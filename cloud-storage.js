window.cloudSync = (() => {
  let client = null;
  let channel = null;
  let reloadTimer = null;
  let saving = false;

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
    const response = await fetch(`${restBaseUrl()}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      ...options,
      headers: restHeaders(options.headers || {})
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `${table} request failed (${response.status})`);
    }
    return text ? JSON.parse(text) : null;
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
      gender: row.gender === "女" ? "女" : "男"
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
      scoreB: Number(row.score_b)
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
          select: "id,name,gender,created_at",
          club_id: `eq.${currentClubId}`,
          is_active: "eq.true",
          order: "created_at.asc"
        }),
        restSelect("badminton_matches", {
          select: "*",
          club_id: `eq.${currentClubId}`,
          deleted_at: "is.null",
          order: "match_date.asc,created_at.asc"
        })
      ]);

      return {
        players: asArray(players).map(mapPlayer),
        matches: asArray(matches).map(mapMatch)
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

  async function saveStateToCloud(nextState) {
    const supabaseClient = null;
    if (!isConfigured() || saving) return;
    saving = true;
    try {
      const safeState = normalizeState(nextState || {});
      const currentClubId = clubId();
      const now = new Date().toISOString();
      await ensureClub();

      const playerRows = safeState.players.map((player) => ({
        club_id: currentClubId,
        id: player.id,
        name: player.name,
        gender: player.gender === "女" ? "女" : "男",
        is_active: true,
        updated_at: now
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

      const existingPlayers = asArray(
        supabaseClient
          ? await throwIfError(
              supabaseClient.from("badminton_players").select("id").eq("club_id", currentClubId).eq("is_active", true)
            )
          : await restSelect("badminton_players", {
              select: "id",
              club_id: `eq.${currentClubId}`,
              is_active: "eq.true"
            })
      );
      const activePlayerIds = new Set(safeState.players.map((player) => player.id));
      const inactivePlayerIds = existingPlayers.map((player) => player.id).filter((id) => !activePlayerIds.has(id));
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

      const matchRows = safeState.matches.map((match) => ({
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
        updated_at: now
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

      const existingMatches = asArray(
        supabaseClient
          ? await throwIfError(
              supabaseClient.from("badminton_matches").select("id").eq("club_id", currentClubId).is("deleted_at", null)
            )
          : await restSelect("badminton_matches", {
              select: "id",
              club_id: `eq.${currentClubId}`,
              deleted_at: "is.null"
            })
      );
      const activeMatchIds = new Set(safeState.matches.map((match) => match.id));
      const deletedMatchIds = existingMatches.map((match) => match.id).filter((id) => !activeMatchIds.has(id));
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
    const supabaseClient = null;
    const testId = `sync-check-${Date.now()}`;
    const now = new Date().toISOString();
    const row = {
      id: testId,
      name: "Sync check",
      updated_at: now
    };

    if (supabaseClient) {
      await throwIfError(supabaseClient.from("badminton_clubs").upsert(row, { onConflict: "id" }));
      await throwIfError(supabaseClient.from("badminton_clubs").delete().eq("id", testId));
    } else {
      await restUpsert("badminton_clubs", row, "id");
      await restDelete("badminton_clubs", { id: `eq.${testId}` });
    }

    return {
      ok: true,
      transport: transportLabel()
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
