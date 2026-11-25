import { cradles, nodes, SIDES, tiles } from "./board.js";

export function nodeController(game, id) {
  const claim = game.claims[id];
  return claim?.pending ?? claim?.held ?? tiles.get(id).node.home;
}

export function shieldActivation(game, id) {
  const activation = game.activatedShields?.[id];
  // Existing matches only stored the activating team.
  return typeof activation === "string" ? { side: activation, at: 0 } : activation;
}

function hexDistance(a, b) {
  const x = a.column - b.column;
  const z = a.row - Math.ceil(a.column / 2) - b.row + Math.ceil(b.column / 2);
  return Math.max(Math.abs(x), Math.abs(z), Math.abs(x + z));
}

function originalSide(tile) {
  if (tile.node.home) return tile.node.home;
  const land = tile.neighbors.filter((id) => id !== null).map((id) => tiles.get(id).region);
  return SIDES.find((side) => land.every((region) => region === side)) ?? null;
}

function buildSpecialLinks() {
  const locations = new Map(nodes.map((tile) => [tile.id, originalSide(tile)]));
  const links = new Map(nodes.map(({ id }) => [id, []]));
  const connect = (a, b) => {
    links.get(a.id).push(b.id);
    links.get(b.id).push(a.id);
  };
  for (const side of SIDES) {
    const local = nodes.filter(({ id }) => locations.get(id) === side);
    for (const a of local) {
      for (const b of local) {
        if (a.id >= b.id) continue;
        const distance = hexDistance(a, b);
        const between = local.some((c) => c !== a && c !== b
          && hexDistance(a, c) < distance && hexDistance(b, c) < distance);
        if (!between) connect(a, b);
      }
    }
    for (const deposit of nodes.filter(({ id }) => locations.get(id) === null)) {
      const nearest = Math.min(...local.map((tile) => hexDistance(deposit, tile)));
      for (const tile of local.filter((tile) => hexDistance(deposit, tile) === nearest)) connect(deposit, tile);
    }
  }
  return links;
}

export const specialHexLinks = buildSpecialLinks();

const cradleRegions = new Map(SIDES.flatMap((side) => cradles[side].map((id) => [id, side])));
const cradleNodes = Object.fromEntries(SIDES.map((side) => [side, new Set(nodes
  .filter(({ cradle, neighbors }) => cradle === side || neighbors.some((id) => cradleRegions.get(id) === side))
  .map(({ id }) => id))]));

function regionConnection(regions, side, footprint, contested) {
  const queue = [...footprint];
  const previous = new Map(footprint.map((id) => [id, null]));
  for (const id of queue) {
    if (regions.get(id) === side) {
      const path = [];
      for (let link = previous.get(id); link !== null; link = previous.get(link)) path.push(link);
      return path;
    }
    for (const neighbor of tiles.get(id).neighbors) {
      if (neighbor === null || previous.has(neighbor) || contested.has(neighbor) || tiles.get(neighbor).node) continue;
      const cradle = cradleRegions.get(neighbor);
      if (cradle && cradle !== side) continue;
      previous.set(neighbor, id);
      queue.push(neighbor);
    }
  }
  return [];
}

function enclosedHexes(regions, side, growth) {
  const boundary = [...growth].filter((id) => regions.get(id) === side)
    .flatMap((id) => tiles.get(id).neighbors);
  const visited = new Set();
  const enclosed = [];
  for (const start of boundary) {
    if (start === null || visited.has(start) || regions.get(start) === side) continue;
    const pocket = [start];
    visited.add(start);
    let hasNode = false;
    for (const id of pocket) {
      const tile = tiles.get(id);
      if (tile.node) hasNode = true;
      for (const neighbor of tile.neighbors) {
        if (neighbor === null || visited.has(neighbor) || regions.get(neighbor) === side) continue;
        visited.add(neighbor);
        pocket.push(neighbor);
      }
    }
    if (!hasNode) enclosed.push(...pocket);
  }
  return enclosed;
}

export function territoryMap(game) {
  const regions = new Map(cradleRegions);
  const controllers = new Map(nodes.map(({ id }) => [id, nodeController(game, id)]));
  const connected = new Set();
  const growth = { blue: new Set(), red: new Set() };
  const rings = { blue: new Set(), red: new Set() };
  const sources = [];
  for (const { id, neighbors, node } of nodes) {
    const side = controllers.get(id);
    if (!side) continue;
    const claim = game.claims[id];
    const activation = shieldActivation(game, id);
    const activated = activation?.side === side;
    if (!claim && !activated) continue;
    const at = claim ? (claim.pending ? claim.pendingAt : claim.heldAt) : activation.at;
    const seed = cradleNodes[side].has(id) && (activated || node.type === "deposit");
    sources.push({ id, side, at: at ?? 0, seed });
    for (const neighbor of neighbors) if (neighbor !== null) rings[side].add(neighbor);
  }
  const contested = new Set([...rings.blue].filter((id) => rings.red.has(id) && !cradleRegions.has(id)));
  sources.sort((a, b) => a.at - b.at || a.id - b.id);

  // Only nodes by their own Cradle can seed a new region. Replay current
  // sources so earlier captures can spread when a link opens and retreat if it is lost.
  while (sources.length) {
    const index = sources.findIndex(({ id, side, seed }) => seed || specialHexLinks.get(id).some((neighbor) =>
      connected.has(neighbor) && controllers.get(neighbor) === side));
    if (index === -1) break;
    const [{ id, side }] = sources.splice(index, 1);
    const footprint = [id, ...tiles.get(id).neighbors].filter((tile) => {
      if (tile === null || contested.has(tile)) return false;
      const cradle = cradleRegions.get(tile);
      return (!cradle || cradle === side) && (!tiles.get(tile).node || controllers.get(tile) === side);
    });
    footprint.push(...regionConnection(regions, side, footprint, contested));
    for (const tile of footprint) {
      regions.set(tile, side);
      growth[side].add(tile);
    }
    connected.add(id);
  }
  // Test the final boundaries so cutting a link can also reopen a pocket.
  const pockets = SIDES.map((side) => enclosedHexes(regions, side, growth[side]));
  for (const [index, side] of SIDES.entries()) {
    for (const id of pockets[index]) {
      if (!contested.has(id) && !cradleRegions.has(id)) regions.set(id, side);
    }
  }
  return regions;
}
