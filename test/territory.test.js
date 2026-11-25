import assert from "node:assert/strict";
import test from "node:test";
import { cradles, nodes, tileLabel, tiles } from "../web/board.js";
import { applyAction, createGame, defensiveTargets, nodeController, shieldSourceActive } from "../web/rules.js";
import { specialHexLinks, territoryMap } from "../web/territory.js";

const now = 10;
const middle = 162; // M7
const frontier = 209; // J9
const blueToMiddle = [94, 117, 140]; // T4, R5, and P6

function scenario() {
  const game = createGame({ now, selectSpecies: false });
  game.phase = "play";
  game.round = 1;
  Object.assign(game.players.blue, { tv: 30, turns: 1 });
  return game;
}

function place(game, id, side = "blue") {
  game.proxies[id] = { side, readyOn: 0 };
}

function act(game, type, from, to = from) {
  assert.equal(applyAction(game, game.activeSide, { type, from, to }, now), null);
}

function power(game, ...ids) {
  for (const id of ids) {
    place(game, id, game.activeSide);
    act(game, "power-shield", id);
  }
}

function occupy(game, ...ids) {
  for (const id of ids) {
    place(game, id, game.activeSide);
    act(game, "occupy", id);
  }
}

test("Turbulence Deposits link to the nearest special hex of each side", () => {
  for (const [id, pair] of [[0, ["B4", "E1"]], [107, ["F6", "J4"]], [middle, ["J9", "P6"]],
    [242, ["P11", "T9"]], [324, ["U13", "X11"]]]) {
    assert.deepEqual(specialHexLinks.get(id).map(tileLabel).sort(), pair);
  }
  for (const { id, node } of nodes) {
    const links = specialHexLinks.get(id);
    assert(links.every((to) => specialHexLinks.get(to).includes(id)));
    if (node.home) assert(links.every((to) => [null, node.home].includes(tiles.get(to).node.home)));
  }
});

test("only Cradles are owned at the start, and an activation by a Cradle seeds linked territory", () => {
  const game = scenario();
  const initial = territoryMap(game);
  assert.equal(initial.size, cradles.blue.length + cradles.red.length);
  for (const [side, ids] of Object.entries(cradles)) {
    assert(ids.every((id) => initial.get(id) === side));
  }

  const [nearCradle, linked] = blueToMiddle;
  power(game, linked);
  assert(shieldSourceActive(game, linked));
  assert(!territoryMap(game).has(linked));
  assert.equal(nodeController(game, linked), "blue");

  power(game, nearCradle);
  const grown = territoryMap(game);
  assert.equal(grown.get(nearCradle), "blue");
  assert.equal(grown.get(linked), "blue");
  assert.equal(grown.get(142), "blue");
});

test("a captured node inside a Cradle changes controller while the Cradle stays with its team", () => {
  const game = scenario();
  const obelisk = 226; // B10 in the Red Cradle
  occupy(game, obelisk);
  power(game, obelisk);
  const regions = territoryMap(game);
  assert.equal(nodeController(game, obelisk), "blue");
  assert(cradles.red.every((id) => regions.get(id) === "red"));
  assert.equal(regions.size, cradles.blue.length + cradles.red.length);
});

test("a frontier capture grows only after a linked Deposit is claimed and loses its region if that link is cut", () => {
  const game = scenario();
  const scout = 163;
  power(game, ...blueToMiddle);
  place(game, middle);
  place(game, frontier);
  place(game, scout, "red");
  act(game, "occupy", frontier);
  assert.equal(nodeController(game, frontier), "blue");
  assert(!territoryMap(game).has(frontier));
  assert(!defensiveTargets(game, "blue").includes(scout));

  act(game, "occupy", middle);
  const regions = territoryMap(game);
  for (const id of [middle, frontier]) {
    assert.equal(regions.get(id), "blue");
    assert(tiles.get(id).neighbors.every((neighbor) => regions.get(neighbor) === "blue"));
  }
  assert(defensiveTargets(game, "blue").includes(scout));
  assert.equal(tiles.get(scout).region, "turbulence");

  act(game, "end");
  act(game, "end");
  assert.equal(game.claims[middle].held, "blue");
  act(game, "end");
  act(game, "move", scout, middle);
  act(game, "occupy", middle);
  assert.equal(nodeController(game, middle), "red");
  assert.equal(nodeController(game, frontier), "blue");
  assert(!territoryMap(game).has(frontier));
});

test("overlapping one-hex rings are Turbulence even if both shields are offline", () => {
  const game = scenario();
  const redAegis = 232; // H10
  game.activeSide = "red";
  game.players.red.tv = 12;
  power(game, 255, redAegis); // F11 and H10
  const shared = tiles.get(frontier).neighbors.filter((id) => tiles.get(redAegis).neighbors.includes(id));
  assert.deepEqual(shared, [208]); // I9
  assert(shared.every((id) => territoryMap(game).get(id) === "red"));

  game.activeSide = "blue";
  power(game, ...blueToMiddle);
  occupy(game, frontier);
  assert(!territoryMap(game).has(frontier));
  assert(shared.every((id) => !territoryMap(game).has(id)));
  occupy(game, middle);
  const grown = territoryMap(game);
  assert.equal(grown.get(frontier), "blue");
  assert.equal(grown.get(207), "red");
  assert(shared.every((id) => !grown.has(id)));

  game.players.blue.augments = { inventory: {}, empRound: game.round };
  assert(!shieldSourceActive(game, frontier));
  assert(!shieldSourceActive(game, redAegis));
  assert.deepEqual(territoryMap(game), grown);
});

test("territory connects to the nearest existing region through gaps beyond the one-hex ring", () => {
  const game = scenario();
  const redObelisk = 130; // F6
  const redAegis = 126; // B6
  const gap = 103; // D5
  power(game, ...blueToMiddle);
  occupy(game, middle, frontier, redObelisk);
  assert(!territoryMap(game).has(gap));
  assert(!tiles.get(redObelisk).neighbors.includes(gap));
  assert(!tiles.get(redAegis).neighbors.includes(gap));
  occupy(game, redAegis);
  assert.equal(territoryMap(game).get(gap), "blue");
});

test("a denied Deposit claim reverts the expansion and leaves the reserve reward", () => {
  const game = scenario();
  power(game, ...blueToMiddle);
  place(game, middle);
  act(game, "occupy", middle);
  assert.equal(territoryMap(game).get(middle), "blue");
  act(game, "move", middle, 163);
  act(game, "end");
  act(game, "end");
  assert(!territoryMap(game).has(middle));
  assert.equal(game.players.blue.reserve, 1);
});

test("growth takes an enclosed pocket without a node and releases it when the boundary reopens", () => {
  const game = scenario();
  const pocket = [128, 153]; // D6 and D7
  const last = 179; // E8
  power(game, ...blueToMiddle);
  occupy(game, middle, frontier, 107, 130, 126, 176);
  assert(pocket.every((id) => !territoryMap(game).has(id)));
  place(game, pocket[0], "red");
  place(game, last);
  act(game, "occupy", last);
  const regions = territoryMap(game);
  assert(pocket.every((id) => regions.get(id) === "blue"));
  assert(defensiveTargets(game, "blue").includes(pocket[0]));

  act(game, "move", last, tiles.get(last).neighbors.find((id) => !game.proxies[id]));
  act(game, "end");
  act(game, "end");
  const reopened = territoryMap(game);
  assert(pocket.every((id) => !reopened.has(id)));
});

test("the board edge can close a pocket, while enclosed special nodes preserve theirs", () => {
  const game = scenario();
  power(game, 173, 223, 273); // X7, X9, and X11 link the eastern edge to the Blue Cradle.
  occupy(game, 324, 320);
  const edge = territoryMap(game);
  for (const id of [297, 322]) assert.equal(edge.get(id), "blue");

  const another = scenario();
  power(another, ...blueToMiddle);
  occupy(another, middle, frontier, 130, 179, 232);
  const nodePocket = territoryMap(another);
  assert(!nodePocket.has(107)); // H5 is an unclaimed Deposit inside the pocket.
  assert(!nodePocket.has(56)); // G3 remains part of that neutral pocket.
});
