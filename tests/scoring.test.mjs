import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext() {
  const context = {
    console,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("storage.js", "utf8"), context, { filename: "storage.js" });
  vm.runInContext(fs.readFileSync("scoring.js", "utf8"), context, { filename: "scoring.js" });
  return context;
}

function makePlayers(ratings = {}) {
  return [
    { id: "a1", name: "A1", gender: "男", rating: ratings.a1 ?? 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "a2", name: "A2", gender: "男", rating: ratings.a2 ?? 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "b1", name: "B1", gender: "男", rating: ratings.b1 ?? 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" },
    { id: "b2", name: "B2", gender: "男", rating: ratings.b2 ?? 5, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: "-" }
  ];
}

function makeBaseState(matches) {
  return {
    players: makePlayers().map(({ id, name, gender }) => ({ id, name, gender })),
    matches
  };
}

function calculate(context, players, scoreA, scoreB) {
  context.players = players;
  context.scoreA = scoreA;
  context.scoreB = scoreB;
  return vm.runInContext(
    'calculateMatchChange(["a1", "a2"], ["b1", "b2"], scoreA, scoreB, players)',
    context
  );
}

function recomputeWith(context, state) {
  context.state = state;
  context.matchSummaries = [];
  return vm.runInContext("recompute()", context);
}

function seasonWith(context, state, referenceDate) {
  context.state = state;
  context.matchSummaries = [];
  context.referenceDate = referenceDate;
  return vm.runInContext("seasonRankingPlayers(referenceDate)", context);
}

function datedMatch(id, date, scoreA = 21, scoreB = 17) {
  return {
    id,
    date,
    teamAIds: ["a1", "a2"],
    teamBIds: ["b1", "b2"],
    scoreA,
    scoreB
  };
}

function byId(players, id) {
  return players.find((player) => player.id === id);
}

const tests = [
  [
    "A team gains rating and B team loses rating when A wins",
    () => {
      const context = createContext();
      const result = calculate(context, makePlayers(), 21, 17);

      assert.equal(result.actualA, 1);
      assert.ok(result.changeA > 0, `expected A change to be positive, got ${result.changeA}`);
      assert.ok(result.changeB < 0, `expected B change to be negative, got ${result.changeB}`);
      assert.equal(Number((result.changeA + result.changeB).toFixed(10)), 0);
    }
  ],
  [
    "larger score margin creates larger rating movement",
    () => {
      const context = createContext();
      const closeWin = calculate(context, makePlayers(), 21, 20);
      const clearWin = calculate(context, makePlayers(), 21, 8);

      assert.ok(
        Math.abs(clearWin.changeA) > Math.abs(closeWin.changeA),
        `expected 21:8 change ${clearWin.changeA} to exceed 21:20 change ${closeWin.changeA}`
      );
    }
  ],
  [
    "upset correction is larger when a high-rated team loses to a low-rated team",
    () => {
      const context = createContext();
      const sameRatingLoss = calculate(context, makePlayers(), 17, 21);
      const upsetLoss = calculate(context, makePlayers({ a1: 7, a2: 7, b1: 5, b2: 5 }), 17, 21);

      assert.ok(
        Math.abs(upsetLoss.changeA) > Math.abs(sameRatingLoss.changeA),
        `expected upset loss ${upsetLoss.changeA} to exceed normal loss ${sameRatingLoss.changeA}`
      );
    }
  ],
  [
    "single-match rating change is capped by maxSingleMatchChange",
    () => {
      const context = createContext();
      const result = calculate(context, makePlayers({ a1: 10, a2: 10, b1: 0, b2: 0 }), 0, 99);
      const cap = vm.runInContext("maxSingleMatchChange", context);

      assert.ok(Math.abs(result.changeA) <= cap, `expected ${result.changeA} to be capped by ${cap}`);
      assert.ok(Math.abs(result.changeB) <= cap, `expected ${result.changeB} to be capped by ${cap}`);
      assert.equal(Math.abs(result.changeA), cap);
    }
  ],
  [
    "recompute rebuilds standings from the full match history after edit or delete",
    () => {
      const context = createContext();
      const firstMatch = {
        id: "m1",
        date: "2026-01-01",
        teamAIds: ["a1", "a2"],
        teamBIds: ["b1", "b2"],
        scoreA: 21,
        scoreB: 17
      };
      const secondMatch = {
        id: "m2",
        date: "2026-01-02",
        teamAIds: ["a1", "b1"],
        teamBIds: ["a2", "b2"],
        scoreA: 21,
        scoreB: 12
      };

      const original = recomputeWith(context, makeBaseState([firstMatch, secondMatch]));
      const afterDelete = recomputeWith(context, makeBaseState([secondMatch]));
      const recomputedDeleteReference = recomputeWith(context, makeBaseState([secondMatch]));

      assert.notEqual(byId(original, "a1").rating, byId(afterDelete, "a1").rating);
      assert.deepEqual(afterDelete, recomputedDeleteReference);

      const editedFirstMatch = { ...firstMatch, scoreA: 10, scoreB: 21 };
      const afterEdit = recomputeWith(context, makeBaseState([editedFirstMatch, secondMatch]));
      const recomputedEditReference = recomputeWith(context, makeBaseState([editedFirstMatch, secondMatch]));

      assert.notEqual(byId(original, "a1").rating, byId(afterEdit, "a1").rating);
      assert.deepEqual(afterEdit, recomputedEditReference);
    }
  ],
  [
    "equally established teammates receive equal changes",
    () => {
      const context = createContext();
      context.players = makePlayers();
      context.match = datedMatch("m1", "2026-08-01");
      const applied = vm.runInContext("applyMatch(players, match)", context);

      assert.equal(applied.playerChanges.a1, applied.playerChanges.a2);
      assert.equal(applied.playerChanges.b1, applied.playerChanges.b2);
    }
  ],
  [
    "less-established teammate rating moves faster in either direction",
    () => {
      const context = createContext();
      const players = makePlayers();
      Object.assign(byId(players, "a1"), { wins: 10, losses: 10 });
      Object.assign(byId(players, "b1"), { wins: 10, losses: 10 });
      context.players = players;
      context.match = datedMatch("m1", "2026-08-01");
      const applied = vm.runInContext("applyMatch(players, match)", context);

      assert.ok(applied.playerChanges.a2 > applied.playerChanges.a1);
      assert.ok(Math.abs(applied.playerChanges.b2) > Math.abs(applied.playerChanges.b1));
    }
  ],
  [
    "unrelated extra attendance does not increase another player's skill rating",
    () => {
      const context = createContext();
      const basePlayers = ["a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"].map((id) => ({
        id,
        name: id.toUpperCase(),
        gender: "男"
      }));
      const firstMatch = datedMatch("m1", "2026-08-01");
      const unrelated = {
        ...datedMatch("m2", "2026-08-02"),
        teamAIds: ["c1", "c2"],
        teamBIds: ["d1", "d2"]
      };
      const once = seasonWith(context, { players: basePlayers, matches: [firstMatch] }, "2026-08-13");
      const withExtra = seasonWith(context, { players: basePlayers, matches: [firstMatch, unrelated] }, "2026-08-13");

      assert.equal(byId(once, "a1").rating, byId(withExtra, "a1").rating);
    }
  ],
  [
    "rolling skill ranking excludes matches older than 52 weeks",
    () => {
      const context = createContext();
      const matches = [
        datedMatch("old", "2025-08-13"),
        datedMatch("inside", "2025-08-14", 17, 21)
      ];
      const player = byId(seasonWith(context, makeBaseState(matches), "2026-08-13"), "a1");

      assert.equal(player.ratingMatches, 1);
      assert.ok(player.rating < 5);
    }
  ],
  [
    "official skill rating requires matches, days and opponent diversity",
    () => {
      const context = createContext();
      const playerIds = ["a1", "a2", "b1", "b2", "c1", "c2", "d1", "d2"];
      const players = playerIds.map((id) => ({ id, name: id.toUpperCase(), gender: "男" }));
      const opponentPairs = [["b1", "b2"], ["c1", "c2"], ["d1", "b1"]];
      const matches = Array.from({ length: 10 }, (_, index) => ({
        id: `m${index + 1}`,
        date: `2026-08-0${(index % 3) + 1}`,
        teamAIds: ["a1", "a2"],
        teamBIds: opponentPairs[index % opponentPairs.length],
        scoreA: 21,
        scoreB: 17
      }));
      const nineMatches = seasonWith(context, { players, matches: matches.slice(0, 9) }, "2026-08-13");
      const tenMatches = seasonWith(context, { players, matches }, "2026-08-13");

      assert.equal(byId(nineMatches, "a1").provisional, true);
      assert.equal(byId(tenMatches, "a1").ratingMatches, 10);
      assert.equal(byId(tenMatches, "a1").ratingDays, 3);
      assert.equal(byId(tenMatches, "a1").ratingOpponents, 5);
      assert.equal(byId(tenMatches, "a1").provisional, false);
    }
  ],
  [
    "rolling rating is deterministic even when matches arrive in a different order",
    () => {
      const context = createContext();
      const earlier = datedMatch("m1", "2026-08-01");
      const later = {
        ...datedMatch("m2", "2026-08-01", 21, 12),
        teamAIds: ["a1", "b1"],
        teamBIds: ["a2", "b2"]
      };
      const ordered = seasonWith(context, makeBaseState([earlier, later]), "2026-08-13");
      const insertedLater = seasonWith(context, makeBaseState([later, earlier]), "2026-08-13");

      assert.deepEqual(
        ordered.map((player) => [player.id, player.rating]),
        insertedLater.map((player) => [player.id, player.rating])
      );
    }
  ],
  [
    "rolling skill ranking recalculates after an old match is edited or deleted",
    () => {
      const context = createContext();
      const state = makeBaseState([
        datedMatch("m1", "2026-08-01"),
        datedMatch("m2", "2026-08-02", 17, 21)
      ]);
      const before = byId(seasonWith(context, state, "2026-08-13"), "a1").rating;

      state.matches[1] = datedMatch("m2", "2026-08-02", 21, 17);
      const afterEdit = byId(seasonWith(context, state, "2026-08-13"), "a1").rating;

      state.matches.splice(1, 1);
      const afterDelete = byId(seasonWith(context, state, "2026-08-13"), "a1").rating;

      assert.notEqual(before, afterEdit);
      assert.notEqual(afterEdit, afterDelete);
    }
  ],
  [
    "normalizeState keeps location and note backward compatible",
    () => {
      const context = createContext();
      const oldMatch = {
        id: "m1",
        date: "2026-01-01",
        teamAIds: ["a1", "a2"],
        teamBIds: ["b1", "b2"],
        scoreA: 21,
        scoreB: 17
      };
      const newMatch = {
        ...oldMatch,
        id: "m2",
        location: "天水圍體育館",
        note: "排名賽"
      };

      context.inputState = makeBaseState([oldMatch, newMatch]);
      const normalized = vm.runInContext("normalizeState(inputState)", context);

      assert.equal(normalized.matches[0].location, "");
      assert.equal(normalized.matches[0].note, "");
      assert.equal(normalized.matches[1].location, "天水圍體育館");
      assert.equal(normalized.matches[1].note, "排名賽");
    }
  ]
];

let failed = 0;

for (const [name, run] of tests) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
}
