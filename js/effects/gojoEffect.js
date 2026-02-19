/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   gojoEffect.js â€” "Unlimited Void" Domain Expansion (ç„¡é‡ç©ºå‡¦)
   Three.js â€” dual-scene alpha-safe rendering (NO EffectComposer).

   Visual targets (from reference image):
     â€¢ Pitch-black void sphere at screen centre
     â€¢ Violent swirling PURPLE/white ink vortex spiraling INTO core
     â€¢ Ink splatter chunks flung outward radially
     â€¢ Electric arcs (random lightning) crackling around the sphere
     â€¢ Chromatic aberration overlay at full power
     â€¢ Violent irregular pulsation on the core
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

const GojoEffect = (() => {
  /* â”€â”€ Three.js handles â”€â”€ */
  let renderer, scene, glowScene, camera, clock;
  let canvas3d;
  let active = false;

  /* â”€â”€ Core â”€â”€ */
  let coreMesh, coreMat;
  let horizonMesh, horizonMat;

  /* â”€â”€ Vortex disk â”€â”€ */
  let vortexMesh, vortexMat;

  /* â”€â”€ Glow copies (additive scene) â”€â”€ */
  let glowCore, glowHorizon;

  /* â”€â”€ Ink / splatter particles â”€â”€ */
  let inkCloud, inkPositions, inkVelocities, inkLife, inkAngVel;
  const INK_COUNT = 5000;

  /* ── Splatter blobs (large slow chunks) ── */
  let blobCloud, blobPositions, blobVelocities, blobLife;
  const BLOB_COUNT = 420;

  /* â”€â”€ Electric arc lines â”€â”€ */
  const arcLines = [];
  let arcTimer = 0;
  const ARC_INTERVAL = 0.08; // seconds between arc bursts

  /* â”€â”€ State â”€â”€ */
  let power = 0.5;
  let domainAge = 0; // seconds since activation

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     GLSL: Void sphere â€” pure black with event horizon
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const coreVert = /* glsl */ `
    varying vec3 vNormal;
    uniform float uTime;
    void main(){
      vNormal = normalize(normalMatrix * normal);
      // violent vibration â€” high freq, irregular
      float vib = sin(uTime*28.0)*0.012 + sin(uTime*47.3)*0.007
                + sin(uTime*13.1 + position.x*9.0)*0.009;
      vec3 p = position + normal * vib;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;
  const coreFrag = /* glsl */ `
    varying vec3 vNormal;
    uniform float uTime;
    uniform float uPower;
    void main(){
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 4.5);
      // event horizon: dark grey -> bright white rim
      vec3 horizonCol = mix(vec3(0.12,0.12,0.12), vec3(1.0,1.0,1.0), rim);
      // pitch black core, white rim glows
      vec3 col = mix(vec3(0.0), horizonCol, rim * (0.6 + uPower*0.4));
      float alpha = mix(0.96, 1.0, rim);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     GLSL: Vortex disk â€” swirling ink nebula
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const vortexVert = /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const vortexFrag = /* glsl */ `
    varying vec2 vUv;
    uniform float uTime;
    uniform float uPower;
    uniform float uAge;

    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.545); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                 mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=0.5;}
      return v;
    }

    void main(){
      vec2 uv = vUv * 2.0 - 1.0;     // âˆ’1..1
      float dist = length(uv);
      if(dist > 1.0){ discard; }      // circular disk

      // swirl angle â€” tighter near centre, driven by time
      float angle = atan(uv.y, uv.x);
      float swirl = angle + uTime * 2.2 - dist * 9.0;
      vec2 swirlUv = vec2(cos(swirl)*dist, sin(swirl)*dist) * 2.5;

      // two layers of fbm for ink turbulence
      float n1 = fbm(swirlUv + uTime*0.18);
      float n2 = fbm(swirlUv * 1.7 - uTime*0.12);
      float ink = n1 * n2 * 2.5;

      // deep black → bright white spiral arm
      float arm = smoothstep(0.3, 0.85, ink) * smoothstep(1.0, 0.1, dist);
      // bright white near event horizon, no colour tint
      float horizonRim = smoothstep(0.7, 0.0, dist);
      vec3 inkCol  = mix(vec3(0.0), vec3(1.0, 1.0, 1.0), arm);
      vec3 rimCol  = vec3(1.0) * horizonRim * 0.45;
      vec3 col = inkCol + rimCol;

      // fade out edges, suck toward centre
      float edge  = smoothstep(1.0, 0.55, dist);
      float inner = smoothstep(0.18, 0.28, dist); // hide under core sphere
      float alpha = edge * inner * (arm * 0.9 + horizonRim * 0.25) * (0.4 + uAge*0.6);

      gl_FragColor = vec4(col, alpha * uPower);
    }
  `;

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     GLSL: Glow halo (additive, back-face)
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  const glowVert = /* glsl */ `
    varying vec3 vNormal;
    void main(){
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `;
  const glowFrag = /* glsl */ `
    varying vec3 vNormal;
    uniform float uPower;
    uniform vec3  uColor;
    void main(){
      float rim = pow(1.0 - abs(dot(vNormal, vec3(0,0,1))), 1.6);
      gl_FragColor = vec4(uColor * rim * uPower, rim * 0.6);
    }
  `;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Canvas â”€â”€ */
  function _createCanvas() {
    canvas3d = document.getElementById("gojo-canvas");
    if (!canvas3d) {
      canvas3d = document.createElement("canvas");
      canvas3d.id = "gojo-canvas";
      canvas3d.style.cssText =
        "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;";
      document.body.appendChild(canvas3d);
    }
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Scene â”€â”€ */
  function _buildScene() {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas3d,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;

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

    /* â”€â”€ Void sphere core â”€â”€ */
    coreMat = new THREE.ShaderMaterial({
      vertexShader: coreVert,
      fragmentShader: coreFrag,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0.5 } },
      transparent: true,
      depthWrite: true,
    });
    coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 64, 64), coreMat);
    coreMesh.renderOrder = 5;
    scene.add(coreMesh);

    /* â”€â”€ Horizon glow (additive) â”€â”€ */
    glowCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        uniforms: {
          uPower: { value: 1.0 },
          uColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
      }),
    );
    glowScene.add(glowCore);

    /* â”€â”€ Vortex disk â”€â”€ */
    vortexMat = new THREE.ShaderMaterial({
      vertexShader: vortexVert,
      fragmentShader: vortexFrag,
      uniforms: {
        uTime: { value: 0 },
        uPower: { value: 0.0 },
        uAge: { value: 0.0 },
      },
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    vortexMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 3.6, 1, 1),
      vortexMat,
    );
    vortexMesh.renderOrder = 2;
    scene.add(vortexMesh);

    /* â”€â”€ Ink point cloud â”€â”€ */
    _buildInkCloud();
    _buildBlobCloud();

    /* â”€â”€ Lights â”€â”€ */
    scene.add(new THREE.PointLight(0xffffff, 2.5, 8, 2));
    scene.add(new THREE.AmbientLight(0x222222, 1.0));

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Ink cloud â”€â”€ */
  function _buildInkCloud() {
    inkPositions = new Float32Array(INK_COUNT * 3);
    inkVelocities = new Float32Array(INK_COUNT * 3);
    inkLife = new Float32Array(INK_COUNT);
    inkAngVel = new Float32Array(INK_COUNT);
    for (let i = 0; i < INK_COUNT; i++) _resetInk(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(inkPositions, 3));
    inkCloud = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.014,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    inkCloud.renderOrder = 4;
    scene.add(inkCloud);
  }

  function _resetInk(i, scatter) {
    // Spawn on outer ring, will spiral inward
    const r = scatter ? 0.4 + Math.random() * 1.8 : 1.4 + Math.random() * 0.8;
    const theta = Math.random() * Math.PI * 2;
    inkPositions[i * 3] = Math.cos(theta) * r;
    inkPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.06; // mostly flat
    inkPositions[i * 3 + 2] = Math.sin(theta) * r;
    inkVelocities[i * 3] =
      inkVelocities[i * 3 + 1] =
      inkVelocities[i * 3 + 2] =
        0;
    inkLife[i] = 0.6 + Math.random() * 0.4;
    inkAngVel[i] = (Math.random() > 0.5 ? 1 : -1) * (0.9 + Math.random() * 1.4);
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Blob cloud â”€â”€ */
  function _buildBlobCloud() {
    blobPositions = new Float32Array(BLOB_COUNT * 3);
    blobVelocities = new Float32Array(BLOB_COUNT * 3);
    blobLife = new Float32Array(BLOB_COUNT);
    for (let i = 0; i < BLOB_COUNT; i++) _resetBlob(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(blobPositions, 3));
    blobCloud = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x000000,
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1.0,
        blending: THREE.NormalBlending,
        depthWrite: false,
      }),
    );
    blobCloud.renderOrder = 3;
    scene.add(blobCloud);
  }

  function _resetBlob(i, scatter) {
    // Blobs shoot OUTWARD from singularity like ink splatter
    const angle = Math.random() * Math.PI * 2;
    const spd = 0.6 + Math.random() * 1.2;
    const r0 = scatter ? Math.random() * 2.2 : 0.25 + Math.random() * 0.1;
    blobPositions[i * 3] = Math.cos(angle) * r0;
    blobPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    blobPositions[i * 3 + 2] = Math.sin(angle) * r0;
    blobVelocities[i * 3] = Math.cos(angle) * spd;
    blobVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
    blobVelocities[i * 3 + 2] = Math.sin(angle) * spd;
    blobLife[i] = 0.4 + Math.random() * 0.6;
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Electric arcs â”€â”€ */
  function _spawnArc() {
    // Remove old arcs
    for (const a of arcLines) scene.remove(a);
    arcLines.length = 0;

    const arcCount = 2 + Math.floor(Math.random() * 3);
    for (let a = 0; a < arcCount; a++) {
      const pts = [];
      const baseA = Math.random() * Math.PI * 2;
      const r0 = 0.25;
      const r1 = 0.5 + Math.random() * 0.6;
      const segs = 8 + Math.floor(Math.random() * 8);

      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const r = r0 + (r1 - r0) * t;
        const jitter = (1 - t) * 0.18 * Math.random();
        const angle = baseA + (Math.random() - 0.5) * 0.8 * (1 - t);
        pts.push(
          new THREE.Vector3(
            Math.cos(angle) * r + (Math.random() - 0.5) * jitter,
            (Math.random() - 0.5) * 0.06 * (1 - t),
            Math.sin(angle) * r + (Math.random() - 0.5) * jitter,
          ),
        );
      }

      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const col = Math.random() > 0.3 ? 0xffffff : 0xdddddd;
      const mat = new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.85 + Math.random() * 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line._ttl = 0.05 + Math.random() * 0.08;
      line._age = 0;
      line.renderOrder = 8;
      scene.add(line);
      arcLines.push(line);
    }
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Per-frame â”€â”€ */
  function _tick() {
    if (!active) return;
    requestAnimationFrame(_tick);

    const dt = clock.getDelta();
    const time = clock.getElapsedTime();
    domainAge = Math.min(1, domainAge + dt * 0.55);

    /* â”€â”€ Core uniforms â”€â”€ */
    coreMat.uniforms.uTime.value = time;
    coreMat.uniforms.uPower.value = power;
    // violent pulsation: high-frequency, irregular scale
    const vib =
      1.0 +
      Math.sin(time * 28.3) * 0.025 +
      Math.sin(time * 47.1) * 0.012 +
      Math.sin(time * 11.7) * 0.018;
    coreMesh.scale.setScalar(vib);
    glowCore.scale.setScalar(vib * 2.0);
    glowCore.material.uniforms.uPower.value = domainAge * power;

    /* â”€â”€ Vortex disk â”€â”€ */
    vortexMat.uniforms.uTime.value = time;
    vortexMat.uniforms.uPower.value = domainAge;
    vortexMat.uniforms.uAge.value = domainAge;

    /* â”€â”€ Ink particles (spiral inward) â”€â”€ */
    const G = 3.8; // gravitational pull
    for (let i = 0; i < INK_COUNT; i++) {
      const px = inkPositions[i * 3];
      const pz = inkPositions[i * 3 + 2];
      const r = Math.sqrt(px * px + pz * pz) + 0.001;

      // Inward radial gravity
      const acc = G / (r * r);
      inkVelocities[i * 3] += (-px / r) * acc * dt;
      inkVelocities[i * 3 + 2] += (-pz / r) * acc * dt;

      // Tangential swirl (CCW)
      const swirl = (inkAngVel[i] * dt) / (r + 0.15);
      inkVelocities[i * 3] += -pz * swirl;
      inkVelocities[i * 3 + 2] += px * swirl;

      inkPositions[i * 3] += inkVelocities[i * 3] * dt;
      inkPositions[i * 3 + 1] += inkVelocities[i * 3 + 1] * dt;
      inkPositions[i * 3 + 2] += inkVelocities[i * 3 + 2] * dt;

      inkLife[i] -= dt * 0.08;
      if (r < 0.2 || inkLife[i] <= 0) _resetInk(i, false);
    }
    inkCloud.geometry.attributes.position.needsUpdate = true;

    /* â”€â”€ Blob particles (outward splatter) â”€â”€ */
    for (let i = 0; i < BLOB_COUNT; i++) {
      blobPositions[i * 3] += blobVelocities[i * 3] * dt;
      blobPositions[i * 3 + 1] += blobVelocities[i * 3 + 1] * dt;
      blobPositions[i * 3 + 2] += blobVelocities[i * 3 + 2] * dt;
      blobLife[i] -= dt * 0.22;
      if (blobLife[i] <= 0) _resetBlob(i, false);
    }
    blobCloud.geometry.attributes.position.needsUpdate = true;

    /* â”€â”€ Electric arcs â”€â”€ */
    arcTimer -= dt;
    if (arcTimer <= 0) {
      _spawnArc();
      arcTimer = ARC_INTERVAL + Math.random() * 0.12;
    }
    for (let i = arcLines.length - 1; i >= 0; i--) {
      arcLines[i]._age += dt;
      arcLines[i].material.opacity =
        (1 - arcLines[i]._age / arcLines[i]._ttl) * 0.9;
      if (arcLines[i]._age >= arcLines[i]._ttl) {
        scene.remove(arcLines[i]);
        arcLines.splice(i, 1);
      }
    }

    /* â”€â”€ Render (dual-scene, transparent) â”€â”€ */
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(glowScene, camera);
  }

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Public API â”€â”€ */
  function spawn(_p, _power) {}
  function update(_p) {}
  function draw(_p) {}

  function clear() {
    domainAge = 0;
    for (let i = 0; i < INK_COUNT; i++) _resetInk(i, true);
    for (let i = 0; i < BLOB_COUNT; i++) _resetBlob(i, true);
    if (inkCloud) inkCloud.geometry.attributes.position.needsUpdate = true;
    if (blobCloud) blobCloud.geometry.attributes.position.needsUpdate = true;
    for (const a of arcLines) scene && scene.remove(a);
    arcLines.length = 0;
    arcTimer = 0;
    if (canvas3d) canvas3d.style.display = "none";
  }

  function activate(_power) {
    if (active) return;
    active = true;
    power = _power || 0.5;
    domainAge = 0;
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
  }

  function setLandmarkPosition(_lm) {
    // Gojo's domain is centred - landmark not used to translate the effect
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
