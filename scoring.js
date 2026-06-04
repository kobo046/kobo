const minRating = 0;

const initialRating = 5;

const maxRating = 10;

const baseK = 0.85;

const maxSingleMatchChange = 1.35;

const scoreDiffWeight = 0.035;

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

function computedPlayers() {
  return recompute();
}

function winRate(player) {
  const played = player.wins + player.losses;
  return played ? Math.round((player.wins / played) * 100) : 0;
}
