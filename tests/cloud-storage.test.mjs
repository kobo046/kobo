import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext(requestDelay = 0) {
  const requests = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const context = {
    console,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    BADMINTON_SUPABASE_CONFIG: {
      url: "https://example.supabase.co",
      anonKey: "publishable-test-key",
      clubId: "default"
    },
    normalizeState(value) {
      return {
        players: Array.isArray(value.players) ? value.players.map((item) => ({ ...item })) : [],
        matches: Array.isArray(value.matches)
          ? value.matches.map((item) => ({
              ...item,
              teamAIds: [...item.teamAIds],
              teamBIds: [...item.teamBIds]
            }))
          : []
      };
    },
    async fetch(url, options = {}) {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      requests.push({ url, options });
      if (requestDelay) await new Promise((resolve) => setTimeout(resolve, requestDelay));
      activeRequests -= 1;
      return {
        ok: true,
        async text() {
          return "[]";
        }
      };
    }
  };
  context.window = context;
  context.requests = requests;
  context.maxActiveRequests = () => maxActiveRequests;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("cloud-storage.js", "utf8"), context, { filename: "cloud-storage.js" });
  return context;
}

function state(matchSuffix = "") {
  return {
    players: [
      { id: "p1", name: "P1", gender: "男", updatedAt: "2026-07-25T10:00:00Z" },
      { id: "p2", name: "P2", gender: "女", updatedAt: "2026-07-25T10:00:00Z" }
    ],
    matches: [
      {
        id: `m1${matchSuffix}`,
        date: "2026-07-25",
        location: "",
        note: "",
        teamAIds: ["p1", "p2"],
        teamBIds: ["p3", "p4"],
        scoreA: 21,
        scoreB: 17,
        updatedAt: "2026-07-25T10:00:00Z"
      },
      {
        id: `m2${matchSuffix}`,
        date: "2026-07-25",
        location: "",
        note: "",
        teamAIds: ["p1", "p2"],
        teamBIds: ["p3", "p4"],
        scoreA: 21,
        scoreB: 19,
        updatedAt: "2026-07-25T10:01:00Z"
      }
    ]
  };
}

const tests = [
  [
    "cloud save uploads only explicitly changed records",
    async () => {
      const context = createContext();
      await context.cloudSync.saveStateToCloud(state(), {
        changedPlayerIds: ["p2"],
        changedMatchIds: ["m2"]
      });

      const playerRequest = context.requests.find((request) => request.url.includes("/badminton_players"));
      const matchRequest = context.requests.find((request) => request.url.includes("/badminton_matches"));
      assert.deepEqual(JSON.parse(playerRequest.options.body).map((item) => item.id), ["p2"]);
      assert.deepEqual(JSON.parse(matchRequest.options.body).map((item) => item.id), ["m2"]);
    }
  ],
  [
    "overlapping cloud saves are queued instead of skipped",
    async () => {
      const context = createContext(3);
      await Promise.all([
        context.cloudSync.saveStateToCloud(state("-first"), {
          changedPlayerIds: [],
          changedMatchIds: ["m1-first"]
        }),
        context.cloudSync.saveStateToCloud(state("-second"), {
          changedPlayerIds: [],
          changedMatchIds: ["m1-second"]
        })
      ]);

      const uploadedMatchIds = context.requests
        .filter((request) => request.url.includes("/badminton_matches"))
        .flatMap((request) => JSON.parse(request.options.body).map((item) => item.id));
      assert.deepEqual(uploadedMatchIds, ["m1-first", "m1-second"]);
      assert.equal(context.maxActiveRequests(), 1);
    }
  ]
];

let failed = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) process.exitCode = 1;
