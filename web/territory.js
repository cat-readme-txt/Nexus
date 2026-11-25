import { board, nodes, SIDES, tiles } from "./board.js";

export function nodeController(game, id) {
  const claim = game.claims[id];
  return claim?.pending ?? claim?.held ?? tiles.get(id).node.home;
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

const initialRegions = new Map(board.filter(({ region }) => SIDES.includes(region)).map(({ id, region }) => [id, region]));

function connectToRegion(regions, side, footprint) {
  const queue = [...footprint];
  const previous = new Map(footprint.map((id) => [id, null]));
  for (const id of queue) {
    if (regions.get(id) === side) {
      for (let link = id; link !== null; link = previous.get(link)) regions.set(link, side);
      return;
    }
    for (const neighbor of tiles.get(id).neighbors) {
      if (neighbor === null || previous.has(neighbor) || tiles.get(neighbor).node) continue;
      previous.set(neighbor, id);
      queue.push(neighbor);
    }
  }
}

export function territoryMap(game) {
  const regions = new Map(initialRegions);
  const controllers = new Map(nodes.map(({ id }) => [id, nodeController(game, id)]));
  const connected = new Set(nodes.filter(({ id, node }) => node.home && controllers.get(id) === node.home).map(({ id }) => id));
  const claims = [];
  for (const { id } of nodes) {
    const claim = game.claims[id];
    const side = controllers.get(id);
    if (claim && side) claims.push({ id, side, at: (claim.pending ? claim.pendingAt : claim.heldAt) ?? 0 });
  }
  claims.sort((a, b) => a.at - b.at || a.id - b.id);

  // A capture can extend territory as soon as a supported link reaches it.
  // Replay current claims so a lost link can disconnect previously captured nodes.
  while (claims.length) {
    const index = claims.findIndex(({ id, side }) => specialHexLinks.get(id).some((neighbor) =>
      connected.has(neighbor) && controllers.get(neighbor) === side));
    if (index === -1) break;
    const [{ id, side }] = claims.splice(index, 1);
    const footprint = [id, ...tiles.get(id).neighbors.filter((neighbor) => neighbor !== null
      && (!tiles.get(neighbor).node || controllers.get(neighbor) === side))];
    connectToRegion(regions, side, footprint);
    for (const tile of footprint) regions.set(tile, side);
    connected.add(id);
  }
  return regions;
}
