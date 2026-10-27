import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createContext(promptValue) {
  const saveCalls = [];
  const statuses = [];
  const activities = [];
  const confirms = [];
  const context = {
    console,
    state: {
      players: [
        { id: "p1", name: "Kobo", gender: "男", updatedAt: "" },
        { id: "p2", name: "Anson", gender: "男", updatedAt: "" }
      ],
      matches: []
    },
    isEditor() {
      return true;
    },
    basePlayer(id) {
      return context.state.players.find((player) => player.id === id);
    },
    prompt() {
      return promptValue;
    },
    confirm(message) {
      confirms.push(message);
      return true;
    },
    async saveState(options) {
      saveCalls.push(options);
      return { cloud: true };
    },
    renderAll() {},
    recordActivity(action, detail) {
      activities.push({ action, detail });
    },
    setStatus(message, isError = false) {
      statuses.push({ message, isError });
    },
    addEventListener() {}
  };
  context.window = context;
  context.saveCalls = saveCalls;
  context.statuses = statuses;
  context.activities = activities;
  context.confirms = confirms;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("events.js", "utf8"), context, { filename: "events.js" });
  return context;
}

const tests = [
  [
    "renaming a player keeps the same id and uploads only that player",
    async () => {
      const context = createContext("Kobo Chan");
      await vm.runInContext('renamePlayer("p1")', context);

      assert.equal(context.state.players[0].id, "p1");
      assert.equal(context.state.players[0].name, "Kobo Chan");
      assert.ok(context.state.players[0].updatedAt);
      assert.deepEqual([...context.saveCalls[0].changedPlayerIds], ["p1"]);
      assert.deepEqual([...context.saveCalls[0].changedMatchIds], []);
      assert.equal(context.activities[0].action, "修改選手姓名");
    }
  ],
  [
    "renaming a player rejects a duplicate name",
    async () => {
      const context = createContext("Anson");
      await vm.runInContext('renamePlayer("p1")', context);

      assert.equal(context.state.players[0].name, "Kobo");
      assert.equal(context.saveCalls.length, 0);
      assert.equal(context.statuses.at(-1).isError, true);
    }
  ],
  [
    "deleting a player with match history is blocked and keeps every match",
    async () => {
      const context = createContext(null);
      context.state.matches = [
        {
          id: "m1",
          teamAIds: ["p1", "p3"],
          teamBIds: ["p2", "p4"],
          scoreA: 21,
          scoreB: 17
        }
      ];
      await vm.runInContext('deletePlayer("p1")', context);

      assert.equal(context.state.players.some((player) => player.id === "p1"), true);
      assert.equal(context.state.matches.length, 1);
      assert.equal(context.saveCalls.length, 0);
      assert.equal(context.confirms.length, 0);
      assert.match(context.statuses.at(-1).message, /不能刪除/);
    }
  ]
];

function installMatchForm(context) {
  const fields = {};
  context.byId = (id) => {
    if (!fields[id]) {
      fields[id] = {
        value: "",
        textContent: "",
        hidden: false,
        classList: { add() {}, remove() {} }
      };
    }
    return fields[id];
  };
  return new Proxy(fields, {
    get(target, prop) {
      return typeof prop === "string" ? context.byId(prop) : target[prop];
    }
  });
}

tests.push(
  [
    "new match date uses the local calendar day",
    async () => {
      const context = createContext(null);
      const morning = new Date(2026, 9, 28, 0, 30);
      context.morning = morning;
      assert.equal(vm.runInContext("localMatchDate(morning)", context), "2026-10-28");
    }
  ],
  [
    "leaving edit mode defaults the next new match to today",
    async () => {
      const context = createContext(null);
      const fields = installMatchForm(context);
      fields.matchDate.value = "2024-01-02";
      context.editingMatchId = "m-old";
      vm.runInContext("clearMatchEditingUi()", context);
      assert.equal(fields.matchDate.value, vm.runInContext("localMatchDate()", context));
      assert.equal(fields.matchDateHint.hidden, false);
      assert.equal(context.editingMatchId, "");
      assert.equal(fields.matchFormTitle.textContent, "新增比賽紀錄");

      fields.matchDate.value = "2024-05-05";
      vm.runInContext("clearMatchEditingUi()", context);
      assert.equal(fields.matchDate.value, "2024-05-05");
    }
  ],
  [
    "editing a match keeps that match date",
    async () => {
      const context = createContext(null);
      const fields = installMatchForm(context);
      fields.matchDate.value = "2026-10-28";
      context.state.matches = [
        {
          id: "m-old",
          date: "2024-01-02",
          teamAIds: ["p1", "p2"],
          teamBIds: ["p3", "p4"],
          scoreA: 21,
          scoreB: 17,
          location: "",
          note: ""
        }
      ];
      context.location = { hash: "" };
      context.renderPreview = () => null;
      vm.runInContext('editMatch("m-old")', context);
      assert.equal(fields.matchDate.value, "2024-01-02");
      assert.equal(fields.matchDateHint.hidden, true);
      assert.equal(fields.matchFormTitle.textContent, "編輯比賽紀錄");
      assert.equal(context.editingMatchId, "m-old");

      context.state.matches[0].date = "";
      vm.runInContext('editMatch("m-old")', context);
      assert.equal(fields.matchDate.value, vm.runInContext("localMatchDate()", context));
    }
  ]
);

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
