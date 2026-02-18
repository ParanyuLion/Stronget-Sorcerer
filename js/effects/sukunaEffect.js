/* ═══════════════════════════════════════════════════════════
   sukunaEffect.js — "Malevolent Shrine" Domain Expansion
   Red slash lines + demonic particle burst
   ═══════════════════════════════════════════════════════════ */

const SukunaEffect = (() => {
  const slashes = [];
  const embers = [];
  const cracks = [];

  const MAX_SLASHES = 25;
  const MAX_EMBERS = 300;
  const MAX_CRACKS = 40;

  /* ── Slash line ── */
  class Slash {
    constructor(p, power) {
      const cx = p.width / 2;
      const cy = p.height / 2;
      const angle = p.random(p.TWO_PI);
      const len = p.random(150, 500) * (0.5 + power);
      this.x1 = cx + Math.cos(angle) * p.random(20, 200);
      this.y1 = cy + Math.sin(angle) * p.random(20, 200);
      this.x2 = this.x1 + Math.cos(angle + p.random(-0.4, 0.4)) * len;
      this.y2 = this.y1 + Math.sin(angle + p.random(-0.4, 0.4)) * len;
      this.progress = 0; // 0→1 animation
      this.speed = p.random(0.06, 0.14);
      this.weight = p.random(1.5, 4);
      this.alpha = 255;
      this.fadeSpeed = p.random(2, 5);
      this.done = false;
    }
    update() {
      if (this.progress < 1) {
        this.progress = Math.min(1, this.progress + this.speed);
      } else {
        this.alpha -= this.fadeSpeed;
        if (this.alpha <= 0) this.done = true;
      }
      return !this.done;
    }
    draw(p) {
      const ex = p.lerp(this.x1, this.x2, this.progress);
      const ey = p.lerp(this.y1, this.y2, this.progress);
      p.strokeWeight(this.weight);

      // Glow layer
      p.stroke(255, 50, 50, this.alpha * 0.3);
      p.strokeWeight(this.weight + 4);
      p.line(this.x1, this.y1, ex, ey);

      // Core slash
      p.stroke(255, 80, 60, this.alpha);
      p.strokeWeight(this.weight);
      p.line(this.x1, this.y1, ex, ey);
    }
  }

  /* ── Ember particle ── */
  class Ember {
    constructor(p, power) {
      this.x = p.random(p.width);
      this.y = p.random(p.height);
      this.vx = p.random(-1, 1);
      this.vy = p.random(-3, -0.5) * (0.5 + power);
      this.life = 1;
      this.decay = p.random(0.006, 0.02);
      this.size = p.random(2, 5);
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      return this.life > 0;
    }
    draw(p) {
      const a = this.life * 255;
      p.noStroke();
      p.fill(255, p.random(40, 120), 30, a);
      p.ellipse(this.x, this.y, this.size);
    }
  }

  /* ── Ground crack ── */
  class Crack {
    constructor(p) {
      this.x = p.random(p.width);
      this.y = p.height - p.random(0, p.height * 0.35);
      this.len = p.random(30, 120);
      this.angle = p.random(-Math.PI * 0.8, -Math.PI * 0.2);
      this.alpha = 255;
      this.fade = p.random(1, 3);
    }
    update() {
      this.alpha -= this.fade;
      return this.alpha > 0;
    }
    draw(p) {
      const ex = this.x + Math.cos(this.angle) * this.len;
      const ey = this.y + Math.sin(this.angle) * this.len;
      p.stroke(200, 30, 20, this.alpha);
      p.strokeWeight(1.5);
      p.line(this.x, this.y, ex, ey);
    }
  }

  /* ── Public API ── */

  function spawn(p, power) {
    // Slash burst
    const slashCount = Math.floor(2 + power * 4);
    for (let i = 0; i < slashCount && slashes.length < MAX_SLASHES; i++) {
      slashes.push(new Slash(p, power));
    }
    // Embers
    const emberCount = Math.floor(8 + power * 16);
    for (let i = 0; i < emberCount && embers.length < MAX_EMBERS; i++) {
      embers.push(new Ember(p, power));
    }
    // Cracks
    if (cracks.length < MAX_CRACKS && p.random() < 0.3) {
      cracks.push(new Crack(p));
    }
  }

  function update(p) {
    for (let i = slashes.length - 1; i >= 0; i--) {
      if (!slashes[i].update()) slashes.splice(i, 1);
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      if (!embers[i].update()) embers.splice(i, 1);
    }
    for (let i = cracks.length - 1; i >= 0; i--) {
      if (!cracks[i].update()) cracks.splice(i, 1);
    }
  }

  function draw(p) {
    // Translucent crimson tint (webcam shows through)
    p.noStroke();
    p.fill(18, 2, 2, 35);
    p.rect(0, 0, p.width, p.height);

    // Vignette‑like red pulse
    const pulse = (Math.sin(p.frameCount * 0.05) * 0.5 + 0.5) * 30;
    p.noStroke();
    p.fill(80 + pulse, 0, 0, 15);
    p.rect(0, 0, p.width, p.height);

    for (const c of cracks) c.draw(p);
    for (const s of slashes) s.draw(p);
    for (const e of embers) e.draw(p);
  }

  function clear() {
    slashes.length = 0;
    embers.length = 0;
    cracks.length = 0;
  }

  return { spawn, update, draw, clear };
})();
