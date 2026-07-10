import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext() {
  const values = new Map();
  const context = {
    console,
    localStorage: {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("storage.js", "utf8"), context, { filename: "storage.js" });
  return context;
}

function players(updatedAt = "") {
  return ["a1", "a2", "b1", "b2"].map((id) => ({ id, name: id.toUpperCase(), gender: "男", updatedAt }));
}

function match(id, updatedAt = "") {
  return {
    id,
    date: "2026-07-10",
    location: "",
    note: "",
    teamAIds: ["a1", "a2"],
    teamBIds: ["b1", "b2"],
    scoreA: 21,
    scoreB: 17,
    updatedAt
  };
}

const tests = [
  [
    "cloud reconnect merges local-only and cloud-only matches",
    () => {
      const context = createContext();
      context.localState = { players: players("2026-07-10T10:00:00Z"), matches: [match("local-match")] };
      context.cloudState = { players: players("2026-07-10T09:00:00Z"), matches: [match("cloud-match")] };
      const merged = vm.runInContext("mergeStateData(localState, cloudState)", context);

      assert.deepEqual([...merged.matches.map((item) => item.id)].sort(), ["cloud-match", "local-match"]);
    }
  ],
  [
    "cloud tombstone prevents an intentionally deleted match from returning",
    () => {
      const context = createContext();
      context.localState = {
        players: players("2026-07-10T09:00:00Z"),
        matches: [match("deleted-match", "2026-07-10T09:00:00Z")]
      };
      context.cloudState = {
        players: players("2026-07-10T09:00:00Z"),
        matches: [],
        deletedMatches: [{ id: "deleted-match", deletedAt: "2026-07-10T10:00:00Z" }]
      };
      const merged = vm.runInContext("mergeStateData(localState, cloudState)", context);

      assert.equal(merged.matches.length, 0);
    }
  ],
  [
    "automatic recovery includes the legacy pre-cloud backup and selects the most complete copy",
    () => {
      const context = createContext();
      context.shortState = { players: players(), matches: [match("m1")] };
      context.fullState = { players: players(), matches: [match("m1"), match("m2"), match("m3")] };
      vm.runInContext('createAutomaticBackup("short", shortState)', context);
      vm.runInContext('localStorage.setItem("badmintonPlayerRating.v2.preCloudBackup", JSON.stringify(fullState))', context);
      const backup = vm.runInContext("mostCompleteAutomaticBackup()", context);

      assert.equal(backup.state.matches.length, 3);
      assert.equal(backup.reason, "舊版連線前備份");
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

if (failed > 0) process.exitCode = 1;
