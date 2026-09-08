import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console, window: { addEventListener() {} }, localStorage: { getItem() { return null; } } });
for (const file of ["storage.js", "scoring.js", "events.js"]) vm.runInContext(fs.readFileSync(file, "utf8"), context);
const run = (code) => vm.runInContext(code, context);
context.state = { players: ["a", "b", "c", "d", "e"].map((id) => ({ id, name: id, gender: "男" })), matches: [] };
const makeMatch = (id, date, scoreA = 21, scoreB = 17) => ({ id, date, teamAIds: ["a", "b"], teamBIds: ["c", "d"], scoreA, scoreB });

for (const values of [["", 17], [21, ""], [-1, 21], [1.5, 21], ["NaN", 21], [100, 21], [21, 21]]) {
  context.values = values;
  assert.notEqual(run("validateMatchScores(...values)"), "");
}
assert.equal(run("validateMatchScores('21', '0')"), "");
console.log("ok - scores reject blanks, fractions, invalid ranges and ties");

for (const scenario of ["new", "edit", "old", "change-player"]) {
  context.state.matches = [makeMatch("first", "2026-08-01"), makeMatch("second", "2026-08-03", 17, 21)];
  context.candidate = makeMatch(scenario === "new" ? "new" : "first", scenario === "old" ? "2020-01-01" : "2026-08-01", 21, 4);
  if (scenario === "change-player") context.candidate.teamAIds[1] = "e";
  const original = JSON.stringify(context.state);
  const preview = run("previewMatchRatings(candidate, '2026-08-10')");
  assert.equal(JSON.stringify(context.state), original);
  context.state.matches = [...context.state.matches.filter((m) => m.id !== context.candidate.id), context.candidate];
  const actual = run("skillRankingPlayers('2026-08-10')");
  const day = run("playersForDate(candidate.date)");
  for (const row of preview) {
    assert.equal(row.after, actual.find((p) => p.id === row.id).rating);
    assert.equal(row.dayAfter, day.find((p) => p.id === row.id).rating);
  }
}
console.log("ok - preview equals saved total/day rankings for new and edited matches without mutating state");

context.state.matches = [];
context.candidate = makeMatch("cap", "2026-08-01", 21, 0);
const applied = run("applyMatch(state.players.map(p => ({...createStats(p), rating: p.id === 'a' ? 9.99 : 5})), candidate)");
assert.ok(Math.abs(applied.playerChanges.a - 0.01) < 1e-9);
console.log("ok - displayed change respects the actual rating boundary");

context.expected = { ...context.state, matches: [makeMatch("verified", "2026-08-01")] };
context.remote = JSON.parse(JSON.stringify(context.expected));
assert.equal(run("verifyCloudWrite(expected, remote, {changedPlayerIds: [], changedMatchIds: ['verified']})"), true);
context.remote.matches[0].scoreB = 3;
assert.equal(run("verifyCloudWrite(expected, remote, {changedPlayerIds: [], changedMatchIds: ['verified']})"), false);
context.remote.matches[0].id = "other";
assert.equal(run("verifyCloudWrite(expected, remote, {changedPlayerIds: [], changedMatchIds: ['verified']})"), false);
console.log("ok - equal cloud counts do not falsely confirm a different score or record");
