// Bakes Mixamo FBX animations into humanoid clips for the VRM characters.
//
//   node scripts/bake-mixamo.mjs <fbx dir> [out dir]
//
// Reads scripts/mixamo-motions.json, loads <fbx dir>/<name>.fbx for every entry
// and writes public/vy/motions/<name>.json plus index.json. Each clip holds, per
// frame, a local rotation for every VRM humanoid bone on the normalised rig
// (VRM 1.0 axes, rest pose = identity) and the hips position in units of the
// rest hip height, so one clip fits every character whatever its size. An
// entry's optional "face" holds expression weights shown while the clip plays.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const FPS = 30;
const QUAT_DIGITS = 3;
const HIPS_DIGITS = 4;

const MIXAMO_TO_VRM = {
  Hips: "hips", Spine: "spine", Spine1: "chest", Spine2: "upperChest", Neck: "neck", Head: "head",
  LeftShoulder: "leftShoulder", LeftArm: "leftUpperArm", LeftForeArm: "leftLowerArm", LeftHand: "leftHand",
  RightShoulder: "rightShoulder", RightArm: "rightUpperArm", RightForeArm: "rightLowerArm", RightHand: "rightHand",
  LeftUpLeg: "leftUpperLeg", LeftLeg: "leftLowerLeg", LeftFoot: "leftFoot", LeftToeBase: "leftToes",
  RightUpLeg: "rightUpperLeg", RightLeg: "rightLowerLeg", RightFoot: "rightFoot", RightToeBase: "rightToes",
};
for (const side of ["Left", "Right"]) {
  const vside = side.toLowerCase();
  MIXAMO_TO_VRM[`${side}HandThumb1`] = `${vside}ThumbMetacarpal`;
  MIXAMO_TO_VRM[`${side}HandThumb2`] = `${vside}ThumbProximal`;
  MIXAMO_TO_VRM[`${side}HandThumb3`] = `${vside}ThumbDistal`;
  for (const [mx, vrm] of [["Index", "Index"], ["Middle", "Middle"], ["Ring", "Ring"], ["Pinky", "Little"]]) {
    MIXAMO_TO_VRM[`${side}Hand${mx}1`] = `${vside}${vrm}Proximal`;
    MIXAMO_TO_VRM[`${side}Hand${mx}2`] = `${vside}${vrm}Intermediate`;
    MIXAMO_TO_VRM[`${side}Hand${mx}3`] = `${vside}${vrm}Distal`;
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [fbxDir, outArg] = process.argv.slice(2);
if (!fbxDir) throw new Error("usage: node scripts/bake-mixamo.mjs <fbx dir> [out dir]");
const outDir = outArg ?? path.join(root, "public", "vy", "motions");
const motions = JSON.parse(fs.readFileSync(path.join(root, "scripts", "mixamo-motions.json"), "utf8"));
fs.mkdirSync(outDir, { recursive: true });

const round = (v, digits) => Number(v.toFixed(digits));

// A captured cycle rarely ends exactly where it began, which reads as a jolt
// every time it repeats. The gap between the last frame and the first is
// spread across the cycle, a growing fraction per frame, so the last frame
// matches the first and the loop wraps continuously.
function closeLoop(bones, hips, frames) {
  const last = frames - 1;
  const a = new THREE.Quaternion(), b = new THREE.Quaternion(), gap = new THREE.Quaternion(), part = new THREE.Quaternion();
  const id = new THREE.Quaternion();
  for (const values of Object.values(bones)) {
    a.fromArray(values, 0);
    b.fromArray(values, last * 4);
    gap.copy(a).multiply(b.clone().invert());
    for (let f = 1; f <= last; f++) {
      part.copy(id).slerp(gap, f / last);
      b.fromArray(values, f * 4).premultiply(part).normalize();
      values.splice(f * 4, 4, round(b.x, QUAT_DIGITS), round(b.y, QUAT_DIGITS), round(b.z, QUAT_DIGITS), round(b.w, QUAT_DIGITS));
    }
  }
  for (let k = 0; k < 3; k++) {
    const d = hips[k] - hips[last * 3 + k];
    for (let f = 1; f <= last; f++) hips[f * 3 + k] = round(hips[f * 3 + k] + (d * f) / last, HIPS_DIGITS);
  }
}

function bake(entry) {
  const file = path.join(fbxDir, `${entry.name}.fbx`);
  const buf = fs.readFileSync(file);
  const asset = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
  const clip = asset.animations[0];
  if (!clip) throw new Error(`${file} has no animation`);
  asset.updateMatrixWorld(true);

  const hipsNode = asset.getObjectByName("mixamorigHips");
  if (!hipsNode) throw new Error(`${file} has no mixamorigHips`);
  // Hips positions are local to the hips' parent; express them in world axes.
  const hipsParentRot = hipsNode.parent.getWorldQuaternion(new THREE.Quaternion());
  const restHeight = hipsNode.position.clone().applyQuaternion(hipsParentRot).y;
  if (!(restHeight > 0)) throw new Error(`${file}: non-positive rest hip height ${restHeight}`);

  const frames = Math.round(clip.duration * FPS) + 1;
  const bones = {};
  let hips = null;
  const q = new THREE.Quaternion();
  const restInv = new THREE.Quaternion();
  const parentRest = new THREE.Quaternion();
  const v = new THREE.Vector3();

  for (const track of clip.tracks) {
    const [nodeName, property] = track.name.split(".");
    const vrmBone = MIXAMO_TO_VRM[nodeName.replace(/^mixamorig/, "")];
    if (!vrmBone) continue;
    const node = asset.getObjectByName(nodeName);
    const interpolant = track.createInterpolant();
    if (property === "quaternion") {
      // A normalised-rig rotation is the Mixamo rotation re-expressed relative to
      // each bone's rest orientation: parentRestWorld * q * restWorld^-1.
      node.getWorldQuaternion(restInv).invert();
      node.parent.getWorldQuaternion(parentRest);
      const out = [];
      for (let f = 0; f < frames; f++) {
        q.fromArray(interpolant.evaluate(Math.min(f / FPS, clip.duration)));
        q.premultiply(parentRest).multiply(restInv).normalize();
        out.push(round(q.x, QUAT_DIGITS), round(q.y, QUAT_DIGITS), round(q.z, QUAT_DIGITS), round(q.w, QUAT_DIGITS));
      }
      bones[vrmBone] = out;
    } else if (property === "position" && vrmBone === "hips") {
      const raw = [];
      for (let f = 0; f < frames; f++) {
        v.fromArray(interpolant.evaluate(Math.min(f / FPS, clip.duration))).applyQuaternion(hipsParentRot).divideScalar(restHeight);
        raw.push(v.x, v.y, v.z);
      }
      // The clip starts over the character's own spot on the floor.
      const [x0, , z0] = raw;
      hips = raw.map((value, i) => round(i % 3 === 0 ? value - x0 : i % 3 === 2 ? value - z0 : value, HIPS_DIGITS));
    }
  }
  if (!bones.hips || !hips) throw new Error(`${file}: missing hips tracks`);
  if (entry.loop) closeLoop(bones, hips, frames);
  return { name: entry.name, category: entry.category, loop: entry.loop, face: entry.face ?? {}, fps: FPS, frames, bones, hips };
}

const index = [];
for (const entry of motions) {
  const baked = bake(entry);
  fs.writeFileSync(path.join(outDir, `${entry.name}.json`), JSON.stringify(baked));
  index.push({ name: entry.name, category: entry.category, loop: entry.loop, duration: round((baked.frames - 1) / FPS, 3) });
  console.log(`${entry.name}: ${baked.frames} frames, ${Object.keys(baked.bones).length} bones`);
}
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 1) + "\n");
console.log(`baked ${index.length} motions into ${outDir}`);
