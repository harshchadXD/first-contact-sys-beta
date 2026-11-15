import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DispersionCell, LunarSite, MissionRecord } from "../types";
import { createTerrainMaterial } from "../shaders/terrainShaders";

type Props = { site: LunarSite; record: MissionRecord; mastM: number; cell: DispersionCell; onCell: (cell: DispersionCell) => void };

export default function ThreeTerrainViewer({ site, record, mastM, cell, onCell }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const live = useRef({ site, record, mastM, cell, onCell });
  live.current = { site, record, mastM, cell, onCell };

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#090d12");
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000); camera.position.set(420, 320, 460);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, stencil: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "terrain-canvas"; host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.06; controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 190; controls.maxDistance = 1250; controls.target.set(0, 10, 0);
    scene.add(new THREE.HemisphereLight(0xb9d3e8, 0x211c19, 1.3));
    const key = new THREE.DirectionalLight(0xffedcf, 3.5); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -320; key.shadow.camera.right = 320; key.shadow.camera.top = 320; key.shadow.camera.bottom = -320;
    key.shadow.camera.near = 0.1; key.shadow.camera.far = 1800; key.shadow.normalBias = 0.04; key.shadow.bias = -0.00015;
    key.shadow.radius = 4; scene.add(key); scene.add(key.target);
    const groundGeo = new THREE.PlaneGeometry(500, 500, 100, 100); groundGeo.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x77766f, roughness: 1 }));
    terrain.receiveShadow = true; terrain.castShadow = true; scene.add(terrain);
    const loader = new THREE.TextureLoader();
    const textureUrl = `/data/${live.current.site.provenance.heightmap_png}`;
    const heightTexture = loader.load(textureUrl, (texture) => {
      texture.colorSpace = THREE.NoColorSpace; texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const data = live.current.site.heightmap;
      const range = data.meters_per_code * 65535;
      terrain.material.dispose(); terrain.material = createTerrainMaterial(texture, range, live.current.site.site_metadata.elevation_m - data.minimum_elevation_m);
      terrain.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, displacementMap: texture,
        displacementScale: range, displacementBias: -(live.current.site.site_metadata.elevation_m - data.minimum_elevation_m) });
    }, undefined, () => { /* synthetic sites still render their data-independent terrain grid */ });
    const gridGroup = new THREE.Group(); scene.add(gridGroup);
    const markerGeometry = new THREE.SphereGeometry(4.4, 12, 10);
    const markers: THREE.Mesh[] = [];
    for (const siteCell of live.current.site.dispersion_grid_5x5) {
      const marker = new THREE.Mesh(markerGeometry, new THREE.MeshStandardMaterial({ color: cellColor(siteCell.status), emissive: cellColor(siteCell.status), emissiveIntensity: 0.16 }));
      marker.position.set(siteCell.dx_m, siteCell.elevation_m == null ? 0 : siteCell.elevation_m - live.current.site.site_metadata.elevation_m + 5, -siteCell.dy_m);
      marker.userData.cell = siteCell; marker.castShadow = true; gridGroup.add(marker); markers.push(marker);
    }
    const lander = makeLander(live.current.mastM); scene.add(lander);
    const sunGlyph = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 })); scene.add(sunGlyph);
    const earthGlyph = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0x38bdf8 })); scene.add(earthGlyph);
    const axes = new THREE.AxesHelper(80); axes.material.transparent = true; (axes.material as THREE.Material).opacity = 0.25; scene.add(axes);
    const groundGrid = new THREE.GridHelper(500, 10, 0x263746, 0x18222c); groundGrid.position.y = -0.4; scene.add(groundGrid);
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(markers, false)[0]; if (hit) live.current.onCell(hit.object.userData.cell as DispersionCell);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    const resize = new ResizeObserver(() => { const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); });
    resize.observe(host);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate); controls.update();
      const state = live.current; const az = THREE.MathUtils.degToRad(state.record.sunAz), el = THREE.MathUtils.degToRad(state.record.sunEl);
      const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      key.position.copy(sunDir).multiplyScalar(900); key.intensity = state.record.sunEl < -3 ? 0.12 : 3.5;
      sunGlyph.position.copy(sunDir).multiplyScalar(420); sunGlyph.visible = state.record.sunEl > -1;
      const earthAz = THREE.MathUtils.degToRad(state.record.earthAz), earthEl = THREE.MathUtils.degToRad(state.record.earthEl);
      earthGlyph.position.set(Math.sin(earthAz) * Math.cos(earthEl), Math.sin(earthEl), Math.cos(earthAz) * Math.cos(earthEl)).multiplyScalar(340);
      lander.position.set(state.cell.dx_m, (state.cell.elevation_m ?? state.site.site_metadata.elevation_m) - state.site.site_metadata.elevation_m, -state.cell.dy_m);
      lander.children.forEach((child) => {
        if (child.userData.mast) { child.scale.y = Math.max(0.5, state.mastM); child.position.y = 16 + state.mastM / 2; }
        if (child.userData.sensor) child.position.y = 17 + state.mastM;
      });
      markers.forEach((marker) => { const c = marker.userData.cell as DispersionCell; const active = c.dx_m === state.cell.dx_m && c.dy_m === state.cell.dy_m;
        (marker.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 0.95 : 0.13; marker.scale.setScalar(active ? 1.28 : 1); });
      renderer.render(scene, camera);
    };
    animate();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); renderer.domElement.removeEventListener("pointerdown", onPointerDown); controls.dispose();
      heightTexture.dispose(); groundGeo.dispose(); terrain.geometry.dispose(); terrain.material.dispose(); terrain.customDepthMaterial?.dispose(); markerGeometry.dispose();
      gridGroup.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.material) (mesh.material as THREE.Material).dispose(); });
      lander.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.geometry) mesh.geometry.dispose(); if (mesh.material) (mesh.material as THREE.Material).dispose(); });
      renderer.dispose(); host.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="terrain-stage" ref={mount}>
    <div className="terrain-overlay terrain-readout"><span>LIVE SOLAR VECTOR</span><strong>{record.sunAz.toFixed(1)}° <small>AZ</small> / {record.sunEl.toFixed(2)}° <small>EL</small></strong></div>
    <div className="terrain-overlay terrain-scale"><span>500 M SITE PATCH</span><i /><span>100 M GRID</span></div>
    <div className="terrain-axis">N ↑ <span>W ←</span></div>
    <div className="terrain-hint">DRAG TO ORBIT <b>·</b> SCROLL TO ZOOM <b>·</b> SELECT A GRID CELL</div>
  </div>;
}

function cellColor(status: DispersionCell["status"]) { return status === "SAFE" ? 0x38bdf8 : status === "CAUTION" ? 0xfacc15 : status === "OUTSIDE_DATA" ? 0x64748b : 0xf43f5e; }

function makeLander(mastM: number) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9d2d6, metalness: 0.48, roughness: 0.38 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd7aa57, metalness: 0.6, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2d37, metalness: 0.36, roughness: 0.5 });
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 7, 6), bodyMat); hull.position.y = 12; hull.castShadow = true; group.add(hull);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 2, 8), gold); deck.position.y = 8; group.add(deck);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.9, 13, 6), bodyMat); leg.position.set(Math.cos(a) * 8, 3.8, Math.sin(a) * 8); leg.rotation.z = -Math.cos(a) * 0.28; leg.rotation.x = Math.sin(a) * 0.28; leg.castShadow = true; group.add(leg); const foot = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 4), dark); foot.position.set(Math.cos(a) * 10.2, 0.6, Math.sin(a) * 10.2); group.add(foot); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1, 8), gold); mast.position.y = 16 + mastM / 2; mast.scale.y = mastM; mast.userData.mast = true; mast.castShadow = true; group.add(mast);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), bodyMat); sensor.position.y = 17 + mastM; sensor.userData.sensor = true; group.add(sensor);
  for (const side of [-1, 1]) { const panel = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x173e5a, metalness: 0.42, roughness: 0.3, emissive: 0x062b49 })); panel.position.set(side * 16, 12, 0); panel.castShadow = true; group.add(panel); }
  group.userData.legs = 4; return group;
}
