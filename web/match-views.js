import { sideName, SIDES } from "./board.js";
import { SPECIES, speciesById, speciesOf } from "./species.js";
import { allProxies, freeReserve, proxyReady } from "./rules.js";

const get = (id) => document.getElementById(id);

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

export function speciesCards(onChoose) {
  return SPECIES.map((species) => {
    const card = element("article");
    card.className = "panel species-card";
    const name = element("h2", species.name);
    const origin = element("p", species.origin);
    origin.className = "muted";
    const power = element("p", species.power);
    const control = element("button", `Choose ${species.name}`);
    control.type = "button";
    control.dataset.species = species.id;
    control.addEventListener("click", () => onChoose(species.id));
    card.append(name, origin, power, control);
    get("species-options").append(card);
    return control;
  });
}

const metrics = [
  ["TV earned", "tvEarned"],
  ["TV spent", "tvSpent"],
  ["Move orders", "moveOrders"],
  ["Strike orders", "strikeOrders"],
  ["Obelisk shots", "obeliskShots"],
  ["Withdrawals", "withdrawals"],
  ["Reinforcements deployed", "deployed"],
  ["Forward deployments", "forwardDeployed"],
  ["Proxies lost", "lost"],
  ["Enemy Proxies removed", "eliminated"],
  ["Hits absorbed", "hitsAbsorbed"],
  ["Node claims", "claims"],
  ["Reserve Proxies fabricated", "fabricated"],
  ["Caches recovered", "salvaged"],
  ["Augments used", "augmentUses"],
];

export function renderReview(game) {
  get("result-title").textContent = `${sideName(game.winner)} wins`;
  get("result-message").textContent = `${game.result === "nexus" ? "Nexus captured" : "Match conceded"} · ${game.round} ${game.round === 1 ? "round" : "rounds"}`;
  const cards = SIDES.map((side) => {
    const species = speciesById.get(speciesOf(game, side));
    const card = element("article");
    card.className = "panel species-card";
    card.dataset.side = side;
    card.append(element("h2", `${sideName(side)} · ${species?.name ?? "Unassigned"}`));
    if (species) {
      const origin = element("p", species.origin);
      origin.className = "muted";
      card.append(origin, element("p", species.power), element("p", species.counter));
    }
    return card;
  });
  get("species-reveal").replaceChildren(...cards);

  renderStats(get("review-stats"), game, true);
}

export function renderStats(container, game, final = false) {
  const table = element("table");
  if (final) table.append(element("caption", "Match statistics"));
  else table.setAttribute("aria-label", "Live match statistics");
  const head = table.createTHead().insertRow();
  for (const label of ["Statistic", "Blue", "Red"]) {
    const cell = element("th", label);
    cell.scope = "col";
    head.append(cell);
  }
  const body = table.createTBody();
  const addRow = (label, value) => {
    const row = body.insertRow();
    const name = element("th", label);
    name.scope = "row";
    row.append(name);
    for (const side of SIDES) row.insertCell().textContent = value(side);
  };

  const field = allProxies(game);
  addRow("Turns started", (side) => game.players[side].turns);
  addRow("Proxies active", (side) => field.filter((proxy) => proxy.side === side && proxyReady(game, proxy)).length);
  addRow("Proxies in reserve", (side) => game.players[side].reserve + freeReserve(game, side));
  for (const [label, key] of metrics) {
    addRow(label, (side) => game.stats ? (game.stats[side]?.[key] ?? 0) : "–");
  }
  if (final) addRow("Species power uses", (side) => game.stats?.[side]?.speciesPowers ?? 0);
  container.replaceChildren(table);
}
