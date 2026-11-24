/**
 * triad-sanctum-3d.js
 * 「三元牌（Triad Cards）」專屬電影級 3D 東方玄金三元星陣舞台
 * 支援 7 狀態同步：IDLE → SHUFFLING → SELECTING → LIFTING → FLIPPING → REVEAL → RESULT
 *
 * 視覺美學：
 * - 外層古銅星晷雙環（各自獨立慣性軸與緩急轉速，與「宇宙指引」同級精工質感）
 * - 中央正逆交織「三元玄金幾何陣（Sacred Triad）」與三枚頂點星印（對應順位 I、II、III）
 * - 點選第 1、2、3 張牌時即時點亮對應 3D 頂點星印並釋放水墨星波；翻牌瞬間於對應牌位後方綻放立體共鳴光環
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

function createMeridianTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#2a2d36');
  grad.addColorStop(0.5, '#9d8762');
  grad.addColorStop(1, '#20222a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 128);

  for (let i = 0; i < 96; i++) {
    const x = (i / 96) * 1024;
    const isTriad = i % 32 === 0;
    const isMajor = i % 8 === 0;
    ctx.strokeStyle = isTriad
      ? 'rgba(238, 218, 180, 0.85)'
      : isMajor
      ? 'rgba(205, 178, 132, 0.48)'
      : 'rgba(180, 190, 210, 0.22)';
    ctx.lineWidth = isTriad ? 2.8 : isMajor ? 1.6 : 0.9;
    ctx.beginPath();
    ctx.moveTo(x, isTriad ? 14 : 32);
    ctx.lineTo(x, isTriad ? 114 : 96);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 以三根細緻金屬圓桿建構正三角形立體框架
 */
function createEquilateralFrame(radius, tubeRadius, material) {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI * 0.5 + (i * Math.PI * 2) / 3;
    pts.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
  }

  for (let i = 0; i < 3; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % 3];
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(tubeRadius, tubeRadius, len, 14),
      material
    );
    cyl.position.copy(mid);
    cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    group.add(cyl);
  }

  return { group, vertices: pts };
}

export class TriadSanctumScene {
  constructor() {
    this.group = new THREE.Group();
    this.sanctumGroup = new THREE.Group();
    this.waves = [];
    this.vertexNodes = [];

    this.cardPhase = 'IDLE';
    this.stageName = 'main-select';
    this.selectedCount = 0;
    this.elapsed = 0;
    this.reducedMotion = false;
    this.onImpactCallback = null;

    // 置於卡牌景深後方，建立前景卡牌—中景薄霧—遠景三元星陣的電影空間層次
    this.sanctumGroup.position.set(0, 0.52, -1.35);
    this.group.add(this.sanctumGroup);

    this._initRingsAndTriad();
    this._initCenterPrism();
    this._initAmbientStars();
    this._initLights();
  }

  _initRingsAndTriad() {
    const meridianTex = createMeridianTexture();

    const antiqueGoldMat = new THREE.MeshStandardMaterial({
      map: meridianTex,
      color: 0xc8a46b,
      metalness: 0.88,
      roughness: 0.26
    });

    const moonSilverMat = new THREE.MeshStandardMaterial({
      color: 0x7e8da4,
      metalness: 0.82,
      roughness: 0.32
    });

    const triadRodMat = new THREE.MeshStandardMaterial({
      color: 0xdcc08e,
      metalness: 0.9,
      roughness: 0.22,
      emissive: new THREE.Color(0xc8a46b),
      emissiveIntensity: 0.05
    });
    this.triadRodMat = triadRodMat;

    // 1. 外層玄金子午環
    this.outerHalo = new THREE.Group();
    const outerTorus = new THREE.Mesh(
      new THREE.TorusGeometry(2.22, 0.036, 22, 108),
      antiqueGoldMat
    );
    this.outerHalo.add(outerTorus);

    const rivetGeom = new THREE.SphereGeometry(0.048, 12, 12);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rivet = new THREE.Mesh(rivetGeom, triadRodMat);
      rivet.position.set(Math.cos(a) * 2.22, Math.sin(a) * 2.22, 0);
      this.outerHalo.add(rivet);
    }
    this.outerHalo.rotation.set(0.32, -0.22, 0.14);
    this.sanctumGroup.add(this.outerHalo);

    // 2. 中層冷月銀鐵逆轉環
    this.midHalo = new THREE.Group();
    const midTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.74, 0.024, 18, 96),
      moonSilverMat
    );
    this.midHalo.add(midTorus);
    this.midHalo.rotation.set(-0.44, 0.28, -0.18);
    this.sanctumGroup.add(this.midHalo);

    // 3. 主三元正三角陣 + 三枚序位共鳴星印 (對應 I, II, III)
    const primaryTriad = createEquilateralFrame(1.66, 0.018, triadRodMat);
    this.primaryTriadGroup = primaryTriad.group;
    this.sanctumGroup.add(this.primaryTriadGroup);

    const crystalGeom = new THREE.OctahedronGeometry(0.11, 0);
    const haloGeom = new THREE.RingGeometry(0.16, 0.185, 36);

    primaryTriad.vertices.forEach((vPos, idx) => {
      const holder = new THREE.Group();
      holder.position.copy(vPos);

      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: 0x1b1e28,
        metalness: 0.45,
        roughness: 0.18,
        clearcoat: 0.85,
        emissive: new THREE.Color(0xe6cca0),
        emissiveIntensity: 0.08
      });
      const crystal = new THREE.Mesh(crystalGeom, crystalMat);
      holder.add(crystal);

      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xe6cca0,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      holder.add(halo);

      this.primaryTriadGroup.add(holder);
      this.vertexNodes.push({ holder, crystal, crystalMat, halo, haloMat, idx });
    });

    // 4. 內層逆向副三角陣（象徵顯意識與潛意識對照）
    const innerTriad = createEquilateralFrame(1.12, 0.012, moonSilverMat);
    this.innerTriadGroup = innerTriad.group;
    this.innerTriadGroup.rotation.z = Math.PI;
    this.sanctumGroup.add(this.innerTriadGroup);
  }

  _initCenterPrism() {
    const prismGeom = new THREE.OctahedronGeometry(0.32, 0);
    this.prismMat = new THREE.MeshPhysicalMaterial({
      color: 0x101218,
      roughness: 0.16,
      metalness: 0.38,
      clearcoat: 0.9,
      emissive: new THREE.Color(0xc8a46b),
      emissiveIntensity: 0.08
    });
    this.centerPrism = new THREE.Mesh(prismGeom, this.prismMat);
    this.sanctumGroup.add(this.centerPrism);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xe6cca0,
      wireframe: true,
      transparent: true,
      opacity: 0.24
    });
    this.centerWire = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), wireMat);
    this.sanctumGroup.add(this.centerWire);
  }

  _initAmbientStars() {
    this.orbiters = [];
    const geom = new THREE.SphereGeometry(0.02, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdce4f2,
      transparent: true,
      opacity: 0.48
    });

    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geom, mat);
      const r = 2.48 + (i % 3) * 0.28;
      const angle = (i / 9) * Math.PI * 2;
      const speed = 0.07 + (i % 3) * 0.04;
      const zAmp = 0.35 + (i % 2) * 0.22;
      this.sanctumGroup.add(m);
      this.orbiters.push({ mesh: m, r, angle, speed, zAmp });
    }
  }

  _initLights() {
    this.sanctumLight = new THREE.PointLight(0xe6cca0, 1.1, 11, 2);
    this.sanctumLight.position.set(0, 0.55, -0.4);
    this.group.add(this.sanctumLight);
    this._lightBoost = 0;
  }

  _spawnWave(worldPos, colorHex = 0xe6cca0, maxScale = 4.6) {
    const geom = new THREE.RingGeometry(0.28, 0.34, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.44,
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
    return this.sanctumGroup.position;
  }

  /**
   * 同步三元牌目前狀態機與主/子階段
   */
  setCardState(cardPhase, stageName = 'main-select') {
    const prevPhase = this.cardPhase;
    this.cardPhase = cardPhase || 'IDLE';
    this.stageName = stageName || this.stageName;

    if (this.cardPhase === 'SHUFFLING' && prevPhase !== 'SHUFFLING') {
      this._lightBoost = Math.max(this._lightBoost, 1.2);
      this._spawnWave(this.sanctumGroup.position, 0xc8a46b, 5.2);
    } else if (this.cardPhase === 'LIFTING' && prevPhase !== 'LIFTING') {
      this._lightBoost = Math.max(this._lightBoost, 1.4);
    }
  }

  /**
   * 當使用者點選或取消牌卡時（count: 0 ~ 3），點亮對應的三元頂點星印
   */
  setSelectedCount(count) {
    const next = Math.max(0, Math.min(3, Number(count) || 0));
    const increased = next > this.selectedCount;
    this.selectedCount = next;

    if (increased && this.vertexNodes[next - 1]) {
      const node = this.vertexNodes[next - 1];
      const worldPos = new THREE.Vector3();
      node.holder.getWorldPosition(worldPos);
      // 轉換至本 group 局部座標（group 為原點故等價）
      this._spawnWave(worldPos, next === 3 ? 0xe6cca0 : 0xc8a46b, next === 3 ? 4.2 : 2.8);
      this._lightBoost = Math.max(this._lightBoost, 0.65 + next * 0.25);
      ritualSound.playChime(next === 3 ? 'sacred' : 'chime');
    }
  }

  /**
   * 每張牌 3D 翻開瞬間觸發對應左/中/右方位的空間星波與光影脈衝
   */
  triggerFlipImpulse(cardIdx = 1) {
    const xOffset = (cardIdx - 1) * 1.35;
    const pos = new THREE.Vector3(
      xOffset,
      this.sanctumGroup.position.y + 0.15,
      this.sanctumGroup.position.z + 0.45
    );
    this._spawnWave(pos, 0xe6cca0, 3.8);
    this._lightBoost = Math.max(this._lightBoost, 1.65);

    if (cardIdx === 2 && typeof this.onImpactCallback === 'function') {
      this.onImpactCallback(0.036);
    }
  }

  reset() {
    this.cardPhase = 'IDLE';
    this.stageName = 'main-select';
    this.selectedCount = 0;
    this._lightBoost = 0;
    this.sanctumGroup.position.set(0, 0.52, -1.35);
    this.sanctumGroup.scale.set(1, 1, 1);

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
      return { pos: [0, 0.75, 6.6], lookAt: [0, 0.45, 0] };
    }
    switch (this.cardPhase) {
      case 'SHUFFLING':
        return { pos: [0, 0.72, 5.45], lookAt: [0, 0.48, 0] };
      case 'LIFTING':
        return { pos: [0, 0.52, 5.05], lookAt: [0, 0.52, 0] };
      case 'FLIPPING':
        return { pos: [0, 0.58, 5.35], lookAt: [0, 0.48, 0] };
      case 'REVEAL':
      case 'RESULT':
        return { pos: [0, 0.68, 6.25], lookAt: [0, 0.35, 0] };
      default:
        return { pos: [0, 0.65, 5.95], lookAt: [0, 0.48, 0] };
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    this.elapsed += safeDt;
    const m = this.reducedMotion ? 0.25 : 1.0;

    // 更新擴散星波
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
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.42;
      }
    }

    // 階段空間位置與景深退讓（揭示神諭或總覽時退向深處上方，襯托文字閱讀）
    const isReading =
      this.cardPhase === 'REVEAL' ||
      this.cardPhase === 'RESULT' ||
      this.stageName === 'final-overview';
    const targetY = isReading ? 1.18 : 0.52 + Math.sin(this.elapsed * 0.85) * 0.05 * m;
    const targetZ = isReading ? -2.25 : -1.35;
    const targetScale = isReading ? 0.84 : 1.0;

    this.sanctumGroup.position.y = THREE.MathUtils.lerp(this.sanctumGroup.position.y, targetY, safeDt * 2.6);
    this.sanctumGroup.position.z = THREE.MathUtils.lerp(this.sanctumGroup.position.z, targetZ, safeDt * 2.6);
    const curS = THREE.MathUtils.lerp(this.sanctumGroup.scale.x, targetScale, safeDt * 2.6);
    this.sanctumGroup.scale.setScalar(curS);

    // 動態角速度：SHUFFLING 加速運轉，LIFTING / FLIPPING 對齊收束
    const spinMul =
      this.cardPhase === 'SHUFFLING'
        ? 3.6
        : this.cardPhase === 'LIFTING'
        ? 0.45
        : this.cardPhase === 'FLIPPING'
        ? 1.35
        : 1.0;

    if (this.cardPhase === 'LIFTING' || this.cardPhase === 'FLIPPING') {
      // 對齊收斂至端正莊嚴的視角平面
      const alignOuter = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0));
      const alignMid = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.14, 0.08, 0));
      this.outerHalo.quaternion.slerp(alignOuter, Math.min(1, safeDt * 3.8));
      this.midHalo.quaternion.slerp(alignMid, Math.min(1, safeDt * 4.2));
      this.primaryTriadGroup.rotation.z = THREE.MathUtils.lerp(
        this.primaryTriadGroup.rotation.z,
        0,
        Math.min(1, safeDt * 4.5)
      );
      this.innerTriadGroup.rotation.z += safeDt * 0.32 * m;
    } else {
      this.outerHalo.rotation.x += safeDt * 0.09 * spinMul * m;
      this.outerHalo.rotation.y += safeDt * 0.14 * spinMul * m;
      this.midHalo.rotation.x -= safeDt * 0.13 * spinMul * m;
      this.midHalo.rotation.z += safeDt * 0.11 * spinMul * m;
      this.primaryTriadGroup.rotation.z += safeDt * 0.07 * spinMul * m;
      this.innerTriadGroup.rotation.z -= safeDt * 0.12 * spinMul * m;
    }

    this.centerPrism.rotation.y += safeDt * (0.28 + spinMul * 0.18) * m;
    this.centerPrism.rotation.x += safeDt * 0.14 * m;
    this.centerWire.rotation.y -= safeDt * 0.22 * m;

    // 9 顆微細月銀星點軌道運行
    this.orbiters.forEach((o) => {
      o.angle += safeDt * o.speed * spinMul * m;
      o.mesh.position.set(
        Math.cos(o.angle) * o.r,
        Math.sin(o.angle) * o.r,
        Math.sin(o.angle * 2) * o.zAmp
      );
    });

    // 更新三枚頂點星印共鳴亮度
    const allSelected = this.selectedCount >= 3 || this.cardPhase === 'FLIPPING' || isReading;
    this.vertexNodes.forEach((node, idx) => {
      const active = idx < this.selectedCount || this.cardPhase === 'FLIPPING' || isReading;
      const targetEmissive = active ? (allSelected ? 0.85 : 0.62) : 0.08;
      const targetHalo = active ? 0.55 : 0.14;
      const targetNodeScale = active ? 1.24 : 1.0;

      node.crystalMat.emissiveIntensity = THREE.MathUtils.lerp(
        node.crystalMat.emissiveIntensity,
        targetEmissive,
        safeDt * 6
      );
      node.haloMat.opacity = THREE.MathUtils.lerp(node.haloMat.opacity, targetHalo, safeDt * 6);
      const ns = THREE.MathUtils.lerp(node.holder.scale.x, targetNodeScale, safeDt * 6);
      node.holder.scale.setScalar(ns);
      node.crystal.rotation.y += safeDt * (active ? 1.4 : 0.35) * m;
    });

    this.triadRodMat.emissiveIntensity = THREE.MathUtils.lerp(
      this.triadRodMat.emissiveIntensity,
      allSelected ? 0.28 : 0.05,
      safeDt * 4
    );

    this._lightBoost = THREE.MathUtils.lerp(this._lightBoost, 0, safeDt * 2.8);
    this.prismMat.emissiveIntensity = 0.08 + (allSelected ? 0.28 : 0) + this._lightBoost * 0.35;
    this.sanctumLight.intensity = 1.05 + (allSelected ? 0.85 : 0) + this._lightBoost * 1.6;
  }
}
