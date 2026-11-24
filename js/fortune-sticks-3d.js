/**
 * fortune-sticks-3d.js
 * 3D 東方靈籤（宇宙指引）完整 7 狀態求籤儀式模組
 * 狀態機：IDLE → PRAYING → SHAKING → EXTRACTING → FLOATING → REVEALING → RESULT
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const STICK_PHASES = Object.freeze({
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

export function formatStickNumber(num) {
  const cn = CN_NUMS[(num - 1) % CN_NUMS.length] || String(num);
  return `第 ${cn} 籤`;
}

function createTubeWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#181311');
  grad.addColorStop(0.5, '#261d18');
  grad.addColorStop(1, '#14100e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * 512;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(0,0,0,0.28)' : 'rgba(130, 95, 65, 0.08)';
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, 512);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBambooStickTexture(labelText = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#a88c62');
  grad.addColorStop(0.5, '#d6be93');
  grad.addColorStop(1, '#9b7f56');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 768);

  for (let i = 0; i < 45; i++) {
    const x = Math.random() * 128;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(85, 62, 34, 0.16)' : 'rgba(255, 245, 220, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 768);
    ctx.stroke();
  }

  const redGrad = ctx.createLinearGradient(0, 0, 0, 115);
  redGrad.addColorStop(0, '#7d241c');
  redGrad.addColorStop(0.82, '#993228');
  redGrad.addColorStop(1, 'rgba(153, 50, 40, 0)');
  ctx.fillStyle = redGrad;
  ctx.fillRect(0, 0, 128, 115);

  ctx.strokeStyle = 'rgba(140, 96, 42, 0.38)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 110, 108, 635);

  if (labelText) {
    const chars = labelText.replace(/\s+/g, '').split('');
    ctx.fillStyle = '#241710';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 44px "Noto Serif TC", serif';

    const startY = 235;
    const stepY = 74;
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, 64, startY + idx * stepY);
    });

    ctx.strokeStyle = '#8f2d24';
    ctx.lineWidth = 3;
    ctx.strokeRect(42, startY + chars.length * stepY + 18, 44, 44);
    ctx.fillStyle = '#8f2d24';
    ctx.font = '600 22px "Noto Serif TC", serif';
    ctx.fillText('靈', 64, startY + chars.length * stepY + 41);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class FortuneSticksScene {
  constructor() {
    this.group = new THREE.Group();
    this.tubeGroup = new THREE.Group();
    this.sticks = [];

    this.phase = STICK_PHASES.IDLE;
    this.sessionId = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.lastClackTime = 0;
    this.reducedMotion = false;

    this.onRevealedCallback = null;
    this.onPhaseChange = null;

    this.group.add(this.tubeGroup);

    this._initTube();
    this._initSticks();
    this._initHeroStick();
    this._initAuraLight();
  }

  _initTube() {
    const profile = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.66, 0.0),
      new THREE.Vector2(0.72, 0.16),
      new THREE.Vector2(0.68, 2.25),
      new THREE.Vector2(0.71, 2.42),
      new THREE.Vector2(0.64, 2.46),
      new THREE.Vector2(0.58, 2.40),
      new THREE.Vector2(0.57, 0.22),
      new THREE.Vector2(0.0, 0.22)
    ];

    const tubeGeom = new THREE.LatheGeometry(profile, 48);
    const tubeTex = createTubeWoodTexture();
    const tubeMat = new THREE.MeshPhysicalMaterial({
      map: tubeTex,
      roughness: 0.34,
      metalness: 0.08,
      clearcoat: 0.45,
      clearcoatRoughness: 0.3
    });

    const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
    tubeMesh.castShadow = true;
    tubeMesh.receiveShadow = true;
    this.tubeGroup.add(tubeMesh);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xc8a46b,
      metalness: 0.85,
      roughness: 0.26
    });

    const topBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.715, 0.715, 0.11, 48, 1, true),
      goldMat
    );
    topBand.position.y = 2.24;
    this.tubeGroup.add(topBand);

    const midBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.70, 0.70, 0.07, 48, 1, true),
      goldMat
    );
    midBand.position.y = 0.56;
    this.tubeGroup.add(midBand);

    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 128;
    plaqueCanvas.height = 256;
    const pCtx = plaqueCanvas.getContext('2d');
    pCtx.fillStyle = '#120f0d';
    pCtx.fillRect(0, 0, 128, 256);
    pCtx.strokeStyle = '#c8a46b';
    pCtx.lineWidth = 6;
    pCtx.strokeRect(8, 8, 112, 240);
    pCtx.fillStyle = '#e6cca0';
    pCtx.font = '500 54px "Noto Serif TC", serif';
    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.fillText('靈', 64, 88);
    pCtx.fillText('籤', 64, 168);

    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      roughness: 0.4,
      metalness: 0.35
    });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.76, 0.04), plaqueMat);
    plaque.position.set(0, 1.42, 0.69);
    this.tubeGroup.add(plaque);

    this.tubeGroup.position.set(0, -1.62, 0);
  }

  _initSticks() {
    const baseTex = createBambooStickTexture('');
    const stickMat = new THREE.MeshStandardMaterial({
      map: baseTex,
      roughness: 0.52,
      metalness: 0.04
    });

    const stickGeom = new THREE.BoxGeometry(0.115, 2.95, 0.028);

    for (let i = 0; i < 15; i++) {
      const ring = i < 5 ? 0 : 1;
      const angle = (i / (ring === 0 ? 5 : 10)) * Math.PI * 2 + ring * 0.4;
      const radius = ring === 0 ? 0.16 : 0.36;

      const mesh = new THREE.Mesh(stickGeom, stickMat);
      const baseX = Math.cos(angle) * radius;
      const baseZ = Math.sin(angle) * radius;
      const baseY = 1.65 + (Math.random() - 0.5) * 0.14;
      const tiltX = Math.sin(angle) * (0.04 + ring * 0.04);
      const tiltZ = -Math.cos(angle) * (0.04 + ring * 0.04);

      mesh.position.set(baseX, baseY, baseZ);
      mesh.rotation.set(tiltX, angle + Math.PI * 0.5, tiltZ);
      mesh.castShadow = true;

      this.tubeGroup.add(mesh);
      this.sticks.push({
        mesh,
        basePos: new THREE.Vector3(baseX, baseY, baseZ),
        baseRot: new THREE.Euler(tiltX, angle + Math.PI * 0.5, tiltZ),
        phase: Math.random() * Math.PI * 2,
        freq: 14 + Math.random() * 8
      });
    }
  }

  _initHeroStick() {
    const geom = new THREE.BoxGeometry(0.24, 3.1, 0.042);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xa6895e, roughness: 0.5 });
    const frontMat = new THREE.MeshStandardMaterial({
      map: createBambooStickTexture('第 壹 籤'),
      roughness: 0.42,
      metalness: 0.06
    });
    const backMat = new THREE.MeshStandardMaterial({
      map: createBambooStickTexture(''),
      roughness: 0.48
    });

    this.heroFrontMat = frontMat;
    this.heroStick = new THREE.Mesh(geom, [
      sideMat, sideMat, sideMat, sideMat, frontMat, backMat
    ]);
    this.heroStick.visible = false;
    this.heroStick.castShadow = true;
    this.group.add(this.heroStick);
  }

  _initAuraLight() {
    this.heroLight = new THREE.PointLight(0xe6cca0, 0, 10, 2);
    this.heroLight.position.set(0, 1.2, 2.2);
    this.group.add(this.heroLight);
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

  isBusy() {
    return this.phase !== STICK_PHASES.IDLE && this.phase !== STICK_PHASES.RESULT;
  }

  /**
   * 啟動 7 狀態求籤儀式
   * IDLE → PRAYING → SHAKING → EXTRACTING → FLOATING → REVEALING (回呼 React 展開卷軸)
   */
  drawStick(stickNumber, onRevealed, onPhaseChange) {
    if (this.isBusy()) return;

    this.sessionId++;
    this.onRevealedCallback = onRevealed;
    this.onPhaseChange = onPhaseChange;
    this.lastClackTime = 0;

    const label = formatStickNumber(stickNumber);
    if (this.heroFrontMat.map) {
      this.heroFrontMat.map.dispose();
    }
    this.heroFrontMat.map = createBambooStickTexture(label);
    this.heroFrontMat.needsUpdate = true;

    this.heroStick.visible = false;
    this.tubeGroup.visible = true;
    this.tubeGroup.position.set(0, -1.62, 0);
    this.tubeGroup.rotation.set(0, 0, 0);
    this.heroLight.intensity = 0;

    this._setPhase(STICK_PHASES.PRAYING);
  }

  reset() {
    this.sessionId++;
    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.phase = STICK_PHASES.IDLE;
    this.phaseTime = 0;
    this.heroStick.visible = false;
    this.tubeGroup.visible = true;
    this.tubeGroup.position.set(0, -1.62, 0);
    this.tubeGroup.rotation.set(0, 0, 0);
    this.heroLight.intensity = 0;
    this.sticks.forEach((s) => {
      s.mesh.position.copy(s.basePos);
      s.mesh.rotation.copy(s.baseRot);
    });
  }

  getCameraTarget() {
    switch (this.phase) {
      case STICK_PHASES.PRAYING:
        return { pos: [0, 1.5, 5.5], lookAt: [0, 0.2, 0] };
      case STICK_PHASES.SHAKING:
        return { pos: [0, 1.5, 5.8], lookAt: [0, 0.2, 0] };
      case STICK_PHASES.EXTRACTING:
      case STICK_PHASES.FLOATING:
        return { pos: [0, 1.1, 4.9], lookAt: [0, 0.75, 0] };
      case STICK_PHASES.REVEALING:
      case STICK_PHASES.RESULT:
        return { pos: [0, 1.3, 5.8], lookAt: [0, 0.2, 0] };
      default:
        return { pos: [0, 1.75, 6.2], lookAt: [0, 0.2, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;

    // 1. IDLE：籤筒靜立呼吸
    if (this.phase === STICK_PHASES.IDLE) {
      if (!this.reducedMotion) {
        this.tubeGroup.rotation.y = Math.sin(this.elapsed * 0.45) * 0.16;
      }
      this.tubeGroup.position.y = THREE.MathUtils.lerp(this.tubeGroup.position.y, -1.62, safeDt * 4);
      this.tubeGroup.position.z = THREE.MathUtils.lerp(this.tubeGroup.position.z, 0, safeDt * 4);
      this.sticks.forEach((s) => s.mesh.position.lerp(s.basePos, safeDt * 5));
      return;
    }

    // 2. PRAYING（0.72s / 簡化 0.25s）：誠心祈請、微光聚攏
    if (this.phase === STICK_PHASES.PRAYING) {
      const dur = this.reducedMotion ? 0.25 : 0.72;
      const p = Math.min(1, this.phaseTime / dur);
      const ease = p * p * (3 - 2 * p);

      this.tubeGroup.rotation.y = THREE.MathUtils.lerp(this.tubeGroup.rotation.y, 0, safeDt * 5);
      this.tubeGroup.position.y = -1.62 + Math.sin(p * Math.PI) * 0.08;
      this.heroLight.intensity = ease * 1.4;

      if (p >= 1) {
        this._setPhase(STICK_PHASES.SHAKING);
      }
      return;
    }

    // 3. SHAKING（1.35s / 簡化 0.5s）：搖晃籤筒、15 支竹籤真實碰撞竄動
    if (this.phase === STICK_PHASES.SHAKING) {
      const dur = this.reducedMotion ? 0.5 : 1.35;
      const p = Math.min(1, this.phaseTime / dur);
      const env = Math.sin(p * Math.PI);

      this.tubeGroup.rotation.x = 0.28 * env + Math.sin(this.phaseTime * 22) * 0.14 * env;
      this.tubeGroup.rotation.z = Math.cos(this.phaseTime * 17) * 0.12 * env;
      this.tubeGroup.position.y = -1.62 + Math.abs(Math.sin(this.phaseTime * 22)) * 0.22 * env;

      this.sticks.forEach((s) => {
        const bounce = Math.abs(Math.sin(this.phaseTime * s.freq + s.phase)) * 0.44 * env;
        const jitterX = Math.sin(this.phaseTime * (s.freq * 0.8) + s.phase) * 0.05 * env;
        const jitterZ = Math.cos(this.phaseTime * (s.freq * 0.7) + s.phase) * 0.05 * env;

        s.mesh.position.set(
          s.basePos.x + jitterX,
          s.basePos.y + bounce,
          s.basePos.z + jitterZ
        );
        s.mesh.rotation.x = s.baseRot.x + jitterZ * 2.2;
        s.mesh.rotation.z = s.baseRot.z - jitterX * 2.2;
      });

      if (this.phaseTime - this.lastClackTime > 0.095 && env > 0.25) {
        this.lastClackTime = this.phaseTime;
        ritualSound.playBambooClack(0.35 + env * 0.55);
      }

      if (p >= 1) {
        this.heroStick.visible = true;
        this.heroStick.position.set(0, 0.25, 0.15);
        this.heroStick.rotation.set(0.1, Math.PI, 0);
        this.heroStick.scale.set(0.75, 0.75, 0.75);
        ritualSound.playSilkSweep();
        this._setPhase(STICK_PHASES.EXTRACTING);
      }
      return;
    }

    // 4. EXTRACTING（0.88s / 簡化 0.35s）：靈籤清楚自筒中抽出、籤筒後退
    if (this.phase === STICK_PHASES.EXTRACTING) {
      const dur = this.reducedMotion ? 0.35 : 0.88;
      const p = Math.min(1, this.phaseTime / dur);
      const ease = 1 - Math.pow(1 - p, 3);

      this.tubeGroup.rotation.x = THREE.MathUtils.lerp(this.tubeGroup.rotation.x, 0, safeDt * 6);
      this.tubeGroup.rotation.z = THREE.MathUtils.lerp(this.tubeGroup.rotation.z, 0, safeDt * 6);
      this.tubeGroup.position.y = THREE.MathUtils.lerp(-1.62, -3.15, ease);
      this.tubeGroup.position.z = THREE.MathUtils.lerp(0, -2.3, ease);

      this.sticks.forEach((s) => s.mesh.position.lerp(s.basePos, safeDt * 6));

      this.heroStick.position.set(
        0,
        THREE.MathUtils.lerp(0.25, 0.92, ease),
        THREE.MathUtils.lerp(0.15, 1.35, ease)
      );
      const sc = THREE.MathUtils.lerp(0.75, 1.0, ease);
      this.heroStick.scale.set(sc, sc, sc);
      this.heroStick.rotation.x = THREE.MathUtils.lerp(0.1, 0, ease);
      this.heroStick.rotation.y = THREE.MathUtils.lerp(Math.PI, Math.PI * 2, ease);
      this.heroLight.intensity = THREE.MathUtils.lerp(1.4, 2.8, ease);

      if (p >= 1) {
        ritualSound.playChime('chime');
        this._setPhase(STICK_PHASES.FLOATING);
      }
      return;
    }

    // 5. FLOATING（0.9s / 簡化 0.35s）：中央懸浮定格展示立體籤號
    if (this.phase === STICK_PHASES.FLOATING) {
      const dur = this.reducedMotion ? 0.35 : 0.9;
      const p = Math.min(1, this.phaseTime / dur);

      this.heroStick.position.y = 0.92 + Math.sin(this.elapsed * 2.4) * 0.05;
      this.heroStick.rotation.y = Math.sin(this.phaseTime * 1.8) * 0.07;

      if (p >= 1) {
        this._setPhase(STICK_PHASES.REVEALING);
        if (typeof this.onRevealedCallback === 'function') {
          const cb = this.onRevealedCallback;
          this.onRevealedCallback = null;
          cb();
        }
      }
      return;
    }

    // 6. REVEALING & 7. RESULT：靈籤優雅退居卷軸上方橫陳守護，不遮擋籤詩閱讀
    if (this.phase === STICK_PHASES.REVEALING || this.phase === STICK_PHASES.RESULT) {
      this.heroStick.position.y = THREE.MathUtils.lerp(this.heroStick.position.y, 2.35, safeDt * 3.5);
      this.heroStick.position.z = THREE.MathUtils.lerp(this.heroStick.position.z, -0.6, safeDt * 3.5);
      this.heroStick.rotation.z = THREE.MathUtils.lerp(this.heroStick.rotation.z, Math.PI * 0.5, safeDt * 3.2);
      this.heroStick.rotation.y = THREE.MathUtils.lerp(this.heroStick.rotation.y, 0, safeDt * 4);
      this.heroLight.intensity = THREE.MathUtils.lerp(this.heroLight.intensity, 1.4, safeDt * 3);
      this.tubeGroup.visible = false;
    }
  }
}
