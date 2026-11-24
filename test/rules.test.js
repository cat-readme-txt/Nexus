import assert from "node:assert/strict";
import test from "node:test";
import { board, cradles, nexus, nodes, otherSide, sentinels, tiles, vanguards, walls } from "../web/board.js";
import {
  advanceClock, applyAction, baseShieldActive, createGame, nodeController, placementActions,
  obeliskRange, proxyActions, readyProxy, TURN_SECONDS, wallActive,
} from "../web/rules.js";

const cost = (type, from, to) => ({ type, from, to });
const start = 10;
const turnMs = TURN_SECONDS * 1000;

function playGame() {
  const game = createGame({ now: start, selectSpecies: false });
  game.phase = "play";
  game.round = 1;
  game.players.blue.tv = 6;
  game.players.blue.turns = 1;
  return game;
}

function proxy(game, id, side) {
  game.proxies[id] = { side, readyOn: 0 };
}

test("the competition layout preserves playable hexes, nodes, and adjacent shields", () => {
  assert.equal(board.length, 337);
  assert.equal(cradles.blue.length, 23);
  assert.equal(cradles.red.length, 22);
  assert.equal(nodes.filter(({ node }) => node.type === "deposit").length, 9);
  assert.deepEqual([sentinels.blue.length, sentinels.red.length], [8, 8]);
  assert.equal(walls.length, 251);
  const game = createGame({ now: start });
  const center = (id) => {
    const { column, row } = tiles.get(id);
    return [3 * column, 2 * row - column % 2];
  };
  for (const tile of board) {
    for (const neighbor of tile.neighbors.filter((id) => id !== null)) {
      assert(tiles.get(neighbor).neighbors.includes(tile.id));
    }
  }
  for (const wall of walls) {
    assert(tiles.get(wall.from).neighbors.includes(wall.to));
    assert.equal(tiles.get(wall.source).node.home, wall.side);
    assert(wallActive(game, wall));
    const home = center(nexus[wall.side]);
    const enemy = center(nexus[otherSide(wall.side)]);
    const project = (id) => {
      const [x, y] = center(id);
      return x * (enemy[0] - home[0]) + 3 * y * (enemy[1] - home[1]);
    };
    assert(project(wall.from) + project(wall.to) > 2 * project(wall.source));
  }
});

test("a local match hands off setup and gives Blue the first fueled turn", () => {
  const game = createGame({ now: start, passAndPlay: true });
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "keth" }, start), "It is the other player’s choice.");
  assert.equal(applyAction(game, "blue", { type: "choose-species", species: "directorate" }, start), null);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "keth" }, start), null);
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "blue", { type: "ready" }, start), null);
  assert.equal(applyAction(game, "blue", { type: "place", to: cradles.red[0] }, start), "That action is unavailable.");
  for (const to of cradles.blue.slice(0, 3)) assert.equal(applyAction(game, "blue", { type: "place", to }, start), null);
  assert.equal(game.activeSide, "red");
  assert.equal(readyProxy(game, cradles.blue[0]), false);
  assert.equal(game.deadline, null);
  assert.equal(applyAction(game, "red", { type: "ready" }, start + 100), null);
  for (const to of cradles.red.slice(0, 3)) assert.equal(applyAction(game, "red", { type: "place", to }, start + 100), null);
  assert.equal(game.phase, "play");
  assert.equal(game.round, 1);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.blue.tv, 6);
  assert.equal(readyProxy(game, cradles.blue[0]), true);
  assert.equal(readyProxy(game, cradles.red[0]), false);
  assert.equal(game.deadline, null);
  assert.equal(advanceClock(game, start + 2 * turnMs), false);
  assert.equal(applyAction(game, "blue", { type: "ready" }, start + 2 * turnMs), null);
  assert.equal(game.deadline, start + 3 * turnMs);
});

test("timeouts complete setup, expire turns and reject actions at the deadline", () => {
  const game = createGame({ now: start });
  assert.equal(advanceClock(game, start + turnMs), false);
  assert.equal(applyAction(game, "red", { type: "choose-species", species: "veyari" }, start), null);
  assert.equal(applyAction(game, "blue", { type: "choose-species", species: "keth" }, start), null);
  assert.equal(game.deadline, start + 180_000);
  assert.equal(advanceClock(game, start + turnMs), true);
  assert.equal(game.activeSide, "red");
  assert.equal(game.players.blue.placed, 3);
  assert.equal(advanceClock(game, start + 2 * turnMs), true);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.red.placed, 3);
  assert.equal(game.players.blue.tv, 6);
  assert.equal(applyAction(game, "blue", { type: "end" }, start + 3 * turnMs), "The turn timer expired.");
  assert.equal(game.activeSide, "red");
  assert.equal(game.players.blue.tv, 0);
  assert.equal(game.players.red.tv, 6);
});

test("one Move captures an enemy for exactly 1 TV, including a fortified enemy", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  game.speciesPicks = { blue: "directorate", red: "keth" };
  proxy(game, from, "blue");
  proxy(game, to, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), "That action is unavailable.");
  proxy(game, to, "red");
  game.proxies[to].fortified = true;
  game.players.blue.tv = 0;
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), "That action is unavailable.");
  game.players.blue.tv = 1;
  assert.equal(applyAction(game, "blue", cost("strike", from, to), start), "That action is unavailable.");
  assert.equal(applyAction(game, "blue", cost("withdraw", from, to), start), "That action is unavailable.");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(game.proxies[to].side, "blue");
  assert.equal(game.proxies[from], undefined);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.activeSide, "red");
  assert.equal(game.stats.blue.tvSpent, 1);
  assert.equal(game.stats.blue.moveOrders, 1);
  assert.equal(game.stats.blue.moveCaptures, 1);
  assert.equal(game.stats.red.lost, 1);
  assert.equal(game.stats.red.hitsAbsorbed, undefined);
  assert.deepEqual(game.impacts, [{ revision: 1, tiles: [to] }]);
  assert(game.soundEvents.some(({ revision, cue }) => revision === 1 && cue === "capture"));
});

test("a capture persists when the player runs out of time", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  proxy(game, from, "blue");
  proxy(game, to, "red");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(game.players.blue.tv, 5);
  assert.equal(advanceClock(game, game.deadline), true);
  assert.equal(game.activeSide, "red");
  assert.equal(game.proxies[from], undefined);
  assert.equal(game.proxies[to].side, "blue");
  assert.equal(game.players.blue.reserve, 1);
  assert.deepEqual(game.impacts, [{ revision: 1, tiles: [to] }]);
});

test("an Aegis capture shuts down only its forward borders and persists until recapture", () => {
  const game = playGame();
  const aegis = 126; // Red's B6 Aegis.
  const from = 101;
  const outward = walls.filter(({ source }) => source === aegis);
  const homeward = walls.find(({ from, to }) => from === aegis && to === 151);
  assert(outward.length > 0);
  assert.equal(homeward.source, 176);

  proxy(game, from, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, aegis), start), null);
  assert.equal(nodeController(game, aegis), "red");
  assert(outward.every((wall) => wallActive(game, wall)));
  const capture = proxyActions(game, aegis).find(({ type }) => type === "occupy");
  assert.equal(capture.cost, 0);
  assert.equal(applyAction(game, "blue", capture, start), null);
  assert.equal(game.players.blue.tv, 5);
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert(wallActive(game, homeward));
  assert.equal(applyAction(game, "blue", cost("move", aegis, from), start), null);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, aegis), "blue");
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);

  proxy(game, 102, "red");
  assert.equal(applyAction(game, "red", cost("move", 102, aegis), start), null);
  assert(outward.every((wall) => !wallActive(game, wall)));
  assert.equal(applyAction(game, "red", cost("occupy", aegis, aegis), start), null);
  assert.equal(nodeController(game, aegis), "red");
  assert(outward.every((wall) => wallActive(game, wall)));
  assert(wallActive(game, homeward));
});

test("an Aegis can be captured after spending the last TV to enter it", () => {
  const game = playGame();
  game.players.blue.tv = 1;
  proxy(game, 101, "blue");
  assert.equal(applyAction(game, "blue", cost("move", 101, 126), start), null);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.blue.tv, 0);
  assert.equal(applyAction(game, "blue", cost("occupy", 126, 126), start), null);
  assert.equal(nodeController(game, 126), "blue");
  assert.equal(game.activeSide, "red");
});

test("Obelisk occupation has a TV cost and remains captured after departure", () => {
  const game = playGame();
  game.speciesPicks = { blue: "veyari", red: "keth" };
  const obelisk = sentinels.red[0];
  const from = 51;
  const wall = walls.find(({ source }) => source === obelisk);
  proxy(game, from, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, obelisk), start), null);
  assert(wallActive(game, wall));
  assert.equal(applyAction(game, "blue", cost("occupy", obelisk, obelisk), start), null);
  assert.equal(game.players.blue.tv, 1);
  assert.equal(applyAction(game, "blue", cost("move", obelisk, from), start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, obelisk), "blue");
  assert(!wallActive(game, wall));
});

test("a Deposit costs 3 TV and grants a reserve even if the claim is denied", () => {
  const game = playGame();
  const deposit = 162;
  proxy(game, deposit, "blue");
  assert.equal(nodeController(game, deposit), null);
  assert.equal(applyAction(game, "blue", cost("occupy", deposit, deposit), start), null);
  assert.equal(game.players.blue.tv, 3);
  assert.equal(game.players.blue.reserve, 1);
  const retreat = proxyActions(game, deposit).find(({ type }) => type === "move");
  assert.equal(applyAction(game, "blue", retreat, start), null);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, deposit), null);
  assert.equal(game.players.blue.reserve, 1);
});

test("a reserve Proxy deploys only at its own Cradle and powers up next turn", () => {
  const game = playGame();
  game.players.blue.reserve = 1;
  const to = vanguards.blue[0];
  assert(!placementActions(game).some((action) => cradles.red.includes(action.to)));
  assert.equal(applyAction(game, "blue", { type: "spawn", to }, start), null);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(readyProxy(game, to), false);
  assert.equal(baseShieldActive(game, "blue"), false);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(readyProxy(game, to), true);
  assert.equal(game.players.blue.tv, 4);
  assert.equal(baseShieldActive(game, "blue"), true);
});

test("an Obelisk can fire at a reachable enemy up to two steps away without moving", () => {
  const game = playGame();
  const from = sentinels.blue[0];
  const to = 6;
  proxy(game, from, "blue");
  const emptyRange = obeliskRange(game, from);
  assert(emptyRange.some((hex) => hex.to === to && hex.steps === 2 && !hex.occupied));
  assert(!proxyActions(game, from).some(({ type }) => type === "fire"));
  proxy(game, to, "red");
  assert(!tiles.get(from).neighbors.includes(to));
  assert.equal(applyAction(game, "blue", cost("fire", from, to), start), null);
  assert.equal(game.stats.blue.obeliskShots, 1);
  assert.deepEqual(game.impacts[0].tiles, [to]);
  assert.equal(game.proxies[to], undefined);
  assert.equal(game.proxies[from].side, "blue");
  assert.equal(game.players.blue.tv, 5);
});

test("enemy shields block movement and the Nexus is reachable after its Vanguard shield drops", () => {
  const game = playGame();
  const wall = walls.find((edge) => edge.side === "red" && wallActive(game, edge));
  proxy(game, wall.from, "blue");
  proxy(game, wall.to, "red");
  assert.equal(applyAction(game, "blue", cost("move", wall.from, wall.to), start), "That action is unavailable.");
  assert.equal(game.proxies[wall.to].side, "red");

  const target = nexus.red;
  const from = tiles.get(target).neighbors.find((id) => id !== null && tiles.get(id).node?.type !== "vanguard");
  proxy(game, from, "blue");
  proxy(game, target, "red");
  proxy(game, vanguards.red[0], "red");
  assert.equal(baseShieldActive(game, "red"), true);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), "That action is unavailable.");
  for (const id of sentinels.red) game.claims[id] = { held: "blue", pending: null };
  assert.equal(baseShieldActive(game, "red"), false);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), null);
  assert.equal(game.proxies[target].side, "blue");
  assert.equal(game.winner, "blue");
  assert.equal(game.phase, "finished");
  assert.equal(game.deadline, null);
});
