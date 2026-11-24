export const DEFAULT_PROXY_SKIN = "disc";
export const PROXY_SKINS = new Set([DEFAULT_PROXY_SKIN, "drone", "classic"]);

export function proxySkin(value) {
  return PROXY_SKINS.has(value) ? value : DEFAULT_PROXY_SKIN;
}
