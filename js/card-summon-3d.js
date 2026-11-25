/**
 * card-summon-3d.js
 * 「三元牌 · Magical Card Summoning」原創電影級 3D 奇幻魔法召喚舞台
 * 支援選牌共鳴與六階段召喚流程：
 *   MAGIC_CIRCLE → ENERGY_GATHERING → CARD_MATERIALIZATION → CARD_AWAKENING → CARD_REVEAL → RESULT
 *
 * 原創視覺語言（100% 原創東方星象 × 神聖幾何，絕不複製任何動漫既有魔法陣）：
 * - 雙層獨立逆轉立體幾何魔法陣（八芒星軌、日月弦弧、二十四星宿幾何銘文）
 * - 72 顆螺旋向心匯聚星芒粒子（ENERGY_GATHERING 階段向中央高速旋聚）
 * - 三道垂直凝結聖光柱（CARD_MATERIALIZATION 階段由光芒中凝結出三張實體卡牌）
 * - 個別卡牌專屬元素光波爆發（CARD_REVEAL 翻面瞬間綻放專屬色彩星環）
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

/**
 * 程式化繪製高解析度原創神聖星象幾何魔法陣貼圖（外環／內星分離以支援正逆雙向旋轉）
 */
function createMagicCircleTexture(layerType = 'outer') {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const cx = 512;
  const cy = 512;

  ctx.clearRect(0, 0, 1024, 1024);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#fff3d6';
  ctx.fillStyle = '#fff3d6';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (layerType === 'outer') {
    // 外雙環與細密星軌刻度
    const rings = [476, 456, 392, 380];
    rings.forEach((r, idx) => {
      ctx.lineWidth = idx === 0 || idx === 2 ? 3.2 : 1.5;
      ctx.globalAlpha = idx === 0 ? 0.92 : 0.68;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 72 道星度刻線與 24 枚原創星象幾何符記
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const isMajor = i % 3 === 0;
      ctx.globalAlpha = isMajor ? 0.85 : 0.35;
      ctx.lineWidth = isMajor ? 2.2 : 1.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 456, Math.sin(a) * 456);
      ctx.lineTo(Math.cos(a) * (isMajor ? 436 : 445), Math.sin(a) * (isMajor ? 436 : 445));
      ctx.stroke();
    }

    for (let i = 0; i < 24; i++) {
      ctx.save();
      ctx.rotate((i / 24) * Math.PI * 2);
      ctx.translate(0, -418);
      ctx.globalAlpha = 0.82;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (i % 3 === 0) {
        ctx.moveTo(0, -11);
        ctx.lineTo(9, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-9, 0);
        ctx.closePath();
      } else if (i % 3 === 1) {
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
      } else {
        ctx.moveTo(-8, -8);
        ctx.lineTo(8, 8);
        ctx.moveTo(8, -8);
        ctx.lineTo(-8, 8);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 四方弦月守護弧（原創日月交輝構圖）
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 2);
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -342, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -330, 38, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // 內層：原創八芒神聖星陣（雙正方形交錯）＋三元內環
    ctx.globalAlpha = 0.88;
    ctx.lineWidth = 2.8;
    for (let sq = 0; sq < 2; sq++) {
      ctx.save();
      ctx.rotate((sq * Math.PI) / 4);
      ctx.beginPath();
      const r = 342;
      for (let p = 0; p < 4; p++) {
        const a = (p * Math.PI) / 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 三元核心交織正三角與星芒中心
    for (let tr = 0; tr < 2; tr++) {
      ctx.save();
      ctx.rotate(tr * Math.PI);
      ctx.globalAlpha = tr === 0 ? 0.85 : 0.55;
      ctx.lineWidth = tr === 0 ? 2.6 : 1.8;
      ctx.beginPath();
      for (let v = 0; v < 3; v++) {
        const a = -Math.PI * 0.5 + (v * Math.PI * 2) / 3;
        const x = Math.cos(a) * 238;
        const y = Math.sin(a) * 238;
        if (v === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 128, 0, Math.PI * 2);
    ctx.stroke();

    // 中央八芒星輝
    ctx.beginPath();
    for (let s = 0; s < 16; s++) {
      const a = (s / 16) * Math.PI * 2;
      const rad = s % 2 === 0 ? 96 : 28;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const PILLAR_VERTEX_SHADER = `
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

const PILLAR_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;

  void main() {
    float edgeSoft = pow(abs(dot(vNormal, vViewDir)), 1.7);
    float vFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
    float stream = 0.82 + 0.18 * sin(vUv.y * 16.0 - uTime * 4.5 + vUv.x * 6.28);
    gl_FragColor = vec4(uColor, edgeSoft * vFade * stream * uOpacity);
  }
`;

export class CardSummonScene {
  constructor() {
    this.group = new THREE.Group();
    this.circleRoot = new THREE.Group();
    this.vertexSeals = [];
    this.pillars = [];
    this.waves = [];

    this.cardPhase = 'IDLE';
    this.stageName = 'main-select';
    this.selectedCount = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.reducedMotion = false;
    this.onImpactCallback = null;

    this.circleRoot.position.set(0, 0.42, -1.35);
    this.circleRoot.rotation.x = -0.34; // 具真實空間透視景深角度的立體魔法陣
    this.group.add(this.circleRoot);

    this._initMagicCircles();
    this._initTriadVertexCrystals();
    this._initSpiralVortexParticles();
    this._initCondensationPillars();
    this._initLights();
  }

  _initMagicCircles() {
    const outerTex = createMagicCircleTexture('outer');
    const innerTex = createMagicCircleTexture('inner');

    this.outerCircleMat = new THREE.MeshBasicMaterial({
      map: outerTex,
      color: 0xe8cfa0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.outerCircleMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 4.9), this.outerCircleMat);
    this.circleRoot.add(this.outerCircleMesh);

    this.innerCircleMat = new THREE.MeshBasicMaterial({
      map: innerTex,
      color: 0xd8cef2,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.innerCircleMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), this.innerCircleMat);
    this.innerCircleMesh.position.z = 0.06;
    this.circleRoot.add(this.innerCircleMesh);

    // 實體 3D 燙金外環框，賦予魔法陣真實金屬厚度感
    this.rimMat = new THREE.MeshStandardMaterial({
      color: 0xe0c492,
      metalness: 0.88,
      roughness: 0.22,
      emissive: new THREE.Color(0xdcb878),
      emissiveIntensity: 0.08
    });
    this.rimTorus = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.024, 18, 108), this.rimMat);
    this.circleRoot.add(this.rimTorus);
  }

  _initTriadVertexCrystals() {
    const crystalGeom = new THREE.OctahedronGeometry(0.11, 0);
    const ringGeom = new THREE.RingGeometry(0.15, 0.18, 36);

    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 0.5 + (i * Math.PI * 2) / 3;
      const r = 1.92;
      const holder = new THREE.Group();
      holder.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.12);

      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xfaf4e8,
        roughness: 0.16,
        metalness: 0.25,
        clearcoat: 0.9,
        emissive: new THREE.Color(0xe6cca0),
        emissiveIntensity: 0.1
      });
      const crystal = new THREE.Mesh(crystalGeom, mat);
      holder.add(crystal);

      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xf4dfb4,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const halo = new THREE.Mesh(ringGeom, haloMat);
      holder.add(halo);

      this.circleRoot.add(holder);
      this.vertexSeals.push({ holder, crystal, mat, haloMat });
    }
  }

  /**
   * 72 顆螺旋向心聚能粒子（ENERGY_GATHERING 時由外圍旋入中心）
   */
  _initSpiralVortexParticles() {
    const count = 72;
    this.vortexData = [];
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const baseR = 0.65 + Math.random() * 2.15;
      const speed = 0.8 + Math.random() * 1.1;
      const yOffset = (Math.random() - 0.5) * 1.4;
      this.vortexData.push({ angle: baseAngle, baseR, curR: baseR, speed, yOffset });
      positions[i * 3] = Math.cos(baseAngle) * baseR;
      positions[i * 3 + 1] = yOffset;
      positions[i * 3 + 2] = Math.sin(baseAngle) * baseR - 1.1;
    }

    this.vortexGeom = new THREE.BufferGeometry();
    this.vortexGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(244,222,180,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const dotTex = new THREE.CanvasTexture(canvas);

    this.vortexMat = new THREE.PointsMaterial({
      size: 0.11,
      map: dotTex,
      color: 0xf7e6c4,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.vortexPoints = new THREE.Points(this.vortexGeom, this.vortexMat);
    this.group.add(this.vortexPoints);
  }

  /**
   * 三道凝結聖光柱（CARD_MATERIALIZATION 階段卡牌自光芒中凝聚成形）
   */
  _initCondensationPillars() {
    const geom = new THREE.CylinderGeometry(0.44, 0.54, 3.8, 28, 1, true);
    const xCoords = [-1.36, 0, 1.36];

    xCoords.forEach((x) => {
      const uniforms = {
        uColor: { value: new THREE.Color('#f5e1b8') },
        uOpacity: { value: 0.0 },
        uTime: { value: 0 }
      };
      const mat = new THREE.ShaderMaterial({
        vertexShader: PILLAR_VERTEX_SHADER,
        fragmentShader: PILLAR_FRAGMENT_SHADER,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(x, 0.52, -0.75);
      this.group.add(mesh);
      this.pillars.push({ mesh, uniforms, targetOpacity: 0 });
    });
  }

  _initLights() {
    this.summonLight = new THREE.PointLight(0xf3dcb0, 1.0, 12, 2);
    this.summonLight.position.set(0, 0.65, -0.2);
    this.group.add(this.summonLight);
    this._lightBoost = 0;
  }

  _spawnBurstWave(worldPos, colorHex = 0xf4dfb4, maxScale = 4.5) {
    const geom = new THREE.RingGeometry(0.24, 0.32, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geom, mat);
    wave.position.copy(worldPos);
    this.group.add(wave);
    this.waves.push({ mesh: wave, age: 0, maxAge: 1.05, maxScale });
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  setImpactHandler(fn) {
    this.onImpactCallback = fn;
  }

  getFocusPosition() {
    return this.circleRoot.position;
  }

  /**
   * 同步三元牌目前狀態機（含六階段魔法召喚狀態）
   */
  setCardState(cardPhase, stageName = 'main-select', elementColors = null) {
    const prev = this.cardPhase;
    this.cardPhase = cardPhase || 'IDLE';
    this.stageName = stageName || this.stageName;
    this.phaseTime = 0;

    if (Array.isArray(elementColors)) {
      elementColors.forEach((col, i) => {
        if (this.pillars[i] && col) {
          this.pillars[i].uniforms.uColor.value.set(col);
        }
      });
    }

    if (this.cardPhase === 'MAGIC_CIRCLE' && prev !== 'MAGIC_CIRCLE') {
      this.circleRoot.scale.set(0.32, 0.32, 0.32);
      this._spawnBurstWave(new THREE.Vector3(0, 0.45, -1.1), 0xf3dfb4, 5.6);
      this._lightBoost = 1.4;
      ritualSound.playMagicHum();
    } else if (this.cardPhase === 'CARD_MATERIALIZATION') {
      this.pillars.forEach((p) => {
        p.targetOpacity = 0.44;
      });
      this._lightBoost = 1.8;
    } else if (this.cardPhase === 'CARD_AWAKENING' || this.cardPhase === 'CARD_REVEAL' || this.cardPhase === 'RESULT') {
      this.pillars.forEach((p) => {
        p.targetOpacity = this.cardPhase === 'CARD_AWAKENING' ? 0.18 : 0.0;
      });
    } else {
      this.pillars.forEach((p) => {
        p.targetOpacity = 0.0;
      });
    }
  }

  setSelectedCount(count) {
    const next = Math.max(0, Math.min(3, Number(count) || 0));
    const grew = next > this.selectedCount;
    this.selectedCount = next;

    if (grew && this.vertexSeals[next - 1]) {
      const worldPos = new THREE.Vector3();
      this.vertexSeals[next - 1].holder.getWorldPosition(worldPos);
      this._spawnBurstWave(worldPos, next === 3 ? 0xf7e4ba : 0xd6ccf0, next === 3 ? 4.0 : 2.6);
      this._lightBoost = Math.max(this._lightBoost, 0.6 + next * 0.25);
      ritualSound.playRuneIgnite(next * 2);
    }
  }

  /**
   * 卡牌翻面揭示瞬間（CARD_REVEAL）爆發專屬元素星環光效
   */
  triggerFlipImpulse(cardIdx = 1, colorHex = 0xf5dfb2) {
    const xOffset = (cardIdx - 1) * 1.36;
    const pos = new THREE.Vector3(xOffset, 0.55, -0.75);
    this._spawnBurstWave(pos, colorHex, 4.2);
    this._spawnBurstWave(pos, 0xffffff, 2.5);
    this._lightBoost = Math.max(this._lightBoost, 1.9);

    if (cardIdx === 2 && typeof this.onImpactCallback === 'function') {
      this.onImpactCallback(0.036);
    }
  }

  reset() {
    this.cardPhase = 'IDLE';
    this.stageName = 'main-select';
    this.selectedCount = 0;
    this._lightBoost = 0;
    this.circleRoot.position.set(0, 0.42, -1.35);
    this.circleRoot.rotation.set(-0.34, 0, 0);
    this.circleRoot.scale.set(1, 1, 1);
    this.pillars.forEach((p) => {
      p.targetOpacity = 0;
      p.uniforms.uOpacity.value = 0;
    });

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      this.group.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    this.waves = [];
  }

  getCameraTarget() {
    if (this.stageName === 'final-overview') {
      return { pos: [0, 0.72, 6.6], lookAt: [0, 0.42, 0] };
    }
    switch (this.cardPhase) {
      case 'MAGIC_CIRCLE':
        return { pos: [0, 0.85, 5.25], lookAt: [0, 0.42, -0.6] };
      case 'ENERGY_GATHERING':
        return { pos: [0, 0.65, 4.95], lookAt: [0, 0.45, -0.5] };
      case 'CARD_MATERIALIZATION':
      case 'CARD_AWAKENING':
        return { pos: [0, 0.52, 5.15], lookAt: [0, 0.48, 0] };
      case 'CARD_REVEAL':
        return { pos: [0, 0.58, 5.45], lookAt: [0, 0.46, 0] };
      case 'RESULT':
        return { pos: [0, 0.68, 6.25], lookAt: [0, 0.36, 0] };
      default:
        return { pos: [0, 0.65, 5.95], lookAt: [0, 0.46, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;
    const m = this.reducedMotion ? 0.28 : 1.0;

    // 1. 擴散光波更新
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
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.56;
      }
    }

    // 2. 魔法陣狀態動畫（召喚期間明亮浮現，結果閱讀時退向遠景柔化）
    const isSummonPeak =
      this.cardPhase === 'MAGIC_CIRCLE' ||
      this.cardPhase === 'ENERGY_GATHERING' ||
      this.cardPhase === 'CARD_MATERIALIZATION' ||
      this.cardPhase === 'CARD_AWAKENING' ||
      this.cardPhase === 'CARD_REVEAL';

    const isReading = this.cardPhase === 'RESULT' || this.stageName === 'final-overview';

    const targetScale = isReading ? 0.85 : isSummonPeak ? 1.06 : 0.96;
    const targetY = isReading ? 1.12 : 0.44 + Math.sin(this.elapsed * 0.9) * 0.04 * m;
    const targetZ = isReading ? -2.25 : -1.32;
    const targetRotX = isSummonPeak ? -0.18 : -0.36;

    const nextScale = THREE.MathUtils.lerp(this.circleRoot.scale.x, targetScale, safeDt * 3.8);
    this.circleRoot.scale.setScalar(nextScale);
    this.circleRoot.position.y = THREE.MathUtils.lerp(this.circleRoot.position.y, targetY, safeDt * 3.0);
    this.circleRoot.position.z = THREE.MathUtils.lerp(this.circleRoot.position.z, targetZ, safeDt * 3.0);
    this.circleRoot.rotation.x = THREE.MathUtils.lerp(this.circleRoot.rotation.x, targetRotX, safeDt * 3.2);

    const spinSpeed =
      this.cardPhase === 'ENERGY_GATHERING'
        ? 3.2
        : this.cardPhase === 'MAGIC_CIRCLE'
        ? 2.2
        : this.cardPhase === 'SHUFFLING'
        ? 2.0
        : isSummonPeak
        ? 1.35
        : 0.55;

    this.outerCircleMesh.rotation.z += safeDt * 0.14 * spinSpeed * m;
    this.innerCircleMesh.rotation.z -= safeDt * 0.22 * spinSpeed * m;

    const targetOuterOp = isSummonPeak ? 0.78 : isReading ? 0.22 : 0.30;
    const targetInnerOp = isSummonPeak ? 0.72 : isReading ? 0.18 : 0.24;
    this.outerCircleMat.opacity = THREE.MathUtils.lerp(this.outerCircleMat.opacity, targetOuterOp, safeDt * 4.5);
    this.innerCircleMat.opacity = THREE.MathUtils.lerp(this.innerCircleMat.opacity, targetInnerOp, safeDt * 4.5);

    // 3. 螺旋向心聚能粒子更新
    const posAttr = this.vortexGeom.attributes.position;
    const isGathering = this.cardPhase === 'ENERGY_GATHERING' || this.cardPhase === 'CARD_MATERIALIZATION';
    const targetVortexOp = isGathering ? 0.88 : isSummonPeak ? 0.48 : 0.18;
    this.vortexMat.opacity = THREE.MathUtils.lerp(this.vortexMat.opacity, targetVortexOp, safeDt * 5);

    for (let i = 0; i < this.vortexData.length; i++) {
      const d = this.vortexData[i];
      d.angle += safeDt * d.speed * (isGathering ? 3.8 : 0.55) * m;

      if (this.cardPhase === 'ENERGY_GATHERING') {
        // 粒子由外向中心快速旋聚
        d.curR = THREE.MathUtils.lerp(d.curR, 0.08 + (i % 5) * 0.06, safeDt * 3.4);
      } else {
        d.curR = THREE.MathUtils.lerp(d.curR, d.baseR, safeDt * 2.2);
      }

      const vx = Math.cos(d.angle) * d.curR;
      const vy = 0.45 + d.yOffset * (isGathering ? 0.45 : 1.0) + Math.sin(this.elapsed * 1.5 + i) * 0.08;
      const vz = Math.sin(d.angle) * d.curR * 0.55 - 0.95;
      posAttr.setXYZ(i, vx, vy, vz);
    }
    posAttr.needsUpdate = true;

    // 4. 三道凝結光柱更新
    this.pillars.forEach((p) => {
      p.uniforms.uTime.value = this.elapsed;
      p.uniforms.uOpacity.value = THREE.MathUtils.lerp(
        p.uniforms.uOpacity.value,
        p.targetOpacity,
        safeDt * 6.0
      );
    });

    // 5. 三枚選牌頂點星印亮度更新
    this.vertexSeals.forEach((vs, idx) => {
      const lit = idx < this.selectedCount || isSummonPeak || isReading;
      vs.mat.emissiveIntensity = THREE.MathUtils.lerp(vs.mat.emissiveIntensity, lit ? 0.85 : 0.1, safeDt * 6);
      vs.haloMat.opacity = THREE.MathUtils.lerp(vs.haloMat.opacity, lit ? 0.58 : 0.15, safeDt * 6);
      vs.crystal.rotation.y += safeDt * (lit ? 1.5 : 0.4) * m;
    });

    this._lightBoost = THREE.MathUtils.lerp(this._lightBoost, 0, safeDt * 2.8);
    this.summonLight.intensity = (isSummonPeak ? 2.2 : 0.95) + this._lightBoost * 1.6;
  }
}
