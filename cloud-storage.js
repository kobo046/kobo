window.cloudSync = (() => {
  let client = null;
  let channel = null;
  let reloadTimer = null;
  let saving = false;
  let saveQueue = Promise.resolve();
  const requestTimeoutMs = 7000;

  function config() {
    return window.BADMINTON_SUPABASE_CONFIG || {};
  }

  function isConfigured() {
    const current = config();
    return Boolean(current.url && current.anonKey);
  }

  function hasSupabaseClient() {
    return Boolean(window.supabase && window.supabase.createClient);
  }

  function clubId() {
    return config().clubId || "default";
  }

  function transportLabel() {
    return "REST";
  }

  function getClient() {
    if (!isConfigured() || !hasSupabaseClient()) return null;
    if (!client) {
      const current = config();
      client = window.supabase.createClient(current.url, current.anonKey);
    }
    return client;
  }

  function restBaseUrl() {
    return config().url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  }

  function restHeaders(extra = {}) {
    const key = config().anonKey;
    const token = typeof window.currentAccessToken === "function" ? window.currentAccessToken() : "";
    return {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  async function restRequest(table, params, options = {}) {
    const query = params instanceof URLSearchParams ? params.toString() : "";
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => controller.abort(), requestTimeoutMs)
      : null;

    try {
      const response = await fetch(`${restBaseUrl()}/rest/v1/${table}${query ? `?${query}` : ""}`, {
        ...options,
        signal: controller ? controller.signal : options.signal,
        headers: restHeaders(options.headers || {})
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `${table} request failed (${response.status})`);
      }
      return text ? JSON.parse(text) : null;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("連接 Supabase 逾時，請檢查 Project URL 或網絡。");
      }
      if (error && /Failed to fetch|NetworkError|Load failed/i.test(error.message || "")) {
        throw new Error("無法連接 Supabase Project URL，可能 Project 已暫停、刪除，或網絡阻擋。");
      }
      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function restSelect(table, filters = {}) {
    const params = new URLSearchParams(filters);
    return asArray(await restRequest(table, params, { method: "GET" }));
  }

  async function restUpsert(table, rows, conflictColumns) {
    const params = new URLSearchParams({ on_conflict: conflictColumns });
    return restRequest(table, params, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows)
    });
  }

  async function restUpdate(table, filters, values) {
    const params = new URLSearchParams(filters);
    return restRequest(table, params, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(values)
    });
  }

  async function restDelete(table, filters) {
    const params = new URLSearchParams(filters);
    return restRequest(table, params, { method: "DELETE" });
  }

  function mapPlayer(row) {
    return {
      id: row.id,
      name: row.name,
      gender: row.gender === "女" ? "女" : "男",
      updatedAt: row.updated_at || ""
    };
  }

  function mapMatch(row) {
    return {
      id: row.id,
      date: row.match_date,
      location: row.location || "",
      note: row.note || "",
      teamAIds: [row.team_a_player_1_id, row.team_a_player_2_id],
      teamBIds: [row.team_b_player_1_id, row.team_b_player_2_id],
      scoreA: Number(row.score_a),
      scoreB: Number(row.score_b),
      updatedAt: row.updated_at || row.created_at || ""
    };
  }

  async function throwIfError(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  async function loadStateFromCloud() {
    const supabaseClient = null;
    const currentClubId = clubId();
    if (!supabaseClient) {
      const [players, matches] = await Promise.all([
        restSelect("badminton_players", {
          select: "id,name,gender,is_active,created_at,updated_at",
          club_id: `eq.${currentClubId}`,
          order: "created_at.asc"
        }),
        restSelect("badminton_matches", {
          select: "*",
          club_id: `eq.${currentClubId}`,
          order: "match_date.asc,created_at.asc"
        })
      ]);

      return {
        players: asArray(players).filter((row) => row.is_active).map(mapPlayer),
        matches: asArray(matches).filter((row) => !row.deleted_at).map(mapMatch),
        deletedPlayers: asArray(players).filter((row) => !row.is_active).map((row) => ({ id: row.id, deletedAt: row.updated_at || row.created_at })),
        deletedMatches: asArray(matches).filter((row) => row.deleted_at).map((row) => ({ id: row.id, deletedAt: row.deleted_at || row.updated_at }))
      };
    }

    const [players, matches] = await Promise.all([
      throwIfError(
        supabaseClient
          .from("badminton_players")
          .select("id,name,gender")
          .eq("club_id", currentClubId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
      ),
      throwIfError(
        supabaseClient
          .from("badminton_matches")
          .select("*")
          .eq("club_id", currentClubId)
          .is("deleted_at", null)
          .order("match_date", { ascending: true })
          .order("created_at", { ascending: true })
      )
    ]);

    return {
      players: asArray(players).map(mapPlayer),
      matches: asArray(matches).map(mapMatch)
    };
  }

  async function ensureClub() {
    const supabaseClient = null;
    const now = new Date().toISOString();
    if (!supabaseClient) {
      await restUpsert(
        "badminton_clubs",
        {
          id: clubId(),
          name: "Badminton Club",
          updated_at: now
        },
        "id"
      );
      return;
    }

    await throwIfError(
      supabaseClient.from("badminton_clubs").upsert(
        {
          id: clubId(),
          name: "羽毛球積分群組",
          updated_at: now
        },
        { onConflict: "id" }
      )
    );
  }

  function selectedItems(items, changedIds) {
    if (!Array.isArray(changedIds)) return items;
    const ids = new Set(changedIds.map(String));
    return items.filter((item) => ids.has(String(item.id)));
  }

  async function persistStateToCloud(nextState, options = {}) {
    const supabaseClient = null;
    if (!isConfigured()) return;
    saving = true;
    try {
      const safeState = normalizeState(nextState || {});
      const currentClubId = clubId();
      const now = new Date().toISOString();
      await ensureClub();

      const playerRows = selectedItems(safeState.players, options.changedPlayerIds).map((player) => ({
        club_id: currentClubId,
        id: player.id,
        name: player.name,
        gender: player.gender === "女" ? "女" : "男",
        is_active: true,
        updated_at: player.updatedAt || now
      }));
      if (playerRows.length) {
        if (supabaseClient) {
          await throwIfError(
            supabaseClient.from("badminton_players").upsert(playerRows, { onConflict: "club_id,id" })
          );
        } else {
          await restUpsert("badminton_players", playerRows, "club_id,id");
        }
      }

      const inactivePlayerIds = Array.isArray(options.deletedPlayerIds) ? options.deletedPlayerIds : [];
      if (inactivePlayerIds.length) {
        if (supabaseClient) {
          await throwIfError(
            supabaseClient
              .from("badminton_players")
              .update({ is_active: false, updated_at: now })
              .eq("club_id", currentClubId)
              .in("id", inactivePlayerIds)
          );
        } else {
          await restUpdate(
            "badminton_players",
            { club_id: `eq.${currentClubId}`, id: `in.(${inactivePlayerIds.join(",")})` },
            { is_active: false, updated_at: now }
          );
        }
      }

      const matchRows = selectedItems(safeState.matches, options.changedMatchIds).map((match) => ({
        club_id: currentClubId,
        id: match.id,
        match_date: match.date || new Date().toISOString().slice(0, 10),
        location: match.location || "",
        note: match.note || "",
        team_a_player_1_id: match.teamAIds[0],
        team_a_player_2_id: match.teamAIds[1],
        team_b_player_1_id: match.teamBIds[0],
        team_b_player_2_id: match.teamBIds[1],
        score_a: Number(match.scoreA),
        score_b: Number(match.scoreB),
        deleted_at: null,
        updated_at: match.updatedAt || now
      }));
      if (matchRows.length) {
        if (supabaseClient) {
          await throwIfError(
            supabaseClient.from("badminton_matches").upsert(matchRows, { onConflict: "club_id,id" })
          );
        } else {
          await restUpsert("badminton_matches", matchRows, "club_id,id");
        }
      }

      const deletedMatchIds = Array.isArray(options.deletedMatchIds) ? options.deletedMatchIds : [];
      if (deletedMatchIds.length) {
        if (supabaseClient) {
          await throwIfError(
            supabaseClient
              .from("badminton_matches")
              .update({ deleted_at: now, updated_at: now })
              .eq("club_id", currentClubId)
              .in("id", deletedMatchIds)
          );
        } else {
          await restUpdate(
            "badminton_matches",
            { club_id: `eq.${currentClubId}`, id: `in.(${deletedMatchIds.join(",")})` },
            { deleted_at: now, updated_at: now }
          );
        }
      }
    } finally {
      saving = false;
    }
  }

  function saveStateToCloud(nextState, options = {}) {
    if (!isConfigured()) return Promise.resolve();
    const snapshot = normalizeState(nextState || {});
    const safeOptions = {
      ...options,
      changedPlayerIds: Array.isArray(options.changedPlayerIds) ? [...options.changedPlayerIds] : undefined,
      changedMatchIds: Array.isArray(options.changedMatchIds) ? [...options.changedMatchIds] : undefined,
      deletedPlayerIds: Array.isArray(options.deletedPlayerIds) ? [...options.deletedPlayerIds] : undefined,
      deletedMatchIds: Array.isArray(options.deletedMatchIds) ? [...options.deletedMatchIds] : undefined
    };
    const queuedSave = saveQueue.then(() => persistStateToCloud(snapshot, safeOptions));
    saveQueue = queuedSave.catch(() => {});
    return queuedSave;
  }

  function subscribe(onRemoteState) {
    const supabaseClient = getClient();
    if (!supabaseClient || channel) return;
    const currentClubId = clubId();
    const scheduleReload = () => {
      if (saving) return;
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(async () => {
        try {
          const remoteState = await loadStateFromCloud();
          if (remoteState) onRemoteState(remoteState);
        } catch (error) {
          setStatus(`雲端同步失敗：${error.message}`, true);
        }
      }, 350);
    };

    channel = supabaseClient
      .channel(`badminton-rating-${currentClubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "badminton_players", filter: `club_id=eq.${currentClubId}` },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "badminton_matches", filter: `club_id=eq.${currentClubId}` },
        scheduleReload
      )
      .subscribe();
  }

  async function testConnection() {
    if (!isConfigured()) throw new Error("未設定 Supabase URL 或 publishable key。");
    const cloudState = await loadStateFromCloud();

    return {
      ok: true,
      transport: transportLabel(),
      players: Array.isArray(cloudState.players) ? cloudState.players.length : 0,
      matches: Array.isArray(cloudState.matches) ? cloudState.matches.length : 0
    };
  }

  return {
    isConfigured,
    clubId,
    transportLabel,
    getClient,
    loadStateFromCloud,
    saveStateToCloud,
    testConnection,
    subscribe
  };
})();
