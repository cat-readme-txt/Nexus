export const AUGMENTS = [
  {
    id: "hop", name: "Hop", price: 5,
    description: "Jump one Proxy over adjacent units in a chain. The entire move costs 1 TV.",
  },
  {
    id: "ascension", name: "Ascension", price: 10,
    description: "From turn 6, your first capture by Move each turn refunds 1 TV. From turn 12, capture up to two reachable hexes away. From turn 18, Move up to two hexes even to an empty hex. Moving from Turbulence suppresses these bonuses.",
  },
  {
    id: "overload", name: "Capacitor Overload", price: 30,
    description: "After activation, bank half the TV you end the turn with. The bonus can exceed the normal cap on your next turn.",
  },
  {
    id: "void", name: "The Call of Void", price: 0,
    description: "Send 30 free Proxies to your Cradle or reserve. Give up all other augments and lower your TV cap to 20.",
  },
  {
    id: "emp", name: "Electromagnetic Pulse", price: 10,
    description: "Disable enemy Aegis and Obelisk shields for the rest of the round. Vanguards stay online.",
  },
  {
    id: "disabler", name: "Troop Disabler", price: 10,
    description: "Block the enemy from receiving new Proxies on their next turn. They can still deploy their existing reserve.",
  },
  {
    id: "defensive", name: "Defensive Strike", price: 5,
    description: "Hit up to three enemy Proxies anywhere in your own territory. Fortification can absorb the hit.",
  },
  {
    id: "retaliation", name: "Deadly Retaliation", price: 10,
    description: "On the enemy’s next turn, drain up to 5 TV for each of your Proxies they capture by Move or target with Defensive Strike.",
  },
];

export const AUGMENT_BY_ID = new Map(AUGMENTS.map((augment) => [augment.id, augment]));
