export const SPECIES = [
  {
    id: "directorate",
    name: "Human Directorate",
    origin: "Earth’s governments formed a joint directorate to coordinate the war simulations and their supply lines.",
    power: "Start a turn with a staffed Deposit to gain 3 TV and one reserve Proxy. Obelisk fire costs 2 TV instead of 1.",
    counter: "Raid staffed Deposits before the next turn to interrupt their supply.",
  },
  {
    id: "veyari",
    name: "Veyari",
    origin: "Veyari means “those who cross” in their language. Their scouts navigate the unstable channels between systems.",
    power: "Once per turn for 2 TV, an active Proxy in Turbulence can jump up to three hexes through units and ordinary shields. Paid occupation costs 4 TV.",
    counter: "Screen open landing hexes and defend the Nexus with Vanguards, whose shields stop phase jumps.",
  },
  {
    id: "keth",
    name: "Keth",
    origin: "Keth was the name of a chain of citadels. Their inhabitants kept it when they left their homeworld.",
    power: "Once per turn for 2 TV, fortify a Proxy on a controlled Aegis or Obelisk. It absorbs one Obelisk or Defensive Strike hit while it stays there, through the enemy turn. Cradle deployments cost 2 TV.",
    counter: "Capture fortified Proxies by moving onto their hex, or use two ranged hits in the same turn.",
  },
];

export const speciesById = new Map(SPECIES.map((species) => [species.id, species]));

export function speciesOf(game, side) {
  return game.speciesPicks?.[side] ?? null;
}
