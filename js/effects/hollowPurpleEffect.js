/* ═══════════════════════════════════════════════════════════════════
   hollowPurpleEffect.js — Gojo's "Hollow Purple" (虚式・茈)
   Three.js scene overlaid on the webcam p5 canvas (fully transparent BG).

   WHY NO EffectComposer/UnrealBloomPass:
     Those passes render to internal framebuffers and composite back
     with an opaque black fill — killing the alpha transparency needed
     to see the webcam underneath.

   FAKE BLOOM (alpha-safe):
     Render two scenes with one renderer.render() each:
       1. scene     — main objects (ball, rings, particles)
       2. glowScene — oversized transparent additive-blended copies
     Both are rendered onto the same transparent canvas with autoClear=false.
   ═══════════════════════════════════════════════════════════════════ */

const HollowPurpleEffect = (() => {
  /* ─── Three.js objects ─── */
  let renderer, scene, glowScene, camera;
  let energyBall, ballMat;
  let glowBall, glowMat;
  let ringBlue, ringRed;
  let glowRingBlue, glowRingRed;
  let pointLight;
  let particles, particlePositions, particleVelocities;
  let canvas3d;
  let active = false;
  let clock;
  let mergeProgress = 0;
  const ballPosition = new THREE.Vector3(0, 0, 0);

  const PARTICLE_COUNT = 1200;

  /* ══════════ GLSL: Energy-ball vertex shader ═════════════ */
  const ballVertexShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      float disp = 0.04 * sin(uTime * 3.0 + position.y * 8.0)
                 + 0.02 * sin(uTime * 5.7 + position.x * 12.0);
      vec3 displaced = position + normal * disp;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `;

  /* ══════════ GLSL: Energy-ball fragment shader ═══════════ */
  const ballFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    varying vec2 vUv;
    uniform float uTime;
    uniform float uPower;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
      return v;
    }
    void main() {
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 3.5);
      vec2 uv = vUv * 4.0 - vec2(uTime*0.3, uTime*0.15);
      float energy = fbm(uv + fbm(uv + uTime*0.1));
      float r = fbm(vUv*5.0 + vec2(uTime*0.4, 0.0));
      float b = fbm(vUv*5.0 - vec2(uTime*0.35, uTime*0.2));
      vec3 coreCol   = vec3(0.45+r*0.3, 0.05, 0.80+b*0.2);
      vec3 rimCol    = vec3(0.90, 0.20, 1.00);
      vec3 energyCol = mix(coreCol, vec3(0.6, 0.0, 1.0), energy*0.6);
      vec3 col = mix(energyCol, rimCol, fresnel) * (0.8 + uPower*0.6);
      float alpha = mix(0.85, 1.0, fresnel) * (0.7 + energy*0.3);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  /* ══════════ GLSL: Radial glow halo (fake bloom) ════════ */
  const glowVertexShader = /* glsl */ `
    varying vec3 vNormal;
    void main(){
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const glowFragmentShader = /* glsl */ `
    varying vec3 vNormal;
    uniform float uPower;
    uniform vec3  uColor;
    void main(){
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 1.8);
      gl_FragColor = vec4(uColor * rim * uPower, rim * 0.55);
    }
  `;

  /* ─── Build THREE canvas ─── */
  function _createCanvas() {
    canvas3d = document.getElementById("three-canvas");
    if (!canvas3d) {
      canvas3d = document.createElement("canvas");
      canvas3d.id = "three-canvas";
      canvas3d.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;";
      document.body.appendChild(canvas3d);
    }
  }

  /* ─── Build scene ─── */
  function _buildScene() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas3d,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // FULLY TRANSPARENT clear
    renderer.autoClear = false; // we clear manually per frame

    scene = new THREE.Scene();
    glowScene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 5);
    clock = new THREE.Clock();

    /* Core energy ball */
    ballMat = new THREE.ShaderMaterial({
      vertexShader: ballVertexShader,
      fragmentShader: ballFragmentShader,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0.5 } },
      transparent: true,
      depthWrite: false,
    });
    energyBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 64, 64),
      ballMat,
    );
    energyBall.renderOrder = 10;
    scene.add(energyBall);

    /* Glow halo — oversized sphere, additive, rendered in glowScene */
    glowMat = new THREE.ShaderMaterial({
      vertexShader: glowVertexShader,
      fragmentShader: glowFragmentShader,
      uniforms: {
        uPower: { value: 1.0 },
        uColor: { value: new THREE.Color(0.6, 0.0, 1.0) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    glowBall = new THREE.Mesh(new THREE.SphereGeometry(0.72, 32, 32), glowMat);
    glowScene.add(glowBall);

    /* Blue ring */
    const ringGeo = new THREE.TorusGeometry(0.55, 0.025, 16, 120);
    ringBlue = new THREE.Mesh(
      ringGeo,
      new THREE.MeshStandardMaterial({
        color: 0x0088ff,
        emissive: 0x0044cc,
        emissiveIntensity: 3.0,
        metalness: 0.2,
        roughness: 0.3,
      }),
    );
    ringBlue.rotation.x = Math.PI / 2;
    scene.add(ringBlue);

    glowRingBlue = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.06, 8, 60),
      new THREE.MeshBasicMaterial({
        color: 0x0088ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glowRingBlue.rotation.x = Math.PI / 2;
    glowScene.add(glowRingBlue);

    /* Red ring */
    ringRed = new THREE.Mesh(
      ringGeo.clone(),
      new THREE.MeshStandardMaterial({
        color: 0xff2200,
        emissive: 0xcc1100,
        emissiveIntensity: 3.0,
        metalness: 0.2,
        roughness: 0.3,
      }),
    );
    ringRed.rotation.z = Math.PI / 2;
    scene.add(ringRed);

    glowRingRed = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.06, 8, 60),
      new THREE.MeshBasicMaterial({
        color: 0xff2200,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glowRingRed.rotation.z = Math.PI / 2;
    glowScene.add(glowRingRed);

    /* Point light */
    pointLight = new THREE.PointLight(0xaa44ff, 0, 8, 2);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0x220033, 1.0));

    /* Particles */
    _buildParticles();
  }

  function _buildParticles() {
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) _resetParticle(i);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xcc44ff,
        size: 0.022,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(particles);
  }

  function _resetParticle(i) {
    const r = 1.5 + Math.random() * 1.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] =
      ballPosition.x + r * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] =
      ballPosition.y + r * Math.sin(phi) * Math.sin(theta);
    particlePositions[i * 3 + 2] = ballPosition.z + r * Math.cos(phi);
    particleVelocities[i * 3] =
      particleVelocities[i * 3 + 1] =
      particleVelocities[i * 3 + 2] =
        0;
  }

  /* ─── Per-frame tick ─── */
  function _tick() {
    if (!active) return;
    requestAnimationFrame(_tick);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    mergeProgress = Math.min(1, mergeProgress + dt * 1.2);

    /* Ball */
    ballMat.uniforms.uTime.value = time;
    ballMat.uniforms.uPower.value = 0.5 + mergeProgress * 0.5;
    energyBall.position.copy(ballPosition);
    energyBall.scale.setScalar(0.4 + mergeProgress * 0.6);

    /* Glow halo */
    glowBall.position.copy(ballPosition);
    glowBall.scale.setScalar(energyBall.scale.x * 2.2);
    glowMat.uniforms.uPower.value = mergeProgress;

    /* Point light */
    pointLight.position.copy(ballPosition);
    pointLight.intensity = mergeProgress * 3.0;

    /* Blue ring converging from left */
    const blueOff = (1 - mergeProgress) * 1.6;
    ringBlue.position.set(
      ballPosition.x - blueOff,
      ballPosition.y,
      ballPosition.z,
    );
    ringBlue.rotation.y = time * 2.5;
    ringBlue.scale.setScalar(1 - mergeProgress * 0.7);
    glowRingBlue.position.copy(ringBlue.position);
    glowRingBlue.rotation.copy(ringBlue.rotation);
    glowRingBlue.scale.copy(ringBlue.scale);

    /* Red ring converging from right */
    const redOff = (1 - mergeProgress) * 1.6;
    ringRed.position.set(
      ballPosition.x + redOff,
      ballPosition.y,
      ballPosition.z,
    );
    ringRed.rotation.x = time * -2.5;
    ringRed.scale.setScalar(1 - mergeProgress * 0.7);
    glowRingRed.position.copy(ringRed.position);
    glowRingRed.rotation.copy(ringRed.rotation);
    glowRingRed.scale.copy(ringRed.scale);

    /* Particles */
    _updateParticles(dt);

    /* Render — transparent background, two scenes */
    renderer.clear(true, true, true); // clear to alpha=0
    renderer.render(scene, camera);
    renderer.clearDepth(); // keep colour, reset depth
    renderer.render(glowScene, camera); // additive glow layer
  }

  function _updateParticles(dt) {
    const G = 4.5;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const px = particlePositions[i * 3] - ballPosition.x;
      const py = particlePositions[i * 3 + 1] - ballPosition.y;
      const pz = particlePositions[i * 3 + 2] - ballPosition.z;
      const d = Math.sqrt(px * px + py * py + pz * pz) + 0.001;
      const acc = G / (d * d);
      particleVelocities[i * 3] += (-px / d) * acc * dt;
      particleVelocities[i * 3 + 1] += (-py / d) * acc * dt;
      particleVelocities[i * 3 + 2] += (-pz / d) * acc * dt;
      const swirl = (1.2 * dt) / (d + 0.1);
      particleVelocities[i * 3] += -pz * swirl;
      particleVelocities[i * 3 + 2] += px * swirl;
      particlePositions[i * 3] += particleVelocities[i * 3] * dt;
      particlePositions[i * 3 + 1] += particleVelocities[i * 3 + 1] * dt;
      particlePositions[i * 3 + 2] += particleVelocities[i * 3 + 2] * dt;
      if (d < 0.3) _resetParticle(i);
    }
    particles.geometry.attributes.position.needsUpdate = true;
  }

  /* ─── Landmark → 3-D world position ─── */
  function setLandmarkPosition(lm) {
    if (!lm) return;
    const nx = (1 - lm.x) * 2 - 1;
    const ny = -(lm.y * 2 - 1);
    const aspect = window.innerWidth / window.innerHeight;
    const half = Math.tan((50 * Math.PI) / 180 / 2);
    const zDist = 4.5;
    ballPosition.set(nx * aspect * half * zDist, ny * half * zDist, 0);
  }

  /* ─── Public API ─── */
  function spawn(_p, _power) {}
  function update(_p) {}
  function draw(_p) {}

  function clear() {
    mergeProgress = 0;
    ballPosition.set(0, 0, 0);
    if (particlePositions) {
      for (let i = 0; i < PARTICLE_COUNT; i++) _resetParticle(i);
      if (particles) particles.geometry.attributes.position.needsUpdate = true;
    }
    if (canvas3d) canvas3d.style.display = "none";
  }

  function activate(_power) {
    if (active) return;
    active = true;
    mergeProgress = 0;
    canvas3d.style.display = "block";
    clock.start();
    _tick();
  }

  function deactivate() {
    active = false;
    clear();
  }

  function init() {
    _createCanvas();
    _buildScene();
    canvas3d.style.display = "none";
    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  return {
    init,
    activate,
    deactivate,
    spawn,
    update,
    draw,
    clear,
    setLandmarkPosition,
  };
})();
