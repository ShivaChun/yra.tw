/**
 * cosmic-oracle-3d.js
 * 「宇宙指引（Cosmic Guidance）」電影級 3D 東方玄銅渾天星儀模組
 * 狀態機：IDLE → PRAYING → SHAKING → EXTRACTING → FLOATING → REVEALING → RESULT
 *
 * 視覺美學：東方古天文台玄墨暗金渾天儀（非廉價霓虹科幻）
 * - 三層不同半徑、不同慣性軸與獨立轉速的立體古銅金環（各自不同角速度）
 * - 中央多面雕琢黑曜星核（Obsidian Core）與溫潤內斂星芒
 * - 對齊瞬間觸發克制鏡頭微震動與水墨星波擴散，隨後保留靜謐留白
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const ORACLE_PHASES = Object.freeze({
  IDLE: 'IDLE',
  PRAYING: 'PRAYING',
  SHAKING: 'SHAKING',
  EXTRACTING: 'EXTRACTING',
  FLOATING: 'FLOATING',
  REVEALING: 'REVEALING',
  RESULT: 'RESULT'
});

const CN_NUMS = [
  '壹', '貳', '參', '肆', '伍',
  '陸', '柒', '捌', '玖', '拾',
  '拾壹', '拾貳', '拾參', '拾肆', '拾伍'
];

export function formatOracleIndex(num) {
  const cn = CN_NUMS[(num - 1) % CN_NUMS.length] || String(num);
  return `星 象 · ${cn}`;
}

/**
 * 程式化生成古銅星環刻度紋理
 */
function createAstrolabeRingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // 深古銅暗金基底
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#3a2e1f');
  grad.addColorStop(0.5, '#8a6d43');
  grad.addColorStop(1, '#2b2217');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  // 細密天文刻度線
  for (let i = 0; i < 128; i++) {
    const x = (i / 128) * 1024;
    const isMajor = i % 8 === 0;
    ctx.strokeStyle = isMajor ? 'rgba(235, 210, 165, 0.72)' : 'rgba(200, 164, 107, 0.28)';
    ctx.lineWidth = isMajor ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x, isMajor ? 18 : 34);
    ctx.lineTo(x, isMajor ? 110 : 94);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CosmicOracleScene {
  constructor() {
    this.group = new THREE.Group();
    this.armillaryGroup = new THREE.Group();
    this.rings = [];
    this.waves = [];

    this.phase = ORACLE_PHASES.IDLE;
    this.sessionId = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.lastTickTime = 0;
    this.reducedMotion = false;

    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.onImpactCallback = null;

    this.armillaryGroup.position.set(0, 0.25, 0);
    this.group.add(this.armillaryGroup);

    this._initRings();
    this._initObsidianCore();
    this._initAmbientOrbiters();
    this._initLights();
  }

  _initRings() {
    const ringTex = createAstrolabeRingTexture();

    const brassMat = new THREE.MeshStandardMaterial({
      map: ringTex,
      color: 0xc8a46b,
      metalness: 0.86,
      roughness: 0.28
    });

    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x262830,
      metalness: 0.78,
      roughness: 0.38
    });

    const paleGoldMat = new THREE.MeshStandardMaterial({
      color: 0xe2c799,
      metalness: 0.9,
      roughness: 0.22
    });

    // 三層不同半徑、厚度、材質與獨立轉速的渾天環（絕不使用相同轉速）
    const specs = [
      {
        radius: 1.52,
        tube: 0.048,
        mat: brassMat,
        initRot: new THREE.Euler(0.42, 0.15, 0.28),
        idleSpeed: new THREE.Vector3(0.08, 0.14, 0.04),
        spinPeak: new THREE.Vector3(1.15, 2.2, 0.55)
      },
      {
        radius: 1.18,
        tube: 0.036,
        mat: darkIronMat,
        initRot: new THREE.Euler(-0.65, 0.4, -0.35),
        idleSpeed: new THREE.Vector3(-0.13, 0.09, -0.11),
        spinPeak: new THREE.Vector3(-2.4, 1.4, -1.75)
      },
      {
        radius: 0.86,
        tube: 0.026,
        mat: paleGoldMat,
        initRot: new THREE.Euler(0.85, -0.5, 0.55),
        idleSpeed: new THREE.Vector3(0.19, -0.22, 0.12),
        spinPeak: new THREE.Vector3(3.1, -3.6, 1.9)
      }
    ];

    specs.forEach((s) => {
      const ringHolder = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(s.radius, s.tube, 24, 96),
        s.mat
      );
      torus.castShadow = true;
      torus.receiveShadow = true;
      ringHolder.add(torus);

      // 在環上加上 4 顆極細緻的古銅定位鉚點，強化旋轉與重量感
      const nodeGeom = new THREE.SphereGeometry(s.tube * 1.45, 12, 12);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        const node = new THREE.Mesh(nodeGeom, paleGoldMat);
        node.position.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius, 0);
        ringHolder.add(node);
      }

      ringHolder.rotation.copy(s.initRot);
      this.armillaryGroup.add(ringHolder);

      this.rings.push({
        mesh: ringHolder,
        currentVel: s.idleSpeed.clone(),
        idleSpeed: s.idleSpeed,
        spinPeak: s.spinPeak,
        targetAlignQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0))
      });
    });
  }

  _initObsidianCore() {
    // 中央多面黑曜星核（具重量感與低調清漆反射）
    const coreGeom = new THREE.OctahedronGeometry(0.42, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x111218,
      roughness: 0.18,
      metalness: 0.32,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
      emissive: new THREE.Color(0xc8a46b),
      emissiveIntensity: 0.06
    });

    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.coreMesh.castShadow = true;
    this.armillaryGroup.add(this.coreMesh);

    // 極細暗金星軌包絡線（非霓虹，僅作精工切面勾勒）
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xc8a46b,
      wireframe: true,
      transparent: true,
      opacity: 0.22
    });
    this.coreWire = new THREE.Mesh(new THREE.OctahedronGeometry(0.455, 1), wireMat);
    this.armillaryGroup.add(this.coreWire);
  }

  _initAmbientOrbiters() {
    // 12 顆極微小的古銅星點，象徵十二地支／宇宙星宿，以不同軌道半徑靜靜環繞
    this.orbiters = [];
    const dotGeom = new THREE.SphereGeometry(0.022, 10, 10);
    const dotMat = new THREE.MeshBasicMaterial({
      color: 0xe6cca0,
      transparent: true,
      opacity: 0.55
    });

    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(dotGeom, dotMat);
      const r = 1.78 + (i % 3) * 0.22;
      const angle = (i / 12) * Math.PI * 2;
      const speed = 0.08 + (i % 4) * 0.045;
      const incl = (i % 2 === 0 ? 1 : -1) * (0.25 + (i % 3) * 0.18);
      this.armillaryGroup.add(m);
      this.orbiters.push({ mesh: m, r, angle, speed, incl });
    }
  }

  _initLights() {
    // 星核內部暖金微光（隨儀式進展柔和增強，影響三層古銅環的動態反光）
    this.coreLight = new THREE.PointLight(0xe8cfa2, 0.9, 8, 2);
    this.coreLight.position.set(0, 0.25, 0.3);
    this.group.add(this.coreLight);
  }

  _spawnAlignmentWave() {
    const geom = new THREE.RingGeometry(0.45, 0.52, 72);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdcc08c,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geom, mat);
    wave.position.copy(this.armillaryGroup.position);
    this.group.add(wave);
    this.waves.push({ mesh: wave, age: 0, maxAge: 1.15 });
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

  isBusy() {
    return this.phase !== ORACLE_PHASES.IDLE && this.phase !== ORACLE_PHASES.RESULT;
  }

  /**
   * 取得星核世界座標（供動態光影追蹤）
   */
  getFocusPosition() {
    return this.armillaryGroup.position;
  }

  /**
   * 啟動 7 狀態宇宙指引儀式
   */
  invokeOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (this.isBusy()) return;

    this.sessionId++;
    this.onRevealedCallback = onRevealed;
    this.onPhaseChange = onPhaseChange;
    this.lastTickTime = 0;

    this._setPhase(ORACLE_PHASES.PRAYING);
  }

  reset() {
    this.sessionId++;
    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.phase = ORACLE_PHASES.IDLE;
    this.phaseTime = 0;

    this.armillaryGroup.position.set(0, 0.25, 0);
    this.armillaryGroup.scale.set(1, 1, 1);
    this.coreMesh.material.emissiveIntensity = 0.06;
    this.coreLight.intensity = 0.9;

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
      case ORACLE_PHASES.PRAYING:
        // 緩慢推近，凝聚靜謐感
        return { pos: [0, 0.6, 5.2], lookAt: [0, 0.25, 0] };
      case ORACLE_PHASES.SHAKING:
        return { pos: [0, 0.75, 5.5], lookAt: [0, 0.25, 0] };
      case ORACLE_PHASES.EXTRACTING:
        // 星環對齊瞬間微幅推近聚焦
        return { pos: [0, 0.45, 4.7], lookAt: [0, 0.25, 0] };
      case ORACLE_PHASES.FLOATING:
        return { pos: [0, 0.55, 5.1], lookAt: [0, 0.35, 0] };
      case ORACLE_PHASES.REVEALING:
      case ORACLE_PHASES.RESULT:
        // 渾天儀退至背景上方作為深邃景深襯底，絕不干擾閱讀
        return { pos: [0, 0.6, 6.2], lookAt: [0, 0.1, 0] };
      default:
        return { pos: [0, 0.8, 5.8], lookAt: [0, 0.25, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;

    // 更新星波擴散
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
        const easeOut = 1 - Math.pow(1 - p, 3);
        const s = 1 + easeOut * 5.2;
        w.mesh.scale.set(s, s, 1);
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.38;
      }
    }

    // 12 顆微細星點獨立軌道運行
    const orbSpeedMul = this.phase === ORACLE_PHASES.SHAKING ? 3.2 : this.reducedMotion ? 0.3 : 1.0;
    this.orbiters.forEach((o) => {
      o.angle += safeDt * o.speed * orbSpeedMul;
      const x = Math.cos(o.angle) * o.r;
      const z = Math.sin(o.angle) * o.r;
      const y = Math.sin(o.angle * 2) * o.incl * 0.45;
      o.mesh.position.set(x, y, z);
    });

    // 1. IDLE：沉靜緩轉，三環各自不同速度
    if (this.phase === ORACLE_PHASES.IDLE) {
      const m = this.reducedMotion ? 0.3 : 1.0;
      this.armillaryGroup.position.y = THREE.MathUtils.lerp(
        this.armillaryGroup.position.y,
        0.25 + Math.sin(this.elapsed * 0.9) * 0.06,
        safeDt * 3
      );
      this.armillaryGroup.position.z = THREE.MathUtils.lerp(this.armillaryGroup.position.z, 0, safeDt * 3);
      this.armillaryGroup.scale.lerp(new THREE.Vector3(1, 1, 1), safeDt * 3);

      this.rings.forEach((r) => {
        r.currentVel.lerp(r.idleSpeed, safeDt * 2.5);
        r.mesh.rotation.x += r.currentVel.x * safeDt * m;
        r.mesh.rotation.y += r.currentVel.y * safeDt * m;
        r.mesh.rotation.z += r.currentVel.z * safeDt * m;
      });

      this.coreMesh.rotation.y += safeDt * 0.22 * m;
      this.coreWire.rotation.y -= safeDt * 0.14 * m;
      this.coreMesh.material.emissiveIntensity = THREE.MathUtils.lerp(this.coreMesh.material.emissiveIntensity, 0.06, safeDt * 3);
      this.coreLight.intensity = THREE.MathUtils.lerp(this.coreLight.intensity, 0.9, safeDt * 3);
      return;
    }

    // 2. PRAYING（0.8s）：Anticipation & Silence — 三環先微微反向減速屏息
    if (this.phase === ORACLE_PHASES.PRAYING) {
      const dur = this.reducedMotion ? 0.28 : 0.8;
      const p = Math.min(1, this.phaseTime / dur);
      const ease = p * p * (3 - 2 * p);

      this.rings.forEach((r) => {
        // 反向微收蓄力
        r.currentVel.lerp(r.idleSpeed.clone().multiplyScalar(-0.45), safeDt * 4.5);
        r.mesh.rotation.x += r.currentVel.x * safeDt;
        r.mesh.rotation.y += r.currentVel.y * safeDt;
        r.mesh.rotation.z += r.currentVel.z * safeDt;
      });

      this.coreMesh.material.emissiveIntensity = THREE.MathUtils.lerp(0.06, 0.28, ease);
      this.coreLight.intensity = THREE.MathUtils.lerp(0.9, 1.8, ease);

      if (p >= 1) {
        ritualSound.playSilkSweep();
        this._setPhase(ORACLE_PHASES.SHAKING);
      }
      return;
    }

    // 3. SHAKING（1.4s）：Momentum — 三環具質量慣性地依序加速共振
    if (this.phase === ORACLE_PHASES.SHAKING) {
      const dur = this.reducedMotion ? 0.5 : 1.4;
      const p = Math.min(1, this.phaseTime / dur);
      // 緩急不均的動量曲線：前段蓄勢加速，中後段達峰值
      const env = Math.sin(p * Math.PI);

      this.rings.forEach((r, idx) => {
        // 外環最重最慢啟動，內環最輕最快加速
        const inertia = idx === 0 ? 2.4 : idx === 1 ? 3.8 : 5.4;
        const targetVel = r.spinPeak.clone().multiplyScalar(0.35 + env * 0.9);
        r.currentVel.lerp(targetVel, safeDt * inertia);
        r.mesh.rotation.x += r.currentVel.x * safeDt;
        r.mesh.rotation.y += r.currentVel.y * safeDt;
        r.mesh.rotation.z += r.currentVel.z * safeDt;
      });

      this.coreMesh.rotation.y += safeDt * (1.2 + env * 4.2);
      this.coreWire.rotation.x -= safeDt * (0.8 + env * 2.8);
      this.coreMesh.material.emissiveIntensity = 0.28 + env * 0.65;
      this.coreLight.intensity = 1.8 + env * 2.4;

      if (this.phaseTime - this.lastTickTime > 0.16 && env > 0.3) {
        this.lastTickTime = this.phaseTime;
        ritualSound.playBambooClack(0.22 + env * 0.35);
      }

      if (p >= 1) {
        this._spawnAlignmentWave();
        ritualSound.playChime('sacred');
        if (typeof this.onImpactCallback === 'function') {
          this.onImpactCallback(0.055); // 克制的一次微震動，強化星環對齊的 Impact
        }
        this._setPhase(ORACLE_PHASES.EXTRACTING);
      }
      return;
    }

    // 4. EXTRACTING（0.92s）：Impact & Alignment — 三環帶著阻尼慣性對齊共面，星核綻放溫潤暖芒
    if (this.phase === ORACLE_PHASES.EXTRACTING) {
      const dur = this.reducedMotion ? 0.35 : 0.92;
      const p = Math.min(1, this.phaseTime / dur);

      this.rings.forEach((r, idx) => {
        // 以不同阻尼收斂至幾乎共面但保留微幅立體層次的角度
        const alignQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.18 + idx * 0.08, idx * 0.12, 0)
        );
        r.mesh.quaternion.slerp(alignQuat, Math.min(1, safeDt * (4.5 + idx * 1.4)));
      });

      this.coreMesh.rotation.y += safeDt * (1.8 * (1 - p) + 0.35);
      this.coreMesh.material.emissiveIntensity = THREE.MathUtils.lerp(0.95, 0.55, p);
      this.coreLight.intensity = THREE.MathUtils.lerp(4.2, 2.5, p);

      if (p >= 1) {
        this._setPhase(ORACLE_PHASES.FLOATING);
      }
      return;
    }

    // 5. FLOATING（0.82s）：Silence — 靜謐留白，星儀緩升，準備展開卷軸
    if (this.phase === ORACLE_PHASES.FLOATING) {
      const dur = this.reducedMotion ? 0.3 : 0.82;
      const p = Math.min(1, this.phaseTime / dur);

      this.armillaryGroup.position.y = THREE.MathUtils.lerp(this.armillaryGroup.position.y, 0.55, safeDt * 3);
      this.coreMesh.rotation.y += safeDt * 0.35;
      this.rings.forEach((r, idx) => {
        r.mesh.rotation.z += safeDt * (idx % 2 === 0 ? 0.12 : -0.15);
      });

      if (p >= 1) {
        this._setPhase(ORACLE_PHASES.REVEALING);
        if (typeof this.onRevealedCallback === 'function') {
          const cb = this.onRevealedCallback;
          this.onRevealedCallback = null;
          cb();
        }
      }
      return;
    }

    // 6. REVEALING & 7. RESULT：退居景深後上方緩慢旋轉，與前方卷軸建立空間景深層次
    if (this.phase === ORACLE_PHASES.REVEALING || this.phase === ORACLE_PHASES.RESULT) {
      this.armillaryGroup.position.y = THREE.MathUtils.lerp(this.armillaryGroup.position.y, 1.55, safeDt * 2.5);
      this.armillaryGroup.position.z = THREE.MathUtils.lerp(this.armillaryGroup.position.z, -1.8, safeDt * 2.5);
      this.armillaryGroup.scale.lerp(new THREE.Vector3(0.78, 0.78, 0.78), safeDt * 2.5);

      const m = this.reducedMotion ? 0.25 : 0.65;
      this.rings.forEach((r) => {
        r.mesh.rotation.x += r.idleSpeed.x * safeDt * m;
        r.mesh.rotation.y += r.idleSpeed.y * safeDt * m;
      });
      this.coreMesh.rotation.y += safeDt * 0.2 * m;
      this.coreMesh.material.emissiveIntensity = THREE.MathUtils.lerp(this.coreMesh.material.emissiveIntensity, 0.22, safeDt * 2.5);
      this.coreLight.intensity = THREE.MathUtils.lerp(this.coreLight.intensity, 1.4, safeDt * 2.5);
    }
  }
}
