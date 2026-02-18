/* ═══════════════════════════════════════════════════════════
   gestureDetection.js — Detect JJK hand signs from landmarks
   ═══════════════════════════════════════════════════════════

   Landmark IDs (MediaPipe Hands):
     WRIST            = 0
     THUMB_TIP        = 4     THUMB_IP    = 3
     INDEX_TIP        = 8     INDEX_PIP   = 6
     MIDDLE_TIP       = 12    MIDDLE_PIP  = 10
     RING_TIP         = 16    RING_PIP    = 14
     PINKY_TIP        = 20    PINKY_PIP   = 18
     MIDDLE_MCP       = 9

   Each landmark has { x, y, z } in normalised [0‥1] coords
   where y INCREASES downward on the screen.
   ═══════════════════════════════════════════════════════════ */

const GestureDetection = (() => {
  /* ── Landmark shortcuts ── */
  const TIP   = { THUMB: 4, INDEX: 8, MIDDLE: 12, RING: 16, PINKY: 20 };
  const PIP   = { INDEX: 6, MIDDLE: 10, RING: 14, PINKY: 18 };
  const MCP   = { MIDDLE: 9 };

  /* ── Helpers ── */
  function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  /** True when the finger tip is above (lower y) its PIP joint. */
  function fingerUp(landmarks, tipId, pipId) {
    return landmarks[tipId].y < landmarks[pipId].y;
  }

  /** True when all four non‑thumb fingers are extended. */
  function allFingersUp(lm) {
    return (
      fingerUp(lm, TIP.INDEX,  PIP.INDEX)  &&
      fingerUp(lm, TIP.MIDDLE, PIP.MIDDLE) &&
      fingerUp(lm, TIP.RING,   PIP.RING)   &&
      fingerUp(lm, TIP.PINKY,  PIP.PINKY)
    );
  }

  /* ══════════════════════════════════════════════════════════
     detectJJKSigns(multiHandLandmarks, multiHandedness)
     Returns: { technique: string|null, power: number }
     ══════════════════════════════════════════════════════════ */
  function detectJJKSigns(multiHandLandmarks, multiHandedness) {
    const numHands = multiHandLandmarks.length;

    /* ── Two‑hand signs first (higher priority) ────────── */
    if (numHands >= 2) {
      const handA = multiHandLandmarks[0];
      const handB = multiHandLandmarks[1];

      /* Mahito — Self‑Embodiment of Perfection
         Index + Middle fingers crossed on BOTH hands,
         and hands held together (wrists close). */
      const mahitoA = _indexMiddleCrossed(handA);
      const mahitoB = _indexMiddleCrossed(handB);
      const wristDist = dist(handA[0], handB[0]);
      if (mahitoA && mahitoB && wristDist < 0.25) {
        return { technique: 'MAHITO_SELF_EMBODIMENT' };
      }

      /* Megumi — Divine Dogs
         Thumb tips touching + other fingers extended on both hands. */
      const thumbDist = dist(handA[TIP.THUMB], handB[TIP.THUMB]);
      if (thumbDist < 0.06 && allFingersUp(handA) && allFingersUp(handB)) {
        return { technique: 'MEGUMI_DIVINE_DOGS' };
      }
    }

    /* ── Single‑hand signs ─────────────────────────────── */
    if (numHands >= 1) {
      const lm = multiHandLandmarks[0];

      /* Gojo — Unlimited Void
         Index & middle finger tips very close AND x‑coords crossed. */
      if (_indexMiddleCrossed(lm)) {
        return { technique: 'GOJO_UNLIMITED_VOID' };
      }

      /* Sukuna — Malevolent Shrine
         All finger tips above their PIP joints (open palm). */
      if (allFingersUp(lm)) {
        return { technique: 'SUKUNA_MALEVOLENT_SHRINE' };
      }
    }

    return { technique: null };
  }

  /* ── Index & Middle crossed check ── */
  function _indexMiddleCrossed(lm) {
    const indexTip  = lm[TIP.INDEX];
    const middleTip = lm[TIP.MIDDLE];
    const d = dist(indexTip, middleTip);

    // Tips must be very close together
    if (d > 0.07) return false;

    // x‑coordinates should be swapped (index crosses over middle or vice‑versa)
    // Normally index.x < middle.x (right hand) or index.x > middle.x (left hand).
    // "Crossed" means the natural order is reversed.
    const indexMcp  = lm[5];  // INDEX_FINGER_MCP
    const middleMcp = lm[9];  // MIDDLE_FINGER_MCP
    const naturalOrder = indexMcp.x < middleMcp.x; // true ⇒ index is left of middle
    const tipOrder     = indexTip.x < middleTip.x;
    const crossed = naturalOrder !== tipOrder;

    // Also require at least these two fingers to be somewhat extended
    const indexUp  = fingerUp(lm, TIP.INDEX, PIP.INDEX);
    const middleUp = fingerUp(lm, TIP.MIDDLE, PIP.MIDDLE);

    return crossed && indexUp && middleUp;
  }

  /* ── Public API ── */
  return { detectJJKSigns, allFingersUp, fingerUp, dist };
})();
