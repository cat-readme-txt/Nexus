import assert from "node:assert/strict";
import test from "node:test";
import { cradles, nodes, tiles, walls } from "../web/board.js";
import {
  applyAction, createGame, fabricationError, forwardActions, nodeController, placementActions,
  proxyActions, readyProxy, wallActive,
} from "../web/rules.js";

const now = 10;

function playing(blue = "directorate", red = "veyari") {
  const game = createGame({ now, selectSpecies: false });
  game.phase = "play";
  game.speciesPicks = { blue, red };
  game.round = 2;
  Object.assign(game.players.blue, { tv: 12, turns: 2 });
  game.players.red.turns = 1;
  return game;
}

function place(game, tile, side = "blue", readyOn = 0) {
  game.proxies[tile] = { side, readyOn };
}

function act(game, action) {
  return applyAction(game, game.activeSide, action, now);
}

function nextBlueTurn(game) {
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(act(game, { type: "end" }), null);
}

test("a wiped-out side can fabricate for 2 TV and deploy using its last TV", () => {
  const game = playing();
  game.players.blue.tv = 3;
  assert.equal(act(game, { type: "fabricate" }), null);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.players.blue.tv, 1);
  const to = cradles.blue[0];
  assert.equal(act(game, { type: "spawn", to }), null);
  assert.equal(game.activeSide, "red");
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(readyProxy(game, to), false);
  assert.deepEqual(game.stats.blue, { tvSpent: 3, fabricated: 1, deployed: 1 });
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(readyProxy(game, to), true);
  assert.match(fabricationError(game, "blue"), /2 turns/);
  nextBlueTurn(game);
  assert.match(fabricationError(game, "blue"), /1 turn/);
  nextBlueTurn(game);
  assert.equal(fabricationError(game, "blue"), null);
  place(game, cradles.blue[1]);
  assert.match(fabricationError(game, "blue"), /fewer than two/);
});

test("a Turbulence cache surfaces on round three and a ready Proxy can recover it once", () => {
  const game = playing();
  assert.deepEqual(game.caches, []);
  nextBlueTurn(game);
  assert.equal(game.caches.length, 1);
  const [from] = game.caches;
  assert.equal(tiles.get(from).region, "turbulence");
  place(game, from, "blue", game.players.blue.turns + 1);
  assert.match(act(game, { type: "salvage", from, to: from }), /unavailable/);
  game.proxies[from].readyOn = 0;
  assert.equal(act(game, { type: "salvage", from, to: from }), null);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.players.blue.tv, 1);
  assert.equal(game.stats.blue.salvaged, 1);
  assert.deepEqual(game.caches, []);
  assert.match(act(game, { type: "salvage", from, to: from }), /unavailable/);
});

test("forward deployment consumes a reserve, protects activation timing, and drops the Aegis shield through the enemy turn", () => {
  const game = playing("keth");
  const { id: from } = nodes.find(({ node }) => node.type === "aegis" && node.home === "blue");
  const shield = walls.find(({ sources }) => sources.length === 1 && sources[0] === from);
  place(game, from);
  game.players.blue.reserve = 2;
  assert(wallActive(game, shield));
  assert.equal(placementActions(game)[0].cost, 2);
  const action = forwardActions(game, from)[0];
  assert.equal(action.cost, 1);
  assert(tiles.get(from).neighbors.includes(action.to));
  assert.match(act(game, { ...action, from: String(from) }), /unavailable/);
  assert.equal(act(game, action), null);
  assert.equal(game.players.blue.reserve, 1);
  assert(!readyProxy(game, action.to));
  assert.equal(game.stats.blue.forwardDeployed, 1);
  assert.equal(wallActive(game, shield), false);
  assert.equal(forwardActions(game, from).length, 0);
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(wallActive(game, shield), false);
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(wallActive(game, shield), true);
  assert(readyProxy(game, action.to));
  assert(forwardActions(game, from).length > 0);
});

test("Directorate supply depends on staffing a controlled Deposit and ordinary Strikes cost extra", () => {
  const game = playing();
  place(game, 162);
  place(game, 163, "red");
  game.claims[162] = { held: "blue", pending: null };
  assert.equal(act(game, { type: "move", from: 162, to: 163 }), null);
  assert.equal(proxyActions(game, 163).find(({ type }) => type === "strike").cost, 3);
  assert.equal(act(game, { type: "withdraw", from: 163, to: 162 }), null);
  nextBlueTurn(game);
  assert.equal(game.players.blue.tv, 7);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.stats.blue.speciesPowers, 1);
  const move = proxyActions(game, 162).find(({ type }) => type === "move");
  assert.equal(act(game, move), null);
  nextBlueTurn(game);
  assert.equal(game.players.blue.tv, 4);
  assert.equal(game.players.blue.reserve, 1);
});

test("Veyari jump ignores ordinary shields once per turn and paid occupation costs 4 TV", () => {
  const game = playing("veyari", "directorate");
  place(game, 53);
  const options = proxyActions(game, 53);
  assert.equal(tiles.get(53).region, "turbulence");
  assert(walls.some(({ from, to, side }) => from === 52 && to === 53 && side === "red"));
  assert(!options.some(({ type, to }) => type === "move" && to === 52));
  const jump = options.find(({ type, to }) => type === "phase-jump" && to === 52);
  assert.equal(jump.cost, 2);
  assert.equal(act(game, jump), null);
  assert.equal(game.proxies[52].side, "blue");
  place(game, 53);
  assert(!proxyActions(game, 53).some(({ type }) => type === "phase-jump"));
  place(game, 162);
  const claim = proxyActions(game, 162).find(({ type }) => type === "occupy");
  assert.equal(claim.cost, 4);
  assert.equal(act(game, claim), null);
  assert.equal(nodeController(game, 162), "blue");
});

test("Keth armor absorbs one hit, denies entry, and lets a follow-up occupy the hex", () => {
  const game = playing("keth", "veyari");
  place(game, 4);
  place(game, 5, "red");
  assert.equal(act(game, { type: "fortify", from: 4, to: 4 }), null);
  assert.equal(game.proxies[4].fortified, true);
  assert.match(act(game, { type: "fortify", from: 4, to: 4 }), /unavailable/);
  assert.equal(act(game, { type: "end" }), null);
  game.players.red.tv = 8;
  const enter = { type: "move", from: 5, to: 4 };
  const strike = { type: "strike", from: 4, to: 4 };
  assert.equal(act(game, enter), null);
  assert.equal(act(game, strike), null);
  assert.equal(game.proxies[5].side, "red");
  assert.equal(game.proxies[4].side, "blue");
  assert.equal(game.players.red.reserve, 0);
  assert.equal(game.stats.blue.hitsAbsorbed, 1);
  assert.equal(act(game, enter), null);
  assert.equal(act(game, strike), null);
  assert.equal(game.proxies[4].side, "red");
  assert.equal(game.proxies[5], undefined);
  assert.equal(game.players.red.reserve, 1);
  assert.equal(game.stats.blue.lost, 1);
});
