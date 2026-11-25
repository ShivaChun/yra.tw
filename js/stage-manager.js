/**
 * stage-manager.js
 * 全站單一共享電影級 WebGL 舞台控制器（Stage 2: Luminous Mysticism 雙場景系統）
 *
 * 核心能力：
 * - 明暗雙場景天光呼吸轉換（uLuminescence: 1.0 晨曦暖白 ↔ 0.76 空靈薄霧 ↔ 0.0 玄夜星穹）
 * - 心念色溫微連動（感情薰衣草、事業天穹藍、財運淡青玉、方向香檳金等柔和融入霧光）
 * - 入口靜心神殿光弧（Sanctuary Threshold Halo）
 * - 整合三大儀式 3D 場景：
 *   1. MoonBlocksScene（擲筊 · Divine Response）
 *   2. CardSummonScene（三元牌 · Magical Card Summoning）
 *   3. CelestialMechanismScene（宇宙指引 · Celestial Mechanism）
 */

import * as THREE from 'three';
import { MoonBlocksScene } from './moon-blocks-3d.js';
import { CardSummonScene } from './card-summon-3d.js';
import { CelestialMechanismScene, formatOracleIndex } from './celestial-mechanism-3d.js';
import { ritualSound } from './sound-synth.js';

const FOG_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

/**
 * 雙場景平滑過渡背景天光薄霧 Shader（Luminous Ivory ↔ Ethereal Mist ↔ Deep Ink Dusk）
 */
const FOG_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uLuminescence;
  uniform vec3 uAccentColor;
  uniform vec3 uIntentColor;
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
    float t = uTime * 0.048;

    float n1 = fbm(uv * 2.3 + vec2(t, -t * 0.5));
    float n2 = fbm(uv * 3.8 - vec2(t * 0.7, t * 0.35) + n1 * 0.55);
    float mist = smoothstep(0.28, 0.88, n2);

    float beamAxis = abs((uv.x - 0.52) * 1.25 + (uv.y - 1.05) * 0.32);
    float beam = exp(-beamAxis * 3.6) * smoothstep(0.05, 0.98, uv.y);

    // 1. 玄夜星穹基底 (Dusk = 0.0)
    vec3 duskBase = vec3(0.036, 0.046, 0.078);
    vec3 duskMist = mix(vec3(0.075, 0.092, 0.145), uAccentColor, 0.28);
    vec3 duskCol = duskBase + duskMist * mist * (0.30 + uPulse * 0.16);
    duskCol += mix(uAccentColor, uIntentColor, 0.35) * beam * (0.14 + uPulse * 0.12);
    float duskVig = smoothstep(1.12, 0.18, distance(uv, vec2(0.5, 0.48)));
    duskCol *= mix(0.45, 1.0, duskVig);

    // 2. 晨曦暖白／空靈霧光基底 (Luminous = 1.0, Ethereal = 0.76)
    vec3 ivoryTop = mix(vec3(0.895, 0.902, 0.925), vec3(0.968, 0.953, 0.922), smoothstep(0.65, 1.0, uLuminescence));
    vec3 ivoryBot = mix(vec3(0.855, 0.852, 0.848), vec3(0.935, 0.912, 0.870), smoothstep(0.65, 1.0, uLuminescence));
    vec3 lightBase = mix(ivoryBot, ivoryTop, uv.y);

    // 柔和融入心念光暈（薰衣草／天穹藍／淡青玉／香檳金）
    vec3 softTint = mix(vec3(0.96, 0.94, 0.90), uIntentColor, 0.22);
    lightBase = mix(lightBase, softTint, mist * 0.38);
    lightBase += vec3(1.0, 0.97, 0.91) * beam * (0.16 + uPulse * 0.08);

    float centerGlow = exp(-distance(uv, vec2(0.5, 0.52)) * 2.4);
    lightBase += vec3(1.0, 0.98, 0.94) * centerGlow * 0.07;

    vec3 finalCol = mix(duskCol, lightBase, clamp(uLuminescence, 0.0, 1.0));
    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

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
    float fresnel = pow(abs(dot(vNormal, vViewDir)), 1.85);
    float verticalFade = smoothstep(0.0, 0.55, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
    float shimmer = 0.88 + 0.12 * sin(vUv.x * 18.0 + uTime * 0.65);
    gl_FragColor = vec4(uColor, fresnel * verticalFade * shimmer * uIntensity);
  }
`;

const DUST_VERTEX_SHADER = `
  attribute float aScale;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float cycle = mod(pos.y + uTime * (0.085 + aScale * 0.04) + aPhase, 8.0) - 2.6;
    pos.y = cycle;
    pos.x += sin(uTime * 0.30 + aPhase * 3.1) * 0.24;
    pos.z += cos(uTime * 0.26 + aPhase * 2.3) * 0.24;

    vAlpha = smoothstep(-2.6, -0.8, pos.y) * smoothstep(5.4, 3.0, pos.y);
    vAlpha *= (0.38 + 0.62 * sin(uTime * 0.85 + aPhase * 6.28));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float depthFade = smoothstep(14.0, 3.0, -mvPosition.z);
    vAlpha *= depthFade;

    gl_PointSize = aScale * uPixelRatio * (21.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const DUST_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacityScale;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.08, d);
    gl_FragColor = vec4(uColor, glow * glow * vAlpha * uOpacityScale);
  }
`;

class DivinationStageManager {
  constructor() {
    this.canvas = document.getElementById('webgl-stage');
    this.webglReady = false;
    this.mode = 'sanctuary'; // 'sanctuary' | 'blocks' | 'cards' | 'guide'
    this.sceneTone = 'luminous'; // 'luminous' | 'ethereal' | 'dusk'

    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 8;
    this.isLowEnd = cores <= 4 || mem <= 4;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.isHidden = false;

    this.currentLuminescence = 1.0;
    this.targetLuminescence = 1.0;
    this.pulseEnergyVal = 0;
    this.shakeIntensity = 0;
    this.totalTime = 0;

    document.body.dataset.sceneTone = 'luminous';
    if (this.reducedMotion) {
      document.body.classList.add('reduced-motion');
    }

    if (!this.canvas) return;

    try {
      this.camTargetPos = new THREE.Vector3(0, 0.6, 6.2);
      this.camTargetLook = new THREE.Vector3(0, 0.35, 0);
      this.currentLook = new THREE.Vector3(0, 0.35, 0);
      this.dynamicFocus = new THREE.Vector3(0, 0.35, 0);

      this.modeColors = {
        sanctuary: new THREE.Color('#d8bc8c'),
        blocks: new THREE.Color('#cfa86e'),
        cards: new THREE.Color('#b8b0dc'),
        guide: new THREE.Color('#9ab8c8')
      };
      this.currentAccent = this.modeColors.sanctuary.clone();
      this.targetIntentColor = new THREE.Color('#e2caa0');
      this.currentIntentColor = new THREE.Color('#e2caa0');

      this._initRenderer();
      this._initSceneAndLights();
      this._initAmbientMist();
      this._initVolumetricBeam();
      this._initFineDust();
      this._initSanctuaryHalo();
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
    this.renderer.toneMappingExposure = 1.08;
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

    this.ambientLight = new THREE.AmbientLight(0xf6efe4, 1.25);
    this.scene.add(this.ambientLight);

    const shadowRes = this.isLowEnd ? 512 : 1024;
    this.keyLight = new THREE.SpotLight(0xfff0d4, 42, 30, Math.PI * 0.28, 0.68, 1.35);
    this.keyLight.position.set(2.2, 8.8, 3.8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = shadowRes;
    this.keyLight.shadow.mapSize.height = shadowRes;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.followLight = new THREE.PointLight(0xf2dbb0, 1.8, 10, 2);
    this.followLight.position.set(0, 2.4, 1.2);
    this.scene.add(this.followLight);

    this.rimLight = new THREE.DirectionalLight(0xa8bedc, 0.95);
    this.rimLight.position.set(-4.8, 3.8, -4.2);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.PointLight(0xdcc29e, 1.1, 14, 2);
    this.fillLight.position.set(-2.5, 1.2, 3.6);
    this.scene.add(this.fillLight);
  }

  _initAmbientMist() {
    this.fogUniforms = {
      uTime: { value: 0 },
      uLuminescence: { value: 1.0 },
      uAccentColor: { value: this.currentAccent.clone() },
      uIntentColor: { value: this.currentIntentColor.clone() },
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
    const coneGeom = new THREE.CylinderGeometry(0.7, 3.5, 11.2, 36, 1, true);
    this.beamUniforms = {
      uColor: { value: new THREE.Color('#f4e2bd') },
      uIntensity: { value: 0.065 },
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
    const count = this.isLowEnd ? 34 : 64;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10.0;
      positions[i * 3 + 1] = Math.random() * 8.0 - 2.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7.5 - 0.8;
      scales[i] = Math.random() * 1.15 + 0.5;
      phases[i] = Math.random() * 10;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    this.dustUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: this._getTargetDpr() },
      uColor: { value: new THREE.Color('#d4b47c') },
      uOpacityScale: { value: 0.36 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      uniforms: this.dustUniforms,
      transparent: true,
      depthWrite: false
    });

    this.dustPoints = new THREE.Points(geom, mat);
    this.scene.add(this.dustPoints);
  }

  /**
   * 入口與心念引導階段（Act I ~ III）背景靜靜懸浮的溫潤香檳金星軌細環
   */
  _initSanctuaryHalo() {
    this.sanctuaryGroup = new THREE.Group();
    this.sanctuaryGroup.position.set(0, 0.42, -1.8);

    const goldWireMat = new THREE.MeshStandardMaterial({
      color: 0xd4b47c,
      metalness: 0.85,
      roughness: 0.25,
      transparent: true,
      opacity: 0.42
    });

    const lavenderWireMat = new THREE.MeshStandardMaterial({
      color: 0xb8b2d8,
      metalness: 0.65,
      roughness: 0.32,
      transparent: true,
      opacity: 0.30
    });

    this.sancRing1 = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.014, 16, 120), goldWireMat);
    this.sancRing1.rotation.set(0.48, 0.22, 0.1);
    this.sanctuaryGroup.add(this.sancRing1);

    this.sancRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.011, 16, 108), lavenderWireMat);
    this.sancRing2.rotation.set(-0.42, -0.28, 0.2);
    this.sanctuaryGroup.add(this.sancRing2);

    this.scene.add(this.sanctuaryGroup);
  }

  _initSubScenes() {
    this.moonBlocks = new MoonBlocksScene();
    this.cardSummon = new CardSummonScene();
    this.celestialMechanism = new CelestialMechanismScene();

    this.moonBlocks.setReducedMotion(this.reducedMotion);
    this.cardSummon.setReducedMotion(this.reducedMotion);
    this.celestialMechanism.setReducedMotion(this.reducedMotion);

    this.moonBlocks.setImpactHandler((intensity) => this.triggerCameraShake(intensity));
    this.cardSummon.setImpactHandler((intensity) => this.triggerCameraShake(intensity));
    this.celestialMechanism.setImpactHandler((intensity) => this.triggerCameraShake(intensity));

    this.scene.add(this.moonBlocks.group);
    this.scene.add(this.cardSummon.group);
    this.scene.add(this.celestialMechanism.group);

    this.setMode('sanctuary');
    this.setSceneTone('luminous');
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

  /* ================= 公開給 React 的雙場景與儀式控制 API ================= */

  isWebGLAvailable() {
    return this.webglReady;
  }

  /**
   * 切換明暗雙場景氛圍：
   * - 'luminous' (1.00)：溫暖明亮晨曦（入口、問心、結果揭曉回暖）
   * - 'ethereal' (0.76)：空靈柔和薄霧（功能選擇、儀式待機）
   * - 'dusk'     (0.00)：深墨星穹聚光（儀式啟動、機關運轉、魔法陣召喚）
   */
  setSceneTone(tone = 'luminous') {
    this.sceneTone = tone;
    document.body.dataset.sceneTone = tone;
    if (tone === 'dusk') {
      this.targetLuminescence = 0.0;
    } else if (tone === 'ethereal') {
      this.targetLuminescence = 0.76;
    } else {
      this.targetLuminescence = 1.0;
    }
  }

  /**
   * 設定使用者心念問題類別對應之柔和氛圍色澤（純視覺安撫，絕不干預隨機結果）
   */
  setIntentAccent(hexColor) {
    if (!hexColor || !this.webglReady) return;
    this.targetIntentColor.set(hexColor);
    this.pulseEnergy(0.4);
  }

  triggerCameraShake(intensity = 0.05) {
    if (this.reducedMotion) return;
    this.shakeIntensity = Math.min(0.075, Math.max(this.shakeIntensity, intensity));
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.webglReady) return;

    if (mode !== 'blocks') this.moonBlocks.reset();
    if (mode !== 'cards') this.cardSummon.reset();
    if (mode !== 'guide') this.celestialMechanism.reset();

    this.sanctuaryGroup.visible = mode === 'sanctuary';
    this.moonBlocks.group.visible = mode === 'blocks';
    this.cardSummon.group.visible = mode === 'cards';
    this.celestialMechanism.group.visible = mode === 'guide';
    this.pulseEnergy(0.32);
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

  syncTriadCardState(cardPhase, stageName, elementColors = null) {
    if (!this.webglReady || !this.cardSummon) return;
    this.cardSummon.setCardState(cardPhase, stageName, elementColors);
    if (cardPhase === 'MAGIC_CIRCLE' || cardPhase === 'CARD_MATERIALIZATION') {
      this.pulseEnergy(0.7);
    }
  }

  notifyCardSelection(count) {
    if (!this.webglReady || !this.cardSummon) return;
    this.cardSummon.setSelectedCount(count);
    this.pulseEnergy(0.3 + count * 0.12);
  }

  triggerCardFlipImpulse(cardIdx = 1, colorHex = 0xf5dfb2) {
    if (!this.webglReady || !this.cardSummon) return;
    this.cardSummon.triggerFlipImpulse(cardIdx, colorHex);
    this.pulseEnergy(0.8);
  }

  invokeCosmicOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (!this.webglReady) return false;
    this.pulseEnergy(0.75);
    this.celestialMechanism.invokeOracle(oracleNumber, onRevealed, onPhaseChange);
    return true;
  }

  resetCosmicOracle() {
    if (!this.webglReady) return;
    this.celestialMechanism.reset();
  }

  pulseEnergy(amount = 0.5) {
    this.pulseEnergyVal = Math.min(1.0, Math.max(this.pulseEnergyVal, amount));
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
    document.body.classList.toggle('reduced-motion', this.reducedMotion);
    if (this.webglReady) {
      this.moonBlocks.setReducedMotion(this.reducedMotion);
      this.cardSummon.setReducedMotion(this.reducedMotion);
      this.celestialMechanism.setReducedMotion(this.reducedMotion);
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

  playRuneSound(idx = 0) {
    ritualSound.playRuneIgnite(idx);
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

    // 平滑推進明暗雙場景曲線（使明暗轉換本身成為流動天光動畫）
    this.currentLuminescence = THREE.MathUtils.lerp(
      this.currentLuminescence,
      this.targetLuminescence,
      Math.min(1, dt * 2.2)
    );
    const lum = this.currentLuminescence;

    this.fogUniforms.uTime.value = this.totalTime;
    this.fogUniforms.uLuminescence.value = lum;
    this.dustUniforms.uTime.value = this.totalTime;
    this.beamUniforms.uTime.value = this.totalTime;

    const targetColor = this.modeColors[this.mode] || this.modeColors.sanctuary;
    this.currentAccent.lerp(targetColor, dt * 2.2);
    this.currentIntentColor.lerp(this.targetIntentColor, dt * 2.2);

    this.fogUniforms.uAccentColor.value.copy(this.currentAccent);
    this.fogUniforms.uIntentColor.value.copy(this.currentIntentColor);

    // 隨明暗雙場景自動調整 3D 燈光強度與微塵色彩對比
    this.ambientLight.intensity = THREE.MathUtils.lerp(0.52, 1.38, lum);
    this.keyLight.intensity = THREE.MathUtils.lerp(40, 48, lum);
    this.dustUniforms.uColor.value
      .copy(lum > 0.5 ? new THREE.Color('#b89252') : new THREE.Color('#f0dfb8'))
      .lerp(this.currentIntentColor, 0.25);
    this.dustUniforms.uOpacityScale.value = THREE.MathUtils.lerp(0.48, 0.34, lum);

    this.pulseEnergyVal = THREE.MathUtils.lerp(this.pulseEnergyVal, 0, dt * 1.6);
    this.fogUniforms.uPulse.value = this.pulseEnergyVal;
    this.beamUniforms.uIntensity.value =
      THREE.MathUtils.lerp(0.095, 0.045, lum) + this.pulseEnergyVal * 0.05;

    // 更新活躍子場景
    if (this.mode === 'sanctuary') {
      this.sancRing1.rotation.z += dt * 0.045 * timeScale;
      this.sancRing2.rotation.z -= dt * 0.06 * timeScale;
      this.sanctuaryGroup.position.y = 0.42 + Math.sin(this.totalTime * 0.65) * 0.06;
      this.camTargetPos.set(0, 0.55, 6.1);
      this.camTargetLook.set(0, 0.38, 0);
      this.dynamicFocus.lerp(new THREE.Vector3(0, 0.4, 0), Math.min(1, dt * 3));
    } else if (this.mode === 'blocks') {
      this.moonBlocks.setLuminescence(lum);
      this.moonBlocks.update(dt);
      const cam = this.moonBlocks.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.moonBlocks.getFocusPosition(), Math.min(1, dt * 5));
    } else if (this.mode === 'cards') {
      this.cardSummon.update(dt);
      const cam = this.cardSummon.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.cardSummon.getFocusPosition(), Math.min(1, dt * 4));
    } else if (this.mode === 'guide') {
      this.celestialMechanism.update(dt);
      const cam = this.celestialMechanism.getCameraTarget();
      this.camTargetPos.set(...cam.pos);
      this.camTargetLook.set(...cam.lookAt);
      this.dynamicFocus.lerp(this.celestialMechanism.getFocusPosition(), Math.min(1, dt * 4));
    }

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

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const distanceScale = aspect < 1.0 ? Math.min(2.85, Math.max(1.24, 1.28 / aspect)) : 1.0;

    const desiredPos = this.camTargetPos.clone();
    if (distanceScale > 1.0) {
      const offset = desiredPos.clone().sub(this.camTargetLook).multiplyScalar(distanceScale);
      desiredPos.copy(this.camTargetLook).add(offset);
    }

    if (!this.reducedMotion) {
      desiredPos.x += Math.sin(this.totalTime * 0.42) * 0.055;
      desiredPos.y += Math.cos(this.totalTime * 0.31) * 0.038;
    }

    this.camera.position.lerp(desiredPos, Math.min(1, dt * 3.0));
    this.currentLook.lerp(this.camTargetLook, Math.min(1, dt * 3.6));

    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * 2 * this.shakeIntensity;
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
