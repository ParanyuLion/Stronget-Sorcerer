/* ═══════════════════════════════════════════════════════════
   handTracking.js — MediaPipe Hands initialisation & camera
   ═══════════════════════════════════════════════════════════ */

const HandTracker = (() => {
  // Public state — consumed by gestureDetection.js & main.js
  const state = {
    multiHandLandmarks: [],
    multiHandedness: [],
    handPower: 0,
    ready: false,
    videoEl: null,  // live <video> element — always current
  };

  /** Compute a 0‥1 "power" from the distance between WRIST(0) and MIDDLE_FINGER_MCP(9). */
  function _computePower(landmarks) {
    if (!landmarks || landmarks.length === 0) return 0;
    const w = landmarks[0];
    const m = landmarks[9];
    const d = Math.sqrt(
      (m.x - w.x) ** 2 + (m.y - w.y) ** 2 + ((m.z || 0) - (w.z || 0)) ** 2
    );
    return Math.min(1, Math.max(0, (d - 0.12) / 0.30));
  }

  /** Initialise MediaPipe Hands + camera util. */
  function init() {
    const videoEl = document.getElementById('webcam');
    state.videoEl = videoEl;  // expose for p5 to draw

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults((results) => {
      state.multiHandLandmarks = results.multiHandLandmarks || [];
      state.multiHandedness = results.multiHandedness || [];
      state.ready = true;

      if (state.multiHandLandmarks.length > 0) {
        state.handPower = _computePower(state.multiHandLandmarks[0]);
      } else {
        state.handPower = 0;
      }
    });

    const camera = new Camera(videoEl, {
      onFrame: async () => {
        await hands.send({ image: videoEl });
      },
      width: 1280,
      height: 720,
    });

    camera.start();
  }

  /**
   * Draw hand landmarks directly onto a p5 canvas.
   * Called from main.js draw() so they appear on the full-screen view.
   */
  function drawLandmarksOnCanvas(p) {
    if (!state.multiHandLandmarks || state.multiHandLandmarks.length === 0) return;

    for (const landmarks of state.multiHandLandmarks) {
      // ── Draw connections ──
      const connections = [
        [0,1],[1,2],[2,3],[3,4],       // thumb
        [0,5],[5,6],[6,7],[7,8],       // index
        [5,9],[9,10],[10,11],[11,12],  // middle
        [9,13],[13,14],[14,15],[15,16],// ring
        [13,17],[17,18],[18,19],[19,20],// pinky
        [0,17],                        // palm base
      ];

      for (const [a, b] of connections) {
        // Mirror x so the display feels natural
        const ax = (1 - landmarks[a].x) * p.width;
        const ay = landmarks[a].y * p.height;
        const bx = (1 - landmarks[b].x) * p.width;
        const by = landmarks[b].y * p.height;
        p.stroke(255, 255, 255, 80);
        p.strokeWeight(2);
        p.line(ax, ay, bx, by);
      }

      // ── Draw landmark dots ──
      for (let i = 0; i < landmarks.length; i++) {
        const lx = (1 - landmarks[i].x) * p.width;
        const ly = landmarks[i].y * p.height;
        // Finger tips get a bright glow
        const isTip = [4, 8, 12, 16, 20].includes(i);
        p.noStroke();
        if (isTip) {
          p.fill(124, 77, 255, 120);
          p.ellipse(lx, ly, 18);
          p.fill(179, 136, 255, 220);
          p.ellipse(lx, ly, 10);
        } else {
          p.fill(124, 77, 255, 180);
          p.ellipse(lx, ly, 7);
        }
      }
    }
  }

  return { state, init, drawLandmarksOnCanvas };
})();
