const minRating = 0;

const initialRating = 5;

const maxRating = 10;

const baseK = 1;

const maxSingleMatchChange = 1.35;

const rankingWindowDays = 52 * 7;

const officialRatingMatchMinimum = 10;

const officialRatingDayMinimum = 3;

const officialRatingOpponentMinimum = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createStats(player) {
  return {
    id: String(player.id),
    name: String(player.name),
    gender: player.gender === "女" ? "女" : "男",
    rating: initialRating,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    recent: "-"
  };
}

function expectedWinRate(teamRating, opponentRating) {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 4));
}

function averageRating(ids, players) {
  const total = ids.reduce((sum, id) => sum + players.find((player) => player.id === id).rating, 0);
  return total / ids.length;
}

function calculateMatchChange(teamAIds, teamBIds, scoreA, scoreB, players) {
  const teamARating = averageRating(teamAIds, players);
  const teamBRating = averageRating(teamBIds, players);
  const expectedA = expectedWinRate(teamARating, teamBRating);
  const actualA = scoreA > scoreB ? 1 : 0;
  const pointDiff = Math.abs(scoreA - scoreB);
  const winnerScore = Math.max(scoreA, scoreB, 1);
  const marginRatio = Math.min(pointDiff / winnerScore, 0.75);
  const marginMultiplier = 1 + marginRatio;
  const outcomeChangeA = baseK * (actualA - expectedA);
  const scoreDiffA = outcomeChangeA * (marginMultiplier - 1);
  const rawChangeA = outcomeChangeA + scoreDiffA;
  const changeA = clamp(rawChangeA, -maxSingleMatchChange, maxSingleMatchChange);

  return {
    actualA,
    expectedA,
    marginMultiplier,
    scoreDiffA,
    changeA,
    changeB: -changeA
  };
}

function ratingLearningMultiplier(player) {
  const played = Number(player.wins || 0) + Number(player.losses || 0);
  if (played < 5) return 1.2;
  if (played < 10) return 1.1;
  if (played < 20) return 1;
  if (played < 40) return 0.9;
  return 0.8;
}

function applyMatch(players, match) {
  const result = calculateMatchChange(match.teamAIds, match.teamBIds, match.scoreA, match.scoreB, players);
  const aWins = match.scoreA > match.scoreB;
  const playerChanges = {};

  const nextPlayers = players.map((player) => {
    const isA = match.teamAIds.includes(player.id);
    const isB = match.teamBIds.includes(player.id);
    if (!isA && !isB) return player;

    const teamChange = isA ? result.changeA : result.changeB;
    const change = clamp(
      teamChange * ratingLearningMultiplier(player),
      -maxSingleMatchChange,
      maxSingleMatchChange
    );
    const pointsFor = isA ? match.scoreA : match.scoreB;
    const pointsAgainst = isA ? match.scoreB : match.scoreA;
    const won = isA ? aWins : !aWins;
    playerChanges[player.id] = change;

    return {
      ...player,
      rating: clamp(player.rating + change, minRating, maxRating),
      wins: player.wins + (won ? 1 : 0),
      losses: player.losses + (won ? 0 : 1),
      pointsFor: player.pointsFor + pointsFor,
      pointsAgainst: player.pointsAgainst + pointsAgainst,
      recent: match.date
    };
  });

  return { players: nextPlayers, result, playerChanges };
}

function recompute() {
  let players = state.players.map(createStats);
  const summaries = [];

  chronologicalMatches(state.matches).forEach((match) => {
    const before = clone(players);
    const applied = applyMatch(players, match);
    players = applied.players;
    summaries.push({
      ...match,
      result: applied.result,
      playerChanges: applied.playerChanges,
      before
    });
  });

  matchSummaries = summaries;
  return players;
}

function rankingReferenceTime(referenceDate) {
  if (typeof referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return Date.parse(`${referenceDate}T00:00:00Z`);
  }
  const date = referenceDate instanceof Date ? referenceDate : new Date();
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function chronologicalMatches(matches) {
  return matches
    .slice()
    .sort(
      (a, b) =>
        String(a.date).localeCompare(String(b.date)) ||
        String(a.id).localeCompare(String(b.id))
    );
}

function playersForMatches(matches) {
  let players = state.players.map(createStats);
  chronologicalMatches(matches).forEach((match) => {
    players = applyMatch(players, match).players;
  });
  return players
    .filter((player) => player.wins + player.losses > 0)
    .sort((a, b) => b.rating - a.rating);
}

function playersForDate(date) {
  if (!date) return [];
  return playersForMatches(state.matches.filter((match) => match.date === date));
}

function skillRankingPlayers(referenceDate) {
  const referenceTime = rankingReferenceTime(referenceDate);
  const cutoffTime = referenceTime - rankingWindowDays * 24 * 60 * 60 * 1000;
  const matches = chronologicalMatches(state.matches).filter((match) => {
    const matchTime = Date.parse(`${match.date}T00:00:00Z`);
    return Number.isFinite(matchTime) && matchTime >= cutoffTime && matchTime <= referenceTime;
  });
  const metrics = new Map(
    state.players.map((player) => [player.id, { days: new Set(), opponents: new Set() }])
  );
  let players = state.players.map(createStats);

  matches.forEach((match) => {
    match.teamAIds.forEach((playerId) => {
      const playerMetrics = metrics.get(playerId);
      playerMetrics?.days.add(match.date);
      match.teamBIds.forEach((opponentId) => playerMetrics?.opponents.add(opponentId));
    });
    match.teamBIds.forEach((playerId) => {
      const playerMetrics = metrics.get(playerId);
      playerMetrics?.days.add(match.date);
      match.teamAIds.forEach((opponentId) => playerMetrics?.opponents.add(opponentId));
    });
    players = applyMatch(players, match).players;
  });

  return players.map((player) => {
    const playerMetrics = metrics.get(player.id);
    const ratingMatches = player.wins + player.losses;
    const ratingDays = playerMetrics?.days.size || 0;
    const ratingOpponents = playerMetrics?.opponents.size || 0;
    return {
      ...player,
      performanceRating: player.rating,
      ratingMatches,
      ratingDays,
      ratingOpponents,
      provisional:
        ratingMatches < officialRatingMatchMinimum ||
        ratingDays < officialRatingDayMinimum ||
        ratingOpponents < officialRatingOpponentMinimum
    };
  });
}

function seasonRankingPlayers(referenceDate) {
  return skillRankingPlayers(referenceDate);
}

function performancePlayers() {
  return recompute();
}

function computedPlayers() {
  return skillRankingPlayers();
}

function winRate(player) {
  const played = player.wins + player.losses;
  return played ? Math.round((player.wins / played) * 100) : 0;
}
