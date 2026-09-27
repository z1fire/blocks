# Blocks

A Minecraft-style voxel sandbox for Android (and the web), built for touch screens.

**[Download the Android APK](https://github.com/z1fire/blocks/releases/latest/download/Blocks.apk)** · **[Play in the browser](https://z1fire.github.io/blocks/)**

## Features

**World**
- Infinite procedural terrain with six biomes: plains, forest, desert, snowy tundra, taiga and mountains
- Caves with lava pools and mushrooms, plus ores: coal, iron, gold and diamond
- Oak, birch and spruce trees, tall grass, flowers, cacti, pumpkins, melons, clay and sandstone
- Real lighting: sunlight falls off into caves and under overhangs, and torches, glowstone, lava and jack o'lanterns glow
- Day/night cycle with sun, moon, stars and clouds; rain and snow storms
- Sand and gravel fall, plants break when their support is removed, and water or lava flows into holes you dig

**Survival**
- Mining speed and drops depend on your tool: wood, stone, iron or diamond pickaxes, axes, shovels and swords, plus a hoe. Tools wear out.
- Crafting (tables, tools, torches, beds and more) and smelting at a furnace (ingots, glass, cooked food)
- Health, hunger and food; fall, lava, cactus and drowning damage
- Farming: hoe the ground, plant seeds, and harvest wheat to make bread. Saplings grow into trees.
- Beds skip the night and set your respawn point
- Mobs: pigs, cows, sheep and chickens; zombies and creepers at night and in dark caves (zombies burn in daylight)
- Items drop into the world and you walk over them to pick them up
- Four difficulty levels, from Peaceful to Hard

**Creative**
- Every block and item, flying, instant building, and controls for time and weather

**General**
- Multiple save slots with autosave (including when the app is backgrounded)
- Held-item view, block-breaking cracks, particles, view bobbing, sprint FOV
- Synthesized sound effects: footsteps, mobs, rain, explosions
- Settings for render distance, sensitivity, resolution, FOV, difficulty and more

## Controls

| Touch | Keyboard / mouse |
|---|---|
| Left side of the screen: move (push to the top edge to sprint) | WASD (Ctrl to sprint) |
| Right side of the screen: drag to look | Mouse |
| Tap: place a block, use (eat, till, plant, crafting table, bed, TNT) or attack | Right click (use/place) |
| Hold: break a block / keep attacking | Left click |
| ▲: jump, swim, fly up · double-tap ▲: toggle flying | Space (double-tap to fly) · F |
| ▼: fly down or swim down | Shift |
| Hotbar / ⋯ button: pick items, open the inventory and crafting | 1–9, mouse wheel, E |

## Install on Android

1. On your phone, open the [latest release](https://github.com/z1fire/blocks/releases/latest) and download `Blocks.apk`.
2. Open it. If Android asks, allow your browser to "install unknown apps".
3. Each push to `main` builds a new release. Install it over the old one and your worlds are kept.

## Development

```bash
npm install
npm run dev          # http://localhost:5173 (also on your LAN for testing on a phone)
npm run build        # production web build -> dist/
npm run icons        # regenerate app and PWA icons
npm run android:sync # build and copy into the Android project (then open android/ in Android Studio)
```

The stack is Three.js, Vite and Capacitor. GitHub Actions (`.github/workflows/build.yml`) builds the signed APK, publishes it as a GitHub Release, and deploys the web version to GitHub Pages.

Code layout:

| File | What it does |
|---|---|
| `src/world.js` | Chunk storage, terrain and biome generation, trees |
| `src/lighting.js` | Sky and block light flood-fill per chunk region |
| `src/mesher.js` | Chunk meshing with face culling, smooth lighting and AO; cross, torch and box models |
| `src/materials.js` | Block shader (day/night, block light, fog) |
| `src/physics.js`, `src/player.js` | Collision bodies, player movement, raycasting |
| `src/entities.js` | Mobs (models, AI, animation), dropped items, falling blocks |
| `src/blocks.js`, `src/items.js` | Block and item definitions with procedural pixel-art textures |
| `src/inventory.js` | Inventory, tools, mining rules, drops, recipes |
| `src/weather.js`, `src/hand.js`, `src/sound.js` | Rain and snow, first-person held item, synthesized audio |
| `src/storage.js` | Save slots |
| `src/ui.js`, `src/main.js` | HUD, menus, game loop and interaction |

Open the browser console and use `window.blocks` to inspect or drive the game (for example `blocks.setTime(0.6)` or `blocks.step(60)`).
