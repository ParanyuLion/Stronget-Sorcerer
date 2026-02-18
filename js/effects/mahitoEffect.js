/* ═══════════════════════════════════════════════════════════
   mahitoEffect.js — "Self‑Embodiment of Perfection"
   Green distortion waves + morphing soul particles
   ═══════════════════════════════════════════════════════════ */

const MahitoEffect = (() => {
  const waves     = [];
  const soulParts = [];
  const glitches  = [];

  const MAX_WAVES  = 10;
  const MAX_PARTS  = 250;
  const MAX_GLITCH = 20;

  /* ── Distortion wave ── */
  class Wave {
    constructor(p, power) {
      this.x = p.width / 2;
      this.y = p.height / 2;
      this.r = 5;
      this.maxR = p.random(250, 600) * (0.5 + power);
      this.speed = p.random(3, 7);
      this.alpha = 220;
    }
    update() {
      this.r += this.speed;
      this.alpha = p5.prototype.map(this.r, 0, this.maxR, 220, 0);
      return this.r < this.maxR;
    }
    draw(p) {
      p.noFill();
      p.stroke(100, 255, 50, this.alpha);
      p.strokeWeight(2);
      p.ellipse(this.x, this.y, this.r * 2);
      // Inner wobble
      p.stroke(180, 255, 80, this.alpha * 0.4);
      p.strokeWeight(1);
      p.beginShape();
      for (let a = 0; a < p.TWO_PI; a += 0.15) {
        const wobble = Math.sin(a * 6 + p.frameCount * 0.1) * 8;
        const rr = this.r + wobble;
        p.vertex(
          this.x + Math.cos(a) * rr,
          this.y + Math.sin(a) * rr
        );
      }
      p.endShape(p.CLOSE);
    }
  }

  /* ── Soul particle (morphing blob) ── */
  class SoulParticle {
    constructor(p, power) {
      const angle = p.random(p.TWO_PI);
      const dist = p.random(20, 200);
      this.x = p.width / 2 + Math.cos(angle) * dist;
      this.y = p.height / 2 + Math.sin(angle) * dist;
      this.vx = p.random(-1.5, 1.5) * (0.5 + power);
      this.vy = p.random(-1.5, 1.5) * (0.5 + power);
      this.size = p.random(3, 10);
      this.life = 1;
      this.decay = p.random(0.005, 0.018);
      this.phase = p.random(p.TWO_PI);
    }
    update(p) {
      this.phase += 0.05;
      this.x += this.vx + Math.sin(this.phase) * 0.5;
      this.y += this.vy + Math.cos(this.phase * 0.8) * 0.5;
      this.life -= this.decay;
      return this.life > 0;
    }
    draw(p) {
      const a = this.life * 200;
      p.noStroke();
      // Outer glow
      p.fill(100, 255, 50, a * 0.25);
      p.ellipse(this.x, this.y, this.size * 2.5);
      // Core
      p.fill(160, 255, 100, a);
      const morph = this.size + Math.sin(this.phase * 3) * 2;
      p.ellipse(this.x, this.y, morph, morph * (0.7 + Math.sin(this.phase) * 0.3));
    }
  }

  /* ── Glitch bar ── */
  class Glitch {
    constructor(p) {
      this.y = p.random(p.height);
      this.h = p.random(2, 12);
      this.offset = p.random(-30, 30);
      this.alpha = 200;
      this.fade = p.random(8, 20);
    }
    update() {
      this.alpha -= this.fade;
      return this.alpha > 0;
    }
    draw(p) {
      p.noStroke();
      p.fill(120, 255, 60, this.alpha);
      p.rect(this.offset, this.y, p.width, this.h);
    }
  }

  /* ── Public API ── */

  function spawn(p, power) {
    if (waves.length < MAX_WAVES && p.random() < 0.35) {
      waves.push(new Wave(p, power));
    }
    const partCount = Math.floor(4 + power * 10);
    for (let i = 0; i < partCount && soulParts.length < MAX_PARTS; i++) {
      soulParts.push(new SoulParticle(p, power));
    }
    if (glitches.length < MAX_GLITCH && p.random() < 0.2) {
      glitches.push(new Glitch(p));
    }
  }

  function update(p) {
    for (let i = waves.length - 1; i >= 0; i--) {
      if (!waves[i].update()) waves.splice(i, 1);
    }
    for (let i = soulParts.length - 1; i >= 0; i--) {
      if (!soulParts[i].update(p)) soulParts.splice(i, 1);
    }
    for (let i = glitches.length - 1; i >= 0; i--) {
      if (!glitches[i].update()) glitches.splice(i, 1);
    }
  }

  function draw(p) {
    // Translucent green tint (webcam shows through)
    p.noStroke();
    p.fill(5, 15, 5, 35);
    p.rect(0, 0, p.width, p.height);

    for (const g of glitches)  g.draw(p);
    for (const w of waves)     w.draw(p);
    for (const s of soulParts) s.draw(p);

    // Central soul glow
    const pulse = Math.sin(p.frameCount * 0.06) * 0.5 + 0.5;
    p.noStroke();
    p.fill(80, 200, 40, 12 + pulse * 10);
    p.ellipse(p.width / 2, p.height / 2, 200 + pulse * 60);
  }

  function clear() {
    waves.length     = 0;
    soulParts.length = 0;
    glitches.length  = 0;
  }

  return { spawn, update, draw, clear };
})();
