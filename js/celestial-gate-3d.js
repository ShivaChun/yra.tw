/**
 * celestial-gate-3d.js
 * 「宇宙指引 · CELESTIAL GATE — Cosmic Revelation」沉浸式宇宙能量入口與星體軌道場景
 *
 * 核心設計哲學：
 *   「不要做成一台有很多零件的機器，而要做成一個正在甦醒的宇宙。」
 *
 * 四大視覺構成整合（對應四張視覺參考）：
 *   A. Dimensional Portal（中央時空入口）：
 *      深邃宇宙黑洞視界核心 + 沿不規則圓形邊界流轉的亮青銀白電漿日冕光環（GLSL 即時流體擾動）。
 *   B. Celestial Orbits（三維多層星體軌道陣列）：
 *      5 層不同高度、不同三維傾角、不同旋轉方向與速度的大型發光星軌環，
 *      搭載發光星體節點、流光脈衝、星象刻度與 5 組三維星座連線（Constellations），零機械齒輪。
 *   C. Energy Nebula & Seal Breaking（立體宇宙流體煙霧與紫藍空間破封裂縫）：
 *      3 層前後景深曲面 Domain-Warped FBM 渦旋流體星雲，參與「聚集 → 渦旋 → 紫藍破封爆發 → 轉化為星塵」全過程。
 *   D. Celestial Beam（中央垂直體積光柱）：
 *      軌道定位與破封後自入口核心貫穿天地的雙層體積光柱、徑向光暈與上升星塵粒子。
 *
 * 七階段連續沉浸式動畫狀態機：
 *   THE_VOID → AWAKENING → PORTAL_OPENING → CELESTIAL_ALIGNMENT
 *   → ENERGY_SYNCHRONIZATION → SEAL_BREAKING → DIVINE_REVELATION (→ GUIDANCE)
 */

import * as THREE from 'three';
import { ritualSound } from './sound-synth.js';

export const CELESTIAL_GATE_PHASES = Object.freeze({
  THE_VOID: 'THE_VOID',
  AWAKENING: 'AWAKENING',
  PORTAL_OPENING: 'PORTAL_OPENING',
  CELESTIAL_ALIGNMENT: 'CELESTIAL_ALIGNMENT',
  ENERGY_SYNCHRONIZATION: 'ENERGY_SYNCHRONIZATION',
  SEAL_BREAKING: 'SEAL_BREAKING',
  DIVINE_REVELATION: 'DIVINE_REVELATION',
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

/* ============================================================================
 * 1. 曲面流體宇宙煙霧與中央時空入口 GLSL Shaders (Ref 01 & Ref 02)
 * ============================================================================ */

const NEBULA_VERTEX_SHADER = `
  varying vec2 vUv;
  varying float vFunnelDepth;
  uniform float uCurvature;

  void main() {
    vUv = uv;
    vec2 centered = (uv - 0.5) * 2.0;
    float r = length(centered);
    // 賦予煙霧曲面漏斗縱深（中央向深空凹陷，外圍微幅舒展，避免平面貼片感）
    vec3 pos = position;
    float funnel = -exp(-r * r * 3.2) * uCurvature;
    pos.z += funnel;
    vFunnelDepth = funnel;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

function buildNebulaFragmentShader(octaves = 5) {
  return `
    precision highp float;
    varying vec2 vUv;
    varying float vFunnelDepth;

    uniform float uTime;
    uniform float uDensity;        // 整體煙霧濃度
    uniform float uPortalOpen;     // 0.0 -> 1.0 中央時空入口開啟程度
    uniform float uSwirlSpeed;     // 渦旋轉速倍率
    uniform float uInflow;         // 正值向內聚集，負值向外擴張
    uniform float uVioletShift;    // 能量同步與破封時的紫藍偏移
    uniform float uGoldShift;      // 啟示階段轉化為香檳金銀白星霧
    uniform float uLayerSeed;      // 不同景深層的獨立隨機種子
    uniform float uIsCoreLayer;    // 1.0 代表主入口層（繪製深邃黑洞視界與電漿亮邊）

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
      float a = 0.52;
      mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
      for (int i = 0; i < ${octaves}; i++) {
        v += a * noise(p);
        p = rot * p * 2.04 + vec2(17.3, 9.2);
        a *= 0.50;
      }
      return v;
    }

    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float r = length(p);
      if (r > 1.0) discard;

      float angle = atan(p.y, p.x);
      // 大幅放慢流體時間推進，營造深邃宇宙星雲緩慢呼吸翻湧的神祕尺度感
      float t = uTime * (0.085 + uSwirlSpeed * 0.088);

      // 旋臂極座標扭曲：越靠近入口邊緣，切向旋轉流速越柔順深沉（Ref 01 渦旋動態）
      float spiralTwist = (1.35 + uSwirlSpeed * 0.65) / (r + 0.24);
      float warpedAngle = angle + spiralTwist * 0.52 - t * 0.48 + uLayerSeed * 2.1;

      vec2 spiralCoord = vec2(
        cos(warpedAngle) * r * 2.35,
        sin(warpedAngle) * r * 2.35
      );

      // Domain-Warped FBM 雙重流體捲動，產生立體緩慢翻湧雲團與絲縷邊緣（Ref 01 & Ref 02）
      vec2 radialFlow = normalize(p + vec2(0.0001)) * (t * uInflow * 0.52);
      vec2 q = vec2(
        fbm(spiralCoord + radialFlow + vec2(uLayerSeed * 5.7, t * 0.18)),
        fbm(spiralCoord + radialFlow + vec2(4.2 - t * 0.16, uLayerSeed * 3.3 + 8.1))
      );

      vec2 w = vec2(
        fbm(spiralCoord * 1.45 + 2.35 * q + vec2(1.7, 9.2) + t * 0.12),
        fbm(spiralCoord * 1.45 + 2.35 * q + vec2(8.3, 2.8) - t * 0.11)
      );

      float fluid = fbm(spiralCoord * 1.15 + 2.1 * w);
      // 絲縷狀高頻能量薄霧（模擬 Ref 02 入口周圍靜靜飄散的藍白煙絲）
      float wisps = fbm(vec2(angle * 3.0 + w.x * 3.8 - t * 0.36, log(r + 0.14) * 3.6 - t * uInflow * 0.45));

      // 不規則自然流動的圓形時空入口邊界
      float rimPerturb = (w.x - 0.5) * 0.068 + (wisps - 0.5) * 0.042;
      float portalRadius = (0.235 * uPortalOpen) + rimPerturb * uPortalOpen;

      // 外圍自然消散遮罩（不規則流體邊界，絕非硬切圓盤）
      float outerMask = smoothstep(0.98, 0.34, r + (fluid - 0.5) * 0.26);

      // 入口內側遮罩：所有景深層皆嚴格避開中央黑洞視界內部，確保入口中心如深淵般純粹深邃（Ref 01 & Ref 02）
      float outsideVoid = smoothstep(portalRadius - 0.008, portalRadius + 0.048, r);

      // 沿入口邊界聚集的纖細銳利藍白電漿日冕環（僅主入口層繪製銳利日冕，避免多層疊加過曝）
      float coronaDist = abs(r - portalRadius);
      float coronaSharp = exp(-coronaDist * 68.0) * uPortalOpen * uIsCoreLayer * (0.68 + 0.45 * wisps);
      float coronaSoft  = exp(-coronaDist * 13.5) * uPortalOpen * outsideVoid * (0.38 + 0.48 * fluid);

      // 立體煙霧體積光感（雲團受中央入口藍白光源由內向外透光照明）
      float innerIllum = exp(-max(0.0, r - portalRadius) * 3.2);
      float cloudBody = smoothstep(0.24, 0.86, fluid * 0.72 + wisps * 0.38) * outerMask * outsideVoid;

      // 色彩系統（PART 5：Deep Cosmic Blue / Cyan Blue / Silver White / Soft Violet / Champagne Gold）
      vec3 deepCosmicBlue = vec3(0.045, 0.115, 0.285);
      vec3 cyanBlue       = vec3(0.200, 0.710, 0.980);
      vec3 silverWhite    = vec3(0.900, 0.950, 1.000);
      vec3 softViolet     = vec3(0.620, 0.410, 0.960);
      vec3 champagneGold  = vec3(0.940, 0.820, 0.580);

      // 雲團暗部為深宇宙藍，受中央照亮處為青藍，翻湧雲峰為銀白（精準還原 Ref 01 立體煙霧層次）
      vec3 smokeCol = mix(deepCosmicBlue, cyanBlue, clamp(innerIllum * 1.08 + q.x * 0.34, 0.0, 1.0));
      smokeCol = mix(smokeCol, silverWhite, smoothstep(0.54, 0.90, fluid) * (0.58 + 0.36 * wisps));

      // 能量同步與破封階段融入柔和紫藍裂縫能量（Ref 03）
      smokeCol = mix(smokeCol, mix(softViolet, silverWhite, 0.32), uVioletShift * (0.55 + 0.45 * w.y));
      // 啟示與回暖階段柔和融入香檳金星塵光澤
      smokeCol = mix(smokeCol, mix(champagneGold, silverWhite, 0.42), uGoldShift * 0.75);

      vec3 coronaCol = mix(cyanBlue, silverWhite, 0.65);
      coronaCol = mix(coronaCol, vec3(0.82, 0.65, 1.0), uVioletShift * 0.65);
      coronaCol = mix(coronaCol, champagneGold, uGoldShift * 0.65);

      vec3 finalRGB = smokeCol * cloudBody * 1.12 + coronaCol * (coronaSharp * 1.15 + coronaSoft * 0.52);
      float smokeAlpha = clamp((cloudBody * 0.84 + coronaSharp * 0.95 + coronaSoft * 0.42) * uDensity, 0.0, 0.95);

      // 主入口層在 portalRadius 內部渲染純淨深邃宇宙黑洞視界（Ref 01 & Ref 02 中央深色空洞）
      if (uIsCoreLayer > 0.5 && uPortalOpen > 0.01) {
        float voidInterior = 1.0 - smoothstep(portalRadius - 0.016, portalRadius + 0.012, r);
        vec3 abyssCol = mix(vec3(0.004, 0.008, 0.020), vec3(0.08, 0.02, 0.16), uVioletShift * 0.65);
        abyssCol = mix(abyssCol, vec3(0.96, 0.91, 0.80), smoothstep(0.35, 0.98, uGoldShift));
        float voidAlpha = voidInterior * smoothstep(0.0, 0.22, uPortalOpen) * (1.0 - uGoldShift * 0.68);

        finalRGB = mix(finalRGB, abyssCol + coronaCol * coronaSharp * 1.12, voidInterior * (1.0 - coronaSharp * 0.35));
        smokeAlpha = max(smokeAlpha, voidAlpha);
      }

      gl_FragColor = vec4(finalRGB, smokeAlpha);
    }
  `;
}

/* ============================================================================
 * 2. 紫藍能量破封裂縫 Shader (Ref 03 — Seal Breaking Rift)
 * ============================================================================ */

const RIFT_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIFT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uRiftOpen;      // 0 -> 1 裂縫張開程度
  uniform float uRiftIntensity; // 爆發亮度與粒子射線強度

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(5.2, 1.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    if (uRiftIntensity <= 0.002) discard;

    vec2 p = (vUv - 0.5) * 2.0;
    // 垂直菱形／梭形空間裂縫比例（呼應 Ref 03 縱向撕裂開啟的紫藍時空裂隙）
    vec2 rp = vec2(p.x * 1.62, p.y * 0.92);
    float dist = length(rp);
    if (dist > 1.35) discard;

    float ang = atan(p.y, p.x);
    float jag = (fbm(vec2(ang * 4.5, uTime * 1.4)) - 0.5) * 0.16;
    float diamond = abs(p.x) * 1.55 + abs(p.y) * 0.82 + jag;

    float riftRadius = 0.34 * uRiftOpen;
    // 裂縫邊緣爆發的放射狀能量絲線（Ref 03 紫藍撕裂光絲）
    float streaks = fbm(vec2(ang * 14.0, dist * 3.4 - uTime * 3.2));
    streaks = pow(clamp(streaks * 1.32, 0.0, 1.0), 2.4);
    float innerFold = fbm(p * 3.6 + vec2(0.0, -uTime * 0.6));

    float rim = exp(-abs(diamond - riftRadius) * 20.0) * (0.72 + 0.78 * streaks);
    float burstRays = exp(-max(0.0, diamond - riftRadius) * 4.8) * streaks * 0.88;
    float innerCore = 1.0 - smoothstep(riftRadius - 0.04, riftRadius + 0.02, diamond);

    // 裂縫內部保留深紫紅星雲幽谷層次（避免全白過曝，忠實呈現 Ref 03 空間被撕開的深邃感）
    vec3 abyssPurple    = mix(vec3(0.09, 0.02, 0.18), vec3(0.34, 0.09, 0.48), innerFold);
    vec3 electricViolet = vec3(0.66, 0.34, 0.98);
    vec3 cyanEdge       = vec3(0.54, 0.91, 1.00);
    vec3 pureWhite      = vec3(0.98, 0.97, 1.00);

    vec3 outerCol = mix(electricViolet, cyanEdge, streaks) * burstRays * 1.15
                  + mix(cyanEdge, pureWhite, 0.55) * rim * 1.35;
    vec3 col = mix(outerCol, abyssPurple + rim * cyanEdge * 0.9, innerCore * 0.88);

    float fadeEdge = smoothstep(1.25, 0.45, dist);
    float alpha = clamp((innerCore * 0.92 + rim * 0.95 + burstRays * 0.76) * fadeEdge * uRiftIntensity, 0.0, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`;

/* ============================================================================
 * 3. 中央垂直天體體積光柱 Shader (Ref 04 & PART 3D — Celestial Beam)
 * ============================================================================ */

const BEAM_PILLAR_VERTEX_SHADER = `
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

const BEAM_PILLAR_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  uniform float uTime;
  uniform float uBeamPower;
  uniform vec3 uCoreColor;
  uniform vec3 uHaloColor;
  uniform float uFresnelExp;

  void main() {
    if (uBeamPower <= 0.002) discard;

    // 圓柱體邊緣自然體積衰減，保留通透感以清晰呈現前後交錯的星體軌道（Ref 04）
    float fresnel = pow(abs(dot(vNormal, vViewDir)), uFresnelExp);
    float vertMask = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.80, vUv.y);
    float centerBoost = 1.0 + 0.22 * exp(-pow((vUv.y - 0.48) * 3.8, 2.0));

    // 隨時間自然流動的上升光絲與呼吸亮度
    float wave1 = 0.88 + 0.12 * sin(vUv.y * 22.0 - uTime * 3.1 + vUv.x * 6.2831);
    float breath = 0.90 + 0.10 * sin(uTime * 2.2);

    vec3 col = mix(uHaloColor, uCoreColor, clamp(fresnel * 1.15, 0.0, 1.0));
    float intensity = fresnel * vertMask * centerBoost * wave1 * breath * uBeamPower;

    gl_FragColor = vec4(col * intensity * 0.96, clamp(intensity * 0.88, 0.0, 0.88));
  }
`;

/* ============================================================================
 * 4. 星體軌道流光 Shader 與 GPU 渦旋星塵粒子 Shader
 * ============================================================================ */

const ORBIT_RING_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ORBIT_RING_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uArcProgress; // 0 -> 1 光點凝聚後沿圓周結晶成環的延伸進度
  uniform float uPulseSpeed;
  uniform vec3 uBaseColor;
  uniform vec3 uPulseColor;

  void main() {
    if (uOpacity <= 0.002 || uArcProgress <= 0.002) discard;
    // 雙向對稱沿軌道圓周柔和延伸成環，無生硬切口
    float symUv = abs(vUv.x - 0.5) * 2.0;
    float arcMask = 1.0 - smoothstep(max(0.0, uArcProgress - 0.18), uArcProgress + 0.02, symUv);
    if (arcMask <= 0.002) discard;

    float a = vUv.x * 6.2831853;
    float p1 = pow(0.5 + 0.5 * sin(a * 2.0 - uTime * uPulseSpeed), 6.0);
    float p2 = pow(0.5 + 0.5 * sin(a * 1.0 + uTime * uPulseSpeed * 0.65 + 1.9), 10.0);
    vec3 col = mix(uBaseColor, uPulseColor, clamp(p1 * 0.65 + p2 * 0.85, 0.0, 1.0));
    float boost = 1.0 + p1 * 0.50 + p2 * 0.65;
    float finalAlpha = uOpacity * arcMask * (0.78 + p1 * 0.22);
    gl_FragColor = vec4(col * boost, clamp(finalAlpha, 0.0, 1.0));
  }
`;

/**
 * 周圍星辰光點逐步向軌道收束凝聚成光環的 GPU Vertex/Fragment Shader
 */
const RING_COALESCE_VERTEX_SHADER = `
  attribute float aBaseAngle;
  attribute vec3 aScatterOffset; // x: 徑向擴散偏移, y: 垂直高度擴散, z: 旋臂滯後角
  attribute float aSize;
  attribute float aPhase;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uRadius;
  uniform float uCoalesce;       // 0.0 (散落於煙霧星海) -> 1.0 (完全凝聚鎖定於光環軌道)
  uniform float uSeedAlpha;      // 光點整體顯影強度
  uniform float uOrbitSpeed;

  varying float vAlpha;
  varying float vCoalesce;

  void main() {
    vCoalesce = uCoalesce;
    float scatter = 1.0 - smoothstep(0.0, 1.0, uCoalesce);
    // 散落時帶三次曲線寬廣漂浮，隨 uCoalesce 推進柔和螺旋收束至精準圓環半徑 uRadius
    float scatterCurve = scatter * scatter;

    float spin = uTime * uOrbitSpeed * mix(0.35, 1.0, uCoalesce);
    float driftAng = sin(uTime * 0.28 + aPhase) * 0.18 * scatter;
    float ang = aBaseAngle + spin + aScatterOffset.z * scatterCurve + driftAng;

    float r = uRadius + aScatterOffset.x * scatterCurve
            + sin(uTime * 0.42 + aPhase * 2.3) * 0.09 * scatter;
    float y = aScatterOffset.y * scatterCurve
            + cos(uTime * 0.36 + aPhase * 1.7) * 0.08 * scatter;

    vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r);
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

    float twinkle = 0.48 + 0.52 * sin(uTime * 1.65 + aPhase * 6.2831);
    // 凝聚過程中段（0.35 ~ 0.85）星點最為璀璨，成環後化為環繞軌道的細緻星芒微粒
    float condenseBoost = 1.0 + 0.55 * sin(clamp(uCoalesce, 0.0, 1.0) * 3.14159);
    vAlpha = twinkle * uSeedAlpha * condenseBoost * smoothstep(14.0, 2.2, -mvPos.z);

    float ptSize = aSize * mix(1.25, 0.82, uCoalesce);
    gl_PointSize = ptSize * uPixelRatio * (25.0 / max(1.2, -mvPos.z));
    gl_Position = projectionMatrix * mvPos;
  }
`;

const RING_COALESCE_FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vCoalesce;

  void main() {
    if (vAlpha <= 0.003) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d * d * 26.0);
    float halo = smoothstep(0.5, 0.06, d) * 0.52;
    vec3 col = mix(uColor, vec3(1.0, 0.99, 0.96), core * (0.45 + 0.35 * vCoalesce));
    gl_FragColor = vec4(col * (1.0 + core * 0.75), clamp((core + halo) * vAlpha, 0.0, 1.0));
  }
`;

const STARDUST_VERTEX_SHADER = `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aSpeed;
  attribute float aSize;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSwirl;
  uniform float uAscend;    // 啟示階段煙霧化為上升星塵
  uniform float uExpand;    // 破封階段向外擴散衝擊

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    // 星塵如無重力深海微光般緩慢旋浮，避免急促旋轉破壞神祕感
    float ang = aAngle + uTime * aSpeed * (0.20 + uSwirl * 0.42);
    float r = aRadius * (1.0 + uExpand * 0.42) + sin(uTime * 0.36 + aAngle * 3.0) * 0.05;

    float y = aHeight;
    if (uAscend > 0.001) {
      float lift = mod(aHeight + 2.2 + uTime * (0.26 + aSpeed * 0.22) * uAscend, 4.8) - 2.2;
      y = mix(aHeight, lift, smoothstep(0.0, 0.65, uAscend));
      r = mix(r, aRadius * 0.62, uAscend * 0.45);
    }

    vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r);
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);

    float twinkle = 0.58 + 0.42 * sin(uTime * 1.35 + aAngle * 7.1);
    vAlpha = twinkle * smoothstep(13.0, 2.2, -mvPos.z);

    gl_PointSize = aSize * uPixelRatio * (26.0 / max(1.2, -mvPos.z));
    gl_Position = projectionMatrix * mvPos;
  }
`;

const STARDUST_FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uGlobalOpacity;

  void main() {
    if (uGlobalOpacity <= 0.002) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float core = exp(-d * d * 24.0);
    float halo = smoothstep(0.5, 0.05, d) * 0.55;
    float a = (core + halo) * vAlpha * uGlobalOpacity;
    gl_FragColor = vec4(vColor * (1.0 + core * 0.8), clamp(a, 0.0, 1.0));
  }
`;

/**
 * 建立柔和星芒發光貼圖（供軌道星體與星座頂點光暈使用）
 */
function createStarGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;

  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.16, 'rgba(255, 246, 224, 0.92)');
  grad.addColorStop(0.42, 'rgba(165, 222, 255, 0.36)');
  grad.addColorStop(1.0, 'rgba(20, 45, 95, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 優雅十字細星芒
  ctx.save();
  ctx.translate(cx, cx);
  for (let i = 0; i < 2; i++) {
    ctx.rotate((i * Math.PI) / 2);
    const lg = ctx.createLinearGradient(-cx * 0.88, 0, cx * 0.88, 0);
    lg.addColorStop(0.0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.5, 'rgba(255,250,236,0.75)');
    lg.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-cx * 0.88, -1.3, cx * 1.76, 2.6);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================================
 * 5. CelestialGateScene 主類別
 * ============================================================================ */

export class CelestialGateScene {
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 8;
    const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;
    this.isLowEnd = options.isLowEnd ?? (cores <= 4 || mem <= 4 || isNarrow);

    this.phase = CELESTIAL_GATE_PHASES.THE_VOID;
    this.phaseTime = 0;
    this.elapsed = 0;
    this.reducedMotion = false;
    this.isFrozenPreview = false;

    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.onImpactCallback = null;
    this.sessionId = 0;

    this.waves = [];
    this.starGlowTex = createStarGlowTexture();

    // 宇宙場景根群組（位於 [0, 0.10, 0]）
    this.cosmosRoot = new THREE.Group();
    this.cosmosRoot.position.set(0, 0.10, 0);
    this.group.add(this.cosmosRoot);

    this._buildDeepStarfield();
    this._buildPortalAndNebula();
    this._buildSealRift();
    this._buildCelestialOrbitsAndConstellations();
    this._buildCelestialBeam();
    this._buildStardustVortex();

    this._applyVisualState({
      voidStars: 0.92,
      nebulaDensity: 0.34,
      portalOpen: 0.18,
      swirlSpeed: 0.16,
      inflow: 0.18,
      violetShift: 0.0,
      goldShift: 0.0,
      seedAlpha: [0.0, 0.0, 0.0],
      ringCoalesce: [0.0, 0.0, 0.0],
      orbitReveal: [0, 0, 0],
      orbitSpinMul: 0.18,
      constellationAlpha: 0.0,
      coreCharge: 0.08,
      riftOpen: 0.0,
      riftIntensity: 0.0,
      beamPower: 0.0,
      stardustOpacity: 0.30,
      stardustSwirl: 0.15,
      stardustAscend: 0.0,
      stardustExpand: 0.0
    });
  }

  /**
   * THE VOID — 3D 深邃宇宙星海與銀河微光星群
   */
  _buildDeepStarfield() {
    const count = this.isLowEnd ? 130 : 280;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const heights = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color('#eef5ff'),
      new THREE.Color('#9ad8ff'),
      new THREE.Color('#f4dfb4'),
      new THREE.Color('#c6b6ff')
    ];

    for (let i = 0; i < count; i++) {
      const r = 3.8 + Math.random() * 6.8;
      const ang = Math.random() * Math.PI * 2;
      // 略微集中於斜向銀河帶（呼應 Ref 04 左上至右下的深空星團）
      const bandBias = (Math.random() - 0.5) * 5.2 + Math.sin(ang + 0.8) * 1.1;
      radii[i] = r;
      angles[i] = ang;
      heights[i] = bandBias;
      speeds[i] = (Math.random() * 0.025 + 0.006) * (i % 2 === 0 ? 1 : -1);
      sizes[i] = Math.random() * 1.55 + 0.55;

      positions[i * 3] = Math.cos(ang) * r;
      positions[i * 3 + 1] = bandBias;
      positions[i * 3 + 2] = Math.sin(ang) * r - 1.8;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geom.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geom.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geom.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.voidStarUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uSwirl: { value: 0.05 },
      uAscend: { value: 0.0 },
      uExpand: { value: 0.0 },
      uGlobalOpacity: { value: 0.92 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: STARDUST_VERTEX_SHADER,
      fragmentShader: STARDUST_FRAGMENT_SHADER,
      uniforms: this.voidStarUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.voidStarPoints = new THREE.Points(geom, mat);
    this.voidStarPoints.position.z = -1.6;
    this.group.add(this.voidStarPoints);
  }

  /**
   * A & C. 中央時空入口 (Portal) + 三層立體流體宇宙煙霧 (Energy Nebula) + 中央聚能星核
   */
  _buildPortalAndNebula() {
    this.portalGroup = new THREE.Group();
    this.cosmosRoot.add(this.portalGroup);

    const octaves = this.isLowEnd ? 4 : 5;
    const fragShader = buildNebulaFragmentShader(octaves);
    const segs = this.isLowEnd ? 32 : 48;

    // 3 層前後景深曲面流體層，建立真實三維體積煙霧感（非單張平面貼圖）
    const layerConfigs = [
      { size: 4.15, z: -0.34, curvature: 0.42, seed: 1.17, isCore: 0.0, blending: THREE.AdditiveBlending, order: 1 },
      { size: 3.35, z: 0.0,   curvature: 0.28, seed: 2.63, isCore: 1.0, blending: THREE.NormalBlending,   order: 3 },
      { size: 2.85, z: 0.28,  curvature: -0.22, seed: 4.09, isCore: 0.0, blending: THREE.AdditiveBlending, order: 5 }
    ];

    this.nebulaLayers = layerConfigs.map((cfg) => {
      const geom = new THREE.PlaneGeometry(cfg.size, cfg.size, segs, segs);
      const uniforms = {
        uTime: { value: 0 },
        uDensity: { value: 0.35 },
        uPortalOpen: { value: 0.2 },
        uSwirlSpeed: { value: 0.3 },
        uInflow: { value: 0.25 },
        uVioletShift: { value: 0.0 },
        uGoldShift: { value: 0.0 },
        uLayerSeed: { value: cfg.seed },
        uIsCoreLayer: { value: cfg.isCore },
        uCurvature: { value: cfg.curvature }
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERTEX_SHADER,
        fragmentShader: fragShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: cfg.blending
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.z = cfg.z;
      mesh.renderOrder = cfg.order;
      this.portalGroup.add(mesh);
      return { mesh, uniforms, cfg };
    });

    // 中央能量聚能星核（ENERGY_SYNCHRONIZATION 時於時空入口深處凝聚閃耀）
    this.energyCoreMat = new THREE.SpriteMaterial({
      map: this.starGlowTex,
      color: 0x8ae4ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.energyCoreSprite = new THREE.Sprite(this.energyCoreMat);
    this.energyCoreSprite.scale.setScalar(0.85);
    this.energyCoreSprite.position.set(0, 0, 0.08);
    this.energyCoreSprite.renderOrder = 6;
    this.portalGroup.add(this.energyCoreSprite);

    this.portalLight = new THREE.PointLight(0x6ad4ff, 1.4, 9.5, 1.8);
    this.portalLight.position.set(0, 0.1, 0.65);
    this.portalGroup.add(this.portalLight);
  }

  /**
   * SEAL BREAKING — 紫藍能量空間破封裂縫層 (Ref 03)
   */
  _buildSealRift() {
    const geom = new THREE.PlaneGeometry(3.4, 3.7, 1, 1);
    this.riftUniforms = {
      uTime: { value: 0 },
      uRiftOpen: { value: 0.0 },
      uRiftIntensity: { value: 0.0 }
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: RIFT_VERTEX_SHADER,
      fragmentShader: RIFT_FRAGMENT_SHADER,
      uniforms: this.riftUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending
    });

    this.riftMesh = new THREE.Mesh(geom, mat);
    this.riftMesh.position.set(0, 0, 0.34);
    this.riftMesh.renderOrder = 7;
    this.portalGroup.add(this.riftMesh);
  }

  /**
   * B. 三道精煉立體星體軌道 + 周圍星點凝聚成環系統 + 輕盈星座連線
   * 捨棄繁複多層副環與密集刻度，由散落於煙霧中的星點緩慢收束結晶為 3 道純粹優雅的三維星環
   */
  _buildCelestialOrbitsAndConstellations() {
    this.orbitsRoot = new THREE.Group();
    this.cosmosRoot.add(this.orbitsRoot);

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const ptsPerRing = this.isLowEnd ? 90 : 170;

    const tierSpecs = [
      // Orbit 0：中央內層冰青星環（最先隨入口煙霧聚攏光點而結晶成形）
      {
        y: 0.0,
        radius: 1.44,
        tube: 0.0115,
        tilt: [-0.30, 0.14, -0.22],
        speed: 0.125,
        color: '#9ee8ff',
        pulseColor: '#ffffff',
        starNodes: 2
      },
      // Orbit 1：主黃道香檳金巨環（最寬闊優雅的主軌道，與煙霧星海交織）
      {
        y: 0.20,
        radius: 2.18,
        tube: 0.0135,
        tilt: [0.32, 0.08, 0.18],
        speed: -0.082,
        color: '#f6dfb0',
        pulseColor: '#c4f2ff',
        starNodes: 3
      },
      // Orbit 2：斜交銀紫星辰環（與前兩道形成純粹立體的三維交錯景深）
      {
        y: -0.24,
        radius: 1.80,
        tube: 0.0115,
        tilt: [0.22, -0.14, 0.20],
        speed: 0.098,
        color: '#dfe6ff',
        pulseColor: '#fff5d8',
        starNodes: 2
      }
    ];

    this.orbitTiers = tierSpecs.map((spec, idx) => {
      const tiltGroup = new THREE.Group();
      tiltGroup.position.set(0, spec.y, 0);
      tiltGroup.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
      this.orbitsRoot.add(tiltGroup);

      const spinGroup = new THREE.Group();
      tiltGroup.add(spinGroup);

      // 1. 周圍星辰光點凝聚粒子流（散落於外圍星霧 -> 螺旋收束凝聚至圓環路徑）
      const dummyPos = new Float32Array(ptsPerRing * 3);
      const baseAngles = new Float32Array(ptsPerRing);
      const scatterOffsets = new Float32Array(ptsPerRing * 3);
      const sizes = new Float32Array(ptsPerRing);
      const phases = new Float32Array(ptsPerRing);

      for (let i = 0; i < ptsPerRing; i++) {
        const a = (i / ptsPerRing) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
        baseAngles[i] = a;
        // 散落於軌道內外與上下煙霧空間，帶旋臂滯後角
        const radialSpread = (Math.random() - 0.32) * 1.65;
        const verticalSpread = (Math.random() - 0.5) * 1.45;
        const swirlLag = (Math.random() * 1.4 + 0.5) * (spec.speed >= 0 ? -1 : 1);
        scatterOffsets[i * 3] = radialSpread;
        scatterOffsets[i * 3 + 1] = verticalSpread;
        scatterOffsets[i * 3 + 2] = swirlLag;

        sizes[i] = Math.random() * 1.35 + 0.55;
        phases[i] = Math.random() * 10.0;

        dummyPos[i * 3] = Math.cos(a) * spec.radius;
        dummyPos[i * 3 + 1] = 0;
        dummyPos[i * 3 + 2] = Math.sin(a) * spec.radius;
      }

      const coalesceGeom = new THREE.BufferGeometry();
      coalesceGeom.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
      coalesceGeom.setAttribute('aBaseAngle', new THREE.BufferAttribute(baseAngles, 1));
      coalesceGeom.setAttribute('aScatterOffset', new THREE.BufferAttribute(scatterOffsets, 3));
      coalesceGeom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
      coalesceGeom.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

      const coalesceUniforms = {
        uTime: { value: 0 },
        uPixelRatio: { value: dpr },
        uRadius: { value: spec.radius },
        uCoalesce: { value: 0.0 },
        uSeedAlpha: { value: 0.0 },
        uOrbitSpeed: { value: spec.speed },
        uColor: { value: new THREE.Color(spec.color) }
      };

      const coalesceMat = new THREE.ShaderMaterial({
        vertexShader: RING_COALESCE_VERTEX_SHADER,
        fragmentShader: RING_COALESCE_FRAGMENT_SHADER,
        uniforms: coalesceUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const coalescePoints = new THREE.Points(coalesceGeom, coalesceMat);
      coalescePoints.frustumCulled = false;
      coalescePoints.renderOrder = 5;
      tiltGroup.add(coalescePoints);

      // 2. 光點收束後結晶浮現的纖細純淨光環 (XZ 平面)
      const mainTorus = new THREE.TorusGeometry(spec.radius, spec.tube, 12, this.isLowEnd ? 96 : 144);
      mainTorus.rotateX(Math.PI * 0.5);
      const ringUniforms = {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uArcProgress: { value: 0 },
        uPulseSpeed: { value: 0.48 + idx * 0.12 },
        uBaseColor: { value: new THREE.Color(spec.color) },
        uPulseColor: { value: new THREE.Color(spec.pulseColor) }
      };
      const mainMat = new THREE.ShaderMaterial({
        vertexShader: ORBIT_RING_VERTEX_SHADER,
        fragmentShader: ORBIT_RING_FRAGMENT_SHADER,
        uniforms: ringUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mainMesh = new THREE.Mesh(mainTorus, mainMat);
      mainMesh.renderOrder = 4;
      spinGroup.add(mainMesh);

      const auxMaterials = [];

      // 柔和呼吸外暈細環
      const haloTorus = new THREE.TorusGeometry(spec.radius, spec.tube * 3.2, 8, this.isLowEnd ? 72 : 112);
      haloTorus.rotateX(Math.PI * 0.5);
      const haloMat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      auxMaterials.push({ mat: haloMat, maxOp: 0.15 });
      spinGroup.add(new THREE.Mesh(haloTorus, haloMat));

      // 沿軌道點綴少量璀璨主星辰節點（無繁瑣刻度線）
      const nodeCount = spec.starNodes || 2;
      for (let i = 0; i < nodeCount; i++) {
        const a = (i / nodeCount) * Math.PI * 2 + idx * 0.9;
        const col = i % 2 === 0 ? 0xfff5d6 : 0x9ce8ff;
        this._addGlowingStarBody(
          spinGroup,
          Math.cos(a) * spec.radius,
          0,
          Math.sin(a) * spec.radius,
          0.034,
          0.25,
          col,
          auxMaterials
        );
      }

      return {
        spec,
        tiltGroup,
        spinGroup,
        ringUniforms,
        coalesceUniforms,
        auxMaterials,
        baseTilt: new THREE.Euler(spec.tilt[0], spec.tilt[1], spec.tilt[2])
      };
    });

    // 建立 3 組精選星宿連線（隨星辰與光環自然浮現）
    this._buildConstellations();
  }

  _addGlowingStarBody(parent, x, y, z, coreRadius, haloScale, colorHex, auxMaterials) {
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 12, 12), sphereMat);
    sphere.position.set(x, y, z);
    sphere.renderOrder = 6;
    parent.add(sphere);
    auxMaterials.push({ mat: sphereMat, maxOp: 0.96 });

    const spriteMat = new THREE.SpriteMaterial({
      map: this.starGlowTex,
      color: colorHex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(haloScale);
    sprite.renderOrder = 6;
    parent.add(sprite);
    auxMaterials.push({ mat: spriteMat, maxOp: 0.88 });
  }

  /**
   * 建構懸浮於星霧與軌道間的 3 組精簡星宿連線（Constellations）
   */
  _buildConstellations() {
    this.constellationGroup = new THREE.Group();
    this.orbitsRoot.add(this.constellationGroup);

    const patterns = [
      // 左上天鵝星弧
      {
        offset: [-1.58, 0.56, 0.28],
        pts: [[0, 0.26, 0], [0.18, 0.08, 0.08], [0.40, 0.14, 0.04], [0.20, -0.14, 0.10]]
      },
      // 右上北斗星宿
      {
        offset: [1.52, 0.48, 0.24],
        pts: [[-0.24, -0.06, 0.05], [-0.04, 0.06, 0.02], [0.16, 0.02, 0], [0.30, 0.18, -0.06], [0.46, 0.26, -0.10]]
      },
      // 下方柔和星冠折線
      {
        offset: [0.0, -0.58, 0.72],
        pts: [[-0.64, 0.06, -0.08], [-0.28, -0.10, 0.06], [0.0, 0.08, 0.14], [0.30, -0.08, 0.06], [0.64, 0.07, -0.08]]
      }
    ];

    this.constellationItems = patterns.map((pat) => {
      const grp = new THREE.Group();
      grp.position.set(...pat.offset);
      this.constellationGroup.add(grp);

      const lineVerts = [];
      const starSprites = [];

      pat.pts.forEach((p, idx) => {
        lineVerts.push(p[0], p[1], p[2]);
        // 避免閉合路徑重複最後一點的星芒
        if (idx === pat.pts.length - 1 && pat.pts.length > 6) return;
        const sMat = new THREE.SpriteMaterial({
          map: this.starGlowTex,
          color: idx % 2 === 0 ? 0xfff5d8 : 0xb2eeff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        const sp = new THREE.Sprite(sMat);
        sp.position.set(p[0], p[1], p[2]);
        sp.scale.setScalar(0.16);
        sp.renderOrder = 6;
        grp.add(sp);
        starSprites.push(sMat);
      });

      const lGeom = new THREE.BufferGeometry();
      lGeom.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
      const lMat = new THREE.LineBasicMaterial({
        color: 0xf8e6bc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(lGeom, lMat);
      line.renderOrder = 5;
      grp.add(line);

      return { grp, lineMat: lMat, starSprites };
    });
  }

  /**
   * D. 中央垂直天體體積光柱 (Celestial Beam — Ref 04 & PART 3D)
   */
  _buildCelestialBeam() {
    this.beamGroup = new THREE.Group();
    this.cosmosRoot.add(this.beamGroup);

    // 1. 內層高亮度能量光蕊圓柱
    const innerGeom = new THREE.CylinderGeometry(0.14, 0.22, 8.2, 32, 1, true);
    this.innerBeamUniforms = {
      uTime: { value: 0 },
      uBeamPower: { value: 0.0 },
      uCoreColor: { value: new THREE.Color('#ffffff') },
      uHaloColor: { value: new THREE.Color('#f7e3b5') },
      uFresnelExp: { value: 1.55 }
    };
    const innerMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_PILLAR_VERTEX_SHADER,
      fragmentShader: BEAM_PILLAR_FRAGMENT_SHADER,
      uniforms: this.innerBeamUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.innerBeamMesh = new THREE.Mesh(innerGeom, innerMat);
    this.innerBeamMesh.renderOrder = 8;
    this.beamGroup.add(this.innerBeamMesh);

    // 2. 外層柔和擴散體積光暈圓柱（連結中央入口與所有三維星軌）
    const outerGeom = new THREE.CylinderGeometry(0.52, 0.96, 8.6, 32, 1, true);
    this.outerBeamUniforms = {
      uTime: { value: 0 },
      uBeamPower: { value: 0.0 },
      uCoreColor: { value: new THREE.Color('#fcebc6') },
      uHaloColor: { value: new THREE.Color('#7cd8ff') },
      uFresnelExp: { value: 2.35 }
    };
    const outerMat = new THREE.ShaderMaterial({
      vertexShader: BEAM_PILLAR_VERTEX_SHADER,
      fragmentShader: BEAM_PILLAR_FRAGMENT_SHADER,
      uniforms: this.outerBeamUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    this.outerBeamMesh = new THREE.Mesh(outerGeom, outerMat);
    this.outerBeamMesh.renderOrder = 7;
    this.beamGroup.add(this.outerBeamMesh);

    // 3. 光柱與入口交會處的璀璨星芒核心光暈
    this.beamFlareMat = new THREE.SpriteMaterial({
      map: this.starGlowTex,
      color: 0xfff6e0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.beamFlareSprite = new THREE.Sprite(this.beamFlareMat);
    this.beamFlareSprite.scale.set(2.8, 2.8, 1);
    this.beamFlareSprite.position.set(0, 0, 0.18);
    this.beamFlareSprite.renderOrder = 9;
    this.beamGroup.add(this.beamFlareSprite);
  }

  /**
   * 渦旋能量星塵粒子（參與渦旋吸引、破封擴張、以及結果揭示時「煙霧轉化為上升星塵」）
   */
  _buildStardustVortex() {
    const count = this.isLowEnd ? 96 : 210;
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const angles = new Float32Array(count);
    const heights = new Float32Array(count);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    const palette = [
      new THREE.Color('#7ce0ff'),
      new THREE.Color('#eef7ff'),
      new THREE.Color('#f5dfb0'),
      new THREE.Color('#b99aff')
    ];

    for (let i = 0; i < count; i++) {
      const r = 0.32 + Math.pow(Math.random(), 0.75) * 2.25;
      const a = Math.random() * Math.PI * 2;
      const h = (Math.random() - 0.5) * 2.2;
      radii[i] = r;
      angles[i] = a;
      heights[i] = h;
      speeds[i] = (0.35 + (1.6 / (r + 0.4)) * 0.35) * (i % 5 === 0 ? -0.6 : 1.0);
      sizes[i] = Math.random() * 1.45 + 0.55;

      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = Math.sin(a) * r;

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geom.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geom.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geom.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.stardustUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uSwirl: { value: 0.25 },
      uAscend: { value: 0.0 },
      uExpand: { value: 0.0 },
      uGlobalOpacity: { value: 0.35 }
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader: STARDUST_VERTEX_SHADER,
      fragmentShader: STARDUST_FRAGMENT_SHADER,
      uniforms: this.stardustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.stardustPoints = new THREE.Points(geom, mat);
    this.stardustPoints.renderOrder = 6;
    this.cosmosRoot.add(this.stardustPoints);
  }

  _spawnShockwave(maxScale = 5.4, colorHex = 0xa8e8ff, tiltX = 0) {
    // 使用極細柔光環（避免放大後產生生硬色塊邊緣）
    const geom = new THREE.RingGeometry(0.33, 0.348, 96);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(this.cosmosRoot.position);
    mesh.position.z += 0.15;
    mesh.rotation.x = tiltX;
    mesh.renderOrder = 8;
    this.group.add(mesh);
    this.waves.push({ mesh, age: 0, maxAge: 1.45, maxScale });
  }

  _setPhase(nextPhase) {
    this.phase = nextPhase;
    this.phaseTime = 0;
    if (typeof this.onPhaseChange === 'function') {
      this.onPhaseChange(nextPhase);
    }
  }

  /**
   * 統一套用各子系統視覺權重（確保階段銜接絲滑連續，並支援 Prototype 單獨檢視任一階段）
   */
  _applyVisualState(s) {
    this.currentSpinMul = s.orbitSpinMul ?? 0.3;

    if (this.voidStarUniforms && s.voidStars !== undefined) {
      this.voidStarUniforms.uGlobalOpacity.value = s.voidStars;
    }

    this.nebulaLayers.forEach((layer, idx) => {
      const u = layer.uniforms;
      const layerMul = idx === 1 ? 1.0 : idx === 0 ? 0.76 : 0.68;
      u.uDensity.value = (s.nebulaDensity ?? 0.5) * layerMul;
      u.uPortalOpen.value = s.portalOpen ?? 0.0;
      u.uSwirlSpeed.value = s.swirlSpeed ?? 0.3;
      u.uInflow.value = s.inflow ?? 0.2;
      u.uVioletShift.value = s.violetShift ?? 0.0;
      u.uGoldShift.value = s.goldShift ?? 0.0;
    });

    const charge = s.coreCharge ?? 0.1;
    this.energyCoreMat.opacity = Math.min(0.98, charge);
    const coreScale = 0.75 + charge * 1.45;
    this.energyCoreSprite.scale.setScalar(coreScale);
    this.energyCoreMat.color.lerpColors(
      new THREE.Color('#66d8ff'),
      s.violetShift > 0.35 ? new THREE.Color('#d8b4ff') : new THREE.Color('#fff4d4'),
      Math.min(1, (s.violetShift ?? 0) * 0.7 + (s.goldShift ?? 0) * 0.85)
    );

    this.portalLight.intensity = 1.1 + charge * 3.8 + (s.beamPower ?? 0) * 2.5;
    this.portalLight.color.set(
      (s.goldShift ?? 0) > 0.35 ? 0xffeab8 : (s.violetShift ?? 0) > 0.35 ? 0xb58cff : 0x6ad8ff
    );

    this.riftUniforms.uRiftOpen.value = s.riftOpen ?? 0.0;
    this.riftUniforms.uRiftIntensity.value = s.riftIntensity ?? 0.0;

    const reveals = s.orbitReveal || [0, 0, 0];
    const coalesces = s.ringCoalesce || reveals;
    const seeds = s.seedAlpha || [0, 0, 0];

    this.orbitTiers.forEach((tier, i) => {
      const rev = THREE.MathUtils.clamp(reveals[i] ?? 0, 0, 1);
      const coal = THREE.MathUtils.clamp(coalesces[i] ?? 0, 0, 1);
      const seedOp = THREE.MathUtils.clamp(seeds[i] ?? 0, 0, 1);

      tier.coalesceUniforms.uCoalesce.value = coal;
      tier.coalesceUniforms.uSeedAlpha.value = seedOp;

      tier.ringUniforms.uOpacity.value = rev * 0.90;
      tier.ringUniforms.uArcProgress.value = THREE.MathUtils.smoothstep(rev, 0.0, 0.92);

      tier.auxMaterials.forEach((item) => {
        item.mat.opacity = item.maxOp * rev;
      });
    });

    const cAlpha = THREE.MathUtils.clamp(s.constellationAlpha ?? 0, 0, 1);
    this.constellationItems.forEach((c) => {
      c.lineMat.opacity = cAlpha * 0.68;
      c.starSprites.forEach((sm) => {
        sm.opacity = cAlpha * 0.95;
      });
    });

    const bp = s.beamPower ?? 0.0;
    this.innerBeamUniforms.uBeamPower.value = bp;
    this.outerBeamUniforms.uBeamPower.value = bp * 0.68;
    this.beamFlareMat.opacity = Math.min(0.42, bp * 0.38);
    this.beamFlareSprite.scale.setScalar(1.35 + bp * 0.75);

    this.stardustUniforms.uGlobalOpacity.value = s.stardustOpacity ?? 0.4;
    this.stardustUniforms.uSwirl.value = s.stardustSwirl ?? 0.3;
    this.stardustUniforms.uAscend.value = s.stardustAscend ?? 0.0;
    this.stardustUniforms.uExpand.value = s.stardustExpand ?? 0.0;
  }

  /* ======================= 公開控制介面 (與 StageManager 無縫相容) ======================= */

  setReducedMotion(flag) {
    this.reducedMotion = Boolean(flag);
  }

  setImpactHandler(fn) {
    this.onImpactCallback = fn;
  }

  getFocusPosition() {
    return this.cosmosRoot.position;
  }

  isBusy() {
    return (
      this.phase !== CELESTIAL_GATE_PHASES.THE_VOID &&
      this.phase !== CELESTIAL_GATE_PHASES.GUIDANCE
    );
  }

  /**
   * 啟動 CELESTIAL GATE 七階段宇宙啟示儀式
   */
  invokeOracle(oracleNumber, onRevealed, onPhaseChange) {
    if (this.isBusy()) return;

    this.isFrozenPreview = false;
    this.isRunningRitual = true;
    this.ritualTime = 0;
    this.ritualProgress = 0;
    this.sessionId++;
    this.onRevealedCallback = onRevealed;
    this.onPhaseChange = onPhaseChange;

    this.cosmosRoot.position.set(0, 0.10, 0);
    this.cosmosRoot.scale.setScalar(1.0);

    this.firedMilestones = new Set();

    ritualSound.playAncientResonance();
    ritualSound.playPortalVortex();
    this._setPhase(CELESTIAL_GATE_PHASES.AWAKENING);
  }

  /**
   * 供獨立 Prototype 測試工具直接切換並定格檢視任一動畫階段的動態品質
   */
  previewStage(stageName) {
    this.sessionId++;
    this.onRevealedCallback = null;
    this.isRunningRitual = false;
    this.isFrozenPreview = true;
    this.phase = stageName;
    this.phaseTime = 0;
    this.cosmosRoot.position.set(0, 0.10, 0);
    this.cosmosRoot.scale.setScalar(1.0);

    const presets = {
      [CELESTIAL_GATE_PHASES.THE_VOID]: {
        voidStars: 0.95, nebulaDensity: 0.32, portalOpen: 0.16, swirlSpeed: 0.16, inflow: 0.16,
        violetShift: 0.0, goldShift: 0.0,
        seedAlpha: [0.16, 0.12, 0.10], ringCoalesce: [0.0, 0.0, 0.0], orbitReveal: [0, 0, 0],
        orbitSpinMul: 0.18, constellationAlpha: 0.0, coreCharge: 0.08, riftOpen: 0.0, riftIntensity: 0.0,
        beamPower: 0.0, stardustOpacity: 0.30, stardustSwirl: 0.15, stardustAscend: 0.0, stardustExpand: 0.0
      },
      [CELESTIAL_GATE_PHASES.AWAKENING]: {
        voidStars: 1.0, nebulaDensity: 0.78, portalOpen: 0.26, swirlSpeed: 0.30, inflow: 0.42,
        violetShift: 0.05, goldShift: 0.0,
        seedAlpha: [0.68, 0.52, 0.42], ringCoalesce: [0.28, 0.16, 0.10], orbitReveal: [0, 0, 0],
        orbitSpinMul: 0.22, constellationAlpha: 0.0, coreCharge: 0.28, riftOpen: 0.0, riftIntensity: 0.0,
        beamPower: 0.0, stardustOpacity: 0.58, stardustSwirl: 0.28, stardustAscend: 0.0, stardustExpand: 0.0
      },
      [CELESTIAL_GATE_PHASES.PORTAL_OPENING]: {
        voidStars: 1.0, nebulaDensity: 0.96, portalOpen: 1.0, swirlSpeed: 0.44, inflow: 0.28,
        violetShift: 0.08, goldShift: 0.0,
        seedAlpha: [0.88, 0.72, 0.62], ringCoalesce: [0.84, 0.52, 0.38], orbitReveal: [0.42, 0.0, 0.0],
        orbitSpinMul: 0.32, constellationAlpha: 0.22, coreCharge: 0.22, riftOpen: 0.0, riftIntensity: 0.0,
        beamPower: 0.0, stardustOpacity: 0.68, stardustSwirl: 0.38, stardustAscend: 0.0, stardustExpand: 0.0
      },
      [CELESTIAL_GATE_PHASES.CELESTIAL_ALIGNMENT]: {
        voidStars: 1.0, nebulaDensity: 0.88, portalOpen: 1.0, swirlSpeed: 0.50, inflow: 0.22,
        violetShift: 0.14, goldShift: 0.12,
        seedAlpha: [0.58, 0.62, 0.58], ringCoalesce: [1.0, 1.0, 1.0], orbitReveal: [1, 1, 1],
        orbitSpinMul: 0.55, constellationAlpha: 0.82, coreCharge: 0.36, riftOpen: 0.0, riftIntensity: 0.0,
        beamPower: 0.0, stardustOpacity: 0.76, stardustSwirl: 0.45, stardustAscend: 0.0, stardustExpand: 0.0
      },
      [CELESTIAL_GATE_PHASES.ENERGY_SYNCHRONIZATION]: {
        voidStars: 1.0, nebulaDensity: 0.95, portalOpen: 0.95, swirlSpeed: 1.12, inflow: 0.65,
        violetShift: 0.46, goldShift: 0.18,
        seedAlpha: [0.75, 0.78, 0.75], ringCoalesce: [1.0, 1.0, 1.0], orbitReveal: [1, 1, 1],
        orbitSpinMul: 1.45, constellationAlpha: 1.0, coreCharge: 0.90, riftOpen: 0.28, riftIntensity: 0.32,
        beamPower: 0.12, stardustOpacity: 0.92, stardustSwirl: 1.05, stardustAscend: 0.0, stardustExpand: 0.0
      },
      [CELESTIAL_GATE_PHASES.SEAL_BREAKING]: {
        voidStars: 1.0, nebulaDensity: 0.90, portalOpen: 1.04, swirlSpeed: 1.32, inflow: -0.78,
        violetShift: 0.88, goldShift: 0.12,
        seedAlpha: [0.82, 0.85, 0.82], ringCoalesce: [1.0, 1.0, 1.0], orbitReveal: [1, 1, 1],
        orbitSpinMul: 1.25, constellationAlpha: 0.95, coreCharge: 0.32, riftOpen: 1.0, riftIntensity: 1.0,
        beamPower: 0.16, stardustOpacity: 0.98, stardustSwirl: 1.15, stardustAscend: 0.2, stardustExpand: 0.65
      },
      [CELESTIAL_GATE_PHASES.DIVINE_REVELATION]: {
        voidStars: 0.92, nebulaDensity: 0.46, portalOpen: 0.86, swirlSpeed: 0.48, inflow: -0.28,
        violetShift: 0.10, goldShift: 0.65,
        seedAlpha: [0.65, 0.68, 0.65], ringCoalesce: [1.0, 1.0, 1.0], orbitReveal: [1, 1, 1],
        orbitSpinMul: 0.52, constellationAlpha: 0.92, coreCharge: 0.36, riftOpen: 0.45, riftIntensity: 0.0,
        beamPower: 0.95, stardustOpacity: 0.95, stardustSwirl: 0.42, stardustAscend: 1.0, stardustExpand: 0.25
      }
    };

    this._applyVisualState(presets[stageName] || presets[CELESTIAL_GATE_PHASES.THE_VOID]);
    if (stageName === CELESTIAL_GATE_PHASES.SEAL_BREAKING) {
      this._spawnShockwave(6.2, 0xc084fc, 0.2);
    } else if (stageName === CELESTIAL_GATE_PHASES.DIVINE_REVELATION) {
      this._spawnShockwave(6.8, 0xfff1c9, Math.PI * 0.42);
    }
  }

  reset() {
    this.sessionId++;
    this.isFrozenPreview = false;
    this.isRunningRitual = false;
    this.ritualTime = 0;
    this.ritualProgress = 0;
    this.onRevealedCallback = null;
    this.onPhaseChange = null;
    this.phase = CELESTIAL_GATE_PHASES.THE_VOID;
    this.phaseTime = 0;

    this.cosmosRoot.position.set(0, 0.10, 0);
    this.cosmosRoot.scale.setScalar(1.0);

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      this.group.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    this.waves = [];

    this._applyVisualState({
      voidStars: 0.92,
      nebulaDensity: 0.34,
      portalOpen: 0.18,
      swirlSpeed: 0.16,
      inflow: 0.18,
      violetShift: 0.0,
      goldShift: 0.0,
      seedAlpha: [0.0, 0.0, 0.0],
      ringCoalesce: [0.0, 0.0, 0.0],
      orbitReveal: [0, 0, 0],
      orbitSpinMul: 0.18,
      constellationAlpha: 0.0,
      coreCharge: 0.08,
      riftOpen: 0.0,
      riftIntensity: 0.0,
      beamPower: 0.0,
      stardustOpacity: 0.30,
      stardustSwirl: 0.15,
      stardustAscend: 0.0,
      stardustExpand: 0.0
    });
  }

  /**
   * 全程連續不間斷的三維流體運鏡（消除階段切換時的定點停頓，始終保持輕盈宇宙漂浮感）
   */
  getCameraTarget() {
    const driftX = Math.sin(this.elapsed * 0.24) * 0.12;
    const driftY = Math.cos(this.elapsed * 0.19) * 0.07;

    if (this.isRunningRitual) {
      const u = this.ritualProgress || 0;
      // 單一連續參數曲線：緩慢推進 -> 仰視環繞星點成環 -> 貼近裂縫核心 -> 拉遠仰望貫穿天地的光柱
      const arcX = Math.sin(u * Math.PI * 1.65) * 0.32 + driftX * 0.6;
      const arcY = 0.36 + Math.sin(u * Math.PI * 0.92) * 0.52 + driftY * 0.5;
      const arcZ = 6.38 - Math.sin(u * Math.PI * 1.12) * 0.76 + Math.pow(Math.max(0, u - 0.76) / 0.24, 1.5) * 0.42;
      return {
        pos: [arcX, arcY, arcZ],
        lookAt: [0, 0.08 + Math.sin(u * Math.PI) * 0.04, 0]
      };
    }

    if (this.isFrozenPreview) {
      switch (this.phase) {
        case CELESTIAL_GATE_PHASES.PORTAL_OPENING:
          return { pos: [driftX, 0.30 + driftY, 5.75], lookAt: [0, 0.08, 0] };
        case CELESTIAL_GATE_PHASES.CELESTIAL_ALIGNMENT:
          return { pos: [0.22 + driftX, 0.84 + driftY, 6.45], lookAt: [0, 0.08, 0] };
        case CELESTIAL_GATE_PHASES.ENERGY_SYNCHRONIZATION:
          return { pos: [-0.18 + driftX, 0.64 + driftY, 5.85], lookAt: [0, 0.08, 0] };
        case CELESTIAL_GATE_PHASES.SEAL_BREAKING:
          return { pos: [driftX, 0.34 + driftY, 5.45], lookAt: [0, 0.08, 0] };
        case CELESTIAL_GATE_PHASES.DIVINE_REVELATION:
          return { pos: [driftX, 0.60 + driftY, 6.75], lookAt: [0, 0.10, 0] };
        default:
          return { pos: [driftX, 0.46 + driftY, 6.40], lookAt: [0, 0.08, 0] };
      }
    }

    if (this.phase === CELESTIAL_GATE_PHASES.GUIDANCE) {
      return { pos: [driftX * 1.1, 0.54 + driftY, 6.55], lookAt: [0, 0.08, 0] };
    }

    return { pos: [driftX, 0.48 + driftY, 6.42], lookAt: [0, 0.08, 0] };
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.05);
    const motionMul = this.reducedMotion ? 0.35 : 1.0;
    this.elapsed += safeDt * motionMul;
    this.phaseTime += safeDt;

    // 同步推進所有 Shader 時間軸（永不停止）
    if (this.voidStarUniforms) {
      this.voidStarUniforms.uTime.value = this.elapsed;
    }
    this.nebulaLayers.forEach((layer, idx) => {
      layer.uniforms.uTime.value = this.elapsed * (idx === 1 ? 1.0 : idx === 0 ? 0.78 : 1.18);
    });
    this.riftUniforms.uTime.value = this.elapsed;
    this.innerBeamUniforms.uTime.value = this.elapsed;
    this.outerBeamUniforms.uTime.value = this.elapsed;
    this.stardustUniforms.uTime.value = this.elapsed;

    // 推進 3 道三維星體軌道與其星點凝聚粒子流的持續旋轉與呼吸章動
    const spinScale = (this.currentSpinMul ?? 0.35) * motionMul;
    this.orbitTiers.forEach((tier, idx) => {
      tier.ringUniforms.uTime.value = this.elapsed;
      tier.coalesceUniforms.uTime.value = this.elapsed;
      tier.spinGroup.rotation.y += safeDt * tier.spec.speed * spinScale;
      tier.tiltGroup.rotation.x =
        tier.baseTilt.x + Math.sin(this.elapsed * 0.22 + idx * 1.3) * 0.032 * motionMul;
      tier.tiltGroup.rotation.z =
        tier.baseTilt.z + Math.cos(this.elapsed * 0.18 + idx * 0.9) * 0.026 * motionMul;
    });

    // 星座群組持續緩慢公轉漂浮
    if (this.constellationGroup) {
      this.constellationGroup.rotation.y += safeDt * 0.025 * spinScale;
    }

    // 更新擴散能量波環
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
        w.mesh.scale.setScalar(1 + ease * w.maxScale);
        w.mesh.material.opacity = (1 - p) * (1 - p) * 0.65;
      }
    }

    // 若為獨立 Prototype 靜態階段檢視模式，保持該階段動態循環而不自動跳轉
    if (this.isFrozenPreview) return;

    /* ========================================================================
     * 單一連續不間斷宇宙演化時間軸 (Continuous Overlapping Master Timeline)
     * 徹底消除分段停頓與 2-3 重複感：所有視覺層沿 u ∈ [0, 1] 交疊無縫流轉
     * ======================================================================== */

    // 待機狀態 THE_VOID — 星空、微霧與散落星點持續緩慢旋浮
    if (this.phase === CELESTIAL_GATE_PHASES.THE_VOID && !this.isRunningRitual) {
      const breath = 0.5 + 0.5 * Math.sin(this.elapsed * 0.55);
      this._applyVisualState({
        voidStars: 0.92,
        nebulaDensity: 0.30 + breath * 0.07,
        portalOpen: 0.15 + breath * 0.03,
        swirlSpeed: 0.18,
        inflow: 0.18,
        violetShift: 0.0,
        goldShift: 0.0,
        seedAlpha: [0.18 + breath * 0.06, 0.14 + breath * 0.05, 0.12 + breath * 0.04],
        ringCoalesce: [0.0, 0.0, 0.0],
        orbitReveal: [0, 0, 0],
        orbitSpinMul: 0.24,
        constellationAlpha: 0.0,
        coreCharge: 0.06 + breath * 0.04,
        riftOpen: 0.0,
        riftIntensity: 0.0,
        beamPower: 0.0,
        stardustOpacity: 0.30,
        stardustSwirl: 0.18,
        stardustAscend: 0.0,
        stardustExpand: 0.0
      });
      return;
    }

    // 啟動後一氣呵成的連續動畫（總長 13.2 秒，零中間停頓節點）
    if (this.isRunningRitual) {
      const totalDur = this.reducedMotion ? 4.4 : 13.2;
      this.ritualTime = (this.ritualTime || 0) + safeDt;
      const u = Math.min(1.0, this.ritualTime / totalDur);
      this.ritualProgress = u;

      const ramp = (a, b) => THREE.MathUtils.clamp((u - a) / Math.max(0.0001, b - a), 0, 1);
      const softRamp = (a, b) => THREE.MathUtils.smoothstep(u, a, b);

      // 依連續進度 u 同步更新 UI 階段標題（不重置動畫曲線、不踩煞車）
      let targetPhase = CELESTIAL_GATE_PHASES.AWAKENING;
      if (u >= 0.85) targetPhase = CELESTIAL_GATE_PHASES.DIVINE_REVELATION;
      else if (u >= 0.72) targetPhase = CELESTIAL_GATE_PHASES.SEAL_BREAKING;
      else if (u >= 0.55) targetPhase = CELESTIAL_GATE_PHASES.ENERGY_SYNCHRONIZATION;
      else if (u >= 0.28) targetPhase = CELESTIAL_GATE_PHASES.CELESTIAL_ALIGNMENT;
      else if (u >= 0.13) targetPhase = CELESTIAL_GATE_PHASES.PORTAL_OPENING;

      if (targetPhase !== this.phase) {
        this._setPhase(targetPhase);
      }

      // 關鍵時間點音效與波紋觸發（只觸發一次，不影響連續速度）
      const triggerOnce = (key, fn) => {
        if (!this.firedMilestones.has(key)) {
          this.firedMilestones.add(key);
          fn();
        }
      };
      if (u >= 0.20) triggerOnce('ring0', () => ritualSound.playRuneIgnite(0));
      if (u >= 0.34) triggerOnce('ring1', () => ritualSound.playRuneIgnite(3));
      if (u >= 0.46) triggerOnce('ring2', () => ritualSound.playRuneIgnite(6));
      if (u >= 0.56) triggerOnce('syncHum', () => ritualSound.playMagicHum());
      if (u >= 0.72) {
        triggerOnce('sealBreak', () => {
          ritualSound.playSealBreakRift();
          this._spawnShockwave(6.2, 0xc084fc, 0.18);
          this._spawnShockwave(4.5, 0x7ae4ff, -0.15);
          if (typeof this.onImpactCallback === 'function') this.onImpactCallback(0.038);
        });
      }
      if (u >= 0.85) {
        triggerOnce('beamRise', () => {
          ritualSound.playCelestialBeam();
          ritualSound.playChime('sacred');
          this._spawnShockwave(6.4, 0xfff3d1, Math.PI * 0.45);
          if (typeof this.onImpactCallback === 'function') this.onImpactCallback(0.028);
        });
      }

      // 1. 煙霧與中央時空入口：從 u=0.00 到 u=0.30 一氣呵成同步甦醒並張開，消除 2-3 重複感
      const openCurve = Math.pow(ramp(0.0, 0.32), 0.85);
      const portalOpen = THREE.MathUtils.lerp(0.16, 1.0, openCurve)
                       + Math.sin(ramp(0.70, 0.86) * Math.PI) * 0.06
                       - softRamp(0.86, 1.0) * 0.12;

      const nebulaDensity = 0.32
                          + softRamp(0.0, 0.26) * 0.64
                          - softRamp(0.76, 1.0) * 0.48;

      // 渦旋速度與軌道自轉全程連續平滑推進，絕不在階段交界減速停頓
      const swirlSpeed = 0.20
                       + ramp(0.0, 0.55) * 0.48
                       + softRamp(0.50, 0.76) * 0.68
                       - softRamp(0.78, 1.0) * 0.98;

      const inflow = THREE.MathUtils.lerp(0.32, 0.68, softRamp(0.45, 0.70))
                   - softRamp(0.70, 0.80) * 1.45
                   + softRamp(0.82, 1.0) * 0.62;

      // 2. 周圍星辰光點與 3 道光環：在煙霧張開的同時（u=0.04 起）就持續向內旋聚並接力成環，零等待！
      const c0 = softRamp(0.04, 0.30);
      const c1 = softRamp(0.12, 0.44);
      const c2 = softRamp(0.20, 0.55);

      const r0 = softRamp(0.16, 0.36);
      const r1 = softRamp(0.26, 0.48);
      const r2 = softRamp(0.34, 0.58);

      const s0 = THREE.MathUtils.lerp(0.20, 0.92, softRamp(0.0, 0.20)) - r0 * 0.30;
      const s1 = THREE.MathUtils.lerp(0.15, 0.88, softRamp(0.04, 0.28)) - r1 * 0.26;
      const s2 = THREE.MathUtils.lerp(0.12, 0.85, softRamp(0.08, 0.36)) - r2 * 0.25;

      const constellationAlpha = softRamp(0.22, 0.56) * (1.0 - softRamp(0.88, 1.0) * 0.22);

      // 3 道光環自轉倍率：全程單一連續流暢曲線（0.28 -> 1.55 -> 0.36）
      const orbitSpinMul = 0.28
                         + ramp(0.0, 0.55) * 0.52
                         + softRamp(0.50, 0.75) * 0.75
                         - softRamp(0.76, 1.0) * 1.18;

      // 3. 能量匯聚、紫藍破封裂縫與中央垂直天體光柱：交疊銜接一氣呵成
      const violetShift = softRamp(0.46, 0.76) * 0.90 - softRamp(0.78, 0.96) * 0.76;
      const goldShift = softRamp(0.35, 0.65) * 0.16 + softRamp(0.78, 1.0) * 0.30;

      const coreCharge = 0.12
                       + softRamp(0.0, 0.25) * 0.16
                       + softRamp(0.48, 0.72) * 0.64
                       - softRamp(0.72, 0.84) * 0.58;

      const riftOpen = softRamp(0.64, 0.80) * 1.06 - softRamp(0.84, 1.0) * 0.55;
      const riftIntensity = softRamp(0.66, 0.77) * (1.0 - softRamp(0.81, 0.94));

      const beamPower = softRamp(0.74, 0.91) * 0.95 - softRamp(0.92, 1.0) * 0.36;

      const stardustOpacity = THREE.MathUtils.lerp(0.32, 0.96, softRamp(0.0, 0.68)) - softRamp(0.88, 1.0) * 0.20;
      const stardustSwirl = 0.22 + ramp(0.0, 0.72) * 0.92 - softRamp(0.75, 1.0) * 0.86;
      const stardustAscend = softRamp(0.76, 0.98) * 0.92;
      const stardustExpand = Math.sin(ramp(0.71, 0.95) * Math.PI) * 0.62;

      // 尾段 (u: 0.88 -> 1.0) 同步將整個宇宙場景柔和推向遠景，無縫銜接 GUIDANCE 卡片浮現
      const settle = softRamp(0.88, 1.0);
      this.cosmosRoot.position.y = THREE.MathUtils.lerp(0.10, 0.16, settle);
      this.cosmosRoot.position.z = THREE.MathUtils.lerp(0.0, -1.12, settle);
      this.cosmosRoot.scale.setScalar(THREE.MathUtils.lerp(1.0, 0.88, settle));

      this._applyVisualState({
        voidStars: THREE.MathUtils.lerp(0.95, 0.90, settle),
        nebulaDensity,
        portalOpen,
        swirlSpeed,
        inflow,
        violetShift: Math.max(0, violetShift),
        goldShift,
        seedAlpha: [s0, s1, s2],
        ringCoalesce: [c0, c1, c2],
        orbitReveal: [r0, r1, r2],
        orbitSpinMul: Math.max(0.24, orbitSpinMul),
        constellationAlpha,
        coreCharge: Math.max(0.10, coreCharge),
        riftOpen: Math.max(0, riftOpen),
        riftIntensity: Math.max(0, riftIntensity),
        beamPower: Math.max(0, beamPower),
        stardustOpacity,
        stardustSwirl: Math.max(0.18, stardustSwirl),
        stardustAscend,
        stardustExpand
      });

      if (u >= 1.0) {
        this.isRunningRitual = false;
        this._setPhase(CELESTIAL_GATE_PHASES.GUIDANCE);
        if (typeof this.onRevealedCallback === 'function') {
          const cb = this.onRevealedCallback;
          this.onRevealedCallback = null;
          cb();
        }
      }
      return;
    }

    // Stage 7: GUIDANCE — 維持持續流動的宇宙星海、星霧、三道旋轉星軌與中央光柱，襯托星穹啟示卡
    if (this.phase === CELESTIAL_GATE_PHASES.GUIDANCE) {
      const breath = 0.5 + 0.5 * Math.sin(this.elapsed * 0.65);
      this.cosmosRoot.position.y = THREE.MathUtils.lerp(this.cosmosRoot.position.y, 0.16, safeDt * 2.2);
      this.cosmosRoot.position.z = THREE.MathUtils.lerp(this.cosmosRoot.position.z, -1.12, safeDt * 2.2);
      const s = THREE.MathUtils.lerp(this.cosmosRoot.scale.x, 0.88, safeDt * 2.2);
      this.cosmosRoot.scale.setScalar(s);

      this._applyVisualState({
        voidStars: 0.90,
        nebulaDensity: 0.46 + breath * 0.06,
        portalOpen: 0.86,
        swirlSpeed: 0.30,
        inflow: -0.10,
        violetShift: 0.14,
        goldShift: 0.46,
        seedAlpha: [0.56, 0.60, 0.56],
        ringCoalesce: [1, 1, 1],
        orbitReveal: [0.82, 0.86, 0.80],
        orbitSpinMul: 0.36,
        constellationAlpha: 0.76,
        coreCharge: 0.28,
        riftOpen: 0.0,
        riftIntensity: 0.0,
        beamPower: 0.56 + breath * 0.08,
        stardustOpacity: 0.76,
        stardustSwirl: 0.26,
        stardustAscend: 0.90,
        stardustExpand: 0.06
      });
    }
  }
}
