# Strongest Sorcerer — JJK Cursed Techniques

A real-time web app that uses your webcam and hand tracking to trigger cinematic visual effects inspired by _Jujutsu Kaisen_. Show a hand sign to the camera and watch a Domain Expansion unfold on screen.

---

## Demo

| Technique                                  | Hand Sign                                         | Visual                                                                                                |
| ------------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Unlimited Void** 無量空処                | Cross index + middle fingers                      | Black-hole singularity with swirling ink vortex, 5000 white particles spiraling inward, electric arcs |
| **Hollow Purple** 虚式・茈                 | Pinch thumb + index finger                        | 3-D purple energy ball that tracks your fingertip, converging blue/red rings, particle suction        |
| **Malevolent Shrine** 伏魔御廚子           | Open palm (all fingers up)                        | Red slashes radiating from the centre, ember particles                                                |
| **Divine Dogs** 玉犬                       | Both hands, thumbs touching, fingers extended     | Cyan shadow particles and summoning sigils                                                            |
| **Self-Embodiment of Perfection** 無為転変 | Crossed fingers on BOTH hands held close together | Green distortion waves and soul particles                                                             |

---

## How to Run

No build step, no server required — open directly in a browser.

```bash
# Clone the repo
git clone https://github.com/your-username/Stronget-Sorcerer.git
cd Stronget-Sorcerer

# Option A — just open the file
start index.html          # Windows
open index.html           # macOS

# Option B — local HTTP server (avoids any camera permission quirks)
npx serve .
# then visit http://localhost:3000
```

> **Camera permission** — the browser will request webcam access on first load. Allow it.

---

## Tech Stack

| Library                                                                                     | Version | Role                                                                 |
| ------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| [p5.js](https://p5js.org/)                                                                  | 1.9.4   | Canvas rendering, webcam draw, 2-D effects                           |
| [Three.js](https://threejs.org/)                                                            | 0.160.1 | 3-D effects (Unlimited Void, Hollow Purple) with custom GLSL shaders |
| [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) | 0.4     | Real-time 21-point hand landmark tracking                            |

All libraries are loaded from CDN — no `npm install` needed.

---

## Project Structure

```
Stronget-Sorcerer/
├── index.html                  # Entry point, CDN scripts, DOM
├── style.css                   # Full-screen dark UI, HUD, accent colours
└── js/
    ├── handTracking.js         # MediaPipe Hands init, webcam, landmark draw
    ├── gestureDetection.js     # Hand sign recognition logic
    ├── main.js                 # p5.js sketch, effect registry, orchestration
    └── effects/
        ├── gojoEffect.js       # Unlimited Void — Three.js black hole + ink vortex
        ├── hollowPurpleEffect.js # Hollow Purple — Three.js energy ball + rings
        ├── sukunaEffect.js     # Malevolent Shrine — p5.js red slashes + embers
        ├── megumiEffect.js     # Divine Dogs — p5.js cyan particles + sigils
        └── mahitoEffect.js     # Self-Embodiment — p5.js green distortion waves
```

---

## Architecture

### Webcam → p5 → Three.js layering

```
┌─────────────────────────────────────┐
│  Three.js canvas  z-index: 2        │  ← active technique only (transparent bg)
├─────────────────────────────────────┤
│  p5.js canvas     z-index: 1        │  ← webcam + 2-D effects + hand skeleton
├─────────────────────────────────────┤
│  <video id="webcam">  1×1 px hidden │  ← live feed piped to MediaPipe
└─────────────────────────────────────┘
```

**Key design choice — no `EffectComposer`/`UnrealBloomPass`:** Three.js post-processing pipelines use opaque internal framebuffers that destroy canvas `alpha: true` transparency, making the webcam invisible. Both 3-D effects instead use a **dual-scene fake bloom**: a `glowScene` with oversized additive-blended meshes rendered after `renderer.clearDepth()`.

### Gesture detection priority

```
Two-hand signs   →   Mahito (crossed fingers, wrists close)
                 →   Megumi (thumb tips touching, all fingers up)

Single-hand      →   Hollow Purple (thumb-index pinch < 0.05)
                 →   Unlimited Void (index-middle crossed)
                 →   Malevolent Shrine (open palm)
```

---

## Adding a New Technique

1. Create `js/effects/myEffect.js` — export an object with `{ spawn, update, draw, clear }` (p5) or `{ init, activate, deactivate, spawn, update, draw, clear, setLandmarkPosition }` (Three.js).
2. Add a `<script>` tag in `index.html` before `main.js`.
3. Register it in the `EFFECTS` map in `main.js`:
   ```js
   MY_TECHNIQUE: {
     module: MyEffect,
     label: "Technique Name",
     sub: "Japanese Name — Description",
     accent: "accent-class",
     // threejs: true   ← add this if it uses Three.js
   }
   ```
4. Add gesture detection logic in `gestureDetection.js`.
5. Add `.accent-class` colour in `style.css`.

---

## Browser Requirements

- Chrome 90+ or Edge 90+ recommended (best WebGL & MediaPipe support)
- Camera access required
- Works on localhost or HTTPS (camera API requires a secure context)
