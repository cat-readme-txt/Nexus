import assert from "node:assert/strict";
import test from "node:test";
import { board, cradles, nodes, tiles, walls } from "../web/board.js";
import {
  applyAction, createGame, fabricationError, forwardActions, nodeController, nodeOrders, placementActions,
  proxyActions, readyProxy, wallActive,
} from "../web/rules.js";
import { territoryMap } from "../web/territory.js";

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

test("round three adds a pair of caches on opposite sides of the current Turbulence", () => {
  const game = playing();
  game.activatedShields[94] = "blue";
  game.caches = [60];
  place(game, 162);
  nextBlueTurn(game);
  const [existing, west, east] = game.caches;
  assert.equal(game.caches.length, 3);
  assert.equal(existing, 60);
  assert.equal(new Set(game.caches).size, 3);
  assert(tiles.get(west).column <= 12 && tiles.get(east).column > 12);
  const regions = territoryMap(game);
  for (const id of [west, east]) {
    assert(!regions.has(id));
    assert(!game.proxies[id]);
  }
  nextBlueTurn(game);
  assert.equal(game.caches.length, 3);
});

test("cache spawns skip a round when either half has no eligible hex", () => {
  const game = playing();
  const regions = territoryMap(game);
  for (const { id, column } of board) if (column > 12 && !regions.has(id)) place(game, id, "red");
  nextBlueTurn(game);
  assert.deepEqual(game.caches, []);
});

test("moving onto a cache adds one reserve without an extra TV charge", () => {
  const game = playing();
  game.caches = [60];
  place(game, 35);
  assert.equal(act(game, { type: "move", from: 35, to: 60 }), null);
  assert.equal(game.players.blue.reserve, 1);
  assert.equal(game.players.blue.tv, 11);
  assert.equal(game.stats.blue.salvaged, 1);
  assert.deepEqual(game.caches, []);
  assert.equal(act(game, { type: "move", from: 60, to: 35 }), null);
  assert.equal(act(game, { type: "move", from: 35, to: 60 }), null);
  assert.equal(game.players.blue.reserve, 1);
});

test("Troop Disabler leaves a cache in place when a Proxy steps onto it", () => {
  const game = playing();
  game.players.red.augments = { inventory: {}, disablerTurn: game.players.blue.turns };
  game.caches = [60];
  place(game, 35);
  assert.equal(act(game, { type: "move", from: 35, to: 60 }), null);
  assert.equal(game.players.blue.reserve, 0);
  assert.deepEqual(game.caches, [60]);
});

test("forward deployment needs the augment and a powered Aegis, and can repeat in one turn", () => {
  const game = playing("keth");
  const { id: from } = nodes.find(({ node }) => node.type === "aegis" && node.home === "blue");
  const shield = walls.find(({ source }) => source === from);
  place(game, from);
  const forwardOrder = () => nodeOrders(game, from).find(({ type }) => type === "forward-deploy");
  assert.match(forwardOrder().error, /buy the Forward Deployment augment/i);
  assert.deepEqual(forwardActions(game, from), []);
  place(game, 162);
  game.claims[162] = { held: "blue", pending: null };
  assert.equal(act(game, { type: "buy-augment", augment: "forward" }), null);
  assert.equal(game.players.blue.tv, 7);
  assert.match(forwardOrder().error, /must be powered/);
  assert.equal(act(game, { type: "power-shield", from, to: from }), null);
  assert.match(forwardOrder().error, /reserve Proxy/);
  assert.deepEqual(forwardActions(game, from), []);
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
  const repeat = forwardActions(game, from)[0];
  assert.equal(act(game, repeat), null);
  assert.equal(game.players.blue.reserve, 0);
  assert.equal(game.stats.blue.forwardDeployed, 2);
  assert(wallActive(game, shield));
  assert.equal(forwardActions(game, from).length, 0);
  assert.match(forwardOrder().error, /reserve Proxy/);
  assert.equal(act(game, { type: "end" }), null);
  assert(wallActive(game, shield));
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(wallActive(game, shield), true);
  assert(readyProxy(game, action.to));
  assert(readyProxy(game, repeat.to));
});

test("a captured Aegis can be powered for forward deployment, while Obelisks cannot deploy forward", () => {
  const game = playing();
  const from = 126;
  place(game, from);
  game.players.blue.augments = { inventory: { forward: "active" } };
  game.players.blue.reserve = 1;
  assert.deepEqual(forwardActions(game, from), []);
  assert.equal(act(game, { type: "occupy", from, to: from }), null);
  assert.deepEqual(forwardActions(game, from), []);
  assert.equal(act(game, { type: "power-shield", from, to: from }), null);
  assert(forwardActions(game, from).length > 0);
  place(game, 4);
  assert.equal(act(game, { type: "power-shield", from: 4, to: 4 }), null);
  assert.deepEqual(forwardActions(game, 4), []);
});

test("special node orders retain prices and explain why a selected Proxy cannot act", () => {
  const game = playing("veyari");
  game.players.blue.tv = 1;
  place(game, 161);
  place(game, 162);
  const expected = [[161, "phase-jump", 2], [162, "occupy", 4]];
  for (const [from, type, cost] of expected) {
    const order = nodeOrders(game, from).find((order) => order.type === type);
    assert.equal(order.cost, cost);
    assert.match(order.error, new RegExp(`Needs ${cost} TV`));
    assert.deepEqual(order.actions, []);
    assert(!proxyActions(game, from).some((action) => action.type === type));
  }
  place(game, 162, "blue", game.players.blue.turns + 1);
  assert.match(nodeOrders(game, 162)[0].error, /activates at the start/);
  place(game, 162, "red");
  assert.deepEqual(nodeOrders(game, 162), []);
});

test("Directorate supply depends on staffing a controlled Deposit", () => {
  const game = playing();
  place(game, 162);
  game.claims[162] = { held: "blue", pending: null };
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

test("Directorate Obelisk shots cost 2 TV", () => {
  const game = playing();
  place(game, 4);
  place(game, 6, "red");
  game.players.blue.tv = 1;
  const fireOrder = nodeOrders(game, 4).find(({ type }) => type === "fire");
  assert.equal(fireOrder.cost, 2);
  assert.match(fireOrder.error, /Needs 2 TV/);
  const shot = { type: "fire", from: 4, to: 6 };
  assert.match(act(game, shot), /unavailable/);
  game.players.blue.tv = 2;
  assert.equal(act(game, shot), null);
  assert.equal(game.stats.blue.tvSpent, 2);
  assert.equal(game.proxies[6], undefined);
});

test("Directorate Tier III increases recharge and reduces fire cost until the Call of Void", () => {
  const game = playing();
  game.round = 16;
  game.players.blue.turns = 16;
  game.players.blue.augments = { inventory: { ascension: "active" } };
  for (const { id } of board.slice(0, 55)) if (id !== 5) place(game, id); // F1 is the firing lane.
  place(game, 6, "red");
  place(game, 46, "red");
  place(game, 64);
  game.claims[64] = { held: "blue" };

  nextBlueTurn(game);
  assert.equal(game.players.blue.turns, 17);
  assert.equal(game.players.blue.tv, 40);
  assert.equal(nodeOrders(game, 4).find(({ type }) => type === "fire").cost, 2);

  nextBlueTurn(game);
  assert.equal(game.players.blue.turns, 18);
  assert.equal(game.players.blue.tv, 50);
  const capture = () => proxyActions(game, 45).find(({ type, to }) => type === "move" && to === 46);
  assert.equal(capture().refund, 1);
  assert.equal(act(game, { type: "fire", from: 4, to: 6 }), null);
  assert.equal(game.players.blue.tv, 49);

  assert.equal(act(game, { type: "buy-augment", augment: "void" }), null);
  assert.equal(game.players.blue.tv, 59);
  assert.equal(nodeOrders(game, 4).find(({ type }) => type === "fire").cost, 2);
  assert.equal(capture().refund, undefined);
  nextBlueTurn(game);
  assert.equal(game.players.blue.tv, 20);
});

test("Veyari jump ignores ordinary shields once per turn and paid occupation costs 4 TV", () => {
  const game = playing("veyari", "directorate");
  place(game, 53);
  const border = walls.find(({ from, to, side }) => from === 52 && to === 53 && side === "red");
  game.activatedShields[border.source] = "red";
  const options = proxyActions(game, 53);
  assert.equal(tiles.get(53).region, "turbulence");
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

test("Veyari at Tier III can repeat Phase Jump and pay the base occupation cost", () => {
  const game = playing("veyari", "directorate");
  game.round = 18;
  game.players.blue.turns = 18;
  game.players.blue.augments = { inventory: { ascension: "active" } };
  place(game, 53);
  place(game, 162);
  place(game, 76);
  for (const [from, to] of [[53, 52], [52, 53]]) {
    assert.equal(act(game, { type: "phase-jump", from, to }), null);
  }
  assert.equal(game.stats.blue.speciesPowers, 2);
  assert.equal(game.players.blue.tv, 8);
  for (const id of [162, 76]) {
    const claim = proxyActions(game, id).find(({ type }) => type === "occupy");
    assert.equal(claim.cost, 3);
    assert.equal(act(game, claim), null);
  }
  assert.equal(game.players.blue.tv, 2);
});

test("the Call of Void restores the Veyari jump limit and occupation surcharge immediately", () => {
  const game = playing("veyari");
  game.round = 18;
  game.players.blue.turns = 18;
  game.players.blue.augments = { inventory: { ascension: "active" } };
  place(game, 64);
  game.claims[64] = { held: "blue" };
  place(game, 53);
  place(game, 162);
  const jump = { type: "phase-jump", from: 53, to: 52 };
  const returnJump = { type: "phase-jump", from: 52, to: 53 };
  assert.equal(act(game, jump), null);
  assert.equal(act(game, returnJump), null);

  assert.equal(act(game, { type: "buy-augment", augment: "void" }), null);
  assert.match(act(game, jump), /unavailable/);
  const claim = proxyActions(game, 162).find(({ type }) => type === "occupy");
  assert.equal(claim.cost, 4);
  assert.equal(act(game, claim), null);
  nextBlueTurn(game);
  assert.equal(act(game, jump), null);
  assert.match(act(game, returnJump), /unavailable/);
});

test("Keth fortification follows the Proxy and blocks every hit through the opponent's turn", () => {
  const game = playing("keth", "veyari");
  const source = 126; // B6 Aegis
  const target = 101; // B5
  const obelisk = 76; // B4
  game.claims[source] = { held: "blue", pending: null };
  place(game, source);
  place(game, 4); // E1 Obelisk
  place(game, obelisk, "red");
  const fortify = { type: "fortify", from: source, to: source };
  assert.equal(act(game, fortify), null);
  assert.match(nodeOrders(game, 4).find(({ type }) => type === "fortify").error, /already fortified/);
  assert.equal(act(game, { type: "move", from: source, to: target }), null);
  assert.equal(game.proxies[target].fortified, true);

  assert.equal(act(game, { type: "end" }), null);
  assert.match(act(game, { type: "move", from: obelisk, to: target }), /unavailable/);
  const shot = { type: "fire", from: obelisk, to: target };
  assert.equal(act(game, shot), null);
  assert.equal(act(game, shot), null);
  assert.equal(game.proxies[target].fortified, true);
  assert.equal(game.players.red.reserve, 0);
  assert.equal(game.stats.blue.hitsAbsorbed, 2);

  assert.equal(act(game, { type: "end" }), null);
  assert.equal(game.proxies[target].fortified, undefined);
  assert.equal(act(game, { type: "end" }), null);
  assert.equal(act(game, shot), null);
  assert.equal(game.proxies[target], undefined);
  assert.equal(game.players.red.reserve, 1);
  assert.equal(game.stats.blue.lost, 1);
});

test("Keth at Tier III can fortify multiple active Proxies anywhere and deploy at base cost", () => {
  const game = playing("keth");
  game.round = 17;
  game.players.blue.turns = 17;
  game.players.blue.reserve = 1;
  game.players.blue.augments = { inventory: { ascension: "active" } };
  place(game, 53); // ordinary Turbulence hex
  place(game, 76); // Red Obelisk, still controlled by Red
  place(game, 126);
  assert(!nodeOrders(game, 53).some(({ type }) => type === "fortify"));
  assert.match(nodeOrders(game, 76).find(({ type }) => type === "fortify").error, /Take control/);
  assert.equal(placementActions(game)[0].cost, 2);

  nextBlueTurn(game);
  for (const id of [53, 76]) {
    const order = nodeOrders(game, id).find(({ type }) => type === "fortify");
    assert.equal(order.cost, 2);
    assert.equal(act(game, order.actions[0]), null);
    assert.equal(game.proxies[id].fortified, true);
  }
  assert.match(nodeOrders(game, 53).find(({ type }) => type === "fortify").error, /already fortified/);
  assert.equal(game.stats.blue.speciesPowers, 2);
  const deploy = placementActions(game)[0];
  assert.equal(deploy.cost, 1);
  assert.equal(act(game, deploy), null);
  assert.equal(game.players.blue.tv, 1);
});

test("the Call of Void ends Keth fortifications that required Ascension Tier III", () => {
  const game = playing("keth", "keth");
  game.round = 18;
  game.players.blue.turns = 18;
  game.players.blue.augments = { inventory: { ascension: "active" } };
  for (const id of [4, 53, 64, 71]) place(game, id);
  game.claims[64] = { held: "blue" };
  place(game, 76, "red");
  game.proxies[76].fortified = true;
  for (const id of [53, 4, 71]) {
    assert.equal(act(game, { type: "fortify", from: id, to: id }), null);
    assert.equal(game.proxies[id].fortified, true);
  }
  assert.equal(act(game, { type: "move", from: 53, to: 52 }), null);
  assert.equal(game.proxies[52].fortified, true);

  assert.equal(act(game, { type: "buy-augment", augment: "void" }), null);
  assert.equal(game.proxies[4].fortified, true);
  assert.equal(game.proxies[76].fortified, true);
  assert.equal(game.proxies[52].fortified, undefined);
  assert.equal(game.proxies[71].fortified, undefined);
  assert(!nodeOrders(game, 52).some(({ type }) => type === "fortify"));
  assert.match(nodeOrders(game, 71).find(({ type }) => type === "fortify").error, /already fortified a Proxy this turn/);
});
