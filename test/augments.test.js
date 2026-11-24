import assert from "node:assert/strict";
import test from "node:test";
import { board, cradles, nexus, tiles, vanguards, walls } from "../web/board.js";
import {
  applyAction, augmentStatus, baseShieldActive, createGame, defensiveTargets, freeReserve,
  hopTargets, placementActions, proxyActions, readyProxy, wallActive,
} from "../web/rules.js";

const now = 20;
const deposit = 64;

function scenario(turn = 5) {
  const game = createGame({ now, selectSpecies: false });
  game.phase = "play";
  game.round = turn;
  Object.assign(game.players.blue, { tv: 30, turns: turn });
  game.players.red.turns = turn - 1;
  game.proxies[deposit] = { side: "blue", readyOn: 0 };
  game.claims[deposit] = { held: "blue", pending: null };
  return game;
}

function placeProxy(game, id, side = "blue") {
  game.proxies[id] = { side, readyOn: 0 };
}

function play(game, action) {
  return applyAction(game, game.activeSide, action, now);
}

function buy(game, augment) {
  return play(game, { type: "buy-augment", augment });
}

function use(game, augment) {
  return play(game, { type: "use-augment", augment });
}

function giveTurn(game) {
  assert.equal(play(game, { type: "end" }), null);
}

test("an augment requires a claimed, staffed Deposit at purchase and can be used once later", () => {
  const game = scenario();
  game.claims = {};
  assert.match(buy(game, "emp"), /claimed|Hold a Deposit/);
  game.claims[deposit] = { held: "blue", pending: null };
  game.proxies[deposit].readyOn = game.players.blue.turns + 1;
  assert.match(buy(game, "emp"), /active Proxy/);
  game.proxies[deposit].readyOn = 0;
  assert.equal(buy(game, "emp"), null);
  assert.equal(game.players.blue.tv, 20);
  assert.equal(augmentStatus(game, "blue", "emp"), "ready");
  delete game.proxies[deposit];
  assert.equal(use(game, "emp"), null);
  assert.equal(augmentStatus(game, "blue", "emp"), "used");
  assert.match(use(game, "emp"), /don’t have/);
  assert.match(buy(game, "emp"), /unavailable/);
});

test("buying Hop immediately unlocks repeatable chains for 1 TV each", () => {
  const game = scenario();
  for (const id of [10, 35]) placeProxy(game, id);
  placeProxy(game, 85, "red");
  assert.deepEqual(hopTargets(game, 10), []);
  assert.equal(buy(game, "hop"), null);
  assert.equal(augmentStatus(game, "blue", "hop"), "active");
  assert.deepEqual(hopTargets(game, 10), [60]);
  assert.deepEqual(hopTargets(game, 10, [60]), [110]);
  assert.match(play(game, { type: "hop", augment: "hop", from: 10, path: [60, 85] }), /legal hop/);
  assert.equal(game.players.blue.tv, 25);
  assert.equal(play(game, { type: "hop", augment: "hop", from: 10, path: [60, 110] }), null);
  assert.equal(game.players.blue.tv, 24);
  assert.equal(game.proxies[10], undefined);
  assert.equal(game.proxies[110].side, "blue");
  assert.equal(game.proxies[85].side, "red");
  assert.equal(play(game, { type: "hop", augment: "hop", from: 110, path: [60, 10] }), null);
  assert.equal(game.players.blue.tv, 23);
  assert.equal(game.proxies[10].side, "blue");
  assert.equal(game.stats.blue.augmentUses, 2);
  giveTurn(game);
  giveTurn(game);
  assert.equal(augmentStatus(game, "blue", "hop"), "active");
  assert.deepEqual(hopTargets(game, 10), [60]);
});

test("Hop carries forward from earlier matches and The Call of Void removes it", () => {
  const game = scenario();
  for (const id of [10, 35]) placeProxy(game, id);
  for (const status of ["ready", "used"]) {
    game.players.blue.augments = { inventory: { hop: status } };
    assert.equal(augmentStatus(game, "blue", "hop"), "active");
    assert.deepEqual(hopTargets(game, 10), [60]);
  }
  assert.equal(buy(game, "void"), null);
  assert.equal(augmentStatus(game, "blue", "hop"), "locked");
  assert.deepEqual(hopTargets(game, 10), []);
});

test("Ascension unlocks its tiers using the player's turns and leaves core actions in Turbulence", () => {
  const game = scenario();
  placeProxy(game, 36);
  placeProxy(game, 37, "red");
  assert.equal(buy(game, "ascension"), null);
  assert.equal(use(game, "ascension"), null);
  assert.equal(play(game, { type: "move", from: 36, to: 37 }), null);
  assert.equal(game.players.blue.tv, 19);
  game.players.blue.turns = 6;
  placeProxy(game, 38, "red");
  assert.equal(proxyActions(game, 37).find(({ to }) => to === 38).refund, 1);
  assert.equal(play(game, { type: "move", from: 37, to: 38 }), null);
  assert.equal(game.players.blue.tv, 19);
  assert.equal(game.stats.blue.tvRefunded, 1);
  placeProxy(game, 37, "red");
  assert.equal(proxyActions(game, 38).find(({ to }) => to === 37).refund, undefined);
  assert.equal(play(game, { type: "move", from: 38, to: 37 }), null);
  assert.equal(game.players.blue.tv, 18);
  delete game.proxies[37];
  placeProxy(game, 36);
  placeProxy(game, 38, "red");
  game.players.blue.turns = 11;
  assert(!proxyActions(game, 36).some((a) => a.to === 38));
  game.players.blue.turns = 12;
  const move = proxyActions(game, 36).find((a) => a.to === 38);
  assert.equal(move.type, "move");
  assert.equal(move.cost, 1);
  assert.equal(move.refund, 1);
  assert.equal(play(game, move), null);
  assert.equal(game.proxies[38].side, "blue");
  assert.equal(game.proxies[36], undefined);
  assert(!proxyActions(game, 38).some((a) => a.to === 36));
  game.players.blue.turns = 18;
  assert.equal(proxyActions(game, 38).find((a) => a.to === 36).cost, 1);
  placeProxy(game, 163);
  placeProxy(game, 162, "red");
  assert.equal(tiles.get(163).region, "turbulence");
  const turbulent = proxyActions(game, 163).filter(({ type }) => type === "move");
  assert(turbulent.some(({ to }) => to === 162));
  assert(turbulent.every(({ to, refund }) => !refund && tiles.get(163).neighbors.includes(to)));
});

test("Overload can be saved after a 30 TV purchase and adds banked TV above the recharge cap", () => {
  const game = scenario();
  for (const { id } of board.slice(0, 27)) placeProxy(game, id);
  assert.equal(buy(game, "overload"), null);
  assert.equal(game.activeSide, "red");
  assert.equal(augmentStatus(game, "blue", "overload"), "ready");
  giveTurn(game);
  assert.equal(game.players.blue.tv, 30);
  assert.equal(use(game, "overload"), null);
  game.players.blue.tv -= 1;
  giveTurn(game);
  assert.equal(game.players.blue.augments.bankedTV, 14);
  giveTurn(game);
  assert.equal(game.players.blue.tv, 44);
  assert.equal(game.players.blue.augments.bankedTV, 0);
});

test("the Call of Void fills empty Cradle tiles and banks the rest of the 30 free reinforcements", () => {
  const game = scenario();
  placeProxy(game, cradles.blue[0], "red");
  assert.equal(buy(game, "ascension"), null);
  assert.equal(use(game, "ascension"), null);
  assert.equal(buy(game, "void"), null);
  const fielded = cradles.blue.filter((id) => game.proxies[id].side === "blue");
  assert.equal(fielded.length + freeReserve(game, "blue"), 30);
  assert(fielded.every((id) => !readyProxy(game, id)));
  assert.equal(augmentStatus(game, "blue", "ascension"), "locked");
  assert.equal(augmentStatus(game, "blue", "void"), "active");
  assert.equal(game.proxies[cradles.blue[0]].side, "red");
  const to = fielded[0];
  delete game.proxies[to];
  assert.equal(placementActions(game).find((a) => a.to === to).cost, 0);
  assert.equal(play(game, { type: "spawn", to }), null);
  assert.equal(game.players.blue.tv, 20);
  assert.equal(game.proxies[to].side, "blue");
  giveTurn(game);
  giveTurn(game);
  assert(readyProxy(game, to));
  assert.equal(game.players.blue.tv, 20);
});

test("EMP shuts down enemy Aegis and Obelisk shields for the round and preserves Vanguards", () => {
  const game = scenario();
  const normal = walls.find(({ side, source }) => side === "red" && source !== nexus.red);
  const flank = walls.find(({ source }) => source === nexus.red);
  placeProxy(game, vanguards.red[0], "red");
  assert(wallActive(game, normal));
  assert(wallActive(game, flank));
  assert.equal(buy(game, "emp"), null);
  assert.equal(use(game, "emp"), null);
  assert.equal(wallActive(game, normal), false);
  assert(wallActive(game, flank));
  assert(baseShieldActive(game, "red"));
  giveTurn(game);
  assert.equal(wallActive(game, normal), false);
  giveTurn(game);
  assert(wallActive(game, normal));
});

test("Troop Disabler blocks next-turn rewards and leaves existing reserve available to deploy", () => {
  const game = scenario();
  placeProxy(game, 162, "red");
  placeProxy(game, 163);
  placeProxy(game, 0, "red");
  game.players.red.reserve = 1;
  assert.equal(buy(game, "disabler"), null);
  assert.equal(use(game, "disabler"), null);
  giveTurn(game);
  assert.equal(play(game, { type: "move", from: 162, to: 163 }), null);
  assert.equal(game.players.red.reserve, 1);
  const to = cradles.red[0];
  assert.equal(play(game, { type: "spawn", to }), null);
  assert.equal(game.players.red.reserve, 0);
  assert(!readyProxy(game, to));
  assert.deepEqual(proxyActions(game, to), []);
  giveTurn(game);
  giveTurn(game);
  assert.equal(play(game, { type: "occupy", from: 0, to: 0 }), null);
  assert.equal(game.players.red.reserve, 1);
});

test("Defensive Strike applies once to up to three distinct enemies in the player's region", () => {
  const game = scenario();
  for (const id of [36, 37, 38, 225]) placeProxy(game, id, "red");
  const eligible = defensiveTargets(game, "blue");
  assert.deepEqual(eligible, [36, 37, 38]);
  assert.equal(buy(game, "defensive"), null);
  const action = (targets) => play(game, { type: "defensive-strike", augment: "defensive", targets });
  assert.match(action([36, 36]), /different/);
  assert.match(action([36, 225]), /your territory/);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(action(eligible), null);
  assert(eligible.every((id) => !game.proxies[id]));
  assert.equal(game.proxies[225].side, "red");
  assert.equal(game.players.blue.reserve, 3);
  assert.equal(game.players.blue.tv, 25);
});

test("Deadly Retaliation drains the next opponent to zero without going negative", () => {
  const game = scenario();
  placeProxy(game, 162, "red");
  placeProxy(game, 163);
  assert.equal(buy(game, "retaliation"), null);
  assert.equal(use(game, "retaliation"), null);
  giveTurn(game);
  assert.equal(game.players.red.tv, 4);
  assert.equal(play(game, { type: "move", from: 162, to: 163 }), null);
  assert.equal(game.players.red.tv, 0);
  assert.equal(game.activeSide, "blue");
  assert(game.events.some((entry) => entry.includes("lost 3 TV to Deadly Retaliation")));
  placeProxy(game, 162);
  giveTurn(game);
  assert.equal(play(game, { type: "move", from: 163, to: 162 }), null);
  assert.equal(game.players.red.tv, 3);
});
