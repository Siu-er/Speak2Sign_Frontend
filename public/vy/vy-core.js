// Shared runtime for the app's VRM characters: loading, a keyframed motion
// library on the normalised humanoid rig, and the idle "life" layer.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";

export async function loadVrm(renderer, url) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const vrm = (await loader.loadAsync(url)).userData.vrm;
  if (!vrm) throw new Error(`${url} is not a VRM`);
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  VRMUtils.rotateVRM0(vrm);

  // VRoid exports its texture samplers without mipmapping, so 2048 px textures
  // drawn into a small box alias into sparkle. Mipmaps plus anisotropic
  // filtering fix the minification; alpha-to-coverage antialiases the edges
  // of alpha-tested hair and clothing through the renderer's MSAA.
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  vrm.scene.traverse((obj) => {
    obj.frustumCulled = false;
    for (const mat of [].concat(obj.material || [])) {
      for (const value of Object.values(mat)) {
        if (value && value.isTexture) {
          value.generateMipmaps = true;
          value.minFilter = THREE.LinearMipmapLinearFilter;
          value.anisotropy = maxAniso;
          value.needsUpdate = true;
        }
      }
      if (mat.alphaTest > 0) mat.alphaToCoverage = true;
      mat.needsUpdate = true;
    }
  });
  return vrm;
}

// ---------- poses ----------
// A pose maps humanoid bone names to Euler angles in degrees on the
// normalised rig, whose rest pose is the T-pose with every bone at identity.
// The character faces +Z: a negative X angle swings a limb forward, the left
// arm points along +X and is lowered by a negative Z angle.
const ORDER = { leftLowerArm: "ZYX", rightLowerArm: "ZYX" };

const FINGERS = ["Index", "Middle", "Ring", "Little"];
const SEGMENTS = ["Proximal", "Intermediate", "Distal"];

function curl(side, amount, thumb = amount * 0.6) {
  const sign = side === "left" ? 1 : -1;
  const pose = {};
  FINGERS.forEach((f, i) => {
    SEGMENTS.forEach((seg, j) => {
      pose[`${side}${f}${seg}`] = [0, 0, sign * -amount * (j === 0 ? 0.8 : 1) * (1 + i * 0.08)];
    });
  });
  pose[`${side}ThumbProximal`] = [0, sign * -thumb * 0.6, 0];
  pose[`${side}ThumbDistal`] = [0, sign * -thumb, 0];
  return pose;
}

function point(side) {
  const pose = curl(side, 80, 35);
  for (const seg of SEGMENTS) pose[`${side}Index${seg}`] = [0, 0, 0];
  return pose;
}

function peace(side) {
  const pose = curl(side, 85, 45);
  for (const seg of SEGMENTS) {
    pose[`${side}Index${seg}`] = [0, side === "left" ? -6 : 6, 0];
    pose[`${side}Middle${seg}`] = [0, side === "left" ? 6 : -6, 0];
  }
  return pose;
}

const RELAXED_HANDS = { ...curl("left", 18, 10), ...curl("right", 18, 10) };

export const STAND = {
  leftUpperArm: [0, 0, -72], rightUpperArm: [0, 0, 72],
  leftLowerArm: [0, -12, 0], rightLowerArm: [0, 12, 0],
  leftHand: [0, 0, 4], rightHand: [0, 0, -4],
  leftShoulder: [0, 0, -2], rightShoulder: [0, 0, 2],
  ...RELAXED_HANDS,
};

const with_ = (...parts) => Object.assign({}, STAND, ...parts);

// ---------- clips ----------
// Keys: { t (seconds), pose, hips: [x, y, z] metres, face: { expression: weight } }.
export const CLIPS = {
  idle: {
    loop: true,
    keys: [
      { t: 0, pose: with_({ spine: [0, 0, 0], head: [0, 0, 0] }) },
      { t: 2.2, pose: with_({ spine: [0, 2, 1.5], head: [2, -3, -2] }) },
      { t: 4.4, pose: with_({ spine: [0, 0, 0], head: [0, 0, 0] }) },
    ],
  },
  wave: {
    loop: true,
    keys: [0, 0.32, 0.64].map((t, i) => ({
      t,
      pose: with_({
        rightUpperArm: [-12, 0, -32], rightLowerArm: [80, 0, -62 + (i === 1 ? -22 : 0)],
        rightHand: [0, 0, i === 1 ? 8 : -12],
        head: [0, 6, i === 1 ? 5 : 2], spine: [0, 0, -2],
        ...curl("right", 6, 4),
      }),
      face: { happy: 0.8 },
    })),
  },
  hello: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.35, pose: with_({ rightUpperArm: [-12, 0, -32], rightLowerArm: [80, 0, -66], rightHand: [0, 0, -10], head: [0, 8, 4], ...curl("right", 6, 4) }), face: { happy: 1 } },
      { t: 0.65, pose: with_({ rightUpperArm: [-12, 0, -32], rightLowerArm: [80, 0, -86], rightHand: [0, 0, 10], head: [0, 8, 6], ...curl("right", 6, 4) }), face: { happy: 1 } },
      { t: 0.95, pose: with_({ rightUpperArm: [-12, 0, -32], rightLowerArm: [80, 0, -64], rightHand: [0, 0, -10], head: [0, 8, 4], ...curl("right", 6, 4) }), face: { happy: 1 } },
      { t: 1.25, pose: with_({ rightUpperArm: [-12, 0, -32], rightLowerArm: [80, 0, -86], rightHand: [0, 0, 10], head: [0, 8, 6], ...curl("right", 6, 4) }), face: { happy: 1 } },
      { t: 1.8, pose: with_(), face: { happy: 0.4 } },
    ],
  },
  jump: {
    keys: [
      { t: 0, pose: with_(), hips: [0, 0, 0] },
      { t: 0.22, pose: with_({ spine: [14, 0, 0], leftUpperLeg: [-38, 0, 0], rightUpperLeg: [-38, 0, 0], leftLowerLeg: [70, 0, 0], rightLowerLeg: [70, 0, 0], leftFoot: [-30, 0, 0], rightFoot: [-30, 0, 0], leftUpperArm: [30, 0, -62], rightUpperArm: [30, 0, 62] }), hips: [0, -0.12, 0] },
      { t: 0.45, pose: with_({ spine: [-6, 0, 0], head: [-8, 0, 0], leftUpperArm: [0, 0, 40], rightUpperArm: [0, 0, -40], leftLowerArm: [0, -10, 0], rightLowerArm: [0, 10, 0], leftLowerLeg: [24, 0, 0], rightLowerLeg: [24, 0, 0], leftFoot: [20, 0, 0], rightFoot: [20, 0, 0], ...curl("left", 4), ...curl("right", 4) }), hips: [0, 0.32, 0], face: { happy: 1 } },
      { t: 0.68, pose: with_({ leftUpperArm: [0, 0, 30], rightUpperArm: [0, 0, -30], leftLowerLeg: [36, 0, 0], rightLowerLeg: [36, 0, 0], leftUpperLeg: [-20, 0, 0], rightUpperLeg: [-20, 0, 0] }), hips: [0, 0.18, 0], face: { happy: 1 } },
      { t: 0.86, pose: with_({ spine: [12, 0, 0], leftUpperLeg: [-34, 0, 0], rightUpperLeg: [-34, 0, 0], leftLowerLeg: [62, 0, 0], rightLowerLeg: [62, 0, 0], leftFoot: [-28, 0, 0], rightFoot: [-28, 0, 0] }), hips: [0, -0.1, 0], face: { happy: 0.8 } },
      { t: 1.25, pose: with_(), hips: [0, 0, 0], face: { happy: 0.5 } },
    ],
  },
  walk: {
    loop: true,
    keys: [0, 1, 2, 3].map((k) => {
      const phase = k % 2 === 0 ? 1 : 0;
      const s = k < 2 ? 1 : -1;
      const contact = phase === 1;
      return {
        t: k * 0.24,
        pose: with_({
          leftUpperLeg: [contact ? -26 * s : -4 * s, 0, 0],
          rightUpperLeg: [contact ? 26 * s : 4 * s, 0, 0],
          leftLowerLeg: [contact ? (s > 0 ? 6 : 34) : (s > 0 ? 40 : 10), 0, 0],
          rightLowerLeg: [contact ? (s > 0 ? 34 : 6) : (s > 0 ? 10 : 40), 0, 0],
          leftUpperArm: [contact ? 20 * s : 6 * s, 0, -74],
          rightUpperArm: [contact ? -20 * s : -6 * s, 0, 74],
          leftLowerArm: [0, -20, 0], rightLowerArm: [0, 20, 0],
          hips: [0, contact ? 6 * s : 0, 0],
          spine: [4, contact ? -5 * s : 0, 0],
          head: [-2, contact ? 4 * s : 0, 0],
        }),
        hips: [0, contact ? -0.02 : 0.012, 0],
      };
    }),
  },
  pointLeft: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.35, pose: with_({ leftUpperArm: [-30, -10, -8], leftLowerArm: [0, -14, 0], leftHand: [0, 0, 6], spine: [0, 10, 3], head: [0, 22, 4], ...point("left") }), face: { happy: 0.7 } },
      { t: 1.6, pose: with_({ leftUpperArm: [-30, -10, -4], leftLowerArm: [0, -10, 0], leftHand: [0, 0, 2], spine: [0, 12, 3], head: [0, 26, 6], ...point("left") }), face: { happy: 0.8 } },
    ],
    hold: true,
  },
  pointRight: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.35, pose: with_({ rightUpperArm: [-30, 10, 8], rightLowerArm: [0, 14, 0], rightHand: [0, 0, -6], spine: [0, -10, -3], head: [0, -22, -4], ...point("right") }), face: { happy: 0.7 } },
      { t: 1.6, pose: with_({ rightUpperArm: [-30, 10, 4], rightLowerArm: [0, 10, 0], rightHand: [0, 0, -2], spine: [0, -12, -3], head: [0, -26, -6], ...point("right") }), face: { happy: 0.8 } },
    ],
    hold: true,
  },
  pointUp: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.4, pose: with_({ rightUpperArm: [-20, 0, -58], rightLowerArm: [0, 30, -10], spine: [-4, -4, -4], head: [-14, -8, 0], ...point("right") }), face: { surprised: 0.4, happy: 0.5 } },
      { t: 1.6, pose: with_({ rightUpperArm: [-20, 0, -62], rightLowerArm: [0, 26, -10], spine: [-5, -4, -4], head: [-16, -10, 0], ...point("right") }), face: { surprised: 0.3, happy: 0.6 } },
    ],
    hold: true,
  },
  peace: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.3, pose: with_({ rightUpperArm: [-40, 0, 10], rightLowerArm: [0, 120, 0], rightHand: [0, -20, 0], head: [0, -6, 10], spine: [0, -6, -4], ...peace("right") }), face: { happy: 1 } },
      { t: 1.8, pose: with_({ rightUpperArm: [-40, 0, 12], rightLowerArm: [0, 124, 0], rightHand: [0, -20, 0], head: [0, -8, 12], spine: [0, -6, -5], ...peace("right") }), face: { happy: 1 } },
    ],
    hold: true,
  },
  cheer: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.25, pose: with_({ leftUpperArm: [0, 0, 30], rightUpperArm: [0, 0, -30], leftLowerArm: [0, -30, 30], rightLowerArm: [0, 30, -30], ...curl("left", 90, 60), ...curl("right", 90, 60), head: [-8, 0, 0] }), hips: [0, 0.06, 0], face: { happy: 1 } },
      { t: 0.5, pose: with_({ leftUpperArm: [0, 0, 42], rightUpperArm: [0, 0, -42], leftLowerArm: [0, -20, 10], rightLowerArm: [0, 20, -10], ...curl("left", 90, 60), ...curl("right", 90, 60), head: [-12, 0, 0] }), hips: [0, 0, 0], face: { happy: 1 } },
      { t: 0.75, pose: with_({ leftUpperArm: [0, 0, 30], rightUpperArm: [0, 0, -30], leftLowerArm: [0, -30, 30], rightLowerArm: [0, 30, -30], ...curl("left", 90, 60), ...curl("right", 90, 60), head: [-8, 0, 0] }), hips: [0, 0.06, 0], face: { happy: 1 } },
      { t: 1.2, pose: with_(), face: { happy: 0.6 } },
    ],
  },
  think: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.45, pose: with_({ rightUpperArm: [-30, 0, 50], rightLowerArm: [0, 130, 0], rightHand: [-20, 0, 0], leftUpperArm: [-20, 0, -64], leftLowerArm: [0, -80, 0], head: [6, -10, -10], spine: [0, 0, -3], ...curl("right", 60, 20) }), face: { relaxed: 0.3 } },
      { t: 2, pose: with_({ rightUpperArm: [-30, 0, 52], rightLowerArm: [0, 132, 0], rightHand: [-20, 0, 0], leftUpperArm: [-20, 0, -64], leftLowerArm: [0, -80, 0], head: [8, -14, -12], spine: [0, 0, -4], ...curl("right", 60, 20) }), face: { relaxed: 0.3 } },
    ],
    hold: true,
  },
  bow: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.5, pose: with_({ spine: [24, 0, 0], chest: [8, 0, 0], head: [10, 0, 0], leftUpperArm: [-10, 0, -78], rightUpperArm: [-10, 0, 78] }), face: { happy: 0.7 } },
      { t: 1.1, pose: with_({ spine: [24, 0, 0], chest: [8, 0, 0], head: [10, 0, 0], leftUpperArm: [-10, 0, -78], rightUpperArm: [-10, 0, 78] }), face: { happy: 0.7 } },
      { t: 1.6, pose: with_(), face: { happy: 0.6 } },
    ],
  },
  surprised: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.18, pose: with_({ spine: [-8, 0, 0], head: [-10, 0, 0], leftUpperArm: [-20, 0, -40], rightUpperArm: [-20, 0, 40], leftLowerArm: [0, -70, 0], rightLowerArm: [0, 70, 0], ...curl("left", 4), ...curl("right", 4) }), hips: [0, 0.04, 0], face: { surprised: 1 } },
      { t: 1.2, pose: with_({ spine: [-4, 0, 0], head: [-6, 0, 0], leftUpperArm: [-20, 0, -48], rightUpperArm: [-20, 0, 48], leftLowerArm: [0, -64, 0], rightLowerArm: [0, 64, 0] }), face: { surprised: 0.8 } },
    ],
    hold: true,
  },
  giggle: {
    keys: [
      { t: 0, pose: with_() },
      { t: 0.3, pose: with_({ rightUpperArm: [-46, 0, 54], rightLowerArm: [0, 128, 0], rightHand: [-10, 0, 0], spine: [6, 0, 4], head: [8, 6, 8], ...curl("right", 40, 20) }), face: { happy: 1 } },
      { t: 0.5, pose: with_({ rightUpperArm: [-46, 0, 54], rightLowerArm: [0, 128, 0], rightHand: [-10, 0, 0], spine: [8, 0, 2], head: [10, 4, 4], ...curl("right", 40, 20) }), hips: [0, -0.01, 0], face: { happy: 1 } },
      { t: 0.7, pose: with_({ rightUpperArm: [-46, 0, 54], rightLowerArm: [0, 128, 0], rightHand: [-10, 0, 0], spine: [6, 0, 4], head: [8, 6, 8], ...curl("right", 40, 20) }), face: { happy: 1 } },
      { t: 0.9, pose: with_({ rightUpperArm: [-46, 0, 54], rightLowerArm: [0, 128, 0], rightHand: [-10, 0, 0], spine: [8, 0, 2], head: [10, 4, 4], ...curl("right", 40, 20) }), hips: [0, -0.01, 0], face: { happy: 1 } },
      { t: 1.4, pose: with_(), face: { happy: 0.5 } },
    ],
  },
  spin: {
    keys: [
      { t: 0, pose: with_(), turn: 0 },
      { t: 0.2, pose: with_({ leftUpperArm: [0, 0, -40], rightUpperArm: [0, 0, 40] }), turn: 40, hips: [0, 0.04, 0], face: { happy: 1 } },
      { t: 0.7, pose: with_({ leftUpperArm: [0, 0, -30], rightUpperArm: [0, 0, 30] }), turn: 320, hips: [0, 0.04, 0], face: { happy: 1 } },
      { t: 1.0, pose: with_(), turn: 360, hips: [0, 0, 0], face: { happy: 0.8 } },
    ],
  },
};

// ---------- sampling ----------
const toRad = THREE.MathUtils.degToRad;

function catmull(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

export function clipDuration(clip) {
  return clip.keys[clip.keys.length - 1].t;
}

function channel(key, kind, name, size) {
  if (kind === "pose") return key.pose[name] ?? STAND[name] ?? [0, 0, 0];
  if (kind === "hips") return key.hips ?? [0, 0, 0];
  if (kind === "turn") return [key.turn ?? 0];
  if (kind === "face") return [key.face?.[name] ?? 0];
  return new Array(size).fill(0);
}

function sampleChannel(clip, time, kind, name) {
  const keys = clip.keys;
  const span = clipDuration(clip);
  const t = clip.loop ? ((time % span) + span) % span : Math.min(time, span);
  let i = keys.length - 2;
  for (let k = 0; k < keys.length - 1; k++) {
    if (t <= keys[k + 1].t) { i = k; break; }
  }
  const at = (k) => {
    if (clip.loop) return channel(keys[(k + keys.length - 1) % (keys.length - 1)], kind, name);
    return channel(keys[THREE.MathUtils.clamp(k, 0, keys.length - 1)], kind, name);
  };
  const a = keys[i], b = keys[i + 1];
  const u = THREE.MathUtils.clamp((t - a.t) / Math.max(b.t - a.t, 1e-6), 0, 1);
  const p0 = at(i - 1), p1 = channel(a, kind, name), p2 = channel(b, kind, name), p3 = at(i + 2);
  return p1.map((_, c) => catmull(p0[c], p1[c], p2[c], p3[c], u));
}

function boneNames(clip) {
  const names = new Set(Object.keys(STAND));
  for (const k of clip.keys) for (const n of Object.keys(k.pose)) names.add(n);
  return [...names];
}

function faceNames(clip) {
  const names = new Set();
  for (const k of clip.keys) for (const n of Object.keys(k.face ?? {})) names.add(n);
  return [...names];
}

// Samples a clip into bone quaternions, a hips offset, a turn angle and expression weights.
export function sampleClip(clip, time) {
  const bones = {};
  for (const name of boneNames(clip)) {
    const [x, y, z] = sampleChannel(clip, time, "pose", name);
    bones[name] = new THREE.Quaternion().setFromEuler(new THREE.Euler(toRad(x), toRad(y), toRad(z), ORDER[name] ?? "XYZ"));
  }
  const face = {};
  for (const name of faceNames(clip)) face[name] = THREE.MathUtils.clamp(sampleChannel(clip, time, "face", name)[0], 0, 1);
  return {
    bones,
    hips: new THREE.Vector3(...sampleChannel(clip, time, "hips")),
    turn: toRad(sampleChannel(clip, time, "turn")[0]),
    face,
  };
}

function blendSamples(a, b, w) {
  const bones = {};
  for (const name of new Set([...Object.keys(a.bones), ...Object.keys(b.bones)])) {
    const qa = a.bones[name] ?? new THREE.Quaternion();
    const qb = b.bones[name] ?? new THREE.Quaternion();
    bones[name] = qa.clone().slerp(qb, w);
  }
  const face = {};
  for (const name of new Set([...Object.keys(a.face), ...Object.keys(b.face)])) {
    face[name] = (a.face[name] ?? 0) * (1 - w) + (b.face[name] ?? 0) * w;
  }
  return { bones, hips: a.hips.clone().lerp(b.hips, w), turn: a.turn + (b.turn - a.turn) * w, face };
}

const smooth = (x) => x * x * (3 - 2 * x);

// Plays clips with crossfades. A one-shot clip returns to `fallback` when it
// ends unless it holds its last pose.
export class MotionPlayer {
  constructor(fallback = "idle") {
    this.fallback = fallback;
    this.current = { name: fallback, start: 0 };
    this.previous = null;
    this.fadeStart = 0;
    this.fade = 0.3;
    this.listeners = new Set();
  }

  play(name, now, { fade = 0.3 } = {}) {
    if (!CLIPS[name]) throw new Error(`Unknown clip ${name}`);
    this.previous = { ...this.current, frozen: now };
    this.current = { name, start: now };
    this.fadeStart = now;
    this.fade = fade;
  }

  onFinish(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  sample(now) {
    const clip = CLIPS[this.current.name];
    const elapsed = now - this.current.start;
    if (!clip.loop && !clip.hold && elapsed >= clipDuration(clip)) {
      const finished = this.current.name;
      this.play(this.fallback, now, { fade: 0.35 });
      for (const l of this.listeners) l(finished);
    }
    const cur = sampleClip(CLIPS[this.current.name], now - this.current.start);
    if (!this.previous) return cur;
    const w = smooth(THREE.MathUtils.clamp((now - this.fadeStart) / this.fade, 0, 1));
    if (w >= 1) { this.previous = null; return cur; }
    const prevClip = CLIPS[this.previous.name];
    const prev = sampleClip(prevClip, Math.min(this.previous.frozen, now) - this.previous.start);
    return blendSamples(prev, cur, w);
  }
}

// Poses are authored in VRM 1.0 axes. A VRM 0.x normalised rig faces -Z with
// its left side on -X, a half turn about Y, so each rotation and offset is
// conjugated by that half turn: x and z components change sign.
const isVrm0 = (vrm) => vrm.meta?.metaVersion === "0";

// Applies a sampled pose to the normalised rig.
export function applySample(vrm, sample, hipsRest) {
  const H = vrm.humanoid;
  const flip = isVrm0(vrm);
  for (const name of Object.keys(H.humanBones)) {
    const node = H.getNormalizedBoneNode(name);
    if (!node) continue;
    const q = sample.bones[name] ?? new THREE.Quaternion();
    node.quaternion.set(flip ? -q.x : q.x, q.y, flip ? -q.z : q.z, q.w);
  }
  const hips = H.getNormalizedBoneNode("hips");
  const offset = sample.hips.clone();
  if (flip) offset.set(-offset.x, offset.y, -offset.z);
  hips.position.copy(hipsRest).add(offset);
  const em = vrm.expressionManager;
  if (em) for (const [name, weight] of Object.entries(sample.face)) em.setValue(name, weight);
}

// Breathing, a faint sway and natural blinking layered on any clip.
export class Life {
  constructor() {
    this.nextBlink = 2.5;
  }

  apply(vrm, t) {
    const H = vrm.humanoid;
    const breath = Math.sin(t * 2 * Math.PI * 0.23);
    const chest = H.getNormalizedBoneNode("upperChest") ?? H.getNormalizedBoneNode("chest");
    chest.rotateX(toRad(-1.1 * breath));
    for (const [side, sign] of [["left", -1], ["right", 1]]) {
      H.getNormalizedBoneNode(`${side}Shoulder`)?.rotateZ(toRad(sign * 0.8 * breath));
    }
    H.getNormalizedBoneNode("spine").rotateZ(toRad(0.6 * Math.sin(t * 2 * Math.PI * 0.11)));
    vrm.expressionManager?.setValue("blink", this.blink(t));
  }

  blink(t) {
    const since = t - this.nextBlink;
    if (since < 0) return 0;
    if (since > 0.16) {
      this.nextBlink = t + 2.4 + Math.random() * 3.6;
      return 0;
    }
    return Math.sin((since / 0.16) * Math.PI);
  }
}
