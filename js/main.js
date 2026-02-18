/* ═══════════════════════════════════════════════════════════
   main.js — p5.js sketch + orchestration
   Ties together hand tracking, gesture detection, and effects.
   ═══════════════════════════════════════════════════════════ */

/* ─────────── Effect registry (add new techniques here) ─── */
const EFFECTS = {
  GOJO_UNLIMITED_VOID: {
    module: GojoEffect,
    label: "Unlimited Void",
    sub: "無量空処 — Domain Expansion",
    accent: "accent-gojo",
  },
  SUKUNA_MALEVOLENT_SHRINE: {
    module: SukunaEffect,
    label: "Malevolent Shrine",
    sub: "伏魔御廚子 — Domain Expansion",
    accent: "accent-sukuna",
  },
  MEGUMI_DIVINE_DOGS: {
    module: MegumiEffect,
    label: "Divine Dogs",
    sub: "玉犬 — Ten Shadows Technique",
    accent: "accent-megumi",
  },
  MAHITO_SELF_EMBODIMENT: {
    module: MahitoEffect,
    label: "Self‑Embodiment of Perfection",
    sub: "無為転変 — Idle Transfiguration",
    accent: "accent-mahito",
  },
};

/* ─────────── State ─────────────────────────────────────── */
let activeTechnique = null; // key into EFFECTS
let prevTechnique = null;
let idleFrames = 0;
const IDLE_THRESHOLD = 40; // frames before we consider "idle" and fade
let _p5; // captured p5 instance for safe access

/* ─────────── DOM refs ──────────────────────────────────── */
const elName = document.getElementById("technique-name");
const elSub = document.getElementById("technique-sub");
const elBar = document.getElementById("power-bar");
const elBarC = document.getElementById("power-bar-container");
const elIdle = document.getElementById("idle-prompt");

/* ─────────── p5.js sketch (global mode) ────────────────── */

function setup() {
  const c = createCanvas(windowWidth, windowHeight);
  colorMode(RGB, 255, 255, 255, 255);
  _p5 = this;
  HandTracker.init();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  const ht = HandTracker.state;

  /* ══ 1. Draw full-screen webcam background (mirrored) ══ */
  const videoEl = ht.videoEl;
  if (videoEl && videoEl.readyState >= 2) {
    push();
    translate(width, 0);
    scale(-1, 1); // mirror
    // Cover the canvas while maintaining aspect ratio
    const vw = videoEl.videoWidth || width;
    const vh = videoEl.videoHeight || height;
    const scale2 = Math.max(width / vw, height / vh);
    const dw = vw * scale2;
    const dh = vh * scale2;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    drawingContext.drawImage(videoEl, dx, dy, dw, dh);
    pop();

    // Subtle dark overlay so effects pop against the feed
    noStroke();
    fill(0, 0, 0, activeTechnique ? 100 : 40);
    rect(0, 0, width, height);
  } else {
    background(8, 6, 18);
  }

  /* ══ 2. Detect gesture ══ */
  let detected = null;
  if (ht.ready && ht.multiHandLandmarks.length > 0) {
    const result = GestureDetection.detectJJKSigns(
      ht.multiHandLandmarks,
      ht.multiHandedness,
    );
    detected = result.technique;
  }

  /* ══ 3. Hysteresis — hold technique for a few frames ══ */
  if (detected) {
    activeTechnique = detected;
    idleFrames = 0;
  } else {
    idleFrames++;
    if (idleFrames > IDLE_THRESHOLD) {
      activeTechnique = null;
    }
  }

  /* ══ 4. On technique change, clear old effect ══ */
  if (activeTechnique !== prevTechnique) {
    if (prevTechnique && EFFECTS[prevTechnique]) {
      EFFECTS[prevTechnique].module.clear();
    }
    _updateHUD(activeTechnique);
    prevTechnique = activeTechnique;
  }

  /* ══ 5. Render effects (overlaid on webcam) ══ */
  if (activeTechnique && EFFECTS[activeTechnique]) {
    const fx = EFFECTS[activeTechnique];
    const power = ht.handPower;

    fx.module.spawn(_p5, power);
    fx.module.update(_p5);
    fx.module.draw(_p5);

    elBar.style.width = `${power * 100}%`;
  } else {
    // Still update lingering particles from the last effect
    for (const key in EFFECTS) {
      EFFECTS[key].module.update(_p5);
      EFFECTS[key].module.draw(_p5);
    }
  }

  /* ══ 6. Draw hand landmarks on top of everything ══ */
  HandTracker.drawLandmarksOnCanvas(_p5);
}

/* ─────────── HUD helpers ───────────────────────────────── */

function _updateHUD(technique) {
  // Remove all accent classes
  elName.className = "";
  elSub.className = "";

  if (technique && EFFECTS[technique]) {
    const fx = EFFECTS[technique];
    elName.textContent = fx.label;
    elSub.textContent = fx.sub;
    elName.classList.add("active", fx.accent);
    elSub.classList.add("active");
    elBarC.classList.add("active");
    elIdle.classList.add("hidden");
  } else {
    elName.classList.remove("active");
    elSub.classList.remove("active");
    elBarC.classList.remove("active");
    elIdle.classList.remove("hidden");
    elName.textContent = "";
    elSub.textContent = "";
    elBar.style.width = "0%";
  }
}
