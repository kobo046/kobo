const minRating = 0;

const initialRating = 5;

const maxRating = 10;

const baseK = 0.85;

const maxSingleMatchChange = 1.35;

const scoreDiffWeight = 0.035;

const rankingWindowDays = 52 * 7;

const rankingBestDayLimit = 10;

const officialRankingDayMinimum = 3;

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
  const scoreDiffA = (scoreA - scoreB) * scoreDiffWeight;
  const rawChangeA = baseK * marginMultiplier * (actualA - expectedA) + scoreDiffA;
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

function applyMatch(players, match) {
  const result = calculateMatchChange(match.teamAIds, match.teamBIds, match.scoreA, match.scoreB, players);
  const aWins = match.scoreA > match.scoreB;
  const playerChanges = {};

  const nextPlayers = players.map((player) => {
    const isA = match.teamAIds.includes(player.id);
    const isB = match.teamBIds.includes(player.id);
    if (!isA && !isB) return player;

    const change = isA ? result.changeA : result.changeB;
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

  state.matches.forEach((match) => {
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

function rankingPointsForPosition(position) {
  if (position === 1) return 100;
  if (position === 2) return 84;
  if (position <= 4) return 69;
  if (position <= 8) return 54;
  return 35;
}

function rankingReferenceTime(referenceDate) {
  if (typeof referenceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) {
    return Date.parse(`${referenceDate}T00:00:00Z`);
  }
  const date = referenceDate instanceof Date ? referenceDate : new Date();
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function playersForMatches(matches) {
  let players = state.players.map(createStats);
  matches.forEach((match) => {
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

function rankedDayResults(matches) {
  const players = playersForMatches(matches);
  let previousRating = null;
  let previousPosition = 0;

  return players.map((player, index) => {
    const tiedWithPrevious = previousRating !== null && Math.abs(player.rating - previousRating) < 0.000001;
    const position = tiedWithPrevious ? previousPosition : index + 1;
    previousRating = player.rating;
    previousPosition = position;
    return {
      id: player.id,
      position,
      points: rankingPointsForPosition(position),
      dailyRating: player.rating
    };
  });
}

function seasonRankingPlayers(referenceDate) {
  const performancePlayers = recompute();
  const referenceTime = rankingReferenceTime(referenceDate);
  const cutoffTime = referenceTime - rankingWindowDays * 24 * 60 * 60 * 1000;
  const matchesByDate = new Map();

  state.matches.forEach((match) => {
    const matchTime = Date.parse(`${match.date}T00:00:00Z`);
    if (!Number.isFinite(matchTime) || matchTime < cutoffTime || matchTime > referenceTime) return;
    if (!matchesByDate.has(match.date)) matchesByDate.set(match.date, []);
    matchesByDate.get(match.date).push(match);
  });

  const resultsByPlayer = new Map(state.players.map((player) => [player.id, []]));
  matchesByDate.forEach((matches, date) => {
    rankedDayResults(matches).forEach((result) => {
      resultsByPlayer.get(result.id)?.push({ ...result, date });
    });
  });

  return performancePlayers.map((player) => {
    const rankingResults = resultsByPlayer.get(player.id) || [];
    const bestResults = [...rankingResults]
      .sort((a, b) => b.points - a.points || b.dailyRating - a.dailyRating || b.date.localeCompare(a.date))
      .slice(0, rankingBestDayLimit);
    const rankingPoints = bestResults.reduce((sum, result) => sum + result.points, 0);
    return {
      ...player,
      performanceRating: player.rating,
      rating: clamp(initialRating + rankingPoints / 200, initialRating, maxRating),
      rankingPoints,
      rankingDays: rankingResults.length,
      countedRankingDays: bestResults.length,
      rankingFirsts: rankingResults.filter((result) => result.position === 1).length,
      provisional: rankingResults.length < officialRankingDayMinimum,
      rankingResults
    };
  });
}

function performancePlayers() {
  return recompute();
}

function computedPlayers() {
  return seasonRankingPlayers();
}

function winRate(player) {
  const played = player.wins + player.losses;
  return played ? Math.round((player.wins / played) * 100) : 0;
}
