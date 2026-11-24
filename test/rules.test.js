import assert from "node:assert/strict";
import test from "node:test";
import { board, cradles, nexus, nodes, sentinels, tiles, vanguards, walls } from "../web/board.js";
import {
  advanceClock, applyAction, baseShieldActive, createGame, nodeController, placementActions,
  obeliskRange, proxiesAt, proxyActions, readyProxy, TURN_SECONDS, wallActive,
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
  for (const tile of board) {
    for (const neighbor of tile.neighbors.filter((id) => id !== null)) {
      assert(tiles.get(neighbor).neighbors.includes(tile.id));
    }
  }
  for (const wall of walls) {
    assert(tiles.get(wall.from).neighbors.includes(wall.to));
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

test("entering an enemy hex and striking there are separate orders", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  proxy(game, from, "blue");
  proxy(game, to, "red");
  game.players.blue.tv = 2;
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), "That action is unavailable.");
  game.players.blue.tv = 3;
  assert.equal(applyAction(game, "blue", cost("strike", from, to), start), "That action is unavailable.");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(game.players.blue.tv, 2);
  assert.deepEqual(proxiesAt(game, to).map(({ side }) => side), ["red", "blue"]);
  assert.equal(game.players.blue.reserve, 0);
  assert.deepEqual(game.impacts, []);
  assert.match(applyAction(game, "blue", { type: "fabricate" }, start), /contested hex/);
  assert.equal(applyAction(game, "blue", cost("strike", to, to), start), null);
  assert.equal(game.proxies[to].side, "blue");
  assert.equal(game.proxies[from], undefined);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.activeSide, "red");
  assert.equal(game.engagement, null);
  assert.equal(game.stats.blue.moveOrders, 1);
  assert.equal(game.stats.blue.strikeOrders, 1);
  assert.deepEqual(game.impacts, [{ revision: 2, tiles: [to] }]);
});

test("withdrawing or running out of time returns the attacker without a strike", () => {
  const game = playGame();
  const from = 162;
  const to = 163;
  proxy(game, from, "blue");
  proxy(game, to, "red");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(applyAction(game, "blue", cost("withdraw", to, from), start), null);
  assert.equal(game.players.blue.tv, 5);
  assert.equal(game.proxies[from].side, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, to), start), null);
  assert.equal(advanceClock(game, game.deadline), true);
  assert.equal(game.engagement, null);
  assert.equal(game.proxies[from].side, "blue");
  assert.equal(game.proxies[to].side, "red");
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(game.stats.blue.withdrawals, 2);
  assert.deepEqual(game.impacts, []);
});

test("Aegis claims are free and a deposit costs 3 TV even if the claim is later denied", () => {
  const game = playGame();
  const aegis = nodes.find(({ node }) => node.type === "aegis" && node.home === "red");
  const from = aegis.neighbors.find((id) => id !== null);
  proxy(game, from, "blue");
  assert.equal(applyAction(game, "blue", cost("move", from, aegis.id), start), null);
  assert.equal(nodeController(game, aegis.id), "blue");
  assert.equal(game.players.blue.tv, 5);
  const wall = walls.find(({ sources }) => sources.length === 1 && sources[0] === aegis.id);
  assert.equal(wallActive(game, wall), false);

  const deposit = 162;
  proxy(game, deposit, "blue");
  assert.equal(nodeController(game, deposit), null);
  assert.equal(applyAction(game, "blue", cost("occupy", deposit, deposit), start), null);
  assert.equal(game.players.blue.tv, 2);
  assert.equal(game.players.blue.reserve, 1);
  const retreat = proxyActions(game, deposit).find(({ type }) => type === "move");
  assert.equal(applyAction(game, "blue", retreat, start), null);
  assert.equal(applyAction(game, "blue", { type: "end" }, start), null);
  assert.equal(applyAction(game, "red", { type: "end" }, start), null);
  assert.equal(nodeController(game, deposit), null);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(nodeController(game, aegis.id), "blue");
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
  assert.equal(applyAction(game, "blue", cost("move", wall.from, wall.to), start), "That action is unavailable.");

  const target = nexus.red;
  const from = tiles.get(target).neighbors.find((id) => id !== null && tiles.get(id).node?.type !== "vanguard");
  proxy(game, from, "blue");
  proxy(game, vanguards.red[0], "red");
  assert.equal(baseShieldActive(game, "red"), true);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), "That action is unavailable.");
  for (const id of sentinels.red) game.claims[id] = { held: "blue", pending: null };
  assert.equal(baseShieldActive(game, "red"), false);
  assert.equal(applyAction(game, "blue", cost("move", from, target), start), null);
  assert.equal(game.winner, "blue");
  assert.equal(game.phase, "finished");
  assert.equal(game.deadline, null);
});
