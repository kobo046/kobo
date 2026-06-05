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
    return Boolean(current.url && current.anonKey && window.supabase && window.supabase.createClient);
  }

  function clubId() {
    return config().clubId || "default";
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!client) {
      const current = config();
      client = window.supabase.createClient(current.url, current.anonKey);
    }
    return client;
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
    const supabaseClient = getClient();
    if (!supabaseClient) return null;
    const currentClubId = clubId();
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
    const supabaseClient = getClient();
    if (!supabaseClient) return;
    const now = new Date().toISOString();
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
    const supabaseClient = getClient();
    if (!supabaseClient || saving) return;
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
        await throwIfError(
          supabaseClient.from("badminton_players").upsert(playerRows, { onConflict: "club_id,id" })
        );
      }

      const existingPlayers = asArray(await throwIfError(
        supabaseClient.from("badminton_players").select("id").eq("club_id", currentClubId).eq("is_active", true)
      ));
      const activePlayerIds = new Set(safeState.players.map((player) => player.id));
      const inactivePlayerIds = existingPlayers.map((player) => player.id).filter((id) => !activePlayerIds.has(id));
      if (inactivePlayerIds.length) {
        await throwIfError(
          supabaseClient
            .from("badminton_players")
            .update({ is_active: false, updated_at: now })
            .eq("club_id", currentClubId)
            .in("id", inactivePlayerIds)
        );
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
        await throwIfError(
          supabaseClient.from("badminton_matches").upsert(matchRows, { onConflict: "club_id,id" })
        );
      }

      const existingMatches = asArray(await throwIfError(
        supabaseClient.from("badminton_matches").select("id").eq("club_id", currentClubId).is("deleted_at", null)
      ));
      const activeMatchIds = new Set(safeState.matches.map((match) => match.id));
      const deletedMatchIds = existingMatches.map((match) => match.id).filter((id) => !activeMatchIds.has(id));
      if (deletedMatchIds.length) {
        await throwIfError(
          supabaseClient
            .from("badminton_matches")
            .update({ deleted_at: now, updated_at: now })
            .eq("club_id", currentClubId)
            .in("id", deletedMatchIds)
        );
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

  return {
    isConfigured,
    clubId,
    loadStateFromCloud,
    saveStateToCloud,
    subscribe
  };
})();
