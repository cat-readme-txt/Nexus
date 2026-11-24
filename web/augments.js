export const AUGMENTS = [
  {
    id: "hop", name: "Hop", price: 5,
    description: "Jump one Proxy over adjacent units in a chain. The entire move costs 1 TV.",
  },
  {
    id: "ascension", name: "Ascension", price: 10,
    description: "On turns 6, 12, and 18, unlock cheaper strikes, two-hex teleport strikes, and two-hex moves. Turbulence suppresses these abilities.",
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
    description: "Choose up to three enemy Proxies anywhere in your own territory and destroy them.",
  },
  {
    id: "retaliation", name: "Deadly Retaliation", price: 10,
    description: "On the enemy’s next turn, drain up to 5 TV each time they strike one of your Proxies.",
  },
];

export const AUGMENT_BY_ID = new Map(AUGMENTS.map((augment) => [augment.id, augment]));
