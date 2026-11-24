/**
 * stage-manager.js
 * 全站單一共享電影級 WebGL 舞台控制器
 * - 3D 方向性體積光束（Directional Volumetric Light Cone Shader）
 * - 動態物件追光（光影隨筊杯與星儀移動即時變化）
 * - 克制精簡的微塵粒子（52 顆 / 低效能 28 顆）
 * - 關鍵 Impact 阻尼鏡頭微震動＋電影級鏡頭呼吸推拉
 * - 整合 MoonBlocksScene（擲筊）與 CosmicOracleScene（宇宙指引）
 */

import * as THREE from 'three';
import { MoonBlocksScene } from './moon-blocks-3d.js';
import { TriadSanctumScene } from './triad-sanctum-3d.js';
import { CosmicOracleScene, formatOracleIndex } from './cosmic-oracle-3d.js';
import { ritualSound } from './sound-synth.js';

const FOG_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

const FOG_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uAccentColor;
  uniform float uPulse;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(13.1, 7.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.055;

    float n1 = fbm(uv * 2.5 + vec2(t, -t * 0.55));
    float n2 = fbm(uv * 4.0 - vec2(t * 0.75, t * 0.35) + n1 * 0.6);
    float mist = smoothstep(0.32, 0.88, n2);

    // 柔和斜射頂部天光暈染
    float beamAxis = abs((uv.x - 0.56) * 1.4 + (uv.y - 1.06) * 0.34);
    float beam = exp(-beamAxis * 4.2) * smoothstep(0.05, 0.95, uv.y);

    vec3 baseCol = vec3(0.021, 0.022, 0.029);
    vec3 mistCol = mix(vec3(0.05, 0.053, 0.068), uAccentColor, 0.24);

    vec3 col = baseCol;
    col += mistCol * mist * (0.26 + uPulse * 0.12);
    col += uAccentColor * beam * (0.11 + uPulse * 0.09);

    float dist = distance(uv, vec2(0.5, 0.46));
    col *= smoothstep(1.06, 0.16, dist);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * 3D 空間方向性體積光錐 Shader（邊緣 Fresnel 軟化＋縱向衰減）
 */
const VOLUMETRIC_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const VOLUMETRIC_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;

  void main() {
    // 視角邊緣柔化（消除幾何圓錐硬邊）
    float fresnel = pow(abs(dot(vNormal, vViewDir)), 1.9);
    // 上強下柔的縱向光束衰減
    float verticalFade = smoothstep(0.0, 0.55, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
    // 極微弱的空氣流動明暗絲
    float shimmer = 0.88 + 0.12 * sin(vUv.x * 18.0 + uTime * 0.65);

    float alpha = fresnel * verticalFade * shimmer * uIntensity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/**
 * 細緻低調的微塵粒子 Shader（融入光束與薄霧，絕不浮誇）
 */
const DUST_VERTEX_SHADER = `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float cycle = mod(pos.y + uTime * (0.09 + aScale * 0.04) + aPhase, 8.0) - 2.6;
    pos.y = cycle;
    pos.x += sin(uTime * 0.32 + aPhase * 3.1) * 0.22;
    pos.z += cos(uTime * 0.28 + aPhase * 2.3) * 0.22;

    vAlpha = smoothstep(-2.6, -0.8, pos.y) * smoothstep(5.4, 3.0, pos.y);
    vAlpha *= (0.35 + 0.65 * sin(uTime * 0.9 + aPhase * 6.28));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    // 景深距離感衰減
    float depthFade = smoothstep(14.0, 3.0, -mvPosition.z);
    vAlpha *= depthFade;

    gl_PointSize = aScale * uPixelRatio * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DUST_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(uColor, glow * glow * vAlpha * 0.42);
  }
`;

class DivinationStageManager {
  constructor() {
    this.canvas = document.getElementById('webgl-stage');
    this.webglReady = false;
    this.mode = 'blocks';

    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 8;
    this.isLowEnd = cores <= 4 || mem <= 4;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isHidden = false;

    this.pulseEnergyVal = 0;
    this.shakeIntensity = 0;
    this.totalTime = 0;

    if (this.reducedMotion) {
      document.body.classList.add('reduced-motion');
    }

    if (!this.canvas) return;

    try {
      this.camTargetPos = new THREE.Vector3(0, 4.6, 5.8);
      this.camTargetLook = new THREE.Vector3(0, 0.35, 0);
      this.currentLook = new THREE.Vector3(0, 0.35, 0);
      this.dynamicFocus = new THREE.Vector3(0, 0.3, 0);

      this.modeColors = {
        blocks: new THREE.Color('#c8a46b'), // 暖燭暗金
        cards: new THREE.Color('#8e9cb2'),  // 幽玄月銀
        guide: new THREE.Color('#c5ae86')   // 古天文星金
      };
      this.currentAccent = this.modeColors.blocks.clone();

      this._initRenderer();
      this._initSceneAndLights();
      this._initAmbientMist();
      this._initVolumetricBeam();
      this._initFineDust();
      this._initSubScenes();
      this._bindEvents();

      this.webglReady = true;
      this.clock = new THREE.Clock();
      this._animate();
    } catch (err) {
      console.warn('[DivinationStage] WebGL unavailable, falling back to CSS mode:', err);
      this.webglReady = false;
      this.canvas.style.display = 'none';
    }
  }

  _getTargetDpr() {
    const raw = window.devicePixelRatio || 1;
    return this.isLowEnd ? Math.min(raw, 1.25) : Math.min(raw, 2);
  }

  _initRenderer() {
    const dpr = this._getTargetDpr();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isLowEnd,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  _initSceneAndLights() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      50
    );
    this.camera.position.copy(this.camTargetPos);

    const ambient = new THREE.AmbientLight(0xd8ccb8, 0.44);
    this.scene.add(ambient);

    const shadowRes = this.isLowEnd ? 512 : 1024;
    this.keyLight = new THREE.SpotLight(0xf3d7a8, 38, 28, Math.PI * 0.26, 0.68, 1.4);
    this.keyLight.position.set(2.2, 8.8, 3.6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = shadowRes;
    this.keyLight.shadow.mapSize.height = shadowRes;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    // 動態追光（光影隨物件位置平滑移動產生真實反光變化）
    this.followLight = new THREE.PointLight(0xe8cfa2, 1.8, 9, 2);
    this.followLight.position.set(0, 2.4, 1.2);
    this.scene.add(this.followLight);

    // 幽玄冷月輪廓補光
    const rimLight = new THREE.DirectionalLight(0x7c92b8, 0.92);
    rimLight.position.set(-4.8, 3.8, -4.2);
    this.scene.add(rimLight);

    // 溫暖底反光
    const fillLight = new THREE.PointLight(0x9e5b38, 1.05, 12, 2);
    fillLight.position.set(-2.5, 1.1, 3.5);
    this.scene.add(fillLight);
  }

  _initAmbientMist() {
    this.fogUniforms = {
      uTime: { value: 0 },
      uAccentColor: { value: this.currentAccent.clone() },
      uPulse: { value: 0 }
    };
    const fogGeom = new THREE.PlaneGeometry(2, 2);
    const fogMat = new THREE.ShaderMaterial({
      vertexShader: FOG_VERTEX_SHADER,
      fragmentShader: FOG_FRAGMENT_SHADER,
      uniforms: this.fogUniforms,
      depthWrite: false,
      depthTest: false
    });
    const fogQuad = new THREE.Mesh(fogGeom, fogMat);
    fogQuad.frustumCulled = false;
    fogQuad.renderOrder = -10;
    this.scene.add(fogQuad);
  }

  _initVolumetricBeam() {
    // 3D 方向性體積光錐，自右上方斜射至主體祭壇
    const coneGeom = new THREE.CylinderGeometry(0.65, 3.4, 11.0, 36, 1, true);
    this.beamUniforms = {
      uColor: { value: new THREE.Color('#e6cca0') },
      uIntensity: { value: 0.085 },
      uTime: { value: 0 }
    };
    const coneMat = new THREE.ShaderMaterial({
      vertexShader: VOLUMETRIC_VERTEX_SHADER,
      fragmentShader: VOLUMETRIC_FRAGMENT_SHADER,
      uniforms: this.beamUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.volumetricBeam = new THREE.Mesh(coneGeom, coneMat);
    this.volumetricBeam.position.set(1.0, 4.2, 0.4);
    this.volumetricBeam.rotation.z = 0.24;
    this.volumetricBeam.rotation.x = -0.14;
    this.scene.add(this.volumetricBeam);
  }

  _initFineDust() {
    // 細緻克制而非大量粒子
    const count = this.isLowEnd ? 28 : 52;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 9.5;
      positions[i * 3 + 1] = Math.random() * 8.0 - 2.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7.5 - 0.8;
      scales[i] = Math.random() * 1.1 + 0.45;
      phases[i] = Math.random() * 10;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.dustUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: this._getTargetDpr() },
      uColor: { value: new THREE.Color('#dcd0bc') }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      uniforms: this.dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.dustPoints = new THREE.Points(geom, mat);
    this.scene.add(this.dustPoints);
  }

  _initSubScenes() {
    this.moonBlocks = new MoonBlocksScene();
    this.triadSanctum = new TriadSanctumScene();
    this.cosmicOracle = new CosmicOracleScene();

    this.moonBlocks.setReducedMotion(this.reducedMotion);
    this.triadSanctum.setReducedMotion(this.reducedMotion);
    this.cosmicOracle.setReducedMotion(this.reducedMotion);

    // 註冊關鍵 Impact 鏡頭微震動
    this.moonBlocks.setImpactHandler((intensity) => this.triggerCameraShake(intensity));
    this.triadSanctum.setImpactHandler((intensity) => this.triggerCameraShake(intensity));
    this.cosmicOracle.setImpactHandler((intensity) => this.triggerCameraShake(intensity));

    this.scene.add(this.moonBlocks.group);
    this.scene.add(this.triadSanctum.group);
    this.scene.add(this.cosmicOracle.group);

    this.setMode('blocks');
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      if (!this.webglReady || !this.renderer || !this.camera) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      const dpr = this._getTargetDpr();
      this.renderer.setPixelRatio(dpr);
      this.dustUniforms.uPixelRatio.value = dpr;
    });

    document.addEventListener('visibilitychange', () => {
      this.isHidden = document.hidden;
      if (!this.isHidden && this.clock) {
        this.clock.getDelta();
      }
    });
  }

  /* ================= 公開給 React 的安全儀式控制 API ================= */

  isWebGLAvailable() {
    return this.webglReady;
  }

  triggerCameraShake(intensity = 0.05) {
    if (this.reducedMotion) return;
    this.shakeIntensity = Math.min(0.08, Math.max(this.shakeIntensity, intensity));
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.webglReady) return;

    if (mode !== 'blocks') this.moonBlocks.reset();
    if (mode !== 'cards') this.triadSanctum.reset();
    if (mode !== 'guide') this.cosmicOracle.reset();

    this.moonBlocks.group.visible = mode === 'blocks';
    this.triadSanctum.group.visible = mode === 'cards';
    this.cosmicOracle.group.visible = mode === 'guide';
    this.pulseEnergy(0.35);
  }

  syncTriadCardState(cardPhase, stageName) {
    if (!this.webglReady || !this.triadSanctum) return;
    this.triadSanctum.setCardState(cardPhase, stageName);
    if (cardPhase === 'SHUFFLING' || cardPhase === 'LIFTING') {
      this.pulseEnergy(0.5);
    }
  }

  notifyCardSelection(count) {
    if (!this.webglReady || !this.triadSanctum) return;
    this.triadSanctum.setSelectedCount(count);
    this.pulseEnergy(0.35 + count * 0.12);
  }

  triggerCardFlipImpulse(cardIdx = 1) {
    if (!this.webglReady || !this.triadSanctum) return;
    this.triadSanctum.triggerFlipImpulse(cardIdx);
    this.pulseEnergy(0.75);
  }

  throwMoonBlocks(b1, b2, onComplete, onPhaseChange) {
    if (!this.webglReady) return false;
    this.pulseEnergy(0.65);
    this.moonBlocks.throwBlocks(b1, b2, onComplete, onPhaseChange);
    return true;
  }

  resetMoonBlocks() {
    if (!this.webglReady) return;
    this.moonBlocks.reset();
  }

  invokeCosmicOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (!this.webglReady) return false;
    this.pulseEnergy(0.7);
    this.cosmicOracle.invokeOracle(oracleNumber, onRevealed, onPhaseChange);
    return true;
  }

  resetCosmicOracle() {
    if (!this.webglReady) return;
    this.cosmicOracle.reset();
  }

  pulseEnergy(amount = 0.5) {
    this.pulseEnergyVal = Math.min(1.0, Math.max(this.pulseEnergyVal, amount));
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
    document.body.classList.toggle('reduced-motion', this.reducedMotion);
    if (this.webglReady) {
      this.moonBlocks.setReducedMotion(this.reducedMotion);
      this.triadSanctum.setReducedMotion(this.reducedMotion);
      this.cosmicOracle.setReducedMotion(this.reducedMotion);
    }
  }

  getReducedMotion() {
    return this.reducedMotion;
  }

  toggleSound() {
    const next = !ritualSound.isEnabled();
    ritualSound.setEnabled(next);
    if (next) ritualSound.playChime('chime');
    return next;
  }

  getSoundEnabled() {
    return ritualSound.isEnabled();
  }

  playCardRevealSound() {
    ritualSound.playSilkSweep();
  }

  playChime(tone = 'chime') {
    ritualSound.playChime(tone);
  }

  formatOracleIndex(num) {
    return formatOracleIndex(num);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (this.isHidden || !this.webglReady) return;

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const timeScale = this.reducedMotion ? 0.3 : 1.0;
    this.totalTime += dt * timeScale;

    this.fogUniforms.uTime.value = this.totalTime;
    this.dustUniforms.uTime.value = this.totalTime;
    this.beamUniforms.uTime.value = this.totalTime;

    const targetColor = this.modeColors[this.mode] || this.modeColors.blocks;
    this.currentAccent.lerp(targetColor, dt * 2.0);
    this.fogUniforms.uAccentColor.value.copy(this.currentAccent);
    this.beamUniforms.uColor.value.copy(this.currentAccent).lerp(new THREE.Color('#efe2cb'), 0.35);
    this.dustUniforms.uColor.value.copy(this.currentAccent).lerp(new THREE.Color('#e6dfd3'), 0.55);

    this.pulseEnergyVal = THREE.MathUtils.lerp(this.pulseEnergyVal, 0, dt * 1.6);
    this.fogUniforms.uPulse.value = this.pulseEnergyVal;
    this.beamUniforms.uIntensity.value = 0.075 + this.pulseEnergyVal * 0.045;

    // 更新活躍子場景並追蹤主體焦點（光影隨物件移動）
    if (this.mode === 'blocks') {
      this.moonBlocks.update(dt);
      const cam = this.moonBlocks.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.moonBlocks.getFocusPosition(), Math.min(1, dt * 5));
    } else if (this.mode === 'cards') {
      this.triadSanctum.update(dt);
      const cam = this.triadSanctum.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.triadSanctum.getFocusPosition(), Math.min(1, dt * 4));
    } else if (this.mode === 'guide') {
      this.cosmicOracle.update(dt);
      const cam = this.cosmicOracle.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.cosmicOracle.getFocusPosition(), Math.min(1, dt * 4));
    }

    // 動態追光與主頂光目標平滑跟隨主體移動
    this.keyLight.target.position.copy(this.dynamicFocus);
    this.followLight.position.set(
      this.dynamicFocus.x * 0.85,
      this.dynamicFocus.y + 2.1,
      this.dynamicFocus.z + 1.15
    );
    this.volumetricBeam.position.x = THREE.MathUtils.lerp(
      this.volumetricBeam.position.x,
      0.95 + this.dynamicFocus.x * 0.35,
      dt * 2.2
    );

    // 響應式鏡頭距離自適應（確保窄版手機直屏 390x844 下雙筊尖端與星儀皆完整入鏡零裁切）
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const distanceScale = aspect < 1.0 ? Math.min(2.85, Math.max(1.24, 1.28 / aspect)) : 1.0;

    const desiredPos = this.camTargetPos.clone();
    if (distanceScale > 1.0) {
      const offset = desiredPos.clone().sub(this.camTargetLook).multiplyScalar(distanceScale);
      desiredPos.copy(this.camTargetLook).add(offset);
    }

    // 極柔和的電影呼吸鏡頭（低調自然，不干擾閱讀）
    if (!this.reducedMotion) {
      desiredPos.x += Math.sin(this.totalTime * 0.42) * 0.06;
      desiredPos.y += Math.cos(this.totalTime * 0.31) * 0.04;
    }

    this.camera.position.lerp(desiredPos, Math.min(1, dt * 3.0));
    this.currentLook.lerp(this.camTargetLook, Math.min(1, dt * 3.6));

    // 關鍵 Impact 阻尼微震動（快速衰減）
    if (this.shakeIntensity > 0.001) {
      const sx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      const sy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      this.shakeIntensity *= Math.pow(0.006, dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.lookAt(this.currentLook);
    this.renderer.render(this.scene, this.camera);
  }
}

window.DivinationStage = new DivinationStageManager();
window.dispatchEvent(new CustomEvent('divination-stage-ready'));
