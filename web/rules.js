import { ASCENSION_STAGES, AUGMENT_BY_ID } from "./augments.js";
import { speciesById, speciesOf } from "./species.js";
import { nodeController, shieldActivation, territoryMap } from "./territory.js";
import {
  board, cradles, edgeKey, mirroredWallsBySource, nexus, nexusWalls, nexusWallsByEdge, nodes, otherSide,
  sideName, SIDES, tileLabel, tileName, tiles, wallsByEdge, wallsBySource,
} from "./board.js";

export { nodeController };

export const TURN_SECONDS = 180;
export const MAX_TV = 40;
export const VOID_TV_CAP = 20;
const ASCENDED_DIRECTORATE_TV_CAP = 50;
export const STARTING_PROXIES = 3;
export const ACTION_COST = {
  move: 1, spawn: 1, occupy: 3, fire: 1, vanguardFire: 2, fabricate: 2, phase: 2, fortify: 2, shield: 2,
};
export const RANGED_NODES = {
  sentinel: { label: "Obelisk fire", range: 2, stat: "obeliskShots" },
  vanguard: { label: "Vanguard fire", range: 3, stat: "vanguardShots" },
};
const TURN_MS = 1000 * TURN_SECONDS;
const DEPOSITS = nodes.filter(({ node }) => node.type === "deposit").map(({ id }) => id);
const FIELD_GENERATORS = Object.fromEntries(SIDES.map((side) => [side, nodes
  .filter(({ node }) => node.home === side && isFieldGenerator(node)).map(({ id }) => id)]));
const VOID_REINFORCEMENTS = 30;
const VOID_INVOCATION_TV = 10;
const ACTION_SOUNDS = {
  place: "place", spawn: "deploy", "forward-deploy": "deploy", fabricate: "fabricate",
  fortify: "fortify", fire: "fire", "phase-jump": "phase-jump",
};
const AUGMENT_SOUNDS = { defensive: "strike", emp: "emp" };
const HIT_STATS = { move: "moveCaptures", hop: "hopCaptures", defensive: "defensiveStrikes" };

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
    activatedShields: {},
    caches: [],
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

function effectOnTurn(game, side, effect) {
  return game.players[otherSide(side)].augments?.[effect] === game.players[side].turns;
}

function shieldsJammed(game, side) {
  return game.players[otherSide(side)].augments?.empRound === game.round;
}

function isFieldGenerator(node) {
  return node?.type === "aegis" || node?.type === "sentinel";
}

function fieldShieldController(game, id) {
  const side = shieldActivation(game, id)?.side;
  if (!side || nodeController(game, id) !== side || shieldsJammed(game, side)) return null;
  return side;
}

function hasVanguardSupport(game, side) {
  const enemy = otherSide(side);
  return FIELD_GENERATORS[side].some((id) => game.proxies[id]?.side !== enemy && fieldShieldController(game, id) === side);
}

function staffedVanguard(game, id, side) {
  return shieldActivation(game, id)?.side === side && game.proxies[id]?.side === side && readyProxy(game, id);
}

export function baseShieldActive(game, side) {
  return nexusWalls.every((wall) => wall.side !== side || wallActive(game, wall));
}

export function shieldController(game, id) {
  const node = tiles.get(id)?.node;
  if (node?.type === "vanguard") {
    return staffedVanguard(game, id, node.home) && hasVanguardSupport(game, node.home) ? node.home : null;
  }
  if (isFieldGenerator(node)) return fieldShieldController(game, id);
  return null;
}

export function shieldSourceActive(game, id) {
  return !!shieldController(game, id);
}

export function shieldWallsForSource(game, id) {
  const home = tiles.get(id)?.node?.home;
  if (!home) return [];
  const arcs = nodeController(game, id) === home ? wallsBySource : mirroredWallsBySource;
  return arcs.get(id) ?? [];
}

export function poweredBorder(game, edge) {
  const ring = nexusWallsByEdge.get(edge);
  let powered = ring && shieldController(game, ring.source) === ring.side ? ring : null;
  let earliest = powered ? shieldActivation(game, powered.source).at : Infinity;
  for (const wall of wallsByEdge.get(edge) ?? []) {
    const activation = shieldActivation(game, wall.source);
    if (!activation || activation.at >= earliest || shieldController(game, wall.source) !== wall.side) continue;
    powered = wall;
    earliest = activation.at;
  }
  return powered;
}

export function wallActive(game, wall) {
  const powered = poweredBorder(game, edgeKey(wall.from, wall.to));
  return !!powered && powered.source === wall.source && powered.side === wall.side;
}

function shieldBetween(game, side, from, to) {
  return poweredBorder(game, edgeKey(from, to))?.side === otherSide(side);
}

function reachableEdge(game, side, from, to) {
  return to !== null && !shieldBetween(game, side, from, to);
}

function mayEnter(side, to) {
  const node = tiles.get(to).node;
  return node?.type !== "vanguard" || node.home === side;
}

function addReserve(game, side, count = 1) {
  if (effectOnTurn(game, side, "disablerTurn")) {
    log(game, `${sideName(side)}’s reinforcements were blocked by Troop Disabler.`, "blocked");
    return false;
  }
  game.players[side].reserve += count;
  return true;
}

function collectCache(game, id, side) {
  if (!game.caches?.includes(id) || !addReserve(game, side)) return;
  game.caches = game.caches.filter((tile) => tile !== id);
  record(game, side, "salvaged");
  log(game, `${sideName(side)} recovered a salvage cache at ${tileLabel(id)}.`, "salvage");
}

function claimNode(game, id, side) {
  if (nodeController(game, id) === side) return;
  const node = tiles.get(id).node;
  const at = game.revision + 1;
  if (node.type === "deposit") {
    const previous = game.claims[id];
    game.claims[id] = { held: previous?.held ?? node.home, heldAt: previous?.heldAt, pending: side, pendingAt: at };
    addReserve(game, side);
  } else {
    game.claims[id] = { held: side, heldAt: at, pending: null };
    if (game.activatedShields) delete game.activatedShields[id];
  }
  record(game, side, "claims");
  log(game, `${sideName(side)} claimed ${tileName(tiles.get(id))} at ${tileLabel(id)}.`, "claim");
}

function transferProxy(game, from, to) {
  const proxy = game.proxies[from];
  delete game.proxies[from];
  game.proxies[to] = proxy;
  collectCache(game, to, proxy.side);
  if (to === nexus[otherSide(proxy.side)]) finishGame(game, proxy.side, "nexus");
}

export function freeReserve(game, side) {
  return game.players[side].augments?.freeProxies ?? 0;
}

function place(game, id, side, starting) {
  const player = game.players[side];
  const readyOn = player.augments?.void ? player.turns : player.turns + 1;
  game.proxies[id] = { side, readyOn };
  if (starting) player.placed += 1;
  else {
    if (freeReserve(game, side)) player.augments.freeProxies -= 1;
    else player.reserve -= 1;
    record(game, side, "deployed");
  }
  collectCache(game, id, side);
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
    bankOverload(game, previous);
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
  if (side === "blue") game.round += 1;
  const player = game.players[side];
  player.turns += 1;

  for (const { id, node } of nodes) {
    const claim = game.claims[id];
    if (claim?.pending !== side) continue;
    if (node.type !== "deposit" || game.proxies[id]?.side === side) {
      claim.held = side;
      claim.heldAt = claim.pendingAt;
      claim.pending = null;
    } else {
      log(game, `${tileName(tiles.get(id))} occupation at ${tileLabel(id)} was denied.`, "blocked");
      if (claim.held === node.home) delete game.claims[id];
      else claim.pending = null;
    }
    delete claim.pendingAt;
  }
  if (side === "blue" && game.round % 3 === 0) surfaceCaches(game);

  let activated = 0;
  for (const [id, proxy] of Object.entries(game.proxies)) {
    if (proxy.side !== side) continue;
    delete proxy.fortified;
    delete proxy.ascensionFortification;
    if (readyProxy(game, id)) activated += 1;
  }
  const directorate = speciesOf(game, side) === "directorate";
  const supplied = directorate && hasAugmentDeposit(game, side);
  if (supplied) {
    addReserve(game, side);
    record(game, side, "speciesPowers");
  }
  const rechargeCap = player.augments?.void ? VOID_TV_CAP
    : directorate && hasFinalAscension(game, side) ? ASCENDED_DIRECTORATE_TV_CAP : MAX_TV;
  player.tv = Math.min(rechargeCap, 3 + activated + (supplied ? 3 : 0));
  record(game, side, "tvEarned", player.tv);
  player.tv += player.augments?.bankedTV ?? 0;
  if (player.augments?.bankedTV) player.augments.bankedTV = 0;
  log(game, `${sideName(side)} began its turn with ${player.tv} TV.`);
}

function surfaceCaches(game) {
  const caches = game.caches ??= [];
  const regions = territoryMap(game);
  const center = (tiles.get(nexus.blue).column + tiles.get(nexus.red).column) / 2;
  const open = board.filter(({ id }) => !regions.has(id) && !game.proxies[id] && !caches.includes(id));
  const halves = [open.filter(({ column }) => column <= center), open.filter(({ column }) => column > center)];
  if (halves.some((half) => half.length === 0)) return;
  for (const half of halves) {
    const { id } = half[Math.floor(Math.random() * half.length)];
    caches.push(id);
    log(game, `A salvage cache surfaced at ${tileLabel(id)}.`, "cache");
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
  if (game.players[side].augments?.void || freeReserve(game, side)) return 0;
  const surcharge = !forward && speciesOf(game, side) === "keth" && !hasFinalAscension(game, side);
  return ACTION_COST.spawn + (surcharge ? 1 : 0);
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
  return nodeOrders(game, from).find(({ type }) => type === "forward-deploy")?.actions ?? [];
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
        if (occupied?.side !== side && (fire || !occupied?.fortified)) {
          destinations.push({ to, occupied, steps: step });
        }
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

export function ascensionProgress(game, side) {
  if (augmentStatus(game, side, "ascension") !== "active") return null;
  const player = game.players[side];
  const tier = ASCENSION_STAGES.findLastIndex(({ turn }) => player.turns >= turn);
  const startedOn = player.augments.ascensionStartedOn;
  const rounds = Number.isInteger(startedOn) ? Math.max(0, player.turns - startedOn) : null;
  return { tier, rounds };
}

function hasFinalAscension(game, side) {
  return ascensionProgress(game, side)?.tier === ASCENSION_STAGES.length - 1;
}

export function obeliskFireCost(game, side) {
  const surcharge = speciesOf(game, side) === "directorate" && !hasFinalAscension(game, side);
  return ACTION_COST.fire + (surcharge ? 1 : 0);
}

export function firingRange(game, from) {
  const side = game.activeSide;
  const gun = RANGED_NODES[tiles.get(from)?.node?.type];
  return gun && activeProxyTurn(game, from) && nodeController(game, from) === side
    ? reachableTiles(game, from, side, gun.range, true) : [];
}

export function nodeOrders(game, from) {
  const side = game.activeSide;
  const tile = tiles.get(from);
  if (!tile || game.phase !== "play" || game.proxies[from]?.side !== side) return [];

  const player = game.players[side];
  const species = speciesOf(game, side);
  const finalAscension = hasFinalAscension(game, side);
  const node = tile.node?.type;
  const generator = isFieldGenerator(tile.node);
  const controlled = !!node && nodeController(game, from) === side;
  const sourceError = game.deadline === null ? "Start your turn to issue orders."
    : readyProxy(game, from) ? null : "This Proxy activates at the start of your next turn.";
  const orders = [];
  const add = (type, cost, blocker, destinations = () => [from], emptyError = null) => {
    let error = sourceError ?? blocker;
    if (!error && player.tv < cost) error = `Needs ${cost} TV. You have ${player.tv} TV.`;
    const actions = error ? [] : destinations().map((to) => ({ type, from, to, cost }));
    if (!error && !actions.length) error = emptyError;
    orders.push({ type, cost, error, actions });
  };

  if (generator || node === "deposit") {
    const surcharge = species === "veyari" && !finalAscension;
    const cost = node === "aegis" ? 0 : ACTION_COST.occupy + (surcharge ? 1 : 0);
    add("occupy", cost, controlled ? "You already control this hex." : null);
  }
  if (generator || node === "vanguard") {
    let blocker = null;
    if (!controlled) blocker = "Take control of this hex to activate its shield.";
    else if (shieldActivation(game, from)?.side === side) {
      blocker = node === "vanguard" && !hasVanguardSupport(game, side)
        ? "Activated. It needs at least one online home Aegis or Obelisk to protect the Nexus."
        : "This shield has already been activated.";
    }
    add("power-shield", ACTION_COST.shield, blocker);
  }
  if (node === "aegis") {
    let blocker = null;
    if (!controlled) blocker = "Capture this Aegis first.";
    else if (player.augments?.void) blocker = "The Call of Void locks Forward Deployment.";
    else if (augmentStatus(game, side, "forward") !== "active") blocker = "Buy the Forward Deployment augment first.";
    else if (!shieldSourceActive(game, from)) blocker = "This Aegis must be powered.";
    else if (!hasReserve(game, side)) blocker = "You need a reserve Proxy.";
    add("forward-deploy", deploymentCost(game, side, true), blocker, () => tile.neighbors.filter((to) =>
      reachableEdge(game, side, from, to) && !game.proxies[to] && to !== nexus[otherSide(side)] && mayEnter(side, to)),
    "There’s no legal empty neighboring hex.");
  }
  if (species === "veyari" && !territoryMap(game).has(from)) {
    const blocker = !finalAscension && player.phaseJumpTurn === player.turns
      ? "You have already used Phase Jump this turn." : null;
    add("phase-jump", ACTION_COST.phase, blocker, () => phaseDestinations(game, from, side), "There’s no open landing hex.");
  }
  if (species === "keth" && (generator || finalAscension)) {
    let blocker = null;
    if (game.proxies[from].fortified) blocker = "This Proxy is already fortified.";
    else if (!finalAscension && !controlled) blocker = "Take control of this hex to fortify.";
    else if (!finalAscension && player.fortificationTurn === player.turns) {
      blocker = "You have already fortified a Proxy this turn.";
    }
    add("fortify", ACTION_COST.fortify, blocker);
  }
  if (RANGED_NODES[node]) {
    // Keep the range preview available even when there are no enemies to target.
    const cost = node === "vanguard" ? ACTION_COST.vanguardFire : obeliskFireCost(game, side);
    add("fire", cost, controlled ? null : "Take control of this hex to fire from it.",
      () => firingRange(game, from).filter(({ occupied }) => occupied).map(({ to }) => to));
  }
  return orders;
}

export function proxyMoves(game, from) {
  const side = game.activeSide;
  const player = game.players[side];
  if (!tiles.has(from) || !activeProxyTurn(game, from) || player.tv < ACTION_COST.move) return [];
  const tier = ascensionProgress(game, side)?.tier ?? 0;
  const localTier = tier && territoryMap(game).has(from) ? tier : 0;
  const captureRange = localTier >= 2 ? 2 : 1;
  const moveRange = localTier >= 3 ? 2 : 1;
  const canRefund = localTier >= 1 && player.ascensionRefundTurn !== player.turns;
  const actions = [];
  for (const { to, occupied, steps } of reachableTiles(game, from, side, captureRange)) {
    if (steps <= (occupied ? captureRange : moveRange)) {
      const action = { type: "move", from, to, cost: ACTION_COST.move };
      if (occupied && canRefund) action.refund = ACTION_COST.move;
      actions.push(action);
    }
  }
  return actions;
}

export function proxyActions(game, from) {
  const specialActions = nodeOrders(game, from).filter(({ type }) => type !== "forward-deploy").flatMap(({ actions }) => actions);
  return [...proxyMoves(game, from), ...specialActions];
}

export function hasAugmentDeposit(game, side) {
  return DEPOSITS.some((id) => game.proxies[id]?.side === side
    && readyProxy(game, id) && nodeController(game, id) === side);
}

export function augmentStatus(game, side, id) {
  const state = game.players[side].augments;
  if (state?.void) return id === "void" ? "active" : "locked";
  const status = state?.inventory?.[id];
  // Older matches could have purchased Hop as a single-use augment.
  if (id === "hop" && (status === "ready" || status === "used")) return "active";
  return status ?? "available";
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
  if (state?.void) labels.push(`Void Erosion · ${VOID_TV_CAP} TV recharge cap`);
  if (augmentStatus(game, side, "hop") === "active") labels.push("Hop");
  if (augmentStatus(game, side, "forward") === "active") labels.push("Forward Deploy");
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
  state.inventory[id] = id === "hop" || id === "forward" ? "active" : "ready";
  if (id === "void") {
    record(game, side, "augmentUses");
    player.augments = { inventory: {}, void: true, freeProxies: VOID_REINFORCEMENTS };
    player.tv += VOID_INVOCATION_TV;
    for (const proxy of Object.values(game.proxies)) {
      if (proxy.side !== side || !proxy.ascensionFortification) continue;
      delete proxy.fortified;
      delete proxy.ascensionFortification;
    }
    for (const to of cradles[side]) {
      if (!game.proxies[to] && freeReserve(game, side)) place(game, to, side, false);
    }
    log(game, `${sideName(side)} invoked The Call of Void and received ${VOID_INVOCATION_TV} TV and ${VOID_REINFORCEMENTS} Proxies.`, "void");
  } else {
    log(game, `${sideName(side)} bought ${AUGMENT_BY_ID.get(id).name}.`, "purchase");
    if (id === "overload") activateAugment(game, side, id);
  }
}

function consume(game, side, id, status = "used") {
  game.players[side].augments.inventory[id] = status;
  record(game, side, "augmentUses");
  log(game, `${sideName(side)} used ${AUGMENT_BY_ID.get(id).name}.`, AUGMENT_SOUNDS[id] ?? "augment");
}

function bankOverload(game, side) {
  const player = game.players[side];
  const amount = Math.ceil(player.tv / 2);
  player.tv -= amount;
  player.augments.bankedTV = amount;
  log(game, `${sideName(side)} banked ${amount} TV for its next turn.`);
}

function activateAugment(game, side, id) {
  const state = game.players[side].augments;
  const nextEnemyTurn = game.players[otherSide(side)].turns + 1;
  switch (id) {
    case "ascension":
      state.ascensionStartedOn = game.players[side].turns;
      consume(game, side, id, "active");
      return null;
    case "overload": bankOverload(game, side); break;
    case "emp": state.empRound = game.round; break;
    case "disabler": state.disablerTurn = nextEnemyTurn; break;
    case "retaliation":
      state.retaliationTurn = nextEnemyTurn;
      state.retaliationDrained = 0;
      break;
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
    if (to === null || visited.has(to) || !mayEnter(side, to) || !reachableEdge(game, side, mid, to)) continue;
    const landing = game.proxies[to];
    if (landing?.side !== side && !landing?.fortified) destinations.push({ to, over: mid });
  }
  return destinations;
}

function hopRoute(game, from, path) {
  const side = game.activeSide;
  if (!tiles.has(from) || !activeProxyTurn(game, from) || augmentStatus(game, side, "hop") !== "active"
      || game.players[side].tv < ACTION_COST.move || !Array.isArray(path) || path.length >= tiles.size) return null;
  // Validate the entire route against its own changes before touching the match state.
  const projected = path.length ? { ...game, proxies: { ...game.proxies } } : game;
  const visited = new Set([from]);
  const hits = [];
  let current = from;
  for (const to of path) {
    const hop = nextHops(projected, side, current, visited).find((candidate) => candidate.to === to);
    if (!hop) return null;
    const jumped = projected.proxies[hop.over];
    if (jumped.side !== side && !jumped.fortified) {
      hits.push(hop.over);
      delete projected.proxies[hop.over];
    }
    if (projected.proxies[to]) hits.push(to);
    projected.proxies[to] = projected.proxies[current];
    delete projected.proxies[current];
    visited.add(to);
    current = to;
  }
  return { current, visited, hits, projected };
}

export function hopTargets(game, from, path = []) {
  const route = hopRoute(game, from, path);
  return route ? nextHops(route.projected, game.activeSide, route.current, route.visited).map(({ to }) => to) : [];
}

export function defensiveTargets(game, side) {
  const regions = territoryMap(game);
  return Object.keys(game.proxies).map(Number).filter((id) =>
    game.proxies[id].side !== side && regions.get(id) === side);
}

function destroyProxies(game, side, targets, attack, stat = HIT_STATS[attack]) {
  record(game, side, stat, attack === "hop" ? targets.length : 1);
  const impacts = game.impacts ??= [];
  impacts.push({ revision: game.revision + 1, tiles: [...targets] });
  if (impacts.length > 12) impacts.shift();
  let destroyed = 0;
  for (const to of targets) {
    const proxy = game.proxies[to];
    if (proxy.fortified) {
      record(game, proxy.side, "hitsAbsorbed");
      log(game, `Fortification at ${tileLabel(to)} blocked the hit.`, "blocked");
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
  if (attack !== "fire" && destroyed && effectOnTurn(game, side, "retaliationTurn")) {
    const player = game.players[side];
    const retaliation = game.players[otherSide(side)].augments;
    const drained = retaliation.retaliationDrained ?? 0;
    const lost = Math.min(player.tv, 2 * destroyed, 10 - drained);
    if (lost > 0) {
      player.tv -= lost;
      retaliation.retaliationDrained = drained + lost;
      log(game, `${sideName(side)} lost ${lost} TV to Deadly Retaliation.`, "retaliation");
    }
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
  if (type === "hop" && augment === "hop") {
    const route = hopRoute(game, from, path);
    if (!route || !path.length) return "Choose a legal hop route.";
    spend(game, side, ACTION_COST.move);
    record(game, side, "augmentUses");
    const count = route.hits.length;
    const captures = count ? ` and captured ${count} ${count === 1 ? "Proxy" : "Proxies"}` : "";
    log(game, `${sideName(side)} hopped ${tileLabel(from)} to ${tileLabel(route.current)}${captures}.`, "hop");
    if (count) {
      destroyProxies(game, side, route.hits, "hop");
      soundCue(game, "capture");
    }
    for (const landing of path.slice(0, -1)) collectCache(game, landing, side);
    transferProxy(game, from, route.current);
    return null;
  }
  if (augmentStatus(game, side, augment) !== "ready") return "You don’t have this augment ready.";
  if (type === "use-augment") return activateAugment(game, side, augment);
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
      record(game, side, "forwardDeployed");
      log(game, `${name} deployed a Proxy from ${tileLabel(from)} to ${tileLabel(to)}.`);
      return;
    case "fabricate":
      addReserve(game, side);
      player.lastFabricationTurn = player.turns;
      record(game, side, "fabricated");
      log(game, `${name} fabricated a reserve Proxy.`);
      return;
    case "occupy":
      claimNode(game, to, side);
      return;
    case "power-shield":
      (game.activatedShields ??= {})[to] = { side, at: game.revision + 1 };
      record(game, side, "shieldsActivated");
      log(game, `${name} activated the shield at ${tileLabel(to)}.`);
      return;
    case "fortify": {
      const proxy = game.proxies[from];
      proxy.fortified = true;
      const baseFortification = player.fortificationTurn !== player.turns
        && isFieldGenerator(tiles.get(from).node) && nodeController(game, from) === side;
      if (baseFortification) player.fortificationTurn = player.turns;
      else proxy.ascensionFortification = true;
      record(game, side, "speciesPowers");
      log(game, `${name} fortified the Proxy at ${tileLabel(from)}.`);
      return;
    }
    case "fire": {
      const { stat } = RANGED_NODES[tiles.get(from).node.type];
      const destroyed = destroyProxies(game, side, [to], "fire", stat);
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
      const setupComplete = game.phase === "setup" && game.players[side].placed === STARTING_PROXIES;
      const outOfOrders = game.phase === "play" && game.players[side].tv === 0
        && !(deploymentCost(game, side) === 0 && placementActions(game).length)
        && augmentBuyError(game, side, "void") !== null
        && !nodes.some(({ id, node }) => node.type === "aegis" && activeProxyTurn(game, id)
          && nodeController(game, id) !== side);
      if (setupComplete || outOfOrders) {
        nextTurn(game, now);
      }
    }
  }
  game.revision += 1;
  return null;
}
