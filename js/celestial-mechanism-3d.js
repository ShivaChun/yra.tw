/**
 * celestial-mechanism-3d.js
 * 「宇宙指引 · Celestial Mechanism」電影級 3D 精密宇宙封印天體機關
 * 六階段狀態機：DORMANT → AWAKENING → ACTIVATION → UNLOCKING → REVELATION → GUIDANCE
 *
 * 3D 實體機械結構（五層精密同心與斜交機構，共享 BufferGeometry 控制低 Draw Call）：
 * 1. 外層周天赤道齒輪環（36 枚精密立體機械齒槽＋360° 天文刻度古銅環）
 * 2. 十二星宿符文封印環（12 枚獨立立體符文牌，AWAKENING 階段逐一點亮泛光）
 * 3. 斜交星軌子午雙環與十二芒神聖幾何骨架（不同軸向、不同方向與獨立角速度）
 * 4. 中央六瓣古銅鑲青玉機械鎖（Iris Seal Claws：UNLOCKING 階段真實旋轉退栓並向外滑開解封）
 * 5. 深邃多面折射能量星核與立體擴散光波（REVELATION 階段由中心向外層層釋放）
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const CELESTIAL_PHASES = Object.freeze({
  DORMANT: 'DORMANT',
  AWAKENING: 'AWAKENING',
  ACTIVATION: 'ACTIVATION',
  UNLOCKING: 'UNLOCKING',
  REVELATION: 'REVELATION',
  GUIDANCE: 'GUIDANCE'
});

const CN_NUMS = [
  '壹', '貳', '參', '肆', '伍',
  '陸', '柒', '捌', '玖', '拾',
  '拾壹', '拾貳', '拾參', '拾肆', '拾伍'
];

export function formatOracleIndex(num) {
  const cn = CN_NUMS[(num - 1) % CN_NUMS.length] || String(num);
  return `天 機 · 第 ${cn} 籤`;
}

/**
 * 程式化生成精密天文齒輪刻度金屬紋理
 */
function createEngravedScaleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#59462b');
  grad.addColorStop(0.5, '#cbb082');
  grad.addColorStop(1, '#473720');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  for (let i = 0; i < 144; i++) {
    const x = (i / 144) * 1024;
    const isMajor = i % 12 === 0;
    const isMid = i % 4 === 0;
    ctx.strokeStyle = isMajor
      ? 'rgba(255, 246, 224, 0.88)'
      : isMid
      ? 'rgba(240, 216, 172, 0.52)'
      : 'rgba(62, 44, 22, 0.45)';
    ctx.lineWidth = isMajor ? 2.6 : isMid ? 1.5 : 0.9;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 12 : isMid ? 26 : 38);
    ctx.lineTo(x, isMajor ? 116 : isMid ? 102 : 90);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 程式化繪製 12 枚各具造型的古老星象幾何符文貼圖
 */
function createRuneGlyphTexture(glyphIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#181c28';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = '#f3dfb9';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 108, 108);

  ctx.translate(64, 64);
  ctx.strokeStyle = '#fff5df';
  ctx.fillStyle = '#fff5df';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 依據序號產生不同古星象幾何圖騰
  const variant = glyphIndex % 6;
  ctx.beginPath();
  if (variant === 0) {
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.moveTo(0, -34);
    ctx.lineTo(0, 34);
    ctx.moveTo(-24, 0);
    ctx.lineTo(24, 0);
  } else if (variant === 1) {
    ctx.moveTo(0, -30);
    ctx.lineTo(28, 22);
    ctx.lineTo(-28, 22);
    ctx.closePath();
    ctx.moveTo(0, 30);
    ctx.lineTo(0, -12);
  } else if (variant === 2) {
    ctx.arc(0, -10, 18, 0, Math.PI * 2);
    ctx.moveTo(-22, 18);
    ctx.quadraticCurveTo(0, 34, 22, 18);
    ctx.moveTo(0, -28);
    ctx.lineTo(0, 28);
  } else if (variant === 3) {
    ctx.moveTo(0, -32);
    ctx.lineTo(28, 0);
    ctx.lineTo(0, 32);
    ctx.lineTo(-28, 0);
    ctx.closePath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
  } else if (variant === 4) {
    ctx.arc(-6, 0, 22, -Math.PI * 0.65, Math.PI * 0.65);
    ctx.moveTo(12, -24);
    ctx.lineTo(12, 24);
    ctx.moveTo(-2, 0);
    ctx.lineTo(24, 0);
  } else {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      ctx.moveTo(Math.cos(a) * -28, Math.sin(a) * -28);
      ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
    }
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
  }
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 柔和中心徑向光暈貼圖
 */
function createRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255, 252, 242, 1.0)');
  g.addColorStop(0.32, 'rgba(235, 210, 162, 0.55)');
  g.addColorStop(0.7, 'rgba(180, 198, 230, 0.16)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

export class CelestialMechanismScene {
  constructor() {
    this.group = new THREE.Group();
    this.mechanismRoot = new THREE.Group();
    this.runePlaques = [];
    this.sealClaws = [];
    this.waves = [];
    this.orbiters = [];

    this.phase = CELESTIAL_PHASES.DORMANT;
    this.sessionId = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.lastTickTime = 0;
    this.litRuneCount = 0;
    this.lockSoundPlayed = false;
    this.reducedMotion = false;

    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.onImpactCallback = null;

    this.baseScale = 0.70;
    this.mechanismRoot.position.set(0, 0.04, 0);
    this.mechanismRoot.scale.setScalar(this.baseScale);
    this.group.add(this.mechanismRoot);

    this._initMaterials();
    this._initLayer1OuterGearRing();
    this._initLayer2RuneSealBand();
    this._initLayer3CelestialGeometry();
    this._initLayer4MechanicalIrisLock();
    this._initLayer5EnergyCore();
    this._initOrbitingAstrolabeNodes();
  }

  _initMaterials() {
    const scaleTex = createEngravedScaleTexture();

    this.champagneBronzeMat = new THREE.MeshStandardMaterial({
      map: scaleTex,
      color: 0xd8be92,
      metalness: 0.84,
      roughness: 0.26
    });

    this.celestialSlateMat = new THREE.MeshStandardMaterial({
      color: 0x384358,
      metalness: 0.76,
      roughness: 0.32
    });

    this.paleJadeMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fc0b4,
      roughness: 0.22,
      metalness: 0.12,
      clearcoat: 0.75,
      emissive: new THREE.Color(0x88b8a6),
      emissiveIntensity: 0.05
    });

    this.brightGoldMat = new THREE.MeshStandardMaterial({
      color: 0xecd5ab,
      metalness: 0.9,
      roughness: 0.2,
      emissive: new THREE.Color(0xd8b474),
      emissiveIntensity: 0.06
    });
  }

  /**
   * 第一層：外層周天 36 齒精密機械齒輪環
   */
  _initLayer1OuterGearRing() {
    this.outerGearGroup = new THREE.Group();

    const mainTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.78, 0.052, 24, 112),
      this.champagneBronzeMat
    );
    mainTorus.castShadow = true;
    this.outerGearGroup.add(mainTorus);

    // 內嵌副軌道細環
    const subTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.64, 0.018, 16, 96),
      this.brightGoldMat
    );
    this.outerGearGroup.add(subTorus);

    // 共享幾何建構 36 枚外周機械咬合齒與 12 枚內向卡榫
    const toothGeom = new THREE.BoxGeometry(0.065, 0.11, 0.055);
    const pawlGeom = new THREE.BoxGeometry(0.036, 0.09, 0.038);

    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeom, i % 3 === 0 ? this.brightGoldMat : this.champagneBronzeMat);
      tooth.position.set(Math.cos(a) * 1.86, Math.sin(a) * 1.86, 0);
      tooth.rotation.z = a - Math.PI * 0.5;
      this.outerGearGroup.add(tooth);

      if (i % 3 === 0) {
        const pawl = new THREE.Mesh(pawlGeom, this.celestialSlateMat);
        pawl.position.set(Math.cos(a) * 1.58, Math.sin(a) * 1.58, 0);
        pawl.rotation.z = a - Math.PI * 0.5;
        this.outerGearGroup.add(pawl);
      }
    }

    this.outerGearGroup.rotation.set(0.28, 0.16, 0.08);
    this.mechanismRoot.add(this.outerGearGroup);
  }

  /**
   * 第二層：十二星宿符文封印環（12 枚獨立可控發光符文牌）
   */
  _initLayer2RuneSealBand() {
    this.runeBandGroup = new THREE.Group();

    const bandTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.036, 20, 96),
      this.celestialSlateMat
    );
    this.runeBandGroup.add(bandTorus);

    const plaqueGeom = new THREE.BoxGeometry(0.20, 0.20, 0.034);
    const frameGeom = new THREE.BoxGeometry(0.225, 0.225, 0.024);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(a) * 1.38, Math.sin(a) * 1.38, 0);
      holder.rotation.z = a - Math.PI * 0.5;

      const frame = new THREE.Mesh(frameGeom, this.brightGoldMat);
      holder.add(frame);

      const glyphTex = createRuneGlyphTexture(i);
      const runeMat = new THREE.MeshStandardMaterial({
        map: glyphTex,
        color: 0x8e96a8,
        roughness: 0.3,
        metalness: 0.4,
        emissive: new THREE.Color(0xf4d9a0),
        emissiveMap: glyphTex,
        emissiveIntensity: 0.03
      });

      const plaque = new THREE.Mesh(plaqueGeom, runeMat);
      holder.add(plaque);

      this.runeBandGroup.add(holder);
      this.runePlaques.push({ holder, runeMat, lit: false });
    }

    this.runeBandGroup.rotation.set(-0.38, 0.32, -0.22);
    this.mechanismRoot.add(this.runeBandGroup);
  }

  /**
   * 第三層：斜交子午環與神聖十二芒星幾何骨架
   */
  _initLayer3CelestialGeometry() {
    this.geometryGimbal = new THREE.Group();

    // 斜交天球軌道環
    const meridian1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.08, 0.022, 18, 88),
      this.brightGoldMat
    );
    meridian1.rotation.x = Math.PI * 0.32;
    this.geometryGimbal.add(meridian1);

    const meridian2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.04, 0.016, 16, 88),
      this.paleJadeMat
    );
    meridian2.rotation.y = Math.PI * 0.36;
    this.geometryGimbal.add(meridian2);

    // 雙正六邊／六芒星交錯精密連桿（12 芒神聖幾何）
    this.sacredStarMat = new THREE.MeshStandardMaterial({
      color: 0xe8d0a2,
      metalness: 0.88,
      roughness: 0.22,
      emissive: new THREE.Color(0xe5c68b),
      emissiveIntensity: 0.04
    });

    this.starFrameGroup = new THREE.Group();
    const radius = 1.04;
    const rodGeom = new THREE.CylinderGeometry(0.011, 0.011, radius * Math.sqrt(3), 10);

    for (let t = 0; t < 4; t++) {
      const baseAngle = (t * Math.PI) / 6;
      for (let side = 0; side < 3; side++) {
        const a1 = baseAngle + (side * Math.PI * 2) / 3;
        const a2 = baseAngle + ((side + 1) * Math.PI * 2) / 3;
        const p1 = new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, 0);
        const p2 = new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, 0);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(p2, p1).normalize();

        const rod = new THREE.Mesh(rodGeom, this.sacredStarMat);
        rod.position.copy(mid);
        rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        this.starFrameGroup.add(rod);
      }
    }

    this.geometryGimbal.add(this.starFrameGroup);
    this.geometryGimbal.rotation.set(0.52, -0.35, 0.18);
    this.mechanismRoot.add(this.geometryGimbal);
  }

  /**
   * 第四層：中央六瓣玉金機械鎖 (Mechanical Iris Seal)
   * 平時緊密聚攏封住核心；UNLOCKING 時先旋轉退栓，再沿徑向滑開外展！
   */
  _initLayer4MechanicalIrisLock() {
    this.irisLockGroup = new THREE.Group();

    // 鎖座內環
    const lockHousing = new THREE.Mesh(
      new THREE.TorusGeometry(0.74, 0.032, 18, 72),
      this.champagneBronzeMat
    );
    this.irisLockGroup.add(lockHousing);

    // 六片楔形玉金鎖瓣
    const clawOuterGeom = new THREE.CylinderGeometry(0.06, 0.26, 0.42, 4);
    const jadeInlayGeom = new THREE.BoxGeometry(0.08, 0.24, 0.055);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.z = angle;

      const clawAssembly = new THREE.Group();
      // 閉合時尖端指向圓心 (y = 0.30)，退栓解鎖時沿 +Y 滑退至 y = 0.68 並微仰
      clawAssembly.position.set(0, 0.31, 0.02);

      const bronzeWedge = new THREE.Mesh(clawOuterGeom, this.champagneBronzeMat);
      bronzeWedge.rotation.y = Math.PI * 0.25;
      bronzeWedge.rotation.z = Math.PI; // 窄端朝向中心
      bronzeWedge.scale.set(1.0, 1.0, 0.28);
      clawAssembly.add(bronzeWedge);

      const jadeStrip = new THREE.Mesh(jadeInlayGeom, this.paleJadeMat);
      jadeStrip.position.set(0, 0.02, 0.028);
      clawAssembly.add(jadeStrip);

      pivot.add(clawAssembly);
      this.irisLockGroup.add(pivot);

      this.sealClaws.push({
        pivot,
        clawAssembly,
        baseAngle: angle
      });
    }

    this.mechanismRoot.add(this.irisLockGroup);
  }

  /**
   * 第五層：深邃多面能量星核與中心柔光暈
   */
  _initLayer5EnergyCore() {
    this.coreGroup = new THREE.Group();

    const coreGeom = new THREE.IcosahedronGeometry(0.28, 1);
    this.coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf4e4,
      roughness: 0.12,
      metalness: 0.18,
      clearcoat: 1.0,
      emissive: new THREE.Color(0xf0d298),
      emissiveIntensity: 0.18
    });
    this.coreMesh = new THREE.Mesh(coreGeom, this.coreMat);
    this.coreGroup.add(this.coreMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xfff3d6,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    this.coreWire = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 1), wireMat);
    this.coreGroup.add(this.coreWire);

    // 柔和光暈平面（始終朝向相機方向附近，營造無硬邊星核光感）
    const glowTex = createRadialGlowTexture();
    this.coreHaloMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xf7e2b8,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreHalo = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 1.65), this.coreHaloMat);
    this.coreHalo.position.z = 0.05;
    this.coreGroup.add(this.coreHalo);

    this.mechanismRoot.add(this.coreGroup);

    this.coreLight = new THREE.PointLight(0xf6dfb2, 0.85, 12, 1.8);
    this.coreLight.position.set(0, 0.28, 0.45);
    this.group.add(this.coreLight);
  }

  _initOrbitingAstrolabeNodes() {
    const dotGeom = new THREE.SphereGeometry(0.026, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xf2dfb8,
      transparent: true,
      opacity: 0.65
    });

    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(dotGeom, dotMat);
      const r = 2.02 + (i % 3) * 0.24;
      const angle = (i / 14) * Math.PI * 2;
      const speed = (i % 2 === 0 ? 1 : -1) * (0.07 + (i % 4) * 0.035);
      const incl = (i % 2 === 0 ? 1 : -1) * (0.22 + (i % 3) * 0.16);
      this.mechanismRoot.add(m);
      this.orbiters.push({ mesh: m, r, angle, speed, incl });
    }
  }

  _spawnEnergyWave(maxScale = 6.2, colorHex = 0xf2d8a4) {
    const geom = new THREE.RingGeometry(0.32, 0.40, 80);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geom, mat);
    wave.position.copy(this.mechanismRoot.position);
    this.group.add(wave);
    this.waves.push({ mesh: wave, age: 0, maxAge: 1.25, maxScale });
  }

  _setPhase(nextPhase) {
    if (this.phase === nextPhase) return;
    this.phase = nextPhase;
    this.phaseTime = 0;
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(nextPhase);
    }
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  setImpactHandler(fn) {
    this.onImpactCallback = fn;
  }

  getFocusPosition() {
    return this.mechanismRoot.position;
  }

  isBusy() {
    return (
      this.phase !== CELESTIAL_PHASES.DORMANT &&
      this.phase !== CELESTIAL_PHASES.GUIDANCE
    );
  }

  /**
   * 啟動 6 階段宇宙封印機關解鎖儀式
   */
  invokeOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (this.isBusy()) return;

    this.sessionId++;
    this.onRevealedCallback = onRevealed;
    this.onPhaseChange = onPhaseChange;
    this.lastTickTime = 0;
    this.litRuneCount = 0;
    this.lockSoundPlayed = false;

    this.runePlaques.forEach((rp) => {
      rp.lit = false;
      rp.runeMat.emissiveIntensity = 0.04;
    });

    this._setPhase(CELESTIAL_PHASES.AWAKENING);
  }

  reset() {
    this.sessionId++;
    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.phase = CELESTIAL_PHASES.DORMANT;
    this.phaseTime = 0;
    this.litRuneCount = 0;
    this.lockSoundPlayed = false;

    this.mechanismRoot.position.set(0, 0.04, 0);
    this.mechanismRoot.scale.setScalar(this.baseScale);

    this.runePlaques.forEach((rp) => {
      rp.lit = false;
      rp.runeMat.emissiveIntensity = 0.04;
    });

    this.sealClaws.forEach((sc) => {
      sc.pivot.rotation.z = sc.baseAngle;
      sc.clawAssembly.position.set(0, 0.31, 0.02);
      sc.clawAssembly.rotation.set(0, 0, 0);
    });

    this.coreMat.emissiveIntensity = 0.16;
    this.coreHaloMat.opacity = 0.20;
    this.coreHalo.scale.set(1, 1, 1);
    this.coreLight.intensity = 0.85;

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      this.group.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    this.waves = [];
  }

  getCameraTarget() {
    switch (this.phase) {
      case CELESTIAL_PHASES.AWAKENING:
        return { pos: [0, 0.35, 5.85], lookAt: [0, 0.08, 0] };
      case CELESTIAL_PHASES.ACTIVATION:
        return { pos: [0.18, 0.52, 6.05], lookAt: [0, 0.08, 0] };
      case CELESTIAL_PHASES.UNLOCKING:
        // 鏡頭推近特寫中央六瓣機械鎖退栓開啟
        return { pos: [0, 0.22, 4.95], lookAt: [0, 0.05, 0] };
      case CELESTIAL_PHASES.REVELATION:
        return { pos: [0, 0.36, 5.55], lookAt: [0, 0.12, 0] };
      case CELESTIAL_PHASES.GUIDANCE:
        // 機關退向溫暖晨光遠景上方，襯托前方展開的古紙卷軸
        return { pos: [0, 0.58, 6.45], lookAt: [0, 0.08, 0] };
      default:
        return { pos: [0, 0.48, 6.45], lookAt: [0, 0.12, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;
    const motionMul = this.reducedMotion ? 0.3 : 1.0;

    // 更新立體擴散能量波
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += safeDt;
      const p = w.age / w.maxAge;
      if (p >= 1) {
        this.group.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        this.waves.splice(i, 1);
      } else {
        const ease = 1 - Math.pow(1 - p, 3);
        const s = 1 + ease * w.maxScale;
        w.mesh.scale.set(s, s, 1);
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.52;
      }
    }

    // 軌道星體運行
    const orbBoost =
      this.phase === CELESTIAL_PHASES.ACTIVATION
        ? 3.4
        : this.phase === CELESTIAL_PHASES.UNLOCKING
        ? 1.8
        : 1.0;
    this.orbiters.forEach((o) => {
      o.angle += safeDt * o.speed * orbBoost * motionMul;
      o.mesh.position.set(
        Math.cos(o.angle) * o.r,
        Math.sin(o.angle * 2) * o.incl * 0.55,
        Math.sin(o.angle) * o.r
      );
    });

    // 1. DORMANT：沉睡微光呼吸，六瓣機械鎖緊閉
    if (this.phase === CELESTIAL_PHASES.DORMANT) {
      this.mechanismRoot.position.y = THREE.MathUtils.lerp(
        this.mechanismRoot.position.y,
        0.04 + Math.sin(this.elapsed * 0.85) * 0.045 * motionMul,
        safeDt * 3
      );
      this.mechanismRoot.position.z = THREE.MathUtils.lerp(this.mechanismRoot.position.z, 0, safeDt * 3);
      const s = THREE.MathUtils.lerp(this.mechanismRoot.scale.x, this.baseScale, safeDt * 3);
      this.mechanismRoot.scale.setScalar(s);

      this.outerGearGroup.rotation.z += safeDt * 0.045 * motionMul;
      this.runeBandGroup.rotation.z -= safeDt * 0.065 * motionMul;
      this.geometryGimbal.rotation.y += safeDt * 0.09 * motionMul;
      this.starFrameGroup.rotation.z -= safeDt * 0.05 * motionMul;

      const breath = 0.14 + Math.sin(this.elapsed * 1.6) * 0.05;
      this.coreMat.emissiveIntensity = breath;
      this.coreHaloMat.opacity = 0.16 + Math.sin(this.elapsed * 1.6) * 0.04;
      this.coreLight.intensity = 0.75;
      return;
    }

    // 2. AWAKENING（1.05s）：12 枚古代星宿符文依序逐一亮起，神聖幾何骨架顯現微光
    if (this.phase === CELESTIAL_PHASES.AWAKENING) {
      const dur = this.reducedMotion ? 0.42 : 1.08;
      const p = Math.min(1, this.phaseTime / dur);

      const targetLit = Math.min(12, Math.floor(p * 13));
      while (this.litRuneCount < targetLit) {
        const idx = this.litRuneCount;
        if (this.runePlaques[idx]) {
          this.runePlaques[idx].lit = true;
          ritualSound.playRuneIgnite(idx);
        }
        this.litRuneCount++;
      }

      this.runePlaques.forEach((rp) => {
        const goal = rp.lit ? 1.35 : 0.04;
        rp.runeMat.emissiveIntensity = THREE.MathUtils.lerp(rp.runeMat.emissiveIntensity, goal, safeDt * 12);
      });

      this.sacredStarMat.emissiveIntensity = THREE.MathUtils.lerp(0.04, 0.42, p);
      this.paleJadeMat.emissiveIntensity = THREE.MathUtils.lerp(0.05, 0.32, p);
      this.outerGearGroup.rotation.z -= safeDt * 0.12;
      this.runeBandGroup.rotation.z += safeDt * 0.25;

      this.coreMat.emissiveIntensity = THREE.MathUtils.lerp(0.16, 0.55, p);
      this.coreHaloMat.opacity = THREE.MathUtils.lerp(0.18, 0.42, p);
      this.coreLight.intensity = THREE.MathUtils.lerp(0.85, 2.2, p);

      if (p >= 1) {
        ritualSound.playSilkSweep();
        this._setPhase(CELESTIAL_PHASES.ACTIVATION);
      }
      return;
    }

    // 3. ACTIVATION（1.35s）：多層機構各自以不同軸向、方向與慣性高速運轉
    if (this.phase === CELESTIAL_PHASES.ACTIVATION) {
      const dur = this.reducedMotion ? 0.52 : 1.38;
      const p = Math.min(1, this.phaseTime / dur);
      const env = Math.sin(p * Math.PI);

      // 外層齒輪穩重順轉、符文環斜向逆轉、天球骨架立體翻旋、中央鎖座蓄勢微轉
      this.outerGearGroup.rotation.z += safeDt * (0.45 + env * 1.45);
      this.outerGearGroup.rotation.x += safeDt * (0.18 + env * 0.55);

      this.runeBandGroup.rotation.z -= safeDt * (0.75 + env * 2.45);
      this.runeBandGroup.rotation.y += safeDt * (0.35 + env * 1.15);

      this.geometryGimbal.rotation.x -= safeDt * (0.95 + env * 2.8);
      this.geometryGimbal.rotation.y += safeDt * (1.15 + env * 3.1);
      this.starFrameGroup.rotation.z += safeDt * (1.2 + env * 2.6);

      this.irisLockGroup.rotation.z -= safeDt * (0.35 + env * 0.9);
      this.coreMesh.rotation.y += safeDt * 3.2;
      this.coreWire.rotation.x -= safeDt * 2.6;

      this.coreMat.emissiveIntensity = 0.55 + env * 0.65;
      this.coreLight.intensity = 2.2 + env * 2.0;

      if (this.phaseTime - this.lastTickTime > 0.14 && env > 0.25) {
        this.lastTickTime = this.phaseTime;
        ritualSound.playBambooClack(0.28 + env * 0.35);
      }

      if (p >= 1) {
        this._setPhase(CELESTIAL_PHASES.UNLOCKING);
      }
      return;
    }

    // 4. UNLOCKING（1.18s）：
    //    前段 (0 ~ 0.48)：多層圓環互相咬合共面對齊（咔噠定位）
    //    後段 (0.35 ~ 1.0)：中央 6 片玉金機械鎖瓣旋轉退栓並向外滑開，揭露璀璨星核！
    if (this.phase === CELESTIAL_PHASES.UNLOCKING) {
      const dur = this.reducedMotion ? 0.48 : 1.18;
      const p = Math.min(1, this.phaseTime / dur);

      // 各層圓環收斂對齊至莊嚴共面角度
      const qOuter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.10, 0, 0));
      const qRune = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, 0.06, 0));
      const qGimbal = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.06, 0));

      this.outerGearGroup.quaternion.slerp(qOuter, Math.min(1, safeDt * 5.8));
      this.runeBandGroup.quaternion.slerp(qRune, Math.min(1, safeDt * 6.4));
      this.geometryGimbal.quaternion.slerp(qGimbal, Math.min(1, safeDt * 7.2));
      this.starFrameGroup.rotation.z = THREE.MathUtils.lerp(this.starFrameGroup.rotation.z, 0, Math.min(1, safeDt * 6));

      if (p >= 0.34 && !this.lockSoundPlayed) {
        this.lockSoundPlayed = true;
        ritualSound.playMechanismLock();
        this._spawnEnergyWave(3.2, 0xe8d09c);
      }

      // 中央六瓣機械鎖退栓與徑向滑開
      const unlatchP = Math.max(0, Math.min(1, (p - 0.28) / 0.72));
      const unlatchEase = 1 - Math.pow(1 - unlatchP, 3);

      this.sealClaws.forEach((sc) => {
        // 先微旋 15° 退開卡榫，同時向外滑開至半徑 0.66 並向外微翻 24°
        sc.pivot.rotation.z = sc.baseAngle + unlatchEase * 0.26;
        sc.clawAssembly.position.y = THREE.MathUtils.lerp(0.31, 0.66, unlatchEase);
        sc.clawAssembly.position.z = THREE.MathUtils.lerp(0.02, 0.10, unlatchEase);
        sc.clawAssembly.rotation.x = -0.42 * unlatchEase;
      });

      this.coreMesh.rotation.y += safeDt * 2.8;
      this.coreMat.emissiveIntensity = THREE.MathUtils.lerp(0.9, 1.85, unlatchEase);
      this.coreHaloMat.opacity = THREE.MathUtils.lerp(0.45, 0.92, unlatchEase);
      const haloScale = 1 + unlatchEase * 0.85;
      this.coreHalo.scale.set(haloScale, haloScale, 1);
      this.coreLight.intensity = THREE.MathUtils.lerp(3.2, 5.8, unlatchEase);

      if (p >= 1) {
        this._spawnEnergyWave(6.8, 0xfff0cc);
        this._spawnEnergyWave(4.4, 0xc8daf4);
        ritualSound.playChime('sacred');
        if (typeof this.onImpactCallback === 'function') {
          this.onImpactCallback(0.048);
        }
        this._setPhase(CELESTIAL_PHASES.REVELATION);
      }
      return;
    }

    // 5. REVELATION（0.88s）：封印核心能量向四方綻放擴散，天光破曉回暖
    if (this.phase === CELESTIAL_PHASES.REVELATION) {
      const dur = this.reducedMotion ? 0.32 : 0.88;
      const p = Math.min(1, this.phaseTime / dur);

      this.mechanismRoot.position.y = THREE.MathUtils.lerp(this.mechanismRoot.position.y, 0.58, safeDt * 3.2);
      this.coreMesh.rotation.y += safeDt * 1.4;
      this.starFrameGroup.rotation.z += safeDt * 0.25;

      const burstFade = 1 - p * 0.45;
      this.coreMat.emissiveIntensity = 1.85 * burstFade;
      this.coreHaloMat.opacity = 0.92 * burstFade;
      this.coreLight.intensity = THREE.MathUtils.lerp(5.8, 2.4, p);

      if (p >= 1) {
        this._setPhase(CELESTIAL_PHASES.GUIDANCE);
        if (typeof this.onRevealedCallback === 'function') {
          const cb = this.onRevealedCallback;
          this.onRevealedCallback = null;
          cb();
        }
      }
      return;
    }

    // 6. GUIDANCE：已解封的精密天體機關退居溫暖晨曦遠景上方緩慢運轉，守護卷軸指引
    if (this.phase === CELESTIAL_PHASES.GUIDANCE) {
      this.mechanismRoot.position.y = THREE.MathUtils.lerp(this.mechanismRoot.position.y, 1.38, safeDt * 2.6);
      this.mechanismRoot.position.z = THREE.MathUtils.lerp(this.mechanismRoot.position.z, -1.95, safeDt * 2.6);
      const s = THREE.MathUtils.lerp(this.mechanismRoot.scale.x, 0.58, safeDt * 2.6);
      this.mechanismRoot.scale.setScalar(s);

      this.outerGearGroup.rotation.z += safeDt * 0.05 * motionMul;
      this.runeBandGroup.rotation.z -= safeDt * 0.07 * motionMul;
      this.starFrameGroup.rotation.z += safeDt * 0.06 * motionMul;
      this.coreMesh.rotation.y += safeDt * 0.35 * motionMul;

      this.coreMat.emissiveIntensity = THREE.MathUtils.lerp(this.coreMat.emissiveIntensity, 0.45, safeDt * 2.5);
      this.coreHaloMat.opacity = THREE.MathUtils.lerp(this.coreHaloMat.opacity, 0.35, safeDt * 2.5);
      this.coreLight.intensity = THREE.MathUtils.lerp(this.coreLight.intensity, 1.5, safeDt * 2.5);
    }
  }
}
