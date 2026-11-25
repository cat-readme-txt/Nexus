import assert from "node:assert/strict";
import test from "node:test";
import { board, cradles, tiles, vanguards, walls } from "../web/board.js";
import {
  applyAction, augmentStatus, baseShieldActive, createGame, defensiveTargets, freeReserve,
  hopTargets, MAX_TV, placementActions, proxyActions, readyProxy, wallActive,
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

test("Hop unlocks repeatable 1 TV chains that capture every enemy jumped on confirmation", () => {
  const game = scenario();
  for (const id of [10, 35, 161]) placeProxy(game, id);
  placeProxy(game, 85, "red");
  game.proxies[85].fortified = true;
  placeProxy(game, 135, "red");
  game.caches = [60];
  assert.deepEqual(hopTargets(game, 10), []);
  assert.equal(buy(game, "hop"), null);
  assert.equal(augmentStatus(game, "blue", "hop"), "active");
  assert.deepEqual(hopTargets(game, 10), [60]);
  assert.deepEqual(hopTargets(game, 10, [60]), [110]);
  assert.deepEqual(hopTargets(game, 10, [60, 110]), [160]);
  assert.match(play(game, { type: "hop", augment: "hop", from: 10, path: [60, 110, 135] }), /legal hop/);
  assert.equal(game.players.blue.tv, 25);
  assert.equal(game.proxies[85].side, "red");
  assert.equal(game.proxies[135].side, "red");
  assert.equal(game.players.blue.reserve, 0);
  assert.deepEqual(game.caches, [60]);
  assert.equal(play(game, { type: "hop", augment: "hop", from: 10, path: [60, 110, 160] }), null);
  assert.equal(game.players.blue.tv, 24);
  assert.equal(game.proxies[10], undefined);
  assert.equal(game.proxies[35].side, "blue");
  assert.equal(game.proxies[160].side, "blue");
  assert.equal(game.proxies[85], undefined);
  assert.equal(game.proxies[135], undefined);
  assert.equal(game.players.blue.reserve, 3);
  assert.deepEqual(game.caches, []);
  assert.equal(game.stats.blue.salvaged, 1);
  assert.equal(game.stats.blue.hopCaptures, 2);
  assert.equal(game.stats.blue.eliminated, 2);
  assert.equal(game.stats.red.lost, 2);
  assert.deepEqual(game.impacts.at(-1).tiles, [85, 135]);
  assert.deepEqual(hopTargets(game, 160), [137]);
  assert.equal(play(game, { type: "hop", augment: "hop", from: 160, path: [137] }), null);
  assert.equal(game.players.blue.tv, 23);
  assert.equal(game.proxies[137].side, "blue");
  assert.equal(game.proxies[161].side, "blue");
  assert.equal(game.stats.blue.hopCaptures, 2);
  assert.equal(game.stats.blue.augmentUses, 2);
  giveTurn(game);
  giveTurn(game);
  assert.equal(augmentStatus(game, "blue", "hop"), "active");
  assert.deepEqual(hopTargets(game, 137), [160]);
});

test("Hop captures trigger retaliation per enemy and respect Troop Disabler", () => {
  const game = scenario();
  placeProxy(game, 60);
  for (const id of [85, 135]) placeProxy(game, id, "red");
  assert.equal(buy(game, "hop"), null);
  game.players.red.augments = { inventory: {}, retaliationTurn: game.players.blue.turns, disablerTurn: game.players.blue.turns };
  assert.equal(play(game, { type: "hop", augment: "hop", from: 60, path: [110, 160] }), null);
  assert.equal(game.players.blue.tv, 20);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(game.stats.blue.hopCaptures, 2);
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
  const [left, center, right] = [45, 46, 47]; // U2, V2, and W2 in the Blue Cradle
  placeProxy(game, left);
  placeProxy(game, center, "red");
  assert.equal(buy(game, "ascension"), null);
  assert.equal(use(game, "ascension"), null);
  assert.equal(play(game, { type: "move", from: left, to: center }), null);
  assert.equal(game.players.blue.tv, 19);
  game.players.blue.turns = 6;
  placeProxy(game, right, "red");
  assert.equal(proxyActions(game, center).find(({ to }) => to === right).refund, 1);
  assert.equal(play(game, { type: "move", from: center, to: right }), null);
  assert.equal(game.players.blue.tv, 19);
  assert.equal(game.stats.blue.tvRefunded, 1);
  placeProxy(game, center, "red");
  assert.equal(proxyActions(game, right).find(({ to }) => to === center).refund, undefined);
  assert.equal(play(game, { type: "move", from: right, to: center }), null);
  assert.equal(game.players.blue.tv, 18);
  delete game.proxies[center];
  placeProxy(game, left);
  placeProxy(game, right, "red");
  game.players.blue.turns = 11;
  assert(!proxyActions(game, left).some((a) => a.to === right));
  game.players.blue.turns = 12;
  const move = proxyActions(game, left).find((a) => a.to === right);
  assert.equal(move.type, "move");
  assert.equal(move.cost, 1);
  assert.equal(move.refund, 1);
  assert.equal(play(game, move), null);
  assert.equal(game.proxies[right].side, "blue");
  assert.equal(game.proxies[left], undefined);
  assert(!proxyActions(game, right).some((a) => a.to === left));
  game.players.blue.turns = 18;
  assert.equal(proxyActions(game, right).find((a) => a.to === left).cost, 1);
  placeProxy(game, 163);
  placeProxy(game, 162, "red");
  assert.equal(tiles.get(163).region, "turbulence");
  const turbulent = proxyActions(game, 163).filter(({ type }) => type === "move");
  assert(turbulent.some(({ to }) => to === 162));
  assert(turbulent.every(({ to, refund }) => !refund && tiles.get(163).neighbors.includes(to)));
});

test("Overload stores half the TV after its 5 TV price, rounded up, and adds it after recharge", () => {
  const game = scenario();
  for (const { id } of board.slice(0, 40)) placeProxy(game, id);
  game.players.blue.tv = MAX_TV;
  assert.equal(buy(game, "overload"), null);
  assert.equal(augmentStatus(game, "blue", "overload"), "used");
  assert.equal(game.players.blue.tv, 17);
  assert.equal(game.players.blue.augments.bankedTV, 18);
  assert.equal(game.stats.blue.tvSpent, 5);
  giveTurn(game);
  giveTurn(game);
  assert.equal(game.players.blue.tv, 58);
  assert.equal(game.stats.blue.tvEarned, 40);
  assert.equal(game.players.blue.augments.bankedTV, 0);

  const low = scenario();
  low.players.blue.tv = 6;
  assert.equal(buy(low, "overload"), null);
  assert.equal(low.players.blue.augments.bankedTV, 1);
  assert.equal(low.players.blue.tv, 0);
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

test("EMP temporarily cuts the outside power required by an activated Vanguard", () => {
  const game = scenario();
  const vanguard = vanguards.red[0];
  const normal = walls.find(({ side, source }) => side === "red" && tiles.get(source).node.type === "sentinel");
  const inward = walls.find(({ source }) => source === vanguard);
  placeProxy(game, vanguard, "red");
  Object.assign(game.activatedShields, { [vanguard]: "red", [normal.source]: "red" });
  assert(wallActive(game, normal));
  assert(wallActive(game, inward));
  assert.equal(buy(game, "emp"), null);
  assert.equal(use(game, "emp"), null);
  assert.equal(wallActive(game, normal), false);
  assert(!wallActive(game, inward));
  assert(!baseShieldActive(game, "red"));
  giveTurn(game);
  assert.equal(wallActive(game, normal), false);
  giveTurn(game);
  assert(wallActive(game, normal));
  assert(wallActive(game, inward));
});

test("Void deploys regular reserve Proxies for zero TV after its initial supply is exhausted", () => {
  const game = scenario();
  game.speciesPicks = { blue: "keth", red: "veyari" };
  assert.equal(buy(game, "void"), null);
  const to = 71; // V3 Obelisk in the Blue Cradle
  delete game.proxies[to];
  Object.assign(game.players.blue, { tv: 1, reserve: 1 });
  game.players.blue.augments.freeProxies = 0;
  const move = proxyActions(game, deposit).find(({ type }) => type === "move");
  assert.equal(play(game, move), null);
  assert.equal(game.activeSide, "blue");
  assert.equal(game.players.blue.tv, 0);
  const deploy = placementActions(game).find((action) => action.to === to);
  assert.equal(deploy.cost, 0);
  assert.equal(play(game, deploy), null);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(game.stats.blue.tvSpent, 1);
  assert.equal(game.proxies[to].side, "blue");
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
  const cradleTargets = [45, 46, 47];
  for (const id of [...cradleTargets, 225]) placeProxy(game, id, "red");
  const eligible = defensiveTargets(game, "blue");
  assert.deepEqual(eligible, cradleTargets);
  assert.equal(buy(game, "defensive"), null);
  const action = (targets) => play(game, { type: "defensive-strike", augment: "defensive", targets });
  assert.match(action([45, 45]), /different/);
  assert.match(action([45, 225]), /your territory/);
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
  game.players.red.tv = 2;
  assert.equal(play(game, { type: "move", from: 162, to: 163 }), null);
  assert.equal(game.players.red.tv, 0);
  assert.equal(game.activeSide, "blue");
  assert(game.events.some((entry) => entry.includes("lost 1 TV to Deadly Retaliation")));
  placeProxy(game, 162);
  giveTurn(game);
  assert.equal(play(game, { type: "move", from: 163, to: 162 }), null);
  assert.equal(game.players.red.tv, 3);
});

test("Deadly Retaliation costs 5 TV and drains at most 10 TV across the opponent's captures", () => {
  const game = scenario();
  placeProxy(game, 36, "red");
  for (let id = 37; id <= 42; id += 1) placeProxy(game, id);
  assert.equal(buy(game, "retaliation"), null);
  assert.equal(game.players.blue.tv, 25);
  assert.equal(use(game, "retaliation"), null);
  giveTurn(game);
  game.players.red.tv = 20;
  for (let to = 37; to <= 42; to += 1) {
    assert.equal(play(game, { type: "move", from: to - 1, to }), null);
    assert.equal(game.players.red.tv, 20 - (to - 36) - Math.min(2 * (to - 36), 10));
  }
});
