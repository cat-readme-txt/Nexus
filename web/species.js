export const SPECIES = [
  {
    id: "directorate",
    name: "Human Directorate",
    origin: "Earth’s governments formed a joint directorate to coordinate the war simulations and their supply lines.",
    power: "Start a turn with a staffed Deposit to gain 3 TV and one reserve Proxy. Obelisk fire costs 2 TV.",
    ascension: "At Ascension Tier III, recharge up to 50 TV and pay 1 TV for Obelisk fire.",
    counter: "Raid staffed Deposits before the next turn to interrupt their supply.",
  },
  {
    id: "veyari",
    name: "Veyari",
    origin: "Veyari means “those who cross” in their language. Their scouts navigate the unstable channels between systems.",
    power: "Once per turn for 2 TV, an active Proxy in Turbulence can jump up to three hexes through units and ordinary shields. Paid occupation costs 4 TV.",
    ascension: "At Ascension Tier III, repeat Phase Jump as often as TV and legal landings allow. Paid occupation costs 3 TV.",
    counter: "Screen open landing hexes and defend the Nexus with Vanguards. Phase Jump uses empty landings.",
  },
  {
    id: "keth",
    name: "Keth",
    origin: "Keth was the name of a chain of citadels. Their inhabitants kept it when they left their homeworld.",
    power: "Once per turn for 2 TV, fortify an active Proxy on a controlled Aegis or Obelisk. It stays invulnerable through the opponent’s next turn. Cradle deployments cost 2 TV.",
    ascension: "At Ascension Tier III, fortify any number of active Proxies on any hex for 2 TV each. Cradle deployments cost 1 TV.",
    counter: "Pressure unprotected Proxies and target fortified Proxies once their protection expires.",
  },
];

export const speciesById = new Map(SPECIES.map((species) => [species.id, species]));

export function speciesOf(game, side) {
  return game.speciesPicks?.[side] ?? null;
}
