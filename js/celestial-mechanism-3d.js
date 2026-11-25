/**
 * celestial-mechanism-3d.js
 * 「宇宙指引 · Elegant Celestial Mechanism」精密天體封印機關（精修版）
 *
 * 設計準則（遠看輪廓簡潔有力量，近看具備豐富古典天文金屬雕刻工藝）：
 * - 第一層 Outer Ring（外圍主環）：完整連續、具金屬倒角厚度的車削香檳古銅主環，表面精雕十二星宿符文與周天刻度，無零碎突出鋸齒。
 * - 第二層 Celestial Orbit（天體運行環）：雙組不同傾角、扁平矩形斷面的連續天體軌道環與星體節點，與外環及核心保持從容留白比例。
 * - 第三層 Core Seal（中央封印）：對稱有序的六芒／十二芒星晷刻盤、六段同心圓弧鎖環（無風扇葉片、無雜亂交錯線）與立體透光能量星核。
 *
 * 機械因果動畫狀態機：
 *   DORMANT → ALIGNMENT → ORBIT_ROTATION → SEAL_LOCKING → ENERGY_ACTIVATION → REVELATION (→ GUIDANCE)
 *   嚴格區分「固定基準結構」、「定位主環」、「軌道運行結構」與「中央封印鎖定結構」，具清晰前後因果關係。
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const CELESTIAL_PHASES = Object.freeze({
  DORMANT: 'DORMANT',
  ALIGNMENT: 'ALIGNMENT',
  ORBIT_ROTATION: 'ORBIT_ROTATION',
  SEAL_LOCKING: 'SEAL_LOCKING',
  ENERGY_ACTIVATION: 'ENERGY_ACTIVATION',
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
  return `宇 宙 指 引 · ${cn}`;
}

/**
 * 為 RingGeometry 設定無變形平面極座標 UV，使圓盤蝕刻貼圖 100% 精準對齊圓環表面
 */
function applyPlanarRingUV(ringGeom, maxRadius) {
  const pos = ringGeom.attributes.position;
  const uv = ringGeom.attributes.uv;
  const inv = 1 / (maxRadius * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, x * inv + 0.5, y * inv + 0.5);
  }
  uv.needsUpdate = true;
  return ringGeom;
}

/**
 * 建構具真實矩形斷面與 45° 精密倒角的金屬環體 (LatheGeometry 轉向 XY 平面)
 */
function createMachinedRingGeometry(rInner, rOuter, halfThickness, bevel = 0.014, segments = 128) {
  const profile = [
    new THREE.Vector2(rInner, -halfThickness + bevel),
    new THREE.Vector2(rInner + bevel, -halfThickness),
    new THREE.Vector2(rOuter - bevel, -halfThickness),
    new THREE.Vector2(rOuter, -halfThickness + bevel),
    new THREE.Vector2(rOuter, halfThickness - bevel),
    new THREE.Vector2(rOuter - bevel, halfThickness),
    new THREE.Vector2(rInner + bevel, halfThickness),
    new THREE.Vector2(rInner, halfThickness - bevel),
    new THREE.Vector2(rInner, -halfThickness + bevel)
  ];
  const geom = new THREE.LatheGeometry(profile, segments);
  geom.rotateX(Math.PI * 0.5);
  geom.computeVertexNormals();
  return geom;
}

/**
 * 程式化繪製第一層「外圍主環」高精細古典星盤蝕刻表面與發光遮罩
 * (rNorm: 1.48 / 1.84 = 0.804 至 1.0)
 */
function createOuterRingTextures() {
  const size = 1024;
  const cx = size * 0.5;
  const cy = size * 0.5;
  const outerPx = size * 0.5; // 對應 r = 1.84
  const innerPx = outerPx * (1.48 / 1.84); // 對應 r = 1.48

  // 1. 香檳古銅拉絲與蝕刻色彩／凹凸貼圖
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  // 2. 十二星宿符文柔和發光貼圖（ALIGNMENT 時點亮，無任何黑色方塊）
  const emissiveCanvas = document.createElement('canvas');
  emissiveCanvas.width = size;
  emissiveCanvas.height = size;
  const ectx = emissiveCanvas.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, size, size);

  // 金屬環面徑向緞面漸層（溫潤明亮香檳古銅金光澤）
  const radGrad = ctx.createRadialGradient(cx, cy, innerPx, cx, cy, outerPx);
  radGrad.addColorStop(0.0, '#c8a66c');
  radGrad.addColorStop(0.14, '#f2ddb2');
  radGrad.addColorStop(0.52, '#e4c892');
  radGrad.addColorStop(0.88, '#f4e0b6');
  radGrad.addColorStop(1.0, '#ba975c');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);
  ectx.save();
  ectx.translate(cx, cy);

  // 極細微金屬同心車削髮絲紋
  for (let i = 0; i < 42; i++) {
    const r = innerPx + (i / 42) * (outerPx - innerPx);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 248, 232, 0.11)' : 'rgba(92, 68, 34, 0.09)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 主副階梯倒角刻線圈
  const rOuterLine = outerPx * 0.972;
  const rDegreeOuter = outerPx * 0.948;
  const rRuneBandOuter = outerPx * 0.918;
  const rRuneBandInner = innerPx * 1.045;
  const rInnerLine = innerPx * 1.018;

  [rOuterLine, rDegreeOuter, rRuneBandOuter, rRuneBandInner, rInnerLine].forEach((r, idx) => {
    ctx.strokeStyle = idx === 0 || idx === 4 ? 'rgba(86, 62, 28, 0.68)' : 'rgba(96, 70, 32, 0.48)';
    ctx.lineWidth = idx === 0 || idx === 4 ? 2.2 : 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 360 道精密周天角度刻線（外圈細刻度）
  for (let deg = 0; deg < 360; deg += 2) {
    const a = (deg * Math.PI) / 180;
    const is30 = deg % 30 === 0;
    const is10 = deg % 10 === 0;
    const len = is30 ? rOuterLine - rRuneBandInner : is10 ? rOuterLine - rRuneBandOuter : (rOuterLine - rDegreeOuter) * 0.85;
    ctx.strokeStyle = is30
      ? 'rgba(78, 54, 22, 0.78)'
      : is10
      ? 'rgba(88, 62, 28, 0.52)'
      : 'rgba(98, 72, 36, 0.30)';
    ctx.lineWidth = is30 ? 2.0 : is10 ? 1.3 : 0.8;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rOuterLine, Math.sin(a) * rOuterLine);
    ctx.lineTo(Math.cos(a) * (rOuterLine - len), Math.sin(a) * (rOuterLine - len));
    ctx.stroke();
  }

  // 十二宮區間內嵌蝕刻古老星宿符文（直接雕刻於香檳金環面，無突兀黑塊）
  const rRuneMid = (rRuneBandOuter + rRuneBandInner) * 0.5;
  const drawAstrolabeGlyph = (context, idx, strokeCol, lineW) => {
    context.strokeStyle = strokeCol;
    context.lineWidth = lineW;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const v = idx % 6;
    context.beginPath();
    if (v === 0) {
      context.arc(0, 0, 9.5, 0, Math.PI * 2);
      context.moveTo(-14, 0);
      context.lineTo(14, 0);
      context.moveTo(0, -13);
      context.lineTo(0, 13);
    } else if (v === 1) {
      context.moveTo(-11, 9);
      context.lineTo(0, -11);
      context.lineTo(11, 9);
      context.closePath();
      context.arc(0, 2, 3.2, 0, Math.PI * 2);
    } else if (v === 2) {
      context.arc(0, -3, 7.5, Math.PI * 0.15, Math.PI * 0.85, true);
      context.moveTo(0, -11);
      context.lineTo(0, 11);
      context.moveTo(-8, 5);
      context.lineTo(8, 5);
    } else if (v === 3) {
      context.moveTo(0, -12);
      context.lineTo(10, 0);
      context.lineTo(0, 12);
      context.lineTo(-10, 0);
      context.closePath();
      context.moveTo(-14, 0);
      context.lineTo(-10, 0);
      context.moveTo(10, 0);
      context.lineTo(14, 0);
    } else if (v === 4) {
      context.arc(-4, 0, 9, -Math.PI * 0.6, Math.PI * 0.6);
      context.arc(4, 0, 9, Math.PI * 0.4, Math.PI * 1.6);
    } else {
      for (let k = 0; k < 4; k++) {
        const ka = (k * Math.PI) / 4;
        const rr = k % 2 === 0 ? 12 : 7;
        context.moveTo(Math.cos(ka) * -rr, Math.sin(ka) * -rr);
        context.lineTo(Math.cos(ka) * rr, Math.sin(ka) * rr);
      }
    }
    context.stroke();
  };

  for (let i = 0; i < 12; i++) {
    const midAngle = ((i + 0.5) / 12) * Math.PI * 2;
    // 金屬陰刻深線＋高光邊
    ctx.save();
    ctx.rotate(midAngle + Math.PI * 0.5);
    ctx.translate(0, -rRuneMid);
    drawAstrolabeGlyph(ctx, i, 'rgba(255, 248, 228, 0.45)', 3.2);
    drawAstrolabeGlyph(ctx, i, 'rgba(78, 54, 22, 0.82)', 1.8);
    ctx.restore();

    // 同步繪製符文與刻度微光層
    ectx.save();
    ectx.rotate(midAngle + Math.PI * 0.5);
    ectx.translate(0, -rRuneMid);
    ectx.shadowColor = '#fff0c8';
    ectx.shadowBlur = 8;
    drawAstrolabeGlyph(ectx, i, '#fff6df', 2.4);
    ectx.restore();
  }

  // 發光層細雙環
  ectx.strokeStyle = 'rgba(255, 240, 204, 0.45)';
  ectx.lineWidth = 1.4;
  ectx.beginPath();
  ectx.arc(0, 0, rRuneBandOuter, 0, Math.PI * 2);
  ectx.stroke();
  ectx.beginPath();
  ectx.arc(0, 0, rRuneBandInner, 0, Math.PI * 2);
  ectx.stroke();

  ctx.restore();
  ectx.restore();

  const mapTex = new THREE.CanvasTexture(colorCanvas);
  mapTex.colorSpace = THREE.SRGBColorSpace;
  mapTex.anisotropy = 4;

  const emissiveTex = new THREE.CanvasTexture(emissiveCanvas);
  emissiveTex.colorSpace = THREE.SRGBColorSpace;
  emissiveTex.anisotropy = 4;

  return { mapTex, emissiveTex };
}

/**
 * 程式化繪製第三層「中央封印 Core Seal」對稱有序星芒幾何刻盤（參考圖 4 精緻放射星晷）
 */
function createCoreSealDiscTexture() {
  const size = 1024;
  const cx = 512;
  const cy = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);

  // 半透明溫玉珍珠底盤柔暈
  const bg = ctx.createRadialGradient(0, 0, 60, 0, 0, 480);
  bg.addColorStop(0.0, 'rgba(255, 250, 238, 0.55)');
  bg.addColorStop(0.65, 'rgba(238, 224, 194, 0.24)');
  bg.addColorStop(0.95, 'rgba(216, 188, 134, 0.34)');
  bg.addColorStop(1.0, 'rgba(216, 188, 134, 0.0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, 480, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#dfbe82';
  ctx.lineCap = 'round';

  // 外雙細環與內定位環（層次分明，絕不雜亂交錯）
  [468, 446, 336, 198].forEach((r, idx) => {
    ctx.globalAlpha = idx === 0 ? 0.92 : 0.68;
    ctx.lineWidth = idx === 0 ? 3.0 : 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 單一端正對稱六角星章外輪廓（僅於 336~446 環帶間呈現乾淨幾何秩序）
  ctx.globalAlpha = 0.78;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 - Math.PI * 0.5;
    const r = i % 2 === 0 ? 444 : 362;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // 中央 36 道精緻長短交替太陽放射星芒刻線（對標參考圖 4）
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const rIn = 148;
    const rOut = isMajor ? 316 : 268;
    ctx.globalAlpha = isMajor ? 0.88 : 0.48;
    ctx.lineWidth = isMajor ? 2.4 : 1.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
    ctx.stroke();
  }

  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 中心柔和透光光暈貼圖
 */
function createRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255, 253, 245, 1.0)');
  g.addColorStop(0.28, 'rgba(245, 224, 178, 0.62)');
  g.addColorStop(0.68, 'rgba(220, 196, 148, 0.18)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/**
 * 建構精緻立體四角星芒鑲釘 (✦)
 */
function createFourPointStarGeometry(outerR = 0.068, innerR = 0.022, depth = 0.018) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2
  });
  geom.center();
  return geom;
}

export class CelestialMechanismScene {
  constructor() {
    this.group = new THREE.Group();
    this.mechanismRoot = new THREE.Group();
    this.waves = [];
    this.sealArcs = [];
    this.starStuds = [];

    this.phase = CELESTIAL_PHASES.DORMANT;
    this.sessionId = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.reducedMotion = false;

    this.alignLockPlayed = false;
    this.orbitLockPlayed = false;
    this.sealLockPlayed = false;

    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.onImpactCallback = null;

    this.baseScale = 0.72;
    this.mechanismRoot.position.set(0, 0.03, 0);
    this.mechanismRoot.scale.setScalar(this.baseScale);
    this.group.add(this.mechanismRoot);

    this._initMaterials();
    this._initFixedAstrolabeFrame();
    this._initTier1OuterRing();
    this._initTier2CelestialOrbits();
    this._initTier3CoreSeal();
  }

  _initMaterials() {
    // 維持純粹香檳金、古銅金、暖白與溫潤淺銀銅色系（無突兀黑色零件）
    this.champagneGoldMat = new THREE.MeshStandardMaterial({
      color: 0xdcc292,
      metalness: 0.84,
      roughness: 0.25
    });

    this.antiqueBrassMat = new THREE.MeshStandardMaterial({
      color: 0xb9965c,
      metalness: 0.82,
      roughness: 0.30
    });

    this.paleCelestialGoldMat = new THREE.MeshStandardMaterial({
      color: 0xe6d6b8,
      metalness: 0.78,
      roughness: 0.24,
      emissive: new THREE.Color(0xdcb878),
      emissiveIntensity: 0.04
    });

    this.warmIvoryPearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xfbf6ec,
      roughness: 0.16,
      metalness: 0.12,
      clearcoat: 0.9,
      emissive: new THREE.Color(0xf2d9a4),
      emissiveIntensity: 0.12
    });
  }

  /**
   * 固定結構（Fixed Structure）：星盤頂部懸環冠座、底部鎮樞與四方定位基準指針（全程靜止不動）
   */
  _initFixedAstrolabeFrame() {
    this.fixedFrameGroup = new THREE.Group();

    // 北極古典星盤冠環 (對標參考圖 1 & 2 頂部提環)
    const topCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.135, 0.08, 24),
      this.antiqueBrassMat
    );
    topCollar.position.set(0, 1.88, 0);
    this.fixedFrameGroup.add(topCollar);

    const topBail = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.020, 16, 48),
      this.champagneGoldMat
    );
    topBail.position.set(0, 1.99, 0);
    this.fixedFrameGroup.add(topBail);

    // 南極對稱收尾鎮樞
    const botFinial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.045, 0.075, 24),
      this.antiqueBrassMat
    );
    botFinial.position.set(0, -1.88, 0);
    this.fixedFrameGroup.add(botFinial);

    const botRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.016, 14, 36),
      this.champagneGoldMat
    );
    botRing.position.set(0, -1.96, 0);
    this.fixedFrameGroup.add(botRing);

    // 四方內緣基準定位指針（N / E / S / W 固定刻度指標，讓外環旋轉對位一目了然）
    const pointerGeom = new THREE.ConeGeometry(0.032, 0.085, 4);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ptr = new THREE.Mesh(pointerGeom, this.paleCelestialGoldMat);
      ptr.position.set(Math.cos(a) * 1.44, Math.sin(a) * 1.44, 0.048);
      ptr.rotation.z = a + Math.PI * 0.5;
      this.fixedFrameGroup.add(ptr);
    }

    this.mechanismRoot.add(this.fixedFrameGroup);
  }

  /**
   * 第一層：Outer Ring（外圍主環 r = 1.48 ~ 1.84）
   * 完整厚實連續圓環、45° 精密倒角、十二星宿金屬蝕刻與周天刻度（無外突小齒輪）
   */
  _initTier1OuterRing() {
    this.outerRingGroup = new THREE.Group();

    // 1. 具立體厚度與內外倒角的車削古銅主環本體
    const bodyGeom = createMachinedRingGeometry(1.48, 1.84, 0.068, 0.018, 128);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.antiqueBrassMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.outerRingGroup.add(bodyMesh);

    // 外緣與內緣極細香檳金高光倒角線環，強化金屬車削精緻度
    const outerBevelRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.832, 0.010, 14, 128),
      this.paleCelestialGoldMat
    );
    outerBevelRing.position.z = 0.058;
    this.outerRingGroup.add(outerBevelRing);

    const innerBevelRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.488, 0.010, 14, 128),
      this.paleCelestialGoldMat
    );
    innerBevelRing.position.z = 0.058;
    this.outerRingGroup.add(innerBevelRing);

    // 2. 正反面高精度蝕刻星宿符文與周天刻度盤面
    const { mapTex, emissiveTex } = createOuterRingTextures();
    this.outerFaceMat = new THREE.MeshStandardMaterial({
      map: mapTex,
      bumpMap: mapTex,
      bumpScale: 0.010,
      color: 0xf7e7c4,
      metalness: 0.72,
      roughness: 0.22,
      emissive: new THREE.Color(0xf6dfb0),
      emissiveMap: emissiveTex,
      emissiveIntensity: 0.12
    });

    const faceGeom = applyPlanarRingUV(new THREE.RingGeometry(1.485, 1.832, 128, 2), 1.84);
    const frontFace = new THREE.Mesh(faceGeom, this.outerFaceMat);
    frontFace.position.z = 0.069;
    this.outerRingGroup.add(frontFace);

    const backFace = new THREE.Mesh(faceGeom, this.outerFaceMat);
    backFace.rotation.y = Math.PI;
    backFace.position.z = -0.069;
    this.outerRingGroup.add(backFace);

    // 4 枚古典星盤定位鉚釘（極克制點綴於主環四象位）
    const bossGeom = new THREE.CylinderGeometry(0.024, 0.028, 0.022, 16);
    bossGeom.rotateX(Math.PI * 0.5);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const boss = new THREE.Mesh(bossGeom, this.paleCelestialGoldMat);
      boss.position.set(Math.cos(a) * 1.66, Math.sin(a) * 1.66, 0.072);
      this.outerRingGroup.add(boss);
    }

    // 初始於沉睡時停留在未對位角度 (-0.54 rad)，ALIGNMENT 階段旋轉對準 0.000 rad 並鎖定
    this.outerRingRestAngle = -0.54;
    this.outerRingGroup.rotation.z = this.outerRingRestAngle;
    this.mechanismRoot.add(this.outerRingGroup);
  }

  /**
   * 第二層：Celestial Orbit（天體運行環 r = 0.96 ~ 1.17）
   * 與外環保留 0.31 明顯負空間留白；採用雙組扁平矩形斷面連續金屬軌道（對標參考圖 2 & 3）
   */
  _initTier2CelestialOrbits() {
    this.orbitSystemGroup = new THREE.Group();

    // 軌道一：主黃道扁平寬帶環 (r = 1.10 ~ 1.17)
    this.primaryOrbitGimbal = new THREE.Group();
    const orbit1Geom = createMachinedRingGeometry(1.10, 1.168, 0.046, 0.009, 108);
    const orbit1Mesh = new THREE.Mesh(orbit1Geom, this.champagneGoldMat);
    this.primaryOrbitGimbal.add(orbit1Mesh);

    // 主黃道環上的古典日輪星體節點（球體＋微細星環，對標參考圖 3 & 4）
    const sunNodeGroup = new THREE.Group();
    sunNodeGroup.position.set(1.134, 0, 0);
    const sunSphere = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 20), this.warmIvoryPearlMat);
    const sunHaloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.007, 10, 36),
      this.paleCelestialGoldMat
    );
    sunNodeGroup.add(sunSphere);
    sunNodeGroup.add(sunHaloRing);
    this.primaryOrbitGimbal.add(sunNodeGroup);

    // 對側平衡金珠節點
    const counterNode = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 16, 16),
      this.paleCelestialGoldMat
    );
    counterNode.position.set(-1.134, 0, 0);
    this.primaryOrbitGimbal.add(counterNode);

    this.primaryOrbitRestEuler = new THREE.Euler(0.46, -0.32, 0.18);
    this.primaryOrbitAlignQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.32, 0.14, 0));
    this.primaryOrbitGimbal.rotation.copy(this.primaryOrbitRestEuler);
    this.orbitSystemGroup.add(this.primaryOrbitGimbal);

    // 軌道二：副白道交錯扁平軌道環 (r = 0.96 ~ 1.015)
    this.secondaryOrbitGimbal = new THREE.Group();
    const orbit2Geom = createMachinedRingGeometry(0.958, 1.015, 0.036, 0.008, 108);
    const orbit2Mesh = new THREE.Mesh(orbit2Geom, this.paleCelestialGoldMat);
    this.secondaryOrbitGimbal.add(orbit2Mesh);

    const moonNode = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 18, 18),
      this.warmIvoryPearlMat
    );
    moonNode.position.set(0, 0.986, 0);
    this.secondaryOrbitGimbal.add(moonNode);

    this.secondaryOrbitRestEuler = new THREE.Euler(-0.52, 0.38, -0.24);
    this.secondaryOrbitAlignQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, -0.14, 0));
    this.secondaryOrbitGimbal.rotation.copy(this.secondaryOrbitRestEuler);
    this.orbitSystemGroup.add(this.secondaryOrbitGimbal);

    // 兩端極簡天球儀軸承銷，連結外環與主軌道（體現合理機械支撐邏輯）
    const pinGeom = new THREE.CylinderGeometry(0.012, 0.012, 0.30, 12);
    const pinTop = new THREE.Mesh(pinGeom, this.antiqueBrassMat);
    pinTop.position.set(0, 1.32, 0);
    this.orbitSystemGroup.add(pinTop);

    const pinBot = new THREE.Mesh(pinGeom, this.antiqueBrassMat);
    pinBot.position.set(0, -1.32, 0);
    this.orbitSystemGroup.add(pinBot);

    this.mechanismRoot.add(this.orbitSystemGroup);
  }

  /**
   * 第三層：Core Seal（中央封印 r = 0.0 ~ 0.66）
   * 對稱有序星芒刻盤＋六段同心圓弧鎖環＋立體透光能量核心（無風扇葉片、無雜亂交錯線）
   */
  _initTier3CoreSeal() {
    this.coreSealGroup = new THREE.Group();

    // 1. 中央封印外框細環 (r = 0.62 ~ 0.665) ＋ 6 枚對稱立體四角星鑲釘 (✦)
    const sealCollarGeom = createMachinedRingGeometry(0.615, 0.662, 0.028, 0.007, 96);
    const sealCollar = new THREE.Mesh(sealCollarGeom, this.champagneGoldMat);
    this.coreSealGroup.add(sealCollar);

    const starStudGeom = createFourPointStarGeometry(0.056, 0.018, 0.018);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI * 0.5;
      const studMat = new THREE.MeshStandardMaterial({
        color: 0xefe0be,
        metalness: 0.88,
        roughness: 0.18,
        emissive: new THREE.Color(0xf5dba0),
        emissiveIntensity: 0.08
      });
      const stud = new THREE.Mesh(starStudGeom, studMat);
      stud.position.set(Math.cos(a) * 0.638, Math.sin(a) * 0.638, 0.024);
      stud.rotation.z = a;
      this.coreSealGroup.add(stud);
      this.starStuds.push({ mesh: stud, mat: studMat });
    }

    // 2. 對稱太陽放射星芒與六角星章半透刻盤 (對標參考圖 4)
    const sealDiscTex = createCoreSealDiscTexture();
    this.sealDiscMat = new THREE.MeshBasicMaterial({
      map: sealDiscTex,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.sealDiscMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.24), this.sealDiscMat);
    this.coreSealGroup.add(this.sealDiscMesh);

    // 3. 六段同心圓弧鎖環（SEAL_LOCKING 時向內收束咬合成完整金環，REVELATION 時向外舒展開啟）
    this.sealArcRingGroup = new THREE.Group();
    const arcSpan = Math.PI / 3 - 0.11;
    const arcGeom = new THREE.TorusGeometry(0.42, 0.016, 16, 32, arcSpan);

    this.sealArcMat = new THREE.MeshStandardMaterial({
      color: 0xead2a4,
      metalness: 0.9,
      roughness: 0.18,
      emissive: new THREE.Color(0xf2d496),
      emissiveIntensity: 0.08
    });

    for (let i = 0; i < 6; i++) {
      const baseAngle = (i / 6) * Math.PI * 2;
      const holder = new THREE.Group();
      holder.rotation.z = baseAngle;

      const arcMesh = new THREE.Mesh(arcGeom, this.sealArcMat);
      // 讓圓弧置中於該段 +X 方向，以便沿徑向平順收束與舒展
      arcMesh.rotation.z = -arcSpan * 0.5;
      arcMesh.position.set(0.06, 0, 0.022);
      holder.add(arcMesh);

      this.sealArcRingGroup.add(holder);
      this.sealArcs.push({ holder, arcMesh, baseAngle });
    }
    this.sealArcRingGroup.rotation.z = Math.PI / 6;
    this.coreSealGroup.add(this.sealArcRingGroup);

    // 4. 中央立體透光能量核心（內部立體星芒核＋外部半透明琉璃玉球＋景深柔光暈）
    this.energyCoreGroup = new THREE.Group();

    // 內層發光星種
    this.innerSeedMat = new THREE.MeshBasicMaterial({
      color: 0xfff8e6
    });
    this.innerSeed = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 28), this.innerSeedMat);
    this.energyCoreGroup.add(this.innerSeed);

    // 內嵌精緻立體四角星核
    const innerStarGeom = createFourPointStarGeometry(0.175, 0.052, 0.032);
    this.innerStarMesh = new THREE.Mesh(innerStarGeom, this.paleCelestialGoldMat);
    this.energyCoreGroup.add(this.innerStarMesh);

    // 外層立體透光溫玉琉璃球殼（呈現真實立體感、透光感與深度）
    this.crystalShellMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf0,
      transparent: true,
      opacity: 0.64,
      roughness: 0.08,
      metalness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      emissive: new THREE.Color(0xf4d89e),
      emissiveIntensity: 0.18
    });
    this.crystalShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.235, 40, 40),
      this.crystalShellMat
    );
    this.energyCoreGroup.add(this.crystalShell);

    // 柔和中心景深光暈
    const glowTex = createRadialGlowTexture();
    this.coreGlowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0xfae4b8,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.coreGlowSprite = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.38), this.coreGlowMat);
    this.coreGlowSprite.position.z = -0.02;
    this.energyCoreGroup.add(this.coreGlowSprite);

    this.coreSealGroup.add(this.energyCoreGroup);
    this.mechanismRoot.add(this.coreSealGroup);

    this.coreLight = new THREE.PointLight(0xf7e1b4, 1.0, 12, 1.8);
    this.coreLight.position.set(0, 0.05, 0.55);
    this.group.add(this.coreLight);
  }

  _spawnEnergyWave(maxScale = 5.8, colorHex = 0xf7e4ba) {
    const geom = new THREE.RingGeometry(0.26, 0.32, 96);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wave = new THREE.Mesh(geom, mat);
    wave.position.copy(this.mechanismRoot.position);
    this.group.add(wave);
    this.waves.push({ mesh: wave, age: 0, maxAge: 2.15, maxScale });
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
   * 啟動六階段精密天體封印解鎖儀式：
   * DORMANT → ALIGNMENT → ORBIT_ROTATION → SEAL_LOCKING → ENERGY_ACTIVATION → REVELATION (→ GUIDANCE)
   */
  invokeOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (this.isBusy()) return;

    this.sessionId++;
    this.onRevealedCallback = onRevealed;
    this.onPhaseChange = onPhaseChange;

    this.alignLockPlayed = false;
    this.orbitLockPlayed = false;
    this.sealLockPlayed = false;
    this.litStudCount = 0;

    // 從較大沉睡偏移角甦醒，展現巨型古老星盤沉穩長程對位感
    this.outerRingGroup.rotation.z = -0.78;
    this.outerRingStartAngle = -0.78;
    ritualSound.playAncientResonance();
    this._setPhase(CELESTIAL_PHASES.ALIGNMENT);
  }

  reset() {
    this.sessionId++;
    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.phase = CELESTIAL_PHASES.DORMANT;
    this.phaseTime = 0;

    this.alignLockPlayed = false;
    this.orbitLockPlayed = false;
    this.sealLockPlayed = false;

    this.mechanismRoot.position.set(0, 0.03, 0);
    this.mechanismRoot.scale.setScalar(this.baseScale);

    this.outerRingGroup.rotation.set(0, 0, this.outerRingRestAngle);
    this.outerFaceMat.emissiveIntensity = 0.12;

    this.primaryOrbitGimbal.rotation.copy(this.primaryOrbitRestEuler);
    this.secondaryOrbitGimbal.rotation.copy(this.secondaryOrbitRestEuler);

    this.sealDiscMesh.rotation.z = 0;
    this.sealDiscMat.opacity = 0.72;
    this.sealArcRingGroup.rotation.z = Math.PI / 6;
    this.sealArcMat.emissiveIntensity = 0.08;
    this.sealArcs.forEach((sa) => {
      sa.arcMesh.position.set(0.06, 0, 0.022);
    });
    this.starStuds.forEach((st) => {
      st.mat.emissiveIntensity = 0.08;
    });

    this.innerSeed.scale.setScalar(1);
    this.crystalShellMat.emissiveIntensity = 0.18;
    this.coreGlowMat.opacity = 0.34;
    this.coreGlowSprite.scale.setScalar(1);
    this.coreLight.intensity = 1.0;

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
      case CELESTIAL_PHASES.ALIGNMENT:
        return { pos: [0, 0.32, 6.25], lookAt: [0, 0.04, 0] };
      case CELESTIAL_PHASES.ORBIT_ROTATION:
        return { pos: [0.16, 0.44, 6.05], lookAt: [0, 0.04, 0] };
      case CELESTIAL_PHASES.SEAL_LOCKING:
        return { pos: [0, 0.20, 5.25], lookAt: [0, 0.03, 0] };
      case CELESTIAL_PHASES.ENERGY_ACTIVATION:
        return { pos: [0, 0.14, 4.95], lookAt: [0, 0.03, 0] };
      case CELESTIAL_PHASES.REVELATION:
        return { pos: [0, 0.32, 5.65], lookAt: [0, 0.08, 0] };
      case CELESTIAL_PHASES.GUIDANCE:
        return { pos: [0, 0.56, 6.45], lookAt: [0, 0.08, 0] };
      default:
        return { pos: [0, 0.42, 6.45], lookAt: [0, 0.06, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;
    const motionMul = this.reducedMotion ? 0.3 : 1.0;

    // 更新能量擴散光環
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
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.54;
      }
    }

    // 1. DORMANT：外環與中央封印靜止沉睡（絕不全部零件一直旋轉），僅天體軌道極緩微移、核心輕柔呼吸
    if (this.phase === CELESTIAL_PHASES.DORMANT) {
      this.mechanismRoot.position.y = THREE.MathUtils.lerp(
        this.mechanismRoot.position.y,
        0.03 + Math.sin(this.elapsed * 0.75) * 0.035 * motionMul,
        safeDt * 3
      );
      this.mechanismRoot.position.z = THREE.MathUtils.lerp(this.mechanismRoot.position.z, 0, safeDt * 3);
      const s = THREE.MathUtils.lerp(this.mechanismRoot.scale.x, this.baseScale, safeDt * 3);
      this.mechanismRoot.scale.setScalar(s);

      // 僅天體軌道維持極緩慢星體微動，外環與封印保持莊嚴靜止
      this.primaryOrbitGimbal.rotation.y += safeDt * 0.032 * motionMul;
      this.secondaryOrbitGimbal.rotation.x -= safeDt * 0.024 * motionMul;
      this.innerStarMesh.rotation.z += safeDt * 0.08 * motionMul;

      const breath = 0.5 + 0.5 * Math.sin(this.elapsed * 1.5);
      this.crystalShellMat.emissiveIntensity = 0.14 + breath * 0.08;
      this.coreGlowMat.opacity = 0.28 + breath * 0.08;
      this.coreLight.intensity = 0.9 + breath * 0.2;
      return;
    }

    // 2. ALIGNMENT（2.45s）：
    //    巨型古老外環先於深空微光中緩緩甦醒克服靜摩擦，隨後帶著沉重質量感緩慢旋轉對位，並留出靜謐屏息停頓
    if (this.phase === CELESTIAL_PHASES.ALIGNMENT) {
      const dur = this.reducedMotion ? 0.68 : 2.45;
      const p = Math.min(1, this.phaseTime / dur);

      // 0.00 ~ 0.16：古老符文自幽暗中緩慢浮現微光；0.14 ~ 0.88：沉重外環緩慢加速再重錘減速定位；0.88 ~ 1.00：定位後靜默屏息
      const runeGlowP = Math.min(1, p / 0.45);
      this.outerFaceMat.emissiveIntensity = THREE.MathUtils.lerp(0.12, 0.96, runeGlowP * runeGlowP);

      const moveP = Math.max(0, Math.min(1, (p - 0.14) / 0.74));
      // 具龐大轉動慣量的高階緩動曲線（起步極沉、中段穩重、收尾沉穩咬合）
      const heavyEase =
        moveP < 0.5
          ? 8 * moveP * moveP * moveP * moveP
          : 1 - Math.pow(-2 * moveP + 2, 4) / 2;

      this.outerRingGroup.rotation.z = THREE.MathUtils.lerp(this.outerRingStartAngle, 0, heavyEase);

      if (p >= 0.87 && !this.alignLockPlayed) {
        this.alignLockPlayed = true;
        ritualSound.playMechanismLock();
        if (typeof this.onImpactCallback === 'function') {
          this.onImpactCallback(0.022);
        }
      }

      if (p >= 1) {
        this.outerRingGroup.rotation.z = 0;
        this.orbitStartQuat1 = this.primaryOrbitGimbal.quaternion.clone();
        this.orbitStartQuat2 = this.secondaryOrbitGimbal.quaternion.clone();
        ritualSound.playSilkSweep();
        this._setPhase(CELESTIAL_PHASES.ORBIT_ROTATION);
      }
      return;
    }

    // 3. ORBIT_ROTATION（2.75s）：
    //    外環沉重咬合後釋放雙層大型天體軌道，以莊嚴緩慢的角動量交錯巡行，對位後靜默停駐
    if (this.phase === CELESTIAL_PHASES.ORBIT_ROTATION) {
      const dur = this.reducedMotion ? 0.75 : 2.75;
      const p = Math.min(1, this.phaseTime / dur);

      if (p < 0.66) {
        const spinEnv = Math.sin((p / 0.66) * Math.PI);
        // 降低轉速，呈現巨型青銅渾天儀在深空緩慢運行的神祕壓迫與莊嚴感
        this.primaryOrbitGimbal.rotation.y += safeDt * (0.28 + spinEnv * 1.45);
        this.primaryOrbitGimbal.rotation.z += safeDt * (0.14 + spinEnv * 0.62);
        this.secondaryOrbitGimbal.rotation.x -= safeDt * (0.32 + spinEnv * 1.62);
        this.secondaryOrbitGimbal.rotation.y -= safeDt * (0.18 + spinEnv * 0.72);
        this.orbitLockStart1 = this.primaryOrbitGimbal.quaternion.clone();
        this.orbitLockStart2 = this.secondaryOrbitGimbal.quaternion.clone();
      } else if (p < 0.91) {
        const alignP = (p - 0.66) / 0.25;
        const alignEase = 1 - Math.pow(1 - alignP, 3);
        this.primaryOrbitGimbal.quaternion.copy(this.orbitLockStart1).slerp(this.primaryOrbitAlignQuat, alignEase);
        this.secondaryOrbitGimbal.quaternion.copy(this.orbitLockStart2).slerp(this.secondaryOrbitAlignQuat, alignEase);
      } else {
        this.primaryOrbitGimbal.quaternion.copy(this.primaryOrbitAlignQuat);
        this.secondaryOrbitGimbal.quaternion.copy(this.secondaryOrbitAlignQuat);
      }

      if (p >= 0.89 && !this.orbitLockPlayed) {
        this.orbitLockPlayed = true;
        ritualSound.playMechanismLock();
      }

      if (p >= 1) {
        this.primaryOrbitGimbal.quaternion.copy(this.primaryOrbitAlignQuat);
        this.secondaryOrbitGimbal.quaternion.copy(this.secondaryOrbitAlignQuat);
        this._setPhase(CELESTIAL_PHASES.SEAL_LOCKING);
      }
      return;
    }

    // 4. SEAL_LOCKING（2.10s）：
    //    中央神祕星晷刻盤緩緩旋正，六枚星釘依序甦醒，六段金弧沉穩向內收束咬合鎖定
    if (this.phase === CELESTIAL_PHASES.SEAL_LOCKING) {
      const dur = this.reducedMotion ? 0.62 : 2.10;
      const p = Math.min(1, this.phaseTime / dur);
      const lockP = Math.min(1, p / 0.88);
      const ease = lockP < 0.5 ? 4 * lockP * lockP * lockP : 1 - Math.pow(-2 * lockP + 2, 3) / 2;

      this.sealDiscMesh.rotation.z = ease * (Math.PI / 3);
      this.sealArcRingGroup.rotation.z = THREE.MathUtils.lerp(Math.PI / 6, 0, ease);

      this.sealArcs.forEach((sa) => {
        sa.arcMesh.position.x = THREE.MathUtils.lerp(0.068, 0.0, ease);
      });
      this.sealArcMat.emissiveIntensity = THREE.MathUtils.lerp(0.08, 0.82, ease);

      // 六枚四角星鑲釘伴隨清透泛音依序緩緩亮起
      const targetStuds = Math.min(6, Math.floor(lockP * 6.8));
      while ((this.litStudCount || 0) < targetStuds) {
        ritualSound.playRuneIgnite(this.litStudCount * 2);
        this.litStudCount = (this.litStudCount || 0) + 1;
      }

      this.starStuds.forEach((st, idx) => {
        const targetEm = idx < (this.litStudCount || 0) ? 1.05 : 0.08;
        st.mat.emissiveIntensity = THREE.MathUtils.lerp(st.mat.emissiveIntensity, targetEm, safeDt * 8);
      });

      if (p >= 0.87 && !this.sealLockPlayed) {
        this.sealLockPlayed = true;
        ritualSound.playMechanismLock();
      }

      if (p >= 1) {
        this._setPhase(CELESTIAL_PHASES.ENERGY_ACTIVATION);
      }
      return;
    }

    // 5. ENERGY_ACTIVATION（1.90s）：
    //    萬籟俱寂的古老儀式靜默中，星芒能量如深海呼吸般緩慢注入透光琉璃星核
    if (this.phase === CELESTIAL_PHASES.ENERGY_ACTIVATION) {
      const dur = this.reducedMotion ? 0.55 : 1.90;
      const p = Math.min(1, this.phaseTime / dur);
      const ease = p * p * (3 - 2 * p);
      const pulse = 1.0 + 0.08 * Math.sin(p * Math.PI * 3);

      this.sealDiscMat.opacity = THREE.MathUtils.lerp(0.72, 1.0, ease);
      this.innerStarMesh.rotation.z += safeDt * (0.45 + ease * 1.65);

      const seedScale = (1 + ease * 0.46) * pulse;
      this.innerSeed.scale.setScalar(seedScale);
      this.crystalShellMat.emissiveIntensity = THREE.MathUtils.lerp(0.24, 1.55, ease);
      this.coreGlowMat.opacity = THREE.MathUtils.lerp(0.38, 0.96, ease);
      const glowScale = 1 + ease * 0.72;
      this.coreGlowSprite.scale.setScalar(glowScale);
      this.coreLight.intensity = THREE.MathUtils.lerp(1.4, 5.5, ease);

      if (p >= 1) {
        this._spawnEnergyWave(6.6, 0xfff3d4);
        this._spawnEnergyWave(4.2, 0xe8cfa0);
        ritualSound.playChime('sacred');
        if (typeof this.onImpactCallback === 'function') {
          this.onImpactCallback(0.036);
        }
        this._setPhase(CELESTIAL_PHASES.REVELATION);
      }
      return;
    }

    // 6. REVELATION（1.55s）：
    //    中央六段金弧從容緩慢地向外舒展開封，神聖柔光自核心悠遠擴散，天光漸次破曉
    if (this.phase === CELESTIAL_PHASES.REVELATION) {
      const dur = this.reducedMotion ? 0.48 : 1.55;
      const p = Math.min(1, this.phaseTime / dur);
      const openEase = 1 - Math.pow(1 - p, 3);

      this.sealArcs.forEach((sa) => {
        sa.arcMesh.position.x = THREE.MathUtils.lerp(0.0, 0.145, openEase);
      });

      this.innerStarMesh.rotation.z += safeDt * 0.65;
      this.crystalShellMat.emissiveIntensity = THREE.MathUtils.lerp(1.55, 0.62, p);
      this.coreGlowMat.opacity = THREE.MathUtils.lerp(0.96, 0.52, p);
      this.coreLight.intensity = THREE.MathUtils.lerp(5.5, 2.1, p);

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

    // 7. GUIDANCE：解封後的天體封印優雅退居溫暖晨曦遠景，靜靜襯托古紙籤卷而不碰觸上方標題
    if (this.phase === CELESTIAL_PHASES.GUIDANCE) {
      this.mechanismRoot.position.y = THREE.MathUtils.lerp(this.mechanismRoot.position.y, 0.56, safeDt * 2.6);
      this.mechanismRoot.position.z = THREE.MathUtils.lerp(this.mechanismRoot.position.z, -2.15, safeDt * 2.6);
      const s = THREE.MathUtils.lerp(this.mechanismRoot.scale.x, 0.50, safeDt * 2.6);
      this.mechanismRoot.scale.setScalar(s);

      this.primaryOrbitGimbal.rotation.y += safeDt * 0.04 * motionMul;
      this.innerStarMesh.rotation.z += safeDt * 0.25 * motionMul;
      this.outerFaceMat.emissiveIntensity = THREE.MathUtils.lerp(this.outerFaceMat.emissiveIntensity, 0.28, safeDt * 2.5);
      this.crystalShellMat.emissiveIntensity = THREE.MathUtils.lerp(this.crystalShellMat.emissiveIntensity, 0.38, safeDt * 2.5);
      this.coreGlowMat.opacity = THREE.MathUtils.lerp(this.coreGlowMat.opacity, 0.38, safeDt * 2.5);
      this.coreLight.intensity = THREE.MathUtils.lerp(this.coreLight.intensity, 1.5, safeDt * 2.5);
    }
  }
}
