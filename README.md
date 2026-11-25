# Nexus

Nexus is a two-player hex strategy game adapted from the competition board. Command Proxies, open a route through enemy shields, and enter the opposing Nexus to win. [Play Nexus](https://cat-readme-txt.github.io/Nexus/)

- [Setting](#setting)
- [Start a match](#start-a-match)
- [Turns, TV, and combat](#turns-tv-and-combat)
- [The board and special hexes](#the-board-and-special-hexes)
- [Territory growth](#territory-growth)
- [Reinforcements](#reinforcements)
- [Species](#species)
- [Augments](#augments)
- [Controls, settings, and match review](#controls-settings-and-match-review)
- [Testing terminal](#testing-terminal)
- [Development and publishing](#development-and-publishing)

## Setting

When Earth discovers hostile powers beyond the planet, its governments disagree on how to respond and have little information about the threat. They give their most advanced AI access to their supercomputers. It simulates wars involving Earth and the alien powers, including conflicts between the aliens. Each match is one of those simulations.

## Start a match

| Mode | How to join |
| --- | --- |
| **Pass and play** | Play on one device. Pass it during species selection and between setup or play turns. The incoming player starts the clock by selecting **Start setup** or **Start turn**. |
| **Find an opponent** | Join the public queue. The first player waiting takes Blue and the player who joins takes Red. |
| **Play with a friend** | Create an invite and share the eight-character code. The host takes Blue and their friend enters the code to join as Red. |

1. Each player privately picks any species. Both players can pick the same one. Species selection has no turn clock. The game reveals both choices and the species-use statistics in the postgame review. Visible effects can give clues during play.
2. Blue places three starting Proxies for free on separate empty hexes in the Blue Cradle. Red then does the same in the Red Cradle. Each setup turn lasts up to three minutes and finishes as soon as the third Proxy is placed. If time runs out, the game places any missing Proxies in the available Cradle hexes nearest that side’s Nexus.
3. Turn 1 starts with Blue’s action phase. Red acts next. The turn number advances when both sides have finished their action phases.

Online matches require a matchmaking server. Reloading the same browser tab can reconnect to its seat while the match is active. The server renews the public search lease while the player polls, holds a private invite for 20 minutes, and expires a paired room after two hours without an accepted game order. A pass-and-play match lives in the current page. Keep that tab open while playing.

## Turns, TV, and combat

**TV** stands for **teravolts**, the game’s unit of energy. Each side starts its action phase with **3 TV plus 1 TV per active Proxy**. Species supply bonuses count toward the normal recharge cap of **40 TV**. **The Call of Void** lowers that cap to **20 TV**. Banked **Capacitor Overload** TV is added after recharge. Starting and deployed Proxies activate at the beginning of their owner’s next action phase. A dormant Proxy occupies its hex and can be captured.

Spend TV on any number of legal orders, including repeated orders for the same Proxy. Your action phase ends when you select **End turn**, the three-minute clock expires, or you run out of TV and free orders. A free Aegis capture or an available Void deployment can keep the phase open at 0 TV. Unspent TV clears at handoff. TV you already stored with **Capacitor Overload** carries over. The online clock runs on the server. Settings and in-game dialogs leave the clock running.

The competition manual states on page 7, “Energy not spent this round will be lost.” Page 11 describes **Capacitor Overload**, which banks half of the remaining energy. [Competition manual](competition/instruction-manual.pdf)

| Order | Cost | Effect |
| --- | ---: | --- |
| **Move** | 1 TV | Select an active friendly Proxy and enter an adjacent hex. A friendly Proxy blocks the destination. An enemy Proxy on a legal destination is captured immediately, and your Proxy takes its place. Capturing costs only the Move. Dormant and fortified enemies can both be captured this way. |
| **Obelisk fire** | 1 TV, or 2 for Directorate | Select an active Proxy on an Obelisk that belongs to your side and is under your control. Select **Obelisk fire**, then choose a highlighted enemy up to two reachable steps away. The firing Proxy stays in place. |
| **Capture** | 0 TV at an Aegis, 3 TV at an Obelisk, or 4 at an Obelisk for Veyari | Use an active Proxy standing on a node you do not control to change its controller. |
| **Occupy** | 3 TV, or 4 for Veyari | Use an active Proxy on a Deposit you do not control to claim it and receive a reserve Proxy. |
| **Activate shield** | 2 TV | Use an active Proxy on a controlled Aegis, Sentinel Obelisk, or Vanguard to activate its shield. |
| **Deploy in Cradle** | 1 TV, 2 for Keth, or 0 with The Call of Void | Place a reserve Proxy in one of your empty Cradle hexes. |
| **Forward deploy** | 1 TV | After buying Forward Deployment, place a reserve Proxy next to a powered Aegis you control and staff. |
| **Fabricate reserve** | 2 TV | Add a reserve Proxy when you have fewer than two active Proxies. |
| **Recover cache** | 2 TV | Recover the cache underneath an active Proxy and add a reserve Proxy. |
| **Phase jump** | 2 TV | Use the Veyari species power from Turbulence. |
| **Fortify** | 2 TV | Use the Keth species power on a controlled Aegis or Obelisk. |

Active enemy shield borders block movement and Obelisk fire across the edge. For a two-step Move or shot, the intervening hex must be empty and the route must be legal. An Obelisk can hit an enemy on a Vanguard if there is a clear shot. Keth armor absorbs one Obelisk or Defensive Strike hit. Removing an enemy normally adds a reserve Proxy to the attacking side. **Troop Disabler** can block that reward and **Deadly Retaliation** can drain TV on a capture or Defensive Strike.

You win immediately when your Proxy enters the enemy Nexus. An enemy Proxy standing there is captured by that same Move. Select **Leave match → Concede** to give the other player the win and open the match review.

## The board and special hexes

The flat-top competition map has **337 playable hexes**, with columns A–Y and rows 1–14. Blue’s Nexus is **X2** and Red’s is **B13**. Each green Cradle has 25 hexes, including three Sentinel Obelisks. Each side starts with two Vanguards, eight Sentinel Obelisks, and seven Aegis nodes. Nine Deposits start neutral. [Full board layout](web/board-data.js)

| Hex | Symbol when empty | Inlay while occupied | What it does |
| --- | --- | --- | --- |
| **Nexus** | Crown | Gold crown ridge | Enter the enemy Nexus to win. The Vanguard shield can protect all its approaches. |
| **Vanguard** | Sword and shield | Amber side brackets | Pay 2 TV with an active Proxy here to arm the Nexus ring and inward Cradle borders. An armed Vanguard needs an active friendly Proxy on it and at least one online home Aegis or Obelisk free of enemy Proxies. Enemy Proxies cannot enter a Vanguard. |
| **Sentinel Obelisk** | Paired triangles | Lilac chevrons | Pay 2 TV to activate its linked outward borders. An active Proxy on a controlled home Obelisk can fire. |
| **Aegis** | Gold hexagon | Two flat gold bars | Capture for free and pay 2 TV to activate its linked borders. The Forward Deployment augment lets a staffed, powered Aegis deploy reserve Proxies. |
| **Deposit** | Gold ring | Gold ring | Grants one reserve Proxy when first occupied or taken from the opponent. An active Proxy on a Deposit you control lets you buy augments and triggers Directorate supply at the start of its turn. |
| **Cradle** | Green terrain | Green terrain | Your staging area for starting Proxies and reserve deployments. It counts as part of your original territory. |
| **Turbulence** | Gray terrain | Gray terrain | Veyari can phase jump from here. A Move starting here loses all Ascension bonuses. Salvage caches can surface here. |
| **Salvage cache** | Teal crate | Teal diamond | Spend 2 TV with an active Proxy on the cache to recover one reserve Proxy and remove the cache. |

All **251 printed borders** and both Nexus rings start offline. The Vanguards control the inward Cradle borders and Nexus ring. The Aegis and Obelisk field shields follow their complete outward arcs, including the return edges. Some arcs extend around four neighboring hexes, including the Blue arc from E1 through F2 and the Red arc from U13 through T13.

Solid borders are powered. Brighter dashed borders show the same outline while offline. Select a generator to give its own links a pale outline and see their status in the hex inspector. A solid gold ring around a Nexus means its Vanguard shield is active. A small gold hexagon around an individual Proxy means it has armor. Gold terrain inlays identify occupied special hexes.

Select an active friendly Proxy on a generator you control and choose **Activate shield**. An Aegis or Obelisk stays powered after your Proxy leaves. Capturing a generator changes its controller and resets its shield activation. The new controller can pay to power it again. An enemy Proxy standing on a home generator prevents that generator from supporting its original side’s Vanguard shield. A Vanguard stays armed after a friendly Proxy leaves and resumes protection when staffed again with outside power available.

Paying to **Occupy** a Deposit gives the reserve reward immediately. The pending claim counts as control, so a staffed claimant can buy augments that turn. A friendly Proxy must be on the Deposit at the start of your next turn to secure the claim. If the claim is denied, the previous controller regains it or it goes neutral again. You keep any reserve award already received.

## Territory growth

Territory expands through links between special hexes. Each Turbulence Deposit links to the closest special hex on each side. For example, **M7 links to J9 and P6**. Within each side, two special hexes link if there is no third special hex closer to both. Inspect a special hex to see its links.

A captured node extends your region when one of its links reaches a home node you still control or an earlier connected capture. The new territory includes the captured hex, its one-hex ring, and a shortest connection from that ring to your nearest existing territory. This can include ordinary hexes outside both rings. Blue can capture the J9 Obelisk without owning M7, but its region expands there once it has the connected Deposit. Losing that link can cut off the expansion while leaving the captured node under your control.

The board shows current territory in team colors, and **Defensive Strike** uses those boundaries. A denied Deposit claim rolls back its expansion. Capturing territory preserves terrain features such as Turbulence and the printed Cradle deployment zones.

## Reinforcements

- **Cradle deployment.** Select **Deploy in Cradle**, then choose any empty hex in your own Cradle, including its Obelisks. Each placement consumes one reserve Proxy. With The Call of Void, every deployment costs 0 TV, including deployments after the initial 30 Proxies are used. Each team card shows its current **Reserve** count.
- **Forward deployment.** Buy **Forward Deployment** for 5 TV at a staffed Deposit. Select an active Proxy on a powered Aegis you control, including one you captured and activated, then choose **Forward deploy** and an empty legal neighbor. Each placement costs 1 TV and one reserve Proxy. Keep deploying while legal neighboring space, reserves, and TV are available. The destination must respect enemy shields and cannot be the enemy Nexus or Vanguard. The new Proxy activates on your next action phase.
- **Fabrication.** Spend 2 TV to add one Proxy to reserve when you have zero or one active Proxy. You can use it once every three of your turns, even with no pieces left on the board.
- **Salvage.** A cache surfaces at the start of every third full turn. The schedule starts at L7 on Turn 3 and cycles through N7, M6, M8, K7, O7, L8, N8, K6, and O8. If the scheduled hex still holds a cache, the game checks the next eligible hex in that order. An active Proxy can recover one by standing on it and spending 2 TV.
- **Rewards.** Enemy Proxies removed by combat and newly occupied Deposits generate reserves. The Human Directorate can also earn one through supply. **Troop Disabler** prevents new reserves for its affected turn and leaves existing reserves available.

## Species

Emblems appear during private selection and in the match review. Board Proxies use the player’s team color.

| Species | Identity and emblem | Power and trade-off |
| --- | --- | --- |
| Human Directorate | Earth’s governments formed a joint directorate to coordinate the simulations and their supply lines. Its emblem combines a globe and supply chevrons. | Start your turn with at least one active Proxy on a controlled Deposit to gain +3 TV and one reserve Proxy. The bonus applies once per turn even if several Deposits are staffed. Obelisk fire costs 2 TV. Raid staffed Deposits to interrupt their supply. |
| Veyari | Their name means “those who cross.” Their scouts navigate unstable channels between systems. Their emblem frames a phase passage. | Once per turn, pay 2 TV to jump an active Proxy from Turbulence to an empty hex up to three steps away. It can pass ordinary shields and occupied hexes. The route skips the enemy Nexus and enemy Vanguards. Obelisk capture and Deposit occupation cost 4 TV. Screen their empty landing hexes to limit options. |
| Keth | Keth was a chain of citadels. Its inhabitants kept the name after leaving their homeworld. Their emblem is an armored fortress. | Once per turn, pay 2 TV to fortify an active Proxy on a controlled Aegis or Obelisk. The armor absorbs one Obelisk or Defensive Strike hit, expires if the Proxy moves, and otherwise lasts until the owner’s next turn. A Move onto its hex or Hop over it still captures it. Paid Cradle deployments cost 2 TV and forward deployments use the usual rate. |

[Directorate emblem](web/assets/species-directorate.png) · [Veyari emblem](web/assets/species-veyari.png) · [Keth emblem](web/assets/species-keth.png)

## Augments

Open **Augments** during your action phase to see each augment’s icon, price, and description. To buy one, staff a controlled Deposit with an active Proxy and pay the listed price. Each side can buy each augment once per match. Bought augments stay available after you lose access to the Deposit. **Hop**, **Forward Deployment**, **Capacitor Overload**, and **The Call of Void** take effect on purchase. The other augments have a separate activation step.

| Augment | Price | Activation and effect |
| --- | ---: | --- |
| **Hop** | 5 TV | Active immediately and repeatable for the rest of the match, unless you invoke **The Call of Void**. Select an active Proxy to see legal landings marked with violet diamonds alongside normal Move destinations. Each hop goes straight over an adjacent Proxy to an empty hex. It captures an enemy jumped over, including a fortified one. Each capture normally earns one reserve Proxy. Friendly Proxies stay in place. Later hops in the same chain use the board as it will look after the earlier hops. Both edges must respect enemy shields. The route cannot revisit hexes or continue past an enemy Nexus. Select the last landing again to remove it from the route, or **Confirm hop** to commit the whole chain for 1 TV. |
| **Ascension** | 10 TV | Activate once to unlock cumulative tiers on your own play turns. From turn 6, the first capture by Move that starts outside Turbulence refunds its 1 TV movement cost each turn. You still need 1 TV to issue that Move. From turn 12, Move can capture an enemy up to two reachable hexes away. From turn 18, the same range applies to empty destinations. A Move starting in Turbulence uses the normal adjacent range and cost. |
| **Capacitor Overload** | 5 TV | Deduct the 5 TV, then immediately set aside half of what remains, rounded up. Starting with 6 TV banks 1 TV. The stored TV is added after your next normal recharge and can exceed its cap. |
| **Forward Deployment** | 5 TV | Unlock repeatable deployments from powered Aegis hexes you control, including captured and reactivated Aegis. |
| **The Call of Void** | 0 TV | Invoke immediately to deliver 30 Proxies. They fill empty friendly Cradle hexes first and leave the rest in reserve. Every deployment costs 0 TV for the rest of the match. Fielded Proxies activate next turn. Invoking discards your other augments and locks future augment purchases. It clamps your current TV and normal recharge to 20. |
| **Electromagnetic Pulse** | 10 TV | Jams the enemy’s Aegis and Obelisk shields through the end of the current full turn. Their Vanguard shield loses outside power until the jam clears. |
| **Troop Disabler** | 10 TV | On the enemy’s next turn, blocks new reserve rewards, fabrication, cache recovery, and invoking The Call of Void. The opponent can deploy their existing reserve. |
| **Defensive Strike** | 5 TV | Select one to three distinct enemies on hexes in your current territory, then confirm. It hits those targets without requiring a path or a nearby friendly Proxy. Fortification absorbs the first hit. Each enemy removed normally becomes one reserve Proxy. |
| **Deadly Retaliation** | 5 TV | On the enemy’s next action phase, drain 2 TV for each of your Proxies they remove by Move, Hop, or Defensive Strike. The total drain is capped at 10 TV and limited to their remaining TV. |

## Controls, settings, and match review

- **Board.** Select your active Proxy to show legal moves. Select a highlighted destination to commit the Move. A destination containing an enemy is marked as a capture. Select a hex outside the highlighted destinations to inspect it. The inspector displays its coordinate, terrain, territory, special-hex links, shield power, and the Proxy’s activation or fortification status.
- **Orders.** Select your Proxy to see the actions for its current hex. Unavailable orders are grayed out. Hover over an order or focus it with the keyboard to see what it does and what is blocking it.
- **Obelisk preview.** With **Obelisk fire** selected, cyan outlines show reachable hexes and highlighted enemy Proxies are the available targets. Select a target to fire.
- **Keyboard.** Focus the board. Q/W/E move the cursor northwest, north, and northeast. A/S/D move it southwest, south, and southeast. Up and Down go north and south. Left and Right go southwest and southeast; hold Shift with either to go northwest or northeast. Press Enter or Space to select. Escape clears the current selection or targeting plan. Use **−**, **Fit**, and **+** to adjust zoom.
- **Appearance.** **Settings → Proxy skin** offers **Disc**, **Drone**, and **Classic shield**. In pass-and-play, change your side’s skin during your turn. Online, the setting follows your seat and both players see each side’s chosen skin. The menu’s default is used for Blue in pass-and-play and for your online seat. Dormant tokens have a dashed outline and fortification adds a gold hexagon. The inlays work with every skin. A capture or hit flashes its hex briefly when reduced motion is off.
- **Audio.** Sound effects and the synthesized ambient soundtrack start after interacting with the page. Their volume sliders start at 65% and 30%, with 0% muting the channel. Effects mark actions, captures, shield changes, augments, the turn countdown, and results. The countdown warns at ten seconds and ticks at three, two, and one. Audio levels and the Proxy design are remembered in the browser where storage is available.
- **Statistics.** Open **Match statistics** during play. It shows action phases started, active and reserve Proxies, TV earned from recharges, TV spent on orders and purchases, Ascension refunds, Move orders, Move and Hop captures, Obelisk shots, Defensive Strike uses, reinforcements deployed, forward deployments, shields activated, Proxies lost and removed, hits absorbed, node claims, fabrication, caches recovered, and augments used. Starting placements are part of the fielded count. Deployment statistics count reserve placements, including forward deployments and Void placements. TV spent counts the up-front Move cost even if Ascension refunds it.
- **Review.** The match review shows the winner, turn reached, and final stats, and reveals both species, their abilities, counterplay, and power-use counts. View the final board and reopen **Match review** from the top bar.

## Testing terminal

1. In the top bar, open **Settings** and check **Enable testing terminal**.
2. Start a **Pass and play** match, finish setup, and select **Start turn**. **Testing terminal** appears in the top bar during the active play turn.
3. Open it, type a command, and press Enter or **Run**.

| Command | Result |
| --- | --- |
| `help` | Lists the commands. |
| `add TV 100` | Adds 100 TV to the player who opened the terminal for that turn. It can exceed the normal recharge cap. |
| `add reserve 4` | Adds four undeployed Proxies to that player’s reserve. `proxy` and `proxies` also work in place of `reserve`. |

Commands accept positive whole numbers and are case-insensitive. The clock keeps running and the terminal closes at handoff. Testing commands are available only during an active pass-and-play turn. Added TV is a testing grant and does not count as earned in the match statistics.

## Development and publishing

Use Node.js 22 or newer. The development server runs the browser game and local matchmaking.

```sh
npm run dev
```

Open the printed address. For online testing on one machine, open that address in two separate browser profiles or use a regular and a private window. Run the rules, matchmaking, and terminal tests and then create the static bundle.

```sh
npm test
npm run build
```

For GitHub Pages, select **GitHub Actions** under **Settings → Pages**. A push to `main` or a manual run of **Publish game to GitHub Pages** runs the tests, builds the browser files into `dist/`, and deploys that directory. The Pages build offers pass-and-play by default. [GitHub Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

For hosted matchmaking, deploy the supplied Cloudflare Worker and its Matchmaker Durable Object.

```sh
npx wrangler@4 login
npx wrangler@4 deploy
```

Set the GitHub repository’s Actions variable `MATCHMAKING_URL` to the Worker’s public HTTPS origin and rerun the Pages workflow. The generated browser configuration points to its `/api/match` endpoint. The browser and Worker share the same rules engine, so deploy them together whenever the rules change. [Cloudflare Durable Objects documentation](https://developers.cloudflare.com/durable-objects/get-started/)

The [competition manual](competition/instruction-manual.pdf), [print board](competition/board-print.pdf), earlier boards, and Hextml export are in the competition folder. The rules above describe the playable web version.

## Competition artwork

| Background-removed figure | Use |
| --- | --- |
| [Crown](web/assets/nexus.png) | Nexus |
| [Gold sword and shield](web/assets/vanguard.png) | Vanguard |
| [Paired triangles](web/assets/sentinel.png) | Sentinel Obelisk |
| [Gold ring](web/assets/deposit.png) | Deposit |
| [Gold hexagon](web/assets/aegis.png) | Aegis |
| [Black ring](competition/artwork/deposit-black.png) | Alternate Deposit figure |
| [Black sword and shield](competition/artwork/vanguard-black.png) | Alternate Vanguard figure |
| [Gold outline shield](competition/artwork/shield-outline.png) | Distinct shield drawing |

### Home artwork

The home menu uses an original [frontier illustration](web/assets/nexus-frontier.webp) generated with the built-in ImageGen tool.

<details>
<summary>Image prompt</summary>

> Generate a wide cinematic sci-fi concept illustration for the home menu backdrop of a hex strategy game. The scene is a distant aerial view of an alien frontier at night, with a monumental hexagonal fortress and an amber energy core in the right third, muted violet-blue storm clouds, thin concentric gold lights tracing the landing terraces, and a small reddish horizon glow on the far right. Dark navy, desaturated indigo, warm antique gold highlights. The left third should be deep, quiet blue-black negative space for separately rendered web text. Aim for tactile film-grain concept art with clean architectural geometry and an atmospheric sense of scale. Keep the fortress visible on a mobile center crop. Landscape 16:10, edge-to-edge, no typography, letters, logos, watermarks, interface elements, planets, or people.

</details>
