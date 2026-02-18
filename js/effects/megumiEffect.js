/* ═══════════════════════════════════════════════════════════
   megumiEffect.js — "Divine Dogs" Ten Shadows Technique
   Cyan/blue shadow wolves + dark swirling particles
   ═══════════════════════════════════════════════════════════ */

const MegumiEffect = (() => {
  const shadows = [];
  const trails = [];
  const sigils = [];

  const MAX_SHADOWS = 80;
  const MAX_TRAILS = 200;
  const MAX_SIGILS = 8;

  /* ── Shadow particle (wolf‑like swarm) ── */
  class ShadowParticle {
    constructor(p, power) {
      const side = p.random() < 0.5 ? -1 : 1;
      this.x = p.width / 2 + side * p.random(60, 200);
      this.y = p.height * 0.6 + p.random(-40, 40);
      const angle = p.random(p.TWO_PI);
      const spd = p.random(2, 6) * (0.5 + power);
      this.vx = Math.cos(angle) * spd;
      this.vy = Math.sin(angle) * spd - 1;
      this.size = p.random(4, 14);
      this.life = 1;
      this.decay = p.random(0.008, 0.02);
      this.hue = p.random(180, 210); // cyan‑blue
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.03; // slight gravity
      this.life -= this.decay;
      return this.life > 0;
    }
    draw(p) {
      const a = this.life * 220;
      p.noStroke();
      // Dark core
      p.fill(10, 10, 30, a);
      p.ellipse(this.x, this.y, this.size * 1.3);
      // Bright edge
      p.fill(this.hue, 255, 255, a * 0.6);
      p.ellipse(this.x, this.y, this.size * 0.6);
    }
  }

  /* ── Trail wisp ── */
  class Trail {
    constructor(p) {
      this.x = p.random(p.width);
      this.y = p.random(p.height);
      this.vx = p.random(-0.5, 0.5);
      this.vy = p.random(-1.5, -0.3);
      this.life = 1;
      this.decay = p.random(0.005, 0.015);
      this.size = p.random(1, 3);
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      return this.life > 0;
    }
    draw(p) {
      p.noStroke();
      p.fill(0, 200, 255, this.life * 120);
      p.ellipse(this.x, this.y, this.size);
    }
  }

  /* ── Summoning sigil (rotating glyph circle) ── */
  class Sigil {
    constructor(p) {
      this.x = p.width / 2 + p.random(-120, 120);
      this.y = p.height * 0.55 + p.random(-60, 60);
      this.r = p.random(40, 100);
      this.rot = p.random(p.TWO_PI);
      this.rotSpeed = p.random(-0.04, 0.04);
      this.alpha = 200;
      this.fade = p.random(1.5, 3);
      this.segments = Math.floor(p.random(5, 10));
    }
    update() {
      this.rot += this.rotSpeed;
      this.alpha -= this.fade;
      return this.alpha > 0;
    }
    draw(p) {
      p.push();
      p.translate(this.x, this.y);
      p.rotate(this.rot);
      p.noFill();
      p.stroke(0, 220, 255, this.alpha);
      p.strokeWeight(1.2);
      p.ellipse(0, 0, this.r * 2);
      for (let i = 0; i < this.segments; i++) {
        const a = (p.TWO_PI / this.segments) * i;
        p.line(0, 0, Math.cos(a) * this.r, Math.sin(a) * this.r);
      }
      p.pop();
    }
  }

  /* ── Public API ── */

  function spawn(p, power) {
    const count = Math.floor(4 + power * 8);
    for (let i = 0; i < count && shadows.length < MAX_SHADOWS; i++) {
      shadows.push(new ShadowParticle(p, power));
    }
    for (let i = 0; i < 3 && trails.length < MAX_TRAILS; i++) {
      trails.push(new Trail(p));
    }
    if (sigils.length < MAX_SIGILS && p.random() < 0.15) {
      sigils.push(new Sigil(p));
    }
  }

  function update(p) {
    for (let i = shadows.length - 1; i >= 0; i--) {
      if (!shadows[i].update()) shadows.splice(i, 1);
    }
    for (let i = trails.length - 1; i >= 0; i--) {
      if (!trails[i].update()) trails.splice(i, 1);
    }
    for (let i = sigils.length - 1; i >= 0; i--) {
      if (!sigils[i].update()) sigils.splice(i, 1);
    }
  }

  function draw(p) {
    // Translucent dark blue tint (webcam shows through)
    p.noStroke();
    p.fill(4, 4, 20, 35);
    p.rect(0, 0, p.width, p.height);

    for (const s of sigils) s.draw(p);
    for (const t of trails) t.draw(p);
    for (const s of shadows) s.draw(p);

    // Floor shadow gradient
    p.noStroke();
    for (let i = 0; i < 30; i++) {
      p.fill(0, 10, 30, 8);
      p.rect(0, p.height - i * 4, p.width, 4);
    }
  }

  function clear() {
    shadows.length = 0;
    trails.length = 0;
    sigils.length = 0;
  }

  return { spawn, update, draw, clear };
})();
