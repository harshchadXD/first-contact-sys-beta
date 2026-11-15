import * as THREE from "three";

/** Generic scale reference, adapted from teammate geometry; not a particular lander's CAD. */
export function createLander() {
  const group = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({
    color: 0xb9c6ca,
    metalness: 0.75,
    roughness: 0.32,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc8a467,
    metalness: 0.72,
    roughness: 0.34,
  });
  const dark = new THREE.MeshPhysicalMaterial({
    color: 0x122a42,
    metalness: 0.3,
    roughness: 0.15,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
  });
  const part = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  part(new THREE.CylinderGeometry(0.85, 1.05, 1.1, 8), gold, 0, 1.25, 0);
  part(new THREE.CylinderGeometry(1.1, 1.1, 0.12, 8), silver, 0, 1.85, 0);
  part(new THREE.CylinderGeometry(0.53, 0.7, 0.3, 8), silver, 0, 2.05, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4,
      foot = new THREE.Vector3(Math.cos(a) * 1.65, 0.12, Math.sin(a) * 1.65),
      anchor = new THREE.Vector3(Math.cos(a) * 0.7, 1.5, Math.sin(a) * 0.7),
      delta = anchor.clone().sub(foot);
    const leg = part(
      new THREE.CylinderGeometry(0.045, 0.065, delta.length(), 8),
      silver,
      0,
      0,
      0,
    );
    leg.position.copy(foot.clone().add(anchor).multiplyScalar(0.5));
    leg.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    part(
      new THREE.CylinderGeometry(0.22, 0.29, 0.1, 12),
      silver,
      foot.x,
      0.06,
      foot.z,
    );
  }
  for (const side of [-1, 1]) {
    part(new THREE.BoxGeometry(2.3, 0.07, 1.25), dark, side * 2.15, 1.6, 0);
    for (let stripe = 0; stripe < 7; stripe++)
      part(
        new THREE.BoxGeometry(0.012, 0.012, 1.22),
        silver,
        side * 2.15 - 1.05 + stripe * 0.35,
        1.642,
        0,
      );
    part(new THREE.BoxGeometry(0.6, 0.08, 0.1), silver, side * 1.0, 1.6, 0);
  }
  part(
    new THREE.CylinderGeometry(0.23, 0.48, 0.5, 20, 1, true),
    dark,
    0,
    0.48,
    0,
  );
  const profile = Array.from({ length: 17 }, (_, i) => {
    const radius = (i / 16) * 0.48;
    return new THREE.Vector2(radius, radius * radius * 0.7);
  });
  const dish = part(
    new THREE.LatheGeometry(profile, 32),
    silver,
    0.42,
    2.35,
    0,
  );
  dish.rotation.z = Math.PI / 3;
  dish.name = "earth-dish";
  dish.material = silver.clone();
  dish.material.side = THREE.DoubleSide;
  part(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), silver, 0.42, 2.1, 0);
  return group;
}
