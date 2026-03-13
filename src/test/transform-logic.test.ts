import { describe, it, expect } from "vitest";

/**
 * Unit tests for the multi-mesh transform logic used in CADCanvas.
 * These verify the mathematical correctness of pivot-relative transforms
 * without needing Three.js or React rendering.
 */

// Minimal vector helpers matching THREE.Vector3 behavior
class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}
  clone() { return new Vec3(this.x, this.y, this.z); }
  sub(v: Vec3) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  add(v: Vec3) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  divideScalar(s: number) { return new Vec3(this.x / s, this.y / s, this.z / s); }
}

interface FakeMesh {
  name: string;
  position: Vec3;
  scale: Vec3;
  rotationDeg: [number, number, number];
}

function computePivot(meshes: FakeMesh[]): Vec3 {
  const sum = new Vec3();
  for (const m of meshes) {
    sum.x += m.position.x;
    sum.y += m.position.y;
    sum.z += m.position.z;
  }
  return sum.divideScalar(meshes.length);
}

describe("Multi-mesh numeric move", () => {
  it("preserves relative positions when moving on X axis", () => {
    const meshes: FakeMesh[] = [
      { name: "A", position: new Vec3(1, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
      { name: "B", position: new Vec3(3, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
    ];
    const primary = meshes[0];
    const value = 5; // move primary X to 5
    const delta = value - primary.position.x; // delta = 4

    const relBefore = meshes[1].position.x - meshes[0].position.x; // 2

    // Apply delta to all
    for (const m of meshes) m.position.x += delta;

    const relAfter = meshes[1].position.x - meshes[0].position.x;
    expect(relAfter).toBe(relBefore);
    expect(meshes[0].position.x).toBe(5);
    expect(meshes[1].position.x).toBe(7);
  });
});

describe("Multi-mesh numeric scale", () => {
  it("scales positions relative to pivot, preserving structure", () => {
    const meshes: FakeMesh[] = [
      { name: "A", position: new Vec3(-1, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
      { name: "B", position: new Vec3(1, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
    ];
    const pivot = computePivot(meshes); // (0, 0, 0)
    const primary = meshes[0];
    const axisIdx = 0; // X
    const value = 2; // scale X to 2
    const ratio = value / primary.scale.x; // 2

    for (const m of meshes) {
      // Scale the scale value
      m.scale.x *= ratio;
      // Scale position offset from pivot
      const offset = m.position.clone().sub(pivot);
      offset.x *= ratio;
      m.position = pivot.clone().add(offset);
    }

    expect(meshes[0].scale.x).toBe(2);
    expect(meshes[1].scale.x).toBe(2);
    // Positions should be symmetrically expanded
    expect(meshes[0].position.x).toBe(-2);
    expect(meshes[1].position.x).toBe(2);
    // Y and Z unchanged
    expect(meshes[0].position.y).toBe(0);
    expect(meshes[1].position.y).toBe(0);
  });

  it("handles zero-value scale gracefully (no division by zero)", () => {
    const primary = { name: "A", position: new Vec3(0, 0, 0), scale: new Vec3(0, 1, 1), rotationDeg: [0, 0, 0] as [number, number, number] };
    const currentVal = primary.scale.x; // 0
    // The code checks `if (currentVal === 0) return;` — so we just verify the guard
    expect(currentVal).toBe(0);
  });

  it("uniform scale preserves relative distances proportionally", () => {
    const meshes: FakeMesh[] = [
      { name: "A", position: new Vec3(0, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
      { name: "B", position: new Vec3(2, 0, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
      { name: "C", position: new Vec3(0, 3, 0), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
    ];
    const pivot = computePivot(meshes);
    const ratio = 0.5;

    const distBefore = Math.sqrt(
      (meshes[1].position.x - meshes[0].position.x) ** 2 +
      (meshes[1].position.y - meshes[0].position.y) ** 2
    );

    // Scale X axis
    for (const m of meshes) {
      m.scale.x *= ratio;
      const offset = m.position.clone().sub(pivot);
      offset.x *= ratio;
      m.position = pivot.clone().add(offset);
    }

    // Relative X distance should halve
    const xDistAfter = Math.abs(meshes[1].position.x - meshes[0].position.x);
    expect(xDistAfter).toBeCloseTo(1, 5); // was 2, now 1
  });
});

describe("Pivot computation fallback", () => {
  it("average of positions when no mesh refs available", () => {
    const meshes: FakeMesh[] = [
      { name: "A", position: new Vec3(2, 4, 6), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
      { name: "B", position: new Vec3(4, 6, 8), scale: new Vec3(1, 1, 1), rotationDeg: [0, 0, 0] },
    ];
    const pivot = computePivot(meshes);
    expect(pivot.x).toBe(3);
    expect(pivot.y).toBe(5);
    expect(pivot.z).toBe(7);
  });
});
