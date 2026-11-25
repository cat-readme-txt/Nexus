const ascensionFlame = "M13 10c1 3 3.4 4.2 3.4 7a3.4 3.4 0 0 1-6.8 0c0-2.4 1.8-4 3.4-7Z";
const ascensionHalo = "M8 6a5 2 0 1 0 10 0 5 2 0 1 0-10 0Z";
const ascensionWings = "M8 16c-3-1-5-3-6-6 0 6 2 10 6 12m-5-6 5 3m10-3c3-1 5-3 6-6 0 6-2 10-6 12m5-6-5 3";

export const ASCENSION_STAGES = [
  { turn: 0, label: "Active", iconPath: ascensionFlame },
  { turn: 6, label: "Tier I", iconPath: ascensionFlame + ascensionHalo },
  { turn: 12, label: "Tier II", iconPath: ascensionFlame + ascensionHalo + ascensionWings },
  {
    turn: 18, label: "Tier III",
    iconPath: ascensionFlame + ascensionHalo + ascensionWings + "M13 1v1m-7 1 1 1m12 0 1-1m-7 20v2",
  },
];

export const AUGMENTS = [
  {
    id: "hop", name: "Hop", price: 5,
    description: "Unlock hops immediately. Capture unprotected enemy Proxies you jump over or land on. Select an active Proxy to see legal landings and confirm the whole chain for 1 TV.",
    iconPath: "M4 20h3m12 0h3M5 16C8 7 15 5 21 12m-5-1 5 1 1-5",
  },
  {
    id: "ascension", name: "Ascension", price: 10,
    description: "From turn 6, your first capture by Move each turn refunds 1 TV. From turn 12, capture up to two reachable hexes away. From turn 18, Move up to two hexes even to an empty hex, improve your species power, and lose its extra fees. Moves from Turbulence use their usual range and cost.",
    iconPath: ASCENSION_STAGES[1].iconPath,
  },
  {
    id: "overload", name: "Capacitor Overload", price: 5,
    description: "Pay 5 TV to immediately store half of what you have left, rounded up. That energy is added after recharge on your next turn.",
    iconPath: "M4 17h5m0-4v8m8-8v8m0-4h5M14 3l-4 6h5l-3 4",
  },
  {
    id: "forward", name: "Forward Deployment", price: 5,
    description: "Unlock reserve deployments next to any powered Aegis you control and staff with an active Proxy. Each placement costs 1 TV. Use it as often as you have space, reserve and TV.",
    iconPath: "M4 7l5-3 5 3v6l-5 3-5-3V7Zm5 9v5m-3 0h6m4-11h7m-3-3 3 3-3 3",
  },
  {
    id: "void", name: "The Call of Void", price: 0,
    description: "Receive 10 TV and 30 Proxies. Deployments are free and arrive active. Your team takes the Void Erosion skin, gives up all other augments and Ascension upgrades, and recharges up to 20 TV per turn.",
    iconPath: "M23 13a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM18 8a6 6 0 0 0-8 9 6 6 0 0 0 8-9Z",
  },
  {
    id: "emp", name: "Electromagnetic Pulse", price: 10,
    description: "Jam enemy Aegis and Obelisk shields for the rest of this full turn. Their Vanguard shield loses outside power until the jam clears.",
    iconPath: "M6 5a11 11 0 0 0 0 16m3-13a7 7 0 0 0 0 10m11-13a11 11 0 0 1 0 16m-3-13a7 7 0 0 1 0 10M13 12v2",
  },
  {
    id: "disabler", name: "Troop Disabler", price: 10,
    description: "Block the enemy from receiving new Proxies on their next turn. They can still deploy their existing reserve.",
    iconPath: "M22 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM7 19 19 7",
  },
  {
    id: "defensive", name: "Defensive Strike", price: 5,
    description: "Hit up to three enemy Proxies anywhere in your own territory. Fortification can absorb the hit.",
    iconPath: "M13 3l8 4v5c0 5-4 8-8 11-4-3-8-6-8-11V7l8-4ZM9 12h8m-4-4v8",
  },
  {
    id: "retaliation", name: "Deadly Retaliation", price: 5,
    description: "On the enemy’s next turn, drain 2 TV per Proxy they remove by Move, Hop, or Defensive Strike, up to 10 TV total.",
    iconPath: "M4 10h11a6 6 0 0 1 0 12h-4M9 5l-5 5 5 5m11-12 2 3 2-3",
  },
];

export const AUGMENT_BY_ID = new Map(AUGMENTS.map((augment) => [augment.id, augment]));
