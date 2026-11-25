/**
 * moon-blocks-3d.js
 * 3D 擲筊剛體物理與 7 狀態電影級儀式引擎
 * 狀態機：IDLE → PREPARING → THROWING → COLLISION → SETTLING → REVEAL → RESULT
 *
 * 核心幾何與物理保證：
 * 1. 局部座標：+Y 為硃砂漆凸面（陰面 / 0），-Y 為溫潤原木平面（陽面 / 1），彎月弧腹朝 +Z、雙尖角朝 -Z
 * 2. 合筊（PREPARING）：採用統一雙筊剛體座標系（pairPos / pairQuat），左瓣繞 +Z 轉 +90°、右瓣繞 +Z 轉 -90°，
 *    確保兩瓣「原木平面對平面精準貼合、硃砂凸面朝外、彎月弧度 100% 同向吻合」，並執行虔誠拜筊與下沉蓄勢
 * 3. 絕不修改外部傳入的隨機結果 [b1, b2]，全程平滑四元數積分，支援 sessionId 即時中斷與乾淨重置
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const BLOCK_PHASES = Object.freeze({
  IDLE: 'IDLE',
  PREPARING: 'PREPARING',
  THROWING: 'THROWING',
  COLLISION: 'COLLISION',
  SETTLING: 'SETTLING',
  REVEAL: 'REVEAL',
  RESULT: 'RESULT'
});

/**
 * 程式化生成硃砂漆木紋理（凸面 / 陰面）
 */
function createLacquerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#78221a');
  grad.addColorStop(0.38, '#9e3329');
  grad.addColorStop(0.72, '#731e17');
  grad.addColorStop(1, '#4c110d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 細膩大漆木胎年輪暗紋
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(30, 5, 3, 0.18)' : 'rgba(225, 138, 110, 0.08)';
    ctx.lineWidth = Math.random() * 2.0 + 0.45;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      170, y + (Math.random() - 0.5) * 20,
      340, y + (Math.random() - 0.5) * 20,
      512, y + (Math.random() - 0.5) * 10
    );
    ctx.stroke();
  }

  // 邊緣手作包漿微暗角
  const rad = ctx.createRadialGradient(256, 256, 90, 256, 256, 340);
  rad.addColorStop(0, 'rgba(255, 195, 160, 0.06)');
  rad.addColorStop(1, 'rgba(20, 3, 2, 0.34)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 程式化生成溫潤竹頭／原木剖面紋理（平面 / 陽面）
 */
function createRawWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, '#c6ad87');
  grad.addColorStop(0.5, '#e5d2af');
  grad.addColorStop(1, '#be9f75');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 竹根／老木縱向纖維細絲
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(120, 78, 40, 0.19)' : 'rgba(255, 246, 228, 0.15)';
    ctx.lineWidth = Math.random() * 1.7 + 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      180, y + (Math.random() - 0.5) * 12,
      340, y + (Math.random() - 0.5) * 12,
      512, y + (Math.random() - 0.5) * 6
    );
    ctx.stroke();
  }

  // 邊緣硃砂漆滲染收邊
  ctx.strokeStyle = 'rgba(138, 40, 32, 0.62)';
  ctx.lineWidth = 22;
  ctx.strokeRect(0, 0, 512, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 程式化生成黑曜青石鑲嵌古銅星晷祭壇紋理（呼應渾天星儀之精工美學）
 */
function createAltarInlayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const cx = 512;
  const cy = 512;

  // 溫潤白玉青石基底（晨曦模式下呈現明亮溫雅白石，星夜聚光下藉由材質色乘算轉為深邃玄石）
  const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, 512);
  bg.addColorStop(0, '#ebe5d9');
  bg.addColorStop(0.58, '#ddd6c8');
  bg.addColorStop(1, '#c8c0b2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  // 極細微石材肌理
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const r = Math.random() * 2.2 + 0.4;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 245, 225, 0.018)' : 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);

  // 同心古銅鑲嵌細環
  const radii = [152, 265, 345, 392, 412];
  radii.forEach((r, idx) => {
    ctx.strokeStyle = idx === 1 || idx === 3
      ? 'rgba(156, 118, 60, 0.52)'
      : 'rgba(156, 118, 60, 0.28)';
    ctx.lineWidth = idx === 3 ? 2.4 : 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // 二十四節氣／周天刻度細線
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const isOctant = i % 9 === 0;
    const isMajor = i % 3 === 0;
    const rIn = isOctant ? 330 : isMajor ? 348 : 362;
    const rOut = 388;
    ctx.strokeStyle = isOctant
      ? 'rgba(148, 108, 48, 0.65)'
      : isMajor
      ? 'rgba(156, 118, 60, 0.38)'
      : 'rgba(156, 118, 60, 0.20)';
    ctx.lineWidth = isOctant ? 2.2 : 1.0;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
    ctx.stroke();
  }

  // 八方爻線幾何暗紋（極簡東方禪意，避免廟宇俗豔）
  const trigrams = [
    [1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1],
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]
  ];
  for (let k = 0; k < 8; k++) {
    ctx.save();
    ctx.rotate((k / 8) * Math.PI * 2);
    const bars = trigrams[k];
    ctx.strokeStyle = 'rgba(152, 112, 54, 0.44)';
    ctx.lineWidth = 2.2;
    for (let b = 0; b < 3; b++) {
      const y = -286 - b * 11;
      if (bars[b] === 1) {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(20, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(-4, y);
        ctx.moveTo(4, y);
        ctx.lineTo(20, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 中央太極雙魚虛線暗軌（極淡雅）
  ctx.strokeStyle = 'rgba(200, 164, 107, 0.16)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 程式化建構真實新月形 3D 筊杯 Mesh Group
 * 局部座標：
 *   +Y 凸面（硃砂紅漆 / 陰面 / 0），最高點約 y = +0.28
 *   -Y 平面（溫潤原木 / 陽面 / 1），平面約 y = -0.152
 *   +Z 彎月外弧腹，-Z 彎月雙尖角，X ∈ [-1.08, +1.08] 左右完全對稱
 */
function createMoonBlockMesh(lacquerMat, flatWoodMat) {
  const group = new THREE.Group();

  const uSegs = 44;
  const vSegs = 24;
  const lengthHalf = 1.08;
  const maxWidthHalf = 0.44;
  const maxHeight = 0.42;
  const crescentBend = 0.34;

  const evalPoint = (u, v, isTop) => {
    const uClamped = Math.max(-0.999, Math.min(0.999, u));
    const taper = Math.pow(Math.max(0, 1 - uClamped * uClamped), 0.56);
    const x = u * lengthHalf;
    const zArc = crescentBend * (1 - uClamped * uClamped) - crescentBend * 0.45;
    const z = zArc + v * maxWidthHalf * taper;

    let y = 0;
    if (isTop) {
      const domeProfile = Math.cos(v * Math.PI * 0.5);
      y = maxHeight * taper * Math.pow(Math.max(0, domeProfile), 0.78);
    } else {
      y = -0.012 * taper * Math.cos(v * Math.PI * 0.5);
    }
    return [x, y, z];
  };

  const buildSurface = (isTop) => {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let iu = 0; iu <= uSegs; iu++) {
      const uNorm = iu / uSegs;
      const u = uNorm * 2 - 1;
      for (let iv = 0; iv <= vSegs; iv++) {
        const vNorm = iv / vSegs;
        const v = vNorm * 2 - 1;
        const [x, y, z] = evalPoint(u, v, isTop);
        positions.push(x, y, z);
        uvs.push(uNorm, vNorm);
      }
    }

    const row = vSegs + 1;
    for (let iu = 0; iu < uSegs; iu++) {
      for (let iv = 0; iv < vSegs; iv++) {
        const a = iu * row + iv;
        const b = (iu + 1) * row + iv;
        const c = (iu + 1) * row + (iv + 1);
        const d = iu * row + (iv + 1);
        if (isTop) {
          indices.push(a, d, b, b, d, c);
        } else {
          indices.push(a, b, d, b, c, d);
        }
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  };

  const topMesh = new THREE.Mesh(buildSurface(true), lacquerMat);
  topMesh.castShadow = true;
  topMesh.receiveShadow = true;

  const bottomMesh = new THREE.Mesh(buildSurface(false), flatWoodMat);
  bottomMesh.castShadow = true;
  bottomMesh.receiveShadow = true;

  topMesh.position.y = -0.14;
  bottomMesh.position.y = -0.14;

  group.add(topMesh);
  group.add(bottomMesh);

  return group;
}

export class MoonBlocksScene {
  constructor() {
    this.group = new THREE.Group();
    this.blocks = [];
    this.ripples = [];
    this.motes = [];

    this.phase = BLOCK_PHASES.IDLE;
    this.sessionId = 0;
    this.elapsed = 0;
    this.phaseTime = 0;
    this.simTime = 0;
    this.reducedMotion = false;

    this.targetResults = [0, 0];
    this.onPhaseChange = null;
    this.onCompleteCallback = null;
    this.onImpactCallback = null;
    this.claspSoundPlayed = false;

    this._targetAuraOpacity = 0;
    this._targetLightIntensity = 0;

    // 預建合筊局部轉換：
    // 左瓣 (idx=0) 置於 pairFrame 的 x = -0.156，繞 +Z 旋轉 +90° -> 原木平面 (-Y_local) 轉為 +X_pair 朝內貼合，紅漆凸面朝外 (-X_pair)
    // 右瓣 (idx=1) 置於 pairFrame 的 x = +0.156，繞 +Z 旋轉 -90° -> 原木平面 (-Y_local) 轉為 -X_pair 朝內貼合，紅漆凸面朝外 (+X_pair)
    // 兩瓣彎月弧腹皆朝 +Z_pair、尖角皆朝 -Z_pair，100% 完整合璧如一顆剖開再合攏的竹頭新月！
    this._claspLocalOffsets = [
      new THREE.Vector3(-0.156, 0, 0),
      new THREE.Vector3(0.156, 0, 0)
    ];
    this._claspLocalQuats = [
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI * 0.5)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -Math.PI * 0.5))
    ];

    this._initAltar();
    this._initBlocks();
    this._initResultAura();
  }

  _initAltar() {
    const inlayTex = createAltarInlayTexture();

    // 雙場景自適應青玉／黑曜鑲金星盤祭壇主體
    const altarGeom = new THREE.CylinderGeometry(4.35, 4.65, 0.28, 72);
    this.altarSideMat = new THREE.MeshStandardMaterial({
      color: 0xd8d2c6,
      roughness: 0.48,
      metalness: 0.25
    });
    this.altarTopMat = new THREE.MeshStandardMaterial({
      map: inlayTex,
      color: 0xf4eee2,
      roughness: 0.36,
      metalness: 0.24
    });
    const altar = new THREE.Mesh(altarGeom, [this.altarSideMat, this.altarTopMat, this.altarSideMat]);
    altar.position.y = -0.14;
    altar.receiveShadow = true;
    this.group.add(altar);

    // 外圈立體雕琢古銅鎮壇環與八方銅釘（與宇宙指引的古銅渾天儀語彙一脈相承）
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0xc8a46b,
      metalness: 0.86,
      roughness: 0.28
    });
    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(3.62, 0.036, 18, 96),
      bronzeMat
    );
    rimTorus.rotation.x = Math.PI * 0.5;
    rimTorus.position.y = 0.008;
    rimTorus.receiveShadow = true;
    this.group.add(rimTorus);

    const studGeom = new THREE.SphereGeometry(0.052, 12, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const stud = new THREE.Mesh(studGeom, bronzeMat);
      stud.position.set(Math.cos(a) * 3.62, 0.025, Math.sin(a) * 3.62);
      this.group.add(stud);
    }

    // 內圈感應金環（揭曉時微微泛起靈光）
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xdcb878,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide
    });
    this.altarInnerRing = new THREE.Mesh(new THREE.RingGeometry(1.96, 1.99, 96), innerRingMat);
    this.altarInnerRing.rotation.x = -Math.PI * 0.5;
    this.altarInnerRing.position.y = 0.005;
    this.group.add(this.altarInnerRing);
  }

  _getIdlePose(idx) {
    // IDLE 初始呈現「一陰一陽」相映懸浮：左瓣展現朱紅大漆凸面，右瓣展現溫潤原木平面
    if (idx === 0) {
      return {
        pos: new THREE.Vector3(-0.84, 0.42, 0.12),
        euler: new THREE.Euler(0.14, 0.46, 0.1)
      };
    }
    return {
      pos: new THREE.Vector3(0.84, 0.46, -0.08),
      euler: new THREE.Euler(Math.PI - 0.16, -0.42, -0.08)
    };
  }

  _initBlocks() {
    const lacquerTex = createLacquerTexture();
    const woodTex = createRawWoodTexture();

    const lacquerMat = new THREE.MeshPhysicalMaterial({
      map: lacquerTex,
      roughness: 0.24,
      metalness: 0.06,
      clearcoat: 0.78,
      clearcoatRoughness: 0.18
    });

    const flatWoodMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.54,
      metalness: 0.04
    });

    for (let i = 0; i < 2; i++) {
      const mesh = createMoonBlockMesh(lacquerMat, flatWoodMat);
      const idlePose = this._getIdlePose(i);
      mesh.position.copy(idlePose.pos);
      mesh.rotation.copy(idlePose.euler);
      this.group.add(mesh);

      this.blocks.push({
        mesh,
        pos: idlePose.pos.clone(),
        startPos: idlePose.pos.clone(),
        startQuat: mesh.quaternion.clone(),
        vel: new THREE.Vector3(),
        angVel: new THREE.Vector3(),
        bounces: 0,
        settled: false,
        targetFace: 0,
        targetYaw: 0,
        targetTilt: 0,
        targetQuat: new THREE.Quaternion(),
        restY: 0.15,
        rockPhase: i * 1.7,
        idleBaseQuat: mesh.quaternion.clone(),
        idleOffset: i * Math.PI * 0.85
      });
    }
  }

  _initResultAura() {
    // 柔和無硬邊徑向漸層光韻（消除幾何圓環內孔硬邊）
    const auraCanvas = document.createElement('canvas');
    auraCanvas.width = 256;
    auraCanvas.height = 256;
    const actx = auraCanvas.getContext('2d');
    const agrad = actx.createRadialGradient(128, 128, 0, 128, 128, 128);
    agrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    agrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.42)');
    agrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    actx.fillStyle = agrad;
    actx.fillRect(0, 0, 256, 256);
    const auraTex = new THREE.CanvasTexture(auraCanvas);

    const auraGeom = new THREE.PlaneGeometry(5.2, 5.2);
    const auraMat = new THREE.MeshBasicMaterial({
      map: auraTex,
      color: 0xc8a46b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.resultAura = new THREE.Mesh(auraGeom, auraMat);
    this.resultAura.rotation.x = -Math.PI * 0.5;
    this.resultAura.position.y = 0.012;
    this.group.add(this.resultAura);

    this.resultLight = new THREE.PointLight(0xe6cca0, 0, 12, 2);
    this.resultLight.position.set(0, 3.0, 0.5);
    this.group.add(this.resultLight);

    // 創建模擬星芒微塵共用幾何，避免每次碰撞重複建立高開銷資源
    this._sharedMoteGeom = new THREE.SphereGeometry(0.018, 6, 6);
  }

  _setPhase(nextPhase) {
    if (this.phase === nextPhase) return;
    this.phase = nextPhase;
    this.phaseTime = 0;
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(nextPhase);
    }
  }

  _spawnRipple(x, z, intensity = 0.7, colorHex = 0xc8a46b) {
    // 雙層水墨金波：主波紋＋細膩內漣漪
    const count = intensity > 0.45 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const geom = new THREE.RingGeometry(0.10 + k * 0.06, 0.16 + k * 0.07, 56);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: Math.min(0.46, intensity * (k === 0 ? 0.48 : 0.28)),
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(geom, mat);
      ring.rotation.x = -Math.PI * 0.5;
      ring.position.set(x, 0.011 + k * 0.002, z);
      this.group.add(ring);

      this.ripples.push({
        mesh: ring,
        age: 0,
        maxAge: k === 0 ? 0.92 : 1.18,
        spread: k === 0 ? 6.2 : 4.2
      });
    }
  }

  _spawnImpactMotes(x, y, z, intensity = 0.7) {
    if (this.reducedMotion) return;
    const count = Math.min(7, Math.max(3, Math.round(intensity * 6)));
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xe6cca0 : 0xc8a46b,
        transparent: true,
        opacity: 0.55 * intensity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mote = new THREE.Mesh(this._sharedMoteGeom, mat);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = (0.45 + Math.random() * 0.85) * intensity;
      mote.position.set(x + Math.cos(angle) * 0.12, Math.max(0.04, y), z + Math.sin(angle) * 0.12);
      this.group.add(mote);

      this.motes.push({
        mesh: mote,
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.65 + Math.random() * 0.95 * intensity,
          Math.sin(angle) * speed
        ),
        age: 0,
        maxAge: 0.65 + Math.random() * 0.35
      });
    }
  }

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  /**
   * 同步 Luminous Mysticism 明暗雙場景色溫 (0 = 玄夜聚光, 1 = 晨曦暖白)
   */
  setLuminescence(lum) {
    if (!this.altarTopMat || !this.altarSideMat) return;
    const darkTop = new THREE.Color(0x161924);
    const lightTop = new THREE.Color(0xf8f3e8);
    this.altarTopMat.color.copy(darkTop).lerp(lightTop, lum);

    const darkSide = new THREE.Color(0x0d1018);
    const lightSide = new THREE.Color(0xdfd8cb);
    this.altarSideMat.color.copy(darkSide).lerp(lightSide, lum);
  }

  setImpactHandler(fn) {
    this.onImpactCallback = fn;
  }

  getFocusPosition() {
    if (this.blocks.length < 2) return new THREE.Vector3(0, 0.35, 0);
    return new THREE.Vector3(
      (this.blocks[0].pos.x + this.blocks[1].pos.x) * 0.5,
      (this.blocks[0].pos.y + this.blocks[1].pos.y) * 0.5,
      (this.blocks[0].pos.z + this.blocks[1].pos.z) * 0.5
    );
  }

  isBusy() {
    return (
      this.phase !== BLOCK_PHASES.IDLE &&
      this.phase !== BLOCK_PHASES.RESULT
    );
  }

  /**
   * 乾淨重置或中斷目前進行中的動畫，復原至 IDLE
   */
  reset() {
    this.sessionId++;
    this.onCompleteCallback = null;
    this.onPhaseChange = null;
    this.phase = BLOCK_PHASES.IDLE;
    this.phaseTime = 0;
    this.simTime = 0;
    this._targetAuraOpacity = 0;
    this._targetLightIntensity = 0;
    this.resultAura.material.opacity = 0;
    this.resultLight.intensity = 0;
    if (this.altarInnerRing) {
      this.altarInnerRing.material.opacity = 0.16;
      this.altarInnerRing.material.color.setHex(0xdcb878);
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      this.group.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.ripples = [];

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      this.group.remove(m.mesh);
      m.mesh.material.dispose();
    }
    this.motes = [];

    this.blocks.forEach((b, idx) => {
      const idlePose = this._getIdlePose(idx);
      b.pos.copy(idlePose.pos);
      b.vel.set(0, 0, 0);
      b.angVel.set(0, 0, 0);
      b.bounces = 0;
      b.settled = false;
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.copy(idlePose.euler);
      b.idleBaseQuat.copy(b.mesh.quaternion);
    });
  }

  /**
   * 啟動 7 狀態物理擲筊儀式
   * @param {number} b1 0(陰凸面) | 1(陽平面)
   * @param {number} b2 0(陰凸面) | 1(陽平面)
   */
  throwBlocks(b1, b2, onComplete, onPhaseChange) {
    if (this.isBusy()) return;

    this.sessionId++;
    this.targetResults = [b1, b2];
    this.onCompleteCallback = onComplete;
    this.onPhaseChange = onPhaseChange;
    this.simTime = 0;

    this._targetAuraOpacity = 0;
    this._targetLightIntensity = 0;

    this.blocks.forEach((b, idx) => {
      b.startPos.copy(b.pos);
      b.startQuat.copy(b.mesh.quaternion);
      b.targetFace = idx === 0 ? b1 : b2;
      b.targetYaw = (idx === 0 ? -0.48 : 0.52) + (Math.random() - 0.5) * 1.15;
      b.targetTilt = b.targetFace === 1 ? (Math.random() > 0.5 ? 0.13 : -0.13) : 0;
      b.restY = b.targetFace === 1 ? 0.28 : 0.15;
      b.targetQuat.setFromEuler(
        new THREE.Euler(b.targetFace === 1 ? Math.PI : 0, b.targetYaw, b.targetTilt, 'YXZ')
      );
      b.bounces = 0;
      b.settled = false;
    });
    this.claspSoundPlayed = false;

    this._setPhase(BLOCK_PHASES.PREPARING);
  }

  /**
   * 計算合筊階段雙筊整體剛體座標（確保兩瓣平面嚴絲合縫對貼、彎月完全同向、零穿模）
   */
  _computeClaspPairTransform(p) {
    // 1. 虔誠拜筊禮（0.40 ~ 0.76 輕緩前傾一拜再回正靜默）
    let bowPitch = 0;
    let bowY = 0;
    if (p >= 0.40 && p < 0.76) {
      const bp = (p - 0.40) / 0.36;
      const wave = Math.sin(bp * Math.PI);
      bowPitch = 0.26 * wave;
      bowY = -0.08 * wave;
    }

    // 2. 拋擲前下沉蓄勢（Anticipation: 0.76 ~ 1.00）
    let dipY = 0;
    let launchPitch = 0;
    if (p >= 0.76) {
      const dp = (p - 0.76) / 0.24;
      const ease = dp * dp * (3 - 2 * dp);
      dipY = -0.24 * Math.sin(ease * Math.PI * 0.86);
      launchPitch = -0.22 * ease;
    }

    const pairPos = new THREE.Vector3(0, 0.94 + bowY + dipY, 0.18);
    // 微側 24° (yaw = 0.42) 搭配仰捧傾角 (pitch = -0.46)，讓鏡頭同時看清：
    // (a) 完整彎月弧形輪廓、(b) 中央緊密貼合的原木平面中縫、(c) 兩側朝外的朱紅大漆凸面！
    const pairQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-0.46 + bowPitch + launchPitch, 0.42, 0.06, 'YXZ')
    );

    return { pairPos, pairQuat };
  }

  _enterThrowing() {
    this._setPhase(BLOCK_PHASES.THROWING);
    this.simTime = 0;

    this.blocks.forEach((b, idx) => {
      const dir = idx === 0 ? -1 : 1;
      // 自合掌蓄力點向上拋出，兩瓣帶著真實慣性向外微微旋開翻滾
      b.vel.set(
        dir * (0.54 + Math.random() * 0.28) + (Math.random() - 0.5) * 0.14,
        6.25 + Math.random() * 0.65,
        (Math.random() - 0.5) * 0.62 - 0.2
      );
      b.angVel.set(
        (idx === 0 ? 1 : -1) * (8.8 + Math.random() * 4.2),
        (Math.random() - 0.5) * 6.2,
        dir * (5.6 + Math.random() * 3.5)
      );
    });

    this._spawnImpactMotes(0, 0.82, 0.16, 0.55);
    ritualSound.playSilkSweep();
  }

  _enterReveal() {
    this._setPhase(BLOCK_PHASES.REVEAL);
    const sum = this.targetResults[0] + this.targetResults[1];

    const midX = (this.blocks[0].pos.x + this.blocks[1].pos.x) * 0.5;
    const midZ = (this.blocks[0].pos.z + this.blocks[1].pos.z) * 0.5;
    this.resultAura.position.set(midX * 0.65, 0.012, midZ * 0.65);

    if (sum === 1) {
      // 聖筊：溫潤帝王鎏金光韻
      this.resultAura.material.color.setHex(0xdcb878);
      this.resultLight.color.setHex(0xf4d8a4);
      this.altarInnerRing.material.color.setHex(0xe6cca0);
      this._targetAuraOpacity = 0.32;
      this._targetLightIntensity = 3.5;
      this._spawnRipple(midX * 0.65, midZ * 0.65, 0.85, 0xe6cca0);
      ritualSound.playChime('sacred');
    } else if (sum === 2) {
      // 笑筊：清朗月白銀霧
      this.resultAura.material.color.setHex(0xb8c4d4);
      this.resultLight.color.setHex(0xd6e0ec);
      this.altarInnerRing.material.color.setHex(0xc4d0e0);
      this._targetAuraOpacity = 0.20;
      this._targetLightIntensity = 2.1;
      this._spawnRipple(midX * 0.65, midZ * 0.65, 0.65, 0xc4d0e0);
      ritualSound.playChime('laugh');
    } else {
      // 陰筊：沉靜硃砂暗韻
      this.resultAura.material.color.setHex(0x963d33);
      this.resultLight.color.setHex(0xb24d40);
      this.altarInnerRing.material.color.setHex(0xb24d40);
      this._targetAuraOpacity = 0.24;
      this._targetLightIntensity = 1.8;
      this._spawnRipple(midX * 0.65, midZ * 0.65, 0.65, 0xa8463a);
      ritualSound.playChime('yin');
    }
  }

  _enterResult() {
    this._setPhase(BLOCK_PHASES.RESULT);
    if (typeof this.onCompleteCallback === 'function') {
      const cb = this.onCompleteCallback;
      this.onCompleteCallback = null;
      cb();
    }
  }

  getCameraTarget() {
    const midX = this.blocks.length === 2 ? (this.blocks[0].pos.x + this.blocks[1].pos.x) * 0.5 : 0;
    const midZ = this.blocks.length === 2 ? (this.blocks[0].pos.z + this.blocks[1].pos.z) * 0.5 : 0;

    switch (this.phase) {
      case BLOCK_PHASES.PREPARING:
        // 推近特寫雙手合筊與拜禮，清楚呈現兩瓣平面貼合與紅漆光澤
        return { pos: [0.12, 2.55, 3.85], lookAt: [0, 0.86, 0.14] };
      case BLOCK_PHASES.THROWING:
        // 隨上拋弧線拉開仰視景深，展現拋擲張力
        return { pos: [midX * 0.35, 4.35, 5.35], lookAt: [midX * 0.45, 1.15, midZ * 0.35] };
      case BLOCK_PHASES.COLLISION:
      case BLOCK_PHASES.SETTLING:
        // 聚焦石壇落點與彈跳木紋反光
        return { pos: [midX * 0.65, 4.15, 4.35 + midZ * 0.4], lookAt: [midX * 0.82, 0.22, midZ * 0.8] };
      case BLOCK_PHASES.REVEAL:
      case BLOCK_PHASES.RESULT:
        // 優雅俯視英雄鏡位，將落定的雙筊置於結果面板上方視覺黃金點，桌面與手機皆留白從容
        return { pos: [midX * 0.78, 4.75, 3.85 + midZ * 0.72], lookAt: [midX * 0.82, -0.06, midZ * 0.8 + 0.25] };
      default:
        // IDLE 近景英雄視角：展現古銅星盤石壇與一陰一陽雙筊材質細節
        return { pos: [0, 3.05, 4.45], lookAt: [0, 0.34, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    this.phaseTime += safeDt;

    if (this.phase !== BLOCK_PHASES.REVEAL && this.phase !== BLOCK_PHASES.RESULT) {
      this.resultAura.material.opacity = THREE.MathUtils.lerp(this.resultAura.material.opacity, 0, safeDt * 6);
      this.resultLight.intensity = THREE.MathUtils.lerp(this.resultLight.intensity, 0, safeDt * 6);
      if (this.altarInnerRing) {
        this.altarInnerRing.material.opacity = THREE.MathUtils.lerp(this.altarInnerRing.material.opacity, 0.16, safeDt * 4);
      }
    }

    // 更新水墨金波漣漪
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age += safeDt;
      const p = r.age / r.maxAge;
      if (p >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.ripples.splice(i, 1);
      } else {
        const ease = 1 - Math.pow(1 - p, 3);
        const s = 1 + ease * r.spread;
        r.mesh.scale.set(s, s, 1);
        r.mesh.material.opacity = (1 - p) * (1 - p) * 0.42;
      }
    }

    // 更新撞擊星塵微粒
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.age += safeDt;
      const p = m.age / m.maxAge;
      if (p >= 1) {
        this.group.remove(m.mesh);
        m.mesh.material.dispose();
        this.motes.splice(i, 1);
      } else {
        m.vel.y -= 1.8 * safeDt;
        m.vel.multiplyScalar(Math.pow(0.28, safeDt));
        m.mesh.position.addScaledVector(m.vel, safeDt);
        m.mesh.material.opacity = (1 - p) * 0.5;
      }
    }

    // 1. IDLE：靜謐懸浮呼吸（避免機械式等速自轉，改以非對稱微幅氣韻擺動）
    if (this.phase === BLOCK_PHASES.IDLE) {
      const motionScale = this.reducedMotion ? 0.25 : 1.0;
      this.blocks.forEach((b, idx) => {
        const idlePose = this._getIdlePose(idx);
        const floatY = idlePose.pos.y + Math.sin(this.elapsed * 1.25 + b.idleOffset) * 0.055 * motionScale;
        b.pos.x = THREE.MathUtils.lerp(b.pos.x, idlePose.pos.x, safeDt * 4);
        b.pos.y = THREE.MathUtils.lerp(b.pos.y, floatY, safeDt * 4);
        b.pos.z = THREE.MathUtils.lerp(b.pos.z, idlePose.pos.z, safeDt * 4);
        b.mesh.position.copy(b.pos);

        const swayEuler = new THREE.Euler(
          idlePose.euler.x + Math.sin(this.elapsed * 0.85 + b.idleOffset) * 0.045 * motionScale,
          idlePose.euler.y + Math.cos(this.elapsed * 0.65 + idx * 1.9) * 0.06 * motionScale,
          idlePose.euler.z + Math.sin(this.elapsed * 0.95 + idx) * 0.035 * motionScale
        );
        const swayQuat = new THREE.Quaternion().setFromEuler(swayEuler);
        b.mesh.quaternion.slerp(swayQuat, Math.min(1, safeDt * 4.5));
      });
      return;
    }

    // 2. PREPARING（1.36s / 簡化 0.42s）：
    //    (a) 0.00 ~ 0.38：雙筊升起，原木平面對平面精準合攏（紅漆凸面朝外、彎月同向）並輕叩一聲
    //    (b) 0.38 ~ 0.76：虔誠一拜（拜筊儀式感）＋凝神屏息（Silence）
    //    (c) 0.76 ~ 1.00：下沉蓄勢（Anticipation），無縫銜接向上拋擲
    if (this.phase === BLOCK_PHASES.PREPARING) {
      const dur = this.reducedMotion ? 0.42 : 1.36;
      const p = Math.min(1, this.phaseTime / dur);

      const claspP = Math.min(1, p / 0.38);
      const claspEase = 1 - Math.pow(1 - claspP, 3);

      const { pairPos, pairQuat } = this._computeClaspPairTransform(p);

      if (p >= 0.36 && !this.claspSoundPlayed) {
        this.claspSoundPlayed = true;
        ritualSound.playWoodKnock(0.32, 42);
        this._spawnRipple(0, 0.14, 0.38, 0xe6cca0);
      }

      this.blocks.forEach((b, idx) => {
        const worldClaspPos = this._claspLocalOffsets[idx]
          .clone()
          .applyQuaternion(pairQuat)
          .add(pairPos);
        const worldClaspQuat = pairQuat.clone().multiply(this._claspLocalQuats[idx]);

        b.pos.lerpVectors(b.startPos, worldClaspPos, claspEase);
        b.mesh.position.copy(b.pos);
        b.mesh.quaternion.copy(b.startQuat).slerp(worldClaspQuat, claspEase);
      });

      if (p >= 1) {
        this._enterThrowing();
      }
      return;
    }

    // 3. THROWING & 4. COLLISION：剛體拋擲、重力加速度、石壇碰撞反彈與雙筊互撞
    if (this.phase === BLOCK_PHASES.THROWING || this.phase === BLOCK_PHASES.COLLISION) {
      this.simTime += safeDt;
      const gravity = -16.4;
      const subSteps = 3;
      const stepDt = safeDt / subSteps;
      let anyBounced = false;

      for (let s = 0; s < subSteps; s++) {
        this.blocks.forEach((b, idx) => {
          b.vel.y += gravity * stepDt;
          b.pos.addScaledVector(b.vel, stepDt);

          // 祭壇邊界圓約束（收束於 1.18 確保手機直屏 390px 雙筊尖端皆完整落在視野內）
          const radialDist = Math.hypot(b.pos.x, b.pos.z);
          if (radialDist > 1.18) {
            const nx = b.pos.x / radialDist;
            const nz = b.pos.z / radialDist;
            b.pos.x = nx * 1.18;
            b.pos.z = nz * 1.18;
            b.vel.x *= -0.46;
            b.vel.z *= -0.46;
          }

          // 四元數角速度積分
          const omegaMag = b.angVel.length();
          if (omegaMag > 0.001) {
            const axis = b.angVel.clone().divideScalar(omegaMag);
            const dq = new THREE.Quaternion().setFromAxisAngle(axis, omegaMag * stepDt);
            b.mesh.quaternion.premultiply(dq).normalize();
          }

          // 石壇碰撞與反彈
          const floorY = b.bounces >= 2 ? b.restY : 0.22;
          if (b.pos.y <= floorY) {
            b.pos.y = floorY;
            const impactSpeed = Math.abs(b.vel.y);
            if (impactSpeed > 0.36) {
              b.bounces++;
              anyBounced = true;
              // 陽面（弧背著地）彈性略活潑，陰面（平面著地）更沉實俐落
              const faceRestitutionBonus = b.targetFace === 1 ? 0.04 : -0.02;
              const restitution = Math.max(0.18, 0.49 + faceRestitutionBonus - b.bounces * 0.085);
              b.vel.y = impactSpeed * restitution;
              b.vel.x *= 0.73;
              b.vel.z *= 0.73;
              b.angVel.multiplyScalar(0.66);
              b.angVel.y += (Math.random() - 0.5) * impactSpeed * 0.52;

              if (s === 0) {
                const intensity = Math.min(1, impactSpeed / 7.2);
                ritualSound.playWoodKnock(intensity, idx * 78);
                this._spawnRipple(b.pos.x, b.pos.z, intensity);
                if (b.bounces <= 2 && intensity > 0.28) {
                  this._spawnImpactMotes(b.pos.x, 0.05, b.pos.z, intensity);
                }
                if (b.bounces === 1 && impactSpeed > 2.3 && typeof this.onImpactCallback === 'function') {
                  this.onImpactCallback(Math.min(0.062, intensity * 0.062));
                }
              }
            } else {
              b.vel.y = 0;
              b.vel.x *= 0.84;
              b.vel.z *= 0.84;
              b.angVel.multiplyScalar(0.8);
            }
          }

          // 觸地反彈後平滑引導收斂至真實目標朝向
          if (b.bounces >= 1) {
            const guideStrength = b.bounces >= 2 ? 7.8 : 2.8;
            b.mesh.quaternion.slerp(b.targetQuat, Math.min(1, stepDt * guideStrength));
            b.angVel.multiplyScalar(Math.pow(0.2, stepDt));
          }

          b.mesh.position.copy(b.pos);
        });

        // 雙筊防重疊剛體互撞
        const b0 = this.blocks[0];
        const b1 = this.blocks[1];
        const diff = new THREE.Vector3().subVectors(b1.pos, b0.pos);
        const dist = diff.length();
        const minSep = 1.32;
        if (dist > 0.001 && dist < minSep) {
          const overlap = (minSep - dist) * 0.5;
          const normal = diff.divideScalar(dist);
          b0.pos.addScaledVector(normal, -overlap);
          b1.pos.addScaledVector(normal, overlap);

          const relVel = new THREE.Vector3().subVectors(b1.vel, b0.vel);
          const sepVel = relVel.dot(normal);
          if (sepVel < 0) {
            const impulse = -sepVel * 0.66;
            b0.vel.addScaledVector(normal, -impulse);
            b1.vel.addScaledVector(normal, impulse);
            if (s === 0 && Math.abs(sepVel) > 0.68) {
              const hit = Math.min(0.82, Math.abs(sepVel) / 5.8);
              ritualSound.playWoodKnock(hit, 145);
              this._spawnImpactMotes(
                (b0.pos.x + b1.pos.x) * 0.5,
                (b0.pos.y + b1.pos.y) * 0.5,
                (b0.pos.z + b1.pos.z) * 0.5,
                hit * 0.7
              );
            }
          }
        }
      }

      if (this.phase === BLOCK_PHASES.THROWING && anyBounced) {
        this._setPhase(BLOCK_PHASES.COLLISION);
      }

      const bothLowEnergy = this.blocks.every(
        (b) => b.bounces >= 2 && b.vel.length() < 0.42 && b.pos.y <= b.restY + 0.08
      );
      if ((this.phase === BLOCK_PHASES.COLLISION && bothLowEnergy && this.phaseTime > 0.62) || this.simTime > 2.2) {
        this._setPhase(BLOCK_PHASES.SETTLING);
      }
      return;
    }

    // 5. SETTLING（0.62s）：陽面圓弧背著地時呈現真實微幅前後搖晃阻尼，陰面平面著地則沉穩落定
    if (this.phase === BLOCK_PHASES.SETTLING) {
      const dur = this.reducedMotion ? 0.25 : 0.62;
      const p = Math.min(1, this.phaseTime / dur);

      this.blocks.forEach((b) => {
        b.vel.multiplyScalar(Math.pow(0.04, safeDt));
        b.pos.x += b.vel.x * safeDt;
        b.pos.z += b.vel.z * safeDt;
        b.pos.y = THREE.MathUtils.lerp(b.pos.y, b.restY, Math.min(1, safeDt * 11));
        b.mesh.position.copy(b.pos);

        if (b.targetFace === 1 && !this.reducedMotion) {
          // 陽面（圓弧凸背接觸石壇）特有的輕微搖擺止定細節
          const decay = Math.exp(-p * 4.2) * (1 - p);
          const rockAngle = Math.sin(this.phaseTime * 21.0 + b.rockPhase) * 0.14 * decay;
          const rockQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(Math.PI + rockAngle, b.targetYaw, b.targetTilt + rockAngle * 0.45, 'YXZ')
          );
          b.mesh.quaternion.slerp(rockQuat, Math.min(1, safeDt * 14));
        } else {
          b.mesh.quaternion.slerp(b.targetQuat, Math.min(1, safeDt * 12));
        }
      });

      if (p >= 1) {
        this.blocks.forEach((b) => b.mesh.quaternion.copy(b.targetQuat));
        this._enterReveal();
      }
      return;
    }

    // 6. REVEAL（0.65s）：光韻與星盤石壇金環點亮，鏡頭推入英雄俯角
    if (this.phase === BLOCK_PHASES.REVEAL) {
      const dur = this.reducedMotion ? 0.25 : 0.65;
      const p = Math.min(1, this.phaseTime / dur);

      this.resultAura.material.opacity = THREE.MathUtils.lerp(
        this.resultAura.material.opacity,
        this._targetAuraOpacity,
        safeDt * 5.5
      );
      this.resultLight.intensity = THREE.MathUtils.lerp(
        this.resultLight.intensity,
        this._targetLightIntensity,
        safeDt * 5.5
      );
      if (this.altarInnerRing) {
        this.altarInnerRing.material.opacity = THREE.MathUtils.lerp(
          this.altarInnerRing.material.opacity,
          0.42,
          safeDt * 5
        );
      }

      if (p >= 1) {
        this._enterResult();
      }
      return;
    }

    // 7. RESULT：柔和呼吸光環停留
    if (this.phase === BLOCK_PHASES.RESULT) {
      const pulse = 0.88 + Math.sin(this.elapsed * 2.0) * 0.12;
      this.resultAura.material.opacity = THREE.MathUtils.lerp(
        this.resultAura.material.opacity,
        this._targetAuraOpacity * pulse,
        safeDt * 3
      );
      this.resultLight.intensity = THREE.MathUtils.lerp(
        this.resultLight.intensity,
        this._targetLightIntensity * pulse,
        safeDt * 3
      );
      if (this.altarInnerRing) {
        this.altarInnerRing.material.opacity = THREE.MathUtils.lerp(
          this.altarInnerRing.material.opacity,
          0.34 * pulse,
          safeDt * 3
        );
      }
    }
  }
}
