export const DEFAULT_PROXY_SKIN = "disc";
export const VOID_PROXY_SKIN = "void-erosion";
export const PROXY_SKINS = new Set([DEFAULT_PROXY_SKIN, "drone", "classic"]);

export function proxySkin(value) {
  return PROXY_SKINS.has(value) ? value : DEFAULT_PROXY_SKIN;
}

export function effectiveProxySkin(game, side, choice) {
  return game?.players[side]?.augments?.void ? VOID_PROXY_SKIN : proxySkin(choice);
}
