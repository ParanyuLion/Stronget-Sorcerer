/* ═══════════════════════════════════════════════════════════
   gojoEffect.js — "Unlimited Void" Domain Expansion
   Expanding white / purple geometric rings + void particles
   ═══════════════════════════════════════════════════════════ */

const GojoEffect = (() => {
  const rings = [];
  const sparks = [];
  const voidPts = []; // floating void particles

  const MAX_RINGS = 12;
  const MAX_SPARKS = 200;
  const MAX_VOID = 120;

  /* ── Ring class ── */
  class Ring {
    constructor(p, power) {
      this.x = p.width / 2 + p.random(-40, 40);
      this.y = p.height / 2 + p.random(-40, 40);
      this.r = 10;
      this.maxR = p.random(200, 600) * (0.6 + power);
      this.speed = p.random(3, 8);
      this.weight = p.random(1, 3.5);
      this.hue = p.random(250, 290); // purple range
      this.alpha = 255;
      this.sides = p.random([0, 6, 8, 12]); // 0 = circle
      this.rot = p.random(p.TWO_PI);
      this.rotSpeed = p.random(-0.02, 0.02);
    }
    update() {
      this.r += this.speed;
      this.rot += this.rotSpeed;
      this.alpha = p5.prototype.map(this.r, 0, this.maxR, 255, 0);
      return this.r < this.maxR;
    }
    draw(p) {
      p.push();
      p.translate(this.x, this.y);
      p.rotate(this.rot);
      p.noFill();
      p.strokeWeight(this.weight);
      p.stroke(this.hue, 180, 255, this.alpha);
      if (this.sides === 0) {
        p.ellipse(0, 0, this.r * 2);
      } else {
        p.beginShape();
        for (let i = 0; i < this.sides; i++) {
          const a = (p.TWO_PI / this.sides) * i;
          p.vertex(Math.cos(a) * this.r, Math.sin(a) * this.r);
        }
        p.endShape(p.CLOSE);
      }
      p.pop();
    }
  }

  /* ── Spark particle ── */
  class Spark {
    constructor(p, power) {
      const angle = p.random(p.TWO_PI);
      const speed = p.random(1, 5) * (0.5 + power);
      this.x = p.width / 2;
      this.y = p.height / 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = 1;
      this.decay = p.random(0.005, 0.02);
      this.size = p.random(1, 4);
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
      p.fill(220, 200, 255, a);
      p.ellipse(this.x, this.y, this.size);
    }
  }

  /* ── Void dot (ambient) ── */
  class VoidDot {
    constructor(p) {
      this.x = p.random(p.width);
      this.y = p.random(p.height);
      this.size = p.random(1, 3);
      this.phase = p.random(p.TWO_PI);
      this.speed = p.random(0.01, 0.03);
    }
    update(p) {
      this.phase += this.speed;
      this.x += Math.sin(this.phase) * 0.4;
      this.y += Math.cos(this.phase * 0.7) * 0.4;
      // wrap
      if (this.x < 0) this.x = p.width;
      if (this.x > p.width) this.x = 0;
      if (this.y < 0) this.y = p.height;
      if (this.y > p.height) this.y = 0;
    }
    draw(p) {
      const a = (Math.sin(this.phase) * 0.5 + 0.5) * 180;
      p.noStroke();
      p.fill(200, 180, 255, a);
      p.ellipse(this.x, this.y, this.size);
    }
  }

  /* ── Public API ── */

  function spawn(p, power) {
    // Add a ring
    if (rings.length < MAX_RINGS) rings.push(new Ring(p, power));
    // Burst of sparks
    const burstCount = Math.floor(6 + power * 12);
    for (let i = 0; i < burstCount && sparks.length < MAX_SPARKS; i++) {
      sparks.push(new Spark(p, power));
    }
    // Maintain ambient void dots
    while (voidPts.length < MAX_VOID) voidPts.push(new VoidDot(p));
  }

  function update(p) {
    for (let i = rings.length - 1; i >= 0; i--) {
      if (!rings[i].update()) rings.splice(i, 1);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (!sparks[i].update()) sparks.splice(i, 1);
    }
    for (const v of voidPts) v.update(p);
  }

  function draw(p) {
    // Translucent void tint (webcam shows through)
    p.noStroke();
    p.fill(5, 2, 18, 35);
    p.rect(0, 0, p.width, p.height);

    // Ambient void dots
    for (const v of voidPts) v.draw(p);

    // Rings
    for (const r of rings) r.draw(p);

    // Sparks
    for (const s of sparks) s.draw(p);

    // Central glow
    const glowSize = 120 + Math.sin(p.frameCount * 0.04) * 30;
    for (let i = 3; i > 0; i--) {
      p.noStroke();
      p.fill(180, 140, 255, 8 * i);
      p.ellipse(p.width / 2, p.height / 2, glowSize * i);
    }
  }

  function clear() {
    rings.length = 0;
    sparks.length = 0;
    voidPts.length = 0;
  }

  return { spawn, update, draw, clear };
})();
