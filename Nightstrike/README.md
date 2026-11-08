# Nightstrike — Play the Night

A dependency-free 3D football arcade game. Control the ball through a floodlit stadium, outplay defenders, link up with your teammate and finish with a timed shot. Original synthesized sound effects and stadium ambience are included.

## Open the game

Open `Nightstrike.html` in a browser with WebGL enabled. The complete game is embedded in that one file. Mobile file-manager previews may not run games; a hosted browser link is the most reliable way to play on phones and tablets.

The website build is in `site/`. Upload the **contents** of the `site/` directory to a static website host, with `index.html` at the root. No server application, build dependencies, accounts, downloads from a CDN or paid services are required by the game. Hosting access rules are separate from the game. No service worker is installed.

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Steer | Drag across the pitch, or drag the large thumbstick | A/D or left/right arrows |
| One-two pass | ONE-TWO button | Space |
| Focus | Hold FOCUS | Hold F |
| Shoot at the box | STRIKE when the target turns mint | Space |
| Pause | Pause button | P or Escape |

Forward movement is automatic. Red lanes warn before a slide tackle; steer out of the lane. Stay between a standing defender's feet for a nutmeg. A one-two pass protects the ball during the exchange. Three tackles end a run.

Focus slows the action and the shooting target to 42% speed. It drains while held, recharges slowly while dribbling, and gains energy from coins and tricks. Successive tricks within five seconds of game time increase trick-coin rewards up to ×3. At full heat, the ball becomes an unstoppable comet for seven game seconds. A safe finish in the far corner earns 15 bonus coins.

## Campaign and visuals

- 15 stages across Floodlight League, City Circuit and Champions Night, with 45 stars to earn.
- Nutmeg, dodge, sprint, faster-pass and extra-heat stage variations; five cosmetic ball skins.
- Rounded articulated athletes, shaped boots, kit details, faces, hair and diving goalkeeper animation.
- Emerald, violet and golden stadium themes, softer floodlights, comet glow, goal-net movement and celebrations.
- Responsive portrait and landscape interfaces, touch thumbstick, keyboard/mouse play, two camera views and full-screen where the browser supports it.
- Automatic, high and battery-saver graphics; reduced motion/flashes; sound toggle. The screen layout and drawing resolution update when the window changes size.

## Progress and device transfer

A goal earns one star; finish with at most one tackle for another; reach the stage's displayed trick target for the third. Scoring unlocks the next stage. Coins, stars, skins and preferences save in local browser storage.

The existing save key is retained. Earlier five-stage saves expand to fifteen slots when opened at the same browser origin. Moving to a new website or device uses a separate save: in Settings choose **Export Progress**, move that JSON file to the new device, then **Import Progress**. Imports keep the higher coin balance, the best stars from both saves and all owned skins. They do not add wallet balances or change the new device's graphics/control preferences.

An older version without Export Progress must first be replaced by this version at its original location/origin to read that browser's existing save. Keep a backup before clearing browser data. There is no automatic cloud sync.

## Editing and rebuilding

The `dist/engine.js`, `renderer.js`, `audio.js`, `app.js` and `style.css` files are editable sources. `index.template.html` supplies the page structure. Run `python3 build.py` to rebuild `dist/game.js`, `dist/index.html` and the complete `Nightstrike.html` file.

Checks:

- `node check-game.mjs`: three-star completion of all 15 stages, both shooting outcomes, tackles, nutmegs, passing, Focus, combo rewards, bonus scoring, pause and one-time payouts.
- `node check-ui.mjs`: event wiring, legacy save migration, stage unlocks, skins, progress imports, settings and pointer-release behavior with a lightweight DOM stub.
- `node check-renderer.mjs`: finite geometry, rig transforms and draw inputs; ball/goal framing at seven screen sizes; both cameras; every game mode; reduced effects. This is a CPU-side draw-contract check, not GPU compilation.
- `node --check dist/game.js`: bundled JavaScript syntax.

## Delivery status

The automated checks passed. Live publishing could not complete because the configured hosting repository could not be reached. No public or private live deployment was created in this update. Browser visual and real-device QA could not run because the local preview was blocked in this session. Responsive styles and camera geometry are implemented and checked; visual rendering and touch performance still need a real-browser check.


In this ZIP, the editable project and its checks are under `source/`. Run the build/check commands from that folder. The ready-to-host website is under `site/`.
