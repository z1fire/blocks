# Blocks

A Minecraft-style voxel sandbox for Android (and the web), built for touch screens.

**[Download the Android APK](https://github.com/z1fire/blocks/releases/latest/download/Blocks.apk)** · **[Play in the browser](https://z1fire.github.io/blocks/)**

## Features

- Infinite procedurally generated world: plains, forests, deserts, snowy biomes, mountains, oceans, caves, ores, oak and birch trees, cacti, pumpkins
- Break and place 35 block types, all with procedurally drawn pixel-art textures (no image assets)
- **Creative** mode (unlimited blocks, flying) and **Survival** mode (mining, inventory, crafting, health, fall damage, drowning)
- TNT with chain reactions
- Day/night cycle with sun, moon and clouds; smooth ambient occlusion lighting; swimming
- Your world saves automatically, including when the app is sent to the background
- Settings for render distance, sensitivity, resolution, FOV and sound

## Controls

| Touch | Keyboard / mouse |
|---|---|
| Left side of the screen: move (push to the top edge to sprint) | WASD (Ctrl to sprint) |
| Right side of the screen: drag to look | Mouse |
| Tap: place block · Hold: break block | Right click / left click |
| ▲: jump, swim, fly up · double-tap ▲: toggle flying | Space (double-tap to fly) · F |
| ▼: fly down | Shift |
| Hotbar / ⋯ button: pick blocks, open the inventory and crafting | 1–9, mouse wheel, E |

Tapping a TNT block lights it.

## Install on Android

1. On your phone, open the [latest release](https://github.com/z1fire/blocks/releases/latest) and download `Blocks.apk`.
2. Open it. If Android asks, allow your browser to "install unknown apps".
3. Each new push to `main` builds a new release. Install it over the old one and your world is kept.

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

- `src/world.js`: chunk storage and terrain generation
- `src/mesher.js`: chunk meshing with face culling and ambient occlusion
- `src/player.js`: physics and collision, voxel raycasting
- `src/controls.js`: touch joystick, look, and tap/hold input; keyboard and mouse
- `src/blocks.js`: block definitions and procedural textures
- `src/main.js`: game loop, UI, survival, saving
