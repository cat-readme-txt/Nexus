import { AUGMENT_BY_ID } from "./augments.js";
import { speciesById, speciesOf } from "./species.js";
import {
  cradles, edgeKey, nexus, nodes, otherSide, sentinels, sideName, SIDES,
  tileLabel, tileName, tiles, vanguards, wallsByEdge,
} from "./board.js";

export const TURN_SECONDS = 180;
export const MAX_TV = 30;
export const STARTING_PROXIES = 3;
export const ACTION_COST = {
  move: 1, spawn: 1, occupy: 3, fire: 1, fabricate: 2, salvage: 2, phase: 2, fortify: 2,
};
const TURN_MS = 1000 * TURN_SECONDS;
const DEPOSITS = nodes.filter(({ node }) => node.type === "deposit").map(({ id }) => id);
const VOID_REINFORCEMENTS = 30;
const CACHE_TILES = [161, 163, 137, 187, 160, 164, 186, 188, 135, 189];
const ACTION_SOUNDS = {
  place: "place", spawn: "deploy", "forward-deploy": "deploy", fabricate: "fabricate",
  salvage: "salvage", fortify: "fortify", fire: "fire", "phase-jump": "phase-jump",
};
const AUGMENT_SOUNDS = { hop: "hop", defensive: "strike", emp: "emp" };
const HIT_STATS = { move: "moveCaptures", fire: "obeliskShots", defensive: "defensiveStrikes" };

export function createGame({ now = Date.now(), passAndPlay = false, selectSpecies = true } = {}) {
  return {
    phase: selectSpecies ? "species" : "setup",
    activeSide: "blue",
    deadline: selectSpecies ? null : now + TURN_MS,
    speciesPicks: selectSpecies ? { blue: null, red: null } : null,
    passAndPlay,
    round: 0,
    turn: 1,
    revision: 0,
    winner: null,
    result: null,
    players: Object.fromEntries(SIDES.map((side) => [
      side, { tv: 0, reserve: 0, turns: 0, placed: 0 },
    ])),
    proxies: {},
    impacts: [],
    soundEvents: [],
    claims: {},
    caches: [],
    forwardDeployments: {},
    stats: { blue: {}, red: {} },
    events: selectSpecies ? [] : ["Blue is placing starting Proxies."],
  };
}

function soundCue(game, cue) {
  const events = game.soundEvents ??= [];
  const revision = game.revision + 1;
  if (events.some((event) => event.revision === revision && event.cue === cue)) return;
  events.push({ revision, cue });
  if (events.length > 24) events.shift();
}

function log(game, text, cue) {
  game.events.push(text);
  if (game.events.length > 18) game.events.shift();
  if (cue) soundCue(game, cue);
}

function record(game, side, key, amount = 1) {
  game.stats ??= { blue: {}, red: {} };
  const stats = game.stats[side];
  stats[key] = (stats[key] ?? 0) + amount;
}

function spend(game, side, cost) {
  game.players[side].tv -= cost;
  if (cost) record(game, side, "tvSpent", cost);
}

function chooseSpecies(game, side, action, now) {
  if (action.type !== "choose-species" || !speciesById.has(action.species) || !SIDES.includes(side)) {
    return "Choose a species to start.";
  }
  if (game.speciesPicks[side]) return "Your species is already locked.";
  if (game.passAndPlay && game.activeSide !== side) return "It is the other player’s choice.";

  game.speciesPicks[side] = action.species;
  soundCue(game, "species");
  if (SIDES.every((player) => game.speciesPicks[player])) {
    game.phase = "setup";
    game.activeSide = "blue";
    game.deadline = game.passAndPlay ? null : now + TURN_MS;
    log(game, "Blue is placing starting Proxies.", game.passAndPlay ? "handoff" : "turn");
  } else if (game.passAndPlay) {
    game.activeSide = otherSide(side);
  }
  game.revision += 1;
  return null;
}

export function proxyReady(game, proxy) {
  return !!proxy && proxy.readyOn <= game.players[proxy.side].turns;
}

export function readyProxy(game, id) {
  return proxyReady(game, game.proxies[id]);
}

export function allProxies(game) {
  return Object.values(game.proxies);
}

export function nodeController(game, id) {
  const claim = game.claims[id];
  return claim?.pending ?? claim?.held ?? tiles.get(id).node.home;
}

function effectOnTurn(game, side, effect) {
  return game.players[otherSide(side)].augments?.[effect] === game.players[side].turns;
}

function shieldsJammed(game, side) {
  return game.players[otherSide(side)].augments?.empRound === game.round;
}

function obeliskDefenseIntact(game, side) {
  return sentinels[side].some((id) => nodeController(game, id) === side);
}

export function baseShieldActive(game, side) {
  return obeliskDefenseIntact(game, side)
    && vanguards[side].some((id) => game.proxies[id]?.side === side && readyProxy(game, id));
}

export function forwardingFrom(game, id) {
  const deployment = game.forwardDeployments?.[id];
  return !!deployment && game.players[deployment.side].turns === deployment.turn;
}

export function shieldSourceActive(game, id) {
  const node = tiles.get(id)?.node;
  if (node?.type === "vanguard") return baseShieldActive(game, node.home);
  if (node?.type === "nexus") return obeliskDefenseIntact(game, node.home);
  if (node?.type !== "aegis" && node?.type !== "sentinel") return false;
  return nodeController(game, id) === node.home && !shieldsJammed(game, node.home) && !forwardingFrom(game, id);
}

export function wallActive(game, wall) {
  return shieldSourceActive(game, wall.source);
}

function shieldBetween(game, side, from, to) {
  const enemy = otherSide(side);
  if ((from === nexus[enemy] || to === nexus[enemy]) && baseShieldActive(game, enemy)) return true;
  return wallsByEdge.get(edgeKey(from, to))?.some((wall) => wall.side === enemy && wallActive(game, wall)) ?? false;
}

function reachableEdge(game, side, from, to) {
  return to !== null && !shieldBetween(game, side, from, to);
}

function mayEnter(side, to) {
  const node = tiles.get(to).node;
  return node?.type !== "vanguard" || node.home === side;
}

function occupiable(game, id, side) {
  const node = tiles.get(id).node;
  return node && (node.type === "deposit" || node.type === "sentinel" || node.type === "aegis")
    && nodeController(game, id) !== side && game.proxies[id]?.side === side && readyProxy(game, id);
}

function addReserve(game, side, count = 1) {
  if (effectOnTurn(game, side, "disablerTurn")) {
    log(game, `${sideName(side)}’s reinforcements were blocked by Troop Disabler.`, "blocked");
    return;
  }
  game.players[side].reserve += count;
}

function claimNode(game, id, side) {
  if (nodeController(game, id) === side) return;
  const node = tiles.get(id).node;
  if (node.type === "deposit") {
    game.claims[id] = { held: game.claims[id]?.held ?? node.home, pending: side };
    addReserve(game, side);
  } else {
    game.claims[id] = { held: side, pending: null };
  }
  record(game, side, "claims");
  log(game, `${sideName(side)} claimed ${tileName(tiles.get(id))} at ${tileLabel(id)}.`, "claim");
}

function transferProxy(game, from, to) {
  const proxy = game.proxies[from];
  delete proxy.fortified;
  delete game.proxies[from];
  game.proxies[to] = proxy;
  if (to === nexus[otherSide(proxy.side)]) finishGame(game, proxy.side, "nexus");
}

export function freeReserve(game, side) {
  return game.players[side].augments?.freeProxies ?? 0;
}

function place(game, id, side, starting) {
  const player = game.players[side];
  game.proxies[id] = { side, readyOn: player.turns + 1 };
  if (starting) player.placed += 1;
  else {
    if (freeReserve(game, side)) player.augments.freeProxies -= 1;
    else player.reserve -= 1;
    record(game, side, "deployed");
  }
}

function finishGame(game, winner, result) {
  game.phase = "finished";
  game.winner = winner;
  game.result = result;
  game.deadline = null;
  log(game, result === "nexus"
    ? `${sideName(winner)} captured the Nexus.`
    : `${sideName(winner)} won by concession.`, "finish");
}

// Previous online matches could store a half-completed move outside the board.
export function restoreLegacyMove(game) {
  const engagement = game.engagement;
  if (!engagement) return false;
  const { from, proxy } = engagement;
  game.proxies[from] = proxy;
  delete game.engagement;
  game.revision += 1;
  log(game, `${sideName(proxy.side)}’s pending move returned to ${tileLabel(from)} after the rules update.`);
  return true;
}

export function concedeGame(game, side) {
  if (game.phase === "finished") return;
  finishGame(game, otherSide(side), "concession");
  game.revision += 1;
}

function nextTurn(game, now) {
  const previous = game.activeSide;
  const outgoing = game.players[previous];
  if (outgoing.augments?.overloadArmed) {
    outgoing.augments.overloadArmed = false;
    outgoing.augments.bankedTV = Math.floor(outgoing.tv / 2);
    log(game, `${sideName(previous)} banked ${outgoing.augments.bankedTV} TV.`);
  }
  outgoing.tv = 0;
  if (game.phase === "setup" && previous === "red") game.phase = "play";

  const side = otherSide(previous);
  game.activeSide = side;
  game.turn += 1;
  game.deadline = game.passAndPlay ? null : now + TURN_MS;
  soundCue(game, game.passAndPlay ? "handoff" : "turn");

  if (game.phase === "setup") {
    log(game, `${sideName(side)} is placing starting Proxies.`);
    return;
  }
  if (side === "blue") {
    game.round += 1;
    if (game.round % 3 === 0) surfaceCache(game);
  }
  const player = game.players[side];
  player.turns += 1;

  for (const { id, node } of nodes) {
    const claim = game.claims[id];
    if (claim?.pending !== side) continue;
    if (node.type !== "deposit" || game.proxies[id]?.side === side) {
      claim.held = side;
      claim.pending = null;
    } else {
      log(game, `${tileName(tiles.get(id))} occupation at ${tileLabel(id)} was denied.`, "blocked");
      if (claim.held === node.home) delete game.claims[id];
      else claim.pending = null;
    }
  }

  let activated = 0;
  for (const [id, proxy] of Object.entries(game.proxies)) {
    if (proxy.side !== side) continue;
    delete proxy.fortified;
    if (readyProxy(game, id)) activated += 1;
  }
  const supplied = speciesOf(game, side) === "directorate" && hasAugmentDeposit(game, side);
  if (supplied) {
    addReserve(game, side);
    record(game, side, "speciesPowers");
  }
  player.tv = Math.min(player.augments?.void ? 20 : MAX_TV, 3 + activated + (supplied ? 3 : 0));
  record(game, side, "tvEarned", player.tv);
  player.tv += player.augments?.bankedTV ?? 0;
  if (player.augments?.bankedTV) player.augments.bankedTV = 0;
  log(game, `${sideName(side)} began its turn with ${player.tv} TV.`);
}

function surfaceCache(game) {
  const caches = game.caches ??= [];
  const first = game.round / 3 - 1;
  for (let i = 0; i < CACHE_TILES.length; i += 1) {
    const tile = CACHE_TILES[(first + i) % CACHE_TILES.length];
    if (caches.includes(tile)) continue;
    caches.push(tile);
    log(game, `A salvage cache surfaced at ${tileLabel(tile)}.`, "cache");
    return;
  }
}

function completeSetup(game) {
  const side = game.activeSide;
  // Take the nearest empty cradle spaces to this side's Nexus on a setup timeout.
  const home = tiles.get(nexus[side]);
  const empty = cradles[side].filter((id) => !game.proxies[id]);
  empty.sort((a, b) => distanceSquared(tiles.get(a), home) - distanceSquared(tiles.get(b), home));
  for (const id of empty.slice(0, STARTING_PROXIES - game.players[side].placed)) {
    place(game, id, side, true);
  }
}

function distanceSquared(a, b) {
  const x = (a.column - b.column) * 1.5;
  const y = a.row - b.row + (b.column % 2 - a.column % 2) / 2;
  return x * x + 3 * y * y;
}

export function advanceClock(game, now = Date.now()) {
  let changed = false;
  while (game.deadline !== null && now >= game.deadline) {
    const expired = game.deadline;
    if (game.phase === "setup") completeSetup(game);
    log(game, `${sideName(game.activeSide)} ran out of time.`, "timeout");
    nextTurn(game, expired);
    game.revision += 1;
    changed = true;
  }
  return changed;
}

export function deploymentCost(game, side, forward = false) {
  if (freeReserve(game, side)) return 0;
  return ACTION_COST.spawn + (!forward && speciesOf(game, side) === "keth" ? 1 : 0);
}

function hasReserve(game, side) {
  return !!(game.players[side].reserve || freeReserve(game, side));
}

export function placementActions(game) {
  if (game.deadline === null || game.phase === "finished") return [];
  const side = game.activeSide;
  const type = game.phase === "setup" ? "place" : "spawn";
  const cost = type === "place" ? 0 : deploymentCost(game, side);
  if (type === "spawn" && (game.players[side].tv < cost || !hasReserve(game, side))) return [];
  return cradles[side].filter((to) => !game.proxies[to]).map((to) => ({ type, to, cost }));
}

export function fabricationError(game, side) {
  const player = game.players[side];
  const activeCount = Object.keys(game.proxies).filter((id) =>
    game.proxies[id].side === side && readyProxy(game, id)).length;
  if (activeCount >= 2) return "Available with fewer than two active Proxies.";
  if (effectOnTurn(game, side, "disablerTurn")) return "Troop Disabler is blocking reinforcements.";
  if (player.tv < ACTION_COST.fabricate) return `You need ${ACTION_COST.fabricate} TV to fabricate.`;
  const turnsLeft = player.lastFabricationTurn === undefined ? 0 : 3 - (player.turns - player.lastFabricationTurn);
  return turnsLeft > 0 ? `Available in ${turnsLeft} ${turnsLeft === 1 ? "turn" : "turns"}.` : null;
}

export function forwardActions(game, from) {
  if (!tiles.has(from) || !activeProxyTurn(game, from)) return [];
  const side = game.activeSide;
  const cost = deploymentCost(game, side, true);
  const tile = tiles.get(from);
  if (tile.node?.type !== "aegis" || nodeController(game, from) !== side || forwardingFrom(game, from)
      || !hasReserve(game, side) || game.players[side].tv < cost) return [];
  return tile.neighbors
    .filter((to) => reachableEdge(game, side, from, to)
      && !game.proxies[to] && to !== nexus[otherSide(side)] && mayEnter(side, to))
    .map((to) => ({ type: "forward-deploy", from, to, cost }));
}

function phaseDestinations(game, from, side) {
  const enemy = otherSide(side);
  const visited = new Set([from]);
  const queue = [[from, 0]];
  const destinations = [];
  for (const [id, distance] of queue) {
    if (distance === 3) continue;
    for (const to of tiles.get(id).neighbors) {
      if (to === null || visited.has(to) || to === nexus[enemy] || !mayEnter(side, to)) continue;
      visited.add(to);
      queue.push([to, distance + 1]);
      if (!game.proxies[to]) destinations.push(to);
    }
  }
  return destinations;
}

function reachableTiles(game, from, side, distance, fire = false) {
  const reached = new Set([from]);
  const destinations = [];
  let front = [from];
  for (let step = 1; step <= distance; step += 1) {
    const next = [];
    for (const current of front) {
      for (const to of tiles.get(current).neighbors) {
        if (reached.has(to) || !reachableEdge(game, side, current, to)) continue;
        const occupied = game.proxies[to];
        const enterable = mayEnter(side, to);
        if (!enterable && !(fire && occupied?.side === otherSide(side))) continue;
        reached.add(to);
        if (occupied?.side !== side) destinations.push({ to, occupied, steps: step });
        if (!occupied) next.push(to);
      }
    }
    front = next;
  }
  return destinations;
}

function activeProxyTurn(game, from) {
  return game.phase === "play" && game.deadline !== null
    && game.proxies[from]?.side === game.activeSide && readyProxy(game, from);
}

function ascensionActive(game, side, tile) {
  return game.players[side].augments?.inventory.ascension === "active" && tile.region !== "turbulence";
}

export function obeliskFireCost(game, side) {
  return ACTION_COST.fire + (speciesOf(game, side) === "directorate" ? 1 : 0);
}

export function canFireFrom(game, from) {
  const node = tiles.get(from)?.node;
  const side = game.activeSide;
  return activeProxyTurn(game, from) && node?.type === "sentinel"
    && node.home === side && nodeController(game, from) === side;
}

export function obeliskRange(game, from) {
  return canFireFrom(game, from) ? reachableTiles(game, from, game.activeSide, 2, true) : [];
}

export function proxyActions(game, from) {
  const side = game.activeSide;
  const player = game.players[side];
  if (!tiles.has(from) || !activeProxyTurn(game, from)) return [];
  const tile = tiles.get(from);
  const species = speciesOf(game, side);
  const ascended = ascensionActive(game, side, tile);
  const captureRange = ascended && player.turns >= 12 ? 2 : 1;
  const moveRange = ascended && player.turns >= 18 ? 2 : 1;
  const canRefund = ascended && player.turns >= 6 && player.ascensionRefundTurn !== player.turns;
  const actions = [];
  const add = (type, to, cost, details) => {
    if (player.tv >= cost) actions.push({ type, from, to, cost, ...details });
  };
  if (player.tv >= ACTION_COST.move) {
    for (const { to, occupied, steps } of reachableTiles(game, from, side, captureRange)) {
      if (steps <= (occupied ? captureRange : moveRange)) {
        add("move", to, ACTION_COST.move, occupied && canRefund ? { refund: ACTION_COST.move } : undefined);
      }
    }
  }
  if (occupiable(game, from, side)) {
    add("occupy", from, tile.node.type === "aegis" ? 0 : ACTION_COST.occupy + (species === "veyari" ? 1 : 0));
  }
  if (game.caches?.includes(from) && !effectOnTurn(game, side, "disablerTurn")) {
    add("salvage", from, ACTION_COST.salvage);
  }
  if (species === "veyari" && player.phaseJumpTurn !== player.turns && tile.region === "turbulence"
      && player.tv >= ACTION_COST.phase) {
    for (const to of phaseDestinations(game, from, side)) add("phase-jump", to, ACTION_COST.phase);
  }
  if (species === "keth" && player.fortificationTurn !== player.turns
      && (tile.node?.type === "aegis" || tile.node?.type === "sentinel")
      && nodeController(game, from) === side) {
    add("fortify", from, ACTION_COST.fortify);
  }
  const fireCost = obeliskFireCost(game, side);
  if (player.tv >= fireCost) {
    for (const { to, occupied } of obeliskRange(game, from)) {
      if (occupied) add("fire", to, fireCost);
    }
  }
  return actions;
}

export function hasAugmentDeposit(game, side) {
  return DEPOSITS.some((id) => game.proxies[id]?.side === side
    && readyProxy(game, id) && nodeController(game, id) === side);
}

export function augmentStatus(game, side, id) {
  const state = game.players[side].augments;
  if (state?.void) return id === "void" ? "active" : "locked";
  return state?.inventory[id] ?? "available";
}

export function augmentBuyError(game, side, id, hasDeposit = hasAugmentDeposit(game, side)) {
  const augment = AUGMENT_BY_ID.get(id);
  if (!augment) return "Choose a valid augment.";
  if (augmentStatus(game, side, id) !== "available") return "This augment is unavailable.";
  if (!hasDeposit) return "Hold a Deposit with an active Proxy to buy augments.";
  if (game.players[side].tv < augment.price) return `You need ${augment.price} TV to buy this augment.`;
  if (id === "void" && effectOnTurn(game, side, "disablerTurn")) return "Troop Disabler is blocking reinforcements.";
  return null;
}

export function augmentEffects(game, side) {
  const state = game.players[side].augments;
  const labels = [];
  if (state?.void) labels.push("Void · 20 TV cap");
  if (state?.inventory.ascension === "active") labels.push("Ascension");
  if (state?.overloadArmed) labels.push("Overload armed");
  if (state?.bankedTV) labels.push(`${state.bankedTV} TV banked`);
  if (shieldsJammed(game, side)) labels.push("Shields jammed");
  if (effectOnTurn(game, side, "disablerTurn") && game.activeSide === side) labels.push("Reinforcements blocked");
  if (effectOnTurn(game, side, "retaliationTurn") && game.activeSide === side) labels.push("Retaliation risk");
  return labels;
}

function buyAugment(game, side, id) {
  const player = game.players[side];
  spend(game, side, AUGMENT_BY_ID.get(id).price);
  const state = player.augments ??= { inventory: {} };
  state.inventory[id] = "ready";
  if (id === "void") {
    record(game, side, "augmentUses");
    player.augments = { inventory: {}, void: true, freeProxies: VOID_REINFORCEMENTS };
    player.tv = Math.min(player.tv, 20);
    for (const to of cradles[side]) {
      if (!game.proxies[to] && freeReserve(game, side)) place(game, to, side, false);
    }
    log(game, `${sideName(side)} invoked The Call of Void and received ${VOID_REINFORCEMENTS} Proxies.`, "void");
  } else {
    log(game, `${sideName(side)} bought ${AUGMENT_BY_ID.get(id).name}.`, "purchase");
  }
}

function consume(game, side, id, status = "used") {
  game.players[side].augments.inventory[id] = status;
  record(game, side, "augmentUses");
  log(game, `${sideName(side)} used ${AUGMENT_BY_ID.get(id).name}.`, AUGMENT_SOUNDS[id] ?? "augment");
}

function activateAugment(game, side, id) {
  const state = game.players[side].augments;
  const nextEnemyTurn = game.players[otherSide(side)].turns + 1;
  switch (id) {
    case "ascension":
      consume(game, side, id, "active");
      return null;
    case "overload": state.overloadArmed = true; break;
    case "emp": state.empRound = game.round; break;
    case "disabler": state.disablerTurn = nextEnemyTurn; break;
    case "retaliation": state.retaliationTurn = nextEnemyTurn; break;
    default: return "Choose targets on the board to use this augment.";
  }
  consume(game, side, id);
  return null;
}

function nextHops(game, side, from, visited) {
  if (from === nexus[otherSide(side)]) return [];
  const destinations = [];
  for (const [direction, mid] of tiles.get(from).neighbors.entries()) {
    if (mid === null || !game.proxies[mid] || visited.has(mid) || !reachableEdge(game, side, from, mid)) continue;
    const to = tiles.get(mid).neighbors[direction];
    if (to !== null && !game.proxies[to] && !visited.has(to)
        && mayEnter(side, to) && reachableEdge(game, side, mid, to)) destinations.push(to);
  }
  return destinations;
}

function hopRoute(game, from, path) {
  const side = game.activeSide;
  if (!tiles.has(from) || !activeProxyTurn(game, from) || augmentStatus(game, side, "hop") !== "ready"
      || game.players[side].tv < ACTION_COST.move || !Array.isArray(path) || path.length >= tiles.size) return null;
  const visited = new Set([from]);
  let current = from;
  for (const to of path) {
    if (!nextHops(game, side, current, visited).includes(to)) return null;
    visited.add(to);
    current = to;
  }
  return { current, visited };
}

export function hopTargets(game, from, path) {
  const route = hopRoute(game, from, path);
  return route ? nextHops(game, game.activeSide, route.current, route.visited) : [];
}

export function defensiveTargets(game, side) {
  return Object.keys(game.proxies).map(Number).filter((id) =>
    game.proxies[id].side !== side && tiles.get(id).region === side);
}

function destroyProxies(game, side, targets, attack) {
  record(game, side, HIT_STATS[attack]);
  const impacts = game.impacts ??= [];
  impacts.push({ revision: game.revision + 1, tiles: [...targets] });
  if (impacts.length > 12) impacts.shift();
  let destroyed = 0;
  for (const to of targets) {
    const proxy = game.proxies[to];
    if (attack !== "move" && proxy.fortified) {
      delete proxy.fortified;
      record(game, proxy.side, "hitsAbsorbed");
      log(game, `Fortification at ${tileLabel(to)} absorbed the hit.`, "blocked");
    } else {
      delete game.proxies[to];
      record(game, proxy.side, "lost");
      destroyed += 1;
    }
  }
  if (destroyed) {
    addReserve(game, side, destroyed);
    record(game, side, "eliminated", destroyed);
  }
  if (attack !== "fire" && effectOnTurn(game, side, "retaliationTurn")) {
    const player = game.players[side];
    const lost = Math.min(player.tv, 5 * targets.length);
    player.tv -= lost;
    log(game, `${sideName(side)} lost ${lost} TV to Deadly Retaliation.`, "retaliation");
  }
  return destroyed;
}

function applyAugment(game, side, action) {
  const { augment, type, from, path, targets } = action;
  if (type === "buy-augment") {
    const error = augmentBuyError(game, side, augment);
    if (error) return error;
    buyAugment(game, side, augment);
    return null;
  }
  if (augmentStatus(game, side, augment) !== "ready") return "You don’t have this augment ready.";
  if (type === "use-augment") return activateAugment(game, side, augment);
  if (type === "hop" && augment === "hop") {
    const route = hopRoute(game, from, path);
    if (!route || !path.length) return "Choose a legal hop route.";
    spend(game, side, ACTION_COST.move);
    consume(game, side, augment);
    log(game, `${sideName(side)} hopped ${tileLabel(from)} to ${tileLabel(route.current)}.`);
    transferProxy(game, from, route.current);
    return null;
  }
  if (type === "defensive-strike" && augment === "defensive") {
    const eligible = defensiveTargets(game, side);
    if (!Array.isArray(targets) || targets.length < 1 || targets.length > 3
        || new Set(targets).size !== targets.length || !targets.every((id) => eligible.includes(id))) {
      return "Choose up to three different enemy Proxies in your territory.";
    }
    consume(game, side, augment);
    const destroyed = destroyProxies(game, side, targets, "defensive");
    log(game, `${sideName(side)} destroyed ${destroyed} ${destroyed === 1 ? "Proxy" : "Proxies"}.`);
    return null;
  }
  return "Choose a valid augment action.";
}

function perform(game, side, { type, from, to, cost, refund }) {
  const player = game.players[side];
  const name = sideName(side);
  spend(game, side, cost);
  if (ACTION_SOUNDS[type]) soundCue(game, ACTION_SOUNDS[type]);
  switch (type) {
    case "place":
    case "spawn":
      place(game, to, side, type === "place");
      log(game, `${name} placed a Proxy at ${tileLabel(to)}.`);
      return;
    case "forward-deploy":
      place(game, to, side, false);
      (game.forwardDeployments ??= {})[from] = { side, turn: player.turns };
      record(game, side, "forwardDeployed");
      log(game, `${name} deployed a Proxy from ${tileLabel(from)} to ${tileLabel(to)}.`);
      return;
    case "fabricate":
      addReserve(game, side);
      player.lastFabricationTurn = player.turns;
      record(game, side, "fabricated");
      log(game, `${name} fabricated a reserve Proxy.`);
      return;
    case "salvage":
      game.caches = game.caches.filter((id) => id !== to);
      addReserve(game, side);
      record(game, side, "salvaged");
      log(game, `${name} recovered a salvage cache at ${tileLabel(to)}.`);
      return;
    case "occupy":
      claimNode(game, to, side);
      return;
    case "fortify":
      game.proxies[from].fortified = true;
      player.fortificationTurn = player.turns;
      record(game, side, "speciesPowers");
      log(game, `${name} fortified the Proxy at ${tileLabel(from)}.`);
      return;
    case "fire": {
      const destroyed = destroyProxies(game, side, [to], "fire");
      log(game, `${name} fired from ${tileLabel(from)} at ${tileLabel(to)}${destroyed ? " and destroyed a Proxy" : ""}.`);
      return;
    }
    case "phase-jump":
      player.phaseJumpTurn = player.turns;
      record(game, side, "speciesPowers");
      log(game, `${name} jumped from ${tileLabel(from)} to ${tileLabel(to)}.`);
      transferProxy(game, from, to);
      return;
    case "move":
      record(game, side, "moveOrders");
      if (game.proxies[to]) {
        if (refund) {
          player.ascensionRefundTurn = player.turns;
          player.tv += refund;
          record(game, side, "tvRefunded", refund);
        }
        destroyProxies(game, side, [to], "move");
        log(game, `${name} captured a Proxy at ${tileLabel(to)}${refund ? " and recovered 1 TV from Ascension" : ""}.`, "capture");
      } else {
        log(game, `${name} moved ${tileLabel(from)} to ${tileLabel(to)}.`, "move");
      }
      transferProxy(game, from, to);
      return;
  }
}

export function applyAction(game, side, action, now = Date.now()) {
  if (advanceClock(game, now)) return "The turn timer expired.";
  if (game.phase === "finished") return "This match is over.";
  if (!action || typeof action !== "object") return "Choose a valid action.";
  if (game.phase === "species") return chooseSpecies(game, side, action, now);
  if (game.activeSide !== side) return "It is the other player's turn.";
  if (action.type === "ready" && game.passAndPlay && game.deadline === null) {
    game.deadline = now + TURN_MS;
    soundCue(game, "turn");
  } else {
    if (game.deadline === null) return "Start your turn first.";
    if (action.type === "end" && game.phase === "play") {
      nextTurn(game, now);
    } else {
      if (action.augment !== undefined) {
        if (game.phase !== "play") return "Augments become available after setup.";
        const error = applyAugment(game, side, action);
        if (error) return error;
      } else if (action.type === "fabricate" && game.phase === "play") {
        const error = fabricationError(game, side);
        if (error) return error;
        perform(game, side, { type: "fabricate", cost: ACTION_COST.fabricate });
      } else {
        let candidates;
        if (action.type === "place" || action.type === "spawn") candidates = placementActions(game);
        else if (action.type === "forward-deploy") candidates = forwardActions(game, action.from);
        else candidates = proxyActions(game, action.from);
        const legal = candidates.find(({ type, from, to }) =>
          type === action.type && from === action.from && to === action.to);
        if (!legal) return "That action is unavailable.";
        perform(game, side, legal);
      }
      if ((game.phase === "setup" && game.players[side].placed === STARTING_PROXIES)
          || (game.phase === "play" && game.players[side].tv === 0
            && !nodes.some(({ id, node }) => node.type === "aegis" && occupiable(game, id, side)))) {
        nextTurn(game, now);
      }
    }
  }
  game.revision += 1;
  return null;
}
