import { createSkyBodies } from "./createSkyBodies";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  globePosition,
  skyDirection,
  terrainHeightAt,
} from "../services/worldGeometry";
import { createLander } from "./createLander";
import type { TerrainGrid, ScenePoint } from "../types/world";

export type WorldView = "overview" | "terrain" | "ground";
type Props = {
  terrain: TerrainGrid;
  points: ScenePoint[];
  selected: string;
  onSelect: (id: string) => void;
  onEnter: () => void;
  view: WorldView;
  intro: boolean;
  motion: boolean;
  contours: boolean;
  rings: boolean;
  sun: { az: number; el: number };
  earth: { az: number; el: number };
  height: number;
  lat: number;
  lon: number;
  horizon: number[];
  azimuths: number[];
  lookAt: "sun" | "earth";
  focusVersion: number;
  keptPosition?: string;
  pointStatus: Record<string, boolean>;
};

/** Shared display world. Overview art and skyline overlay never replace the exact engine. */
export default function LunarWorld(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    update = useRef<((p: Props) => void) | null>(null),
    latest = useRef(props);
  const [error, setError] = useState("");
  useEffect(() => {
    latest.current = props;
    update.current?.(props);
  }, [props]);
  const { terrain, points } = props;
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    let disposed = false;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      queueMicrotask(() => {
        if (!disposed)
          setError(
            "3D is unavailable here. The location controls and exact analysis still work.",
          );
      });
      return () => {
        disposed = true;
      };
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(38, 1, 0.002, 100);
    camera.position.set(0, 0.1, 7.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.target.set(0, 0, 0);
    controls.minDistance = 2.1;
    controls.maxDistance = 12;
    controls.enablePan = false;
    scene.add(new THREE.HemisphereLight(0xb4c6d6, 0x22252c, 0.7));
    const key = new THREE.DirectionalLight(0xfff4dd, 3.2);
    key.position.set(-3, 2, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x718cb0, 0.45);
    fill.position.set(4, 0, -2);
    scene.add(fill);
    const globe = new THREE.Group();
    scene.add(globe);
    globe.rotation.set(-1.05, -0.35, -0.22);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xcbd0d2,
      roughness: 1,
    });
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.65, 96, 64),
      moonMat,
    );
    globe.add(moon);
    const textures: THREE.Texture[] = [];
    let frame = 0,
      live = latest.current,
      activeView: WorldView = "overview";

    const texture = new THREE.TextureLoader().load(
      "/textures/moon-lroc-2k.jpg",
      (t) => {
        if (disposed) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        moonMat.map = t;
        moonMat.needsUpdate = true;
        request();
      },
      undefined,
      () => {
        if (!disposed)
          setError(
            "The Moon texture could not load. The overview is illustrative; local terrain and analysis remain available.",
          );
      },
    );
    textures.push(texture);
    const loadDisplayTexture = (
      url: string,
      ready: (t: THREE.Texture) => void,
    ) => {
      const t = new THREE.TextureLoader().load(
        url,
        (loaded) => {
          if (disposed) {
            loaded.dispose();
            return;
          }
          ready(loaded);
          request();
        },
        undefined,
        () => {
          if (!disposed)
            setError(
              "A display asset could not load. Exact analysis remains available.",
            );
        },
      );
      textures.push(t);
      return t;
    };
    loadDisplayTexture("/textures/moon-bump-1k.jpg", (t) => {
      moonMat.bumpMap = t;
      moonMat.bumpScale = 0.035;
      moonMat.roughness = 0.94;
      moonMat.metalness = 0.02;
      moonMat.needsUpdate = true;
    });
    const lroOrbit = new THREE.Group();
    globe.add(lroOrbit);
    let orbitPhase = 0,
      previousTime = 0;
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
      "/models/lro-satellite.glb",
      (asset) => {
        const model = asset.scene;
        if (disposed) {
          model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material])
                m.dispose();
            }
          });
          return;
        }
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 0.18 / Math.max(size.x, size.y, size.z, 0.001);
        model.position.copy(
          bounds.getCenter(new THREE.Vector3()).multiplyScalar(-scale),
        );
        model.scale.setScalar(scale);
        const satellite = new THREE.Group();
        satellite.add(model);
        satellite.position.set(2.05, 0, 0);
        lroOrbit.add(satellite);
        request();
      },
      undefined,
      () => {
        if (!disposed)
          setError(
            "LRO display model unavailable. Terrain and exact analysis remain available.",
          );
      },
    );

    const locator = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x80d4d3 }),
    );
    locator.position.set(...globePosition(live.lat, live.lon, 1.67));
    globe.add(locator);
    const locatorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.003, 5, 64),
      new THREE.MeshBasicMaterial({
        color: 0x80d4d3,
        transparent: true,
        opacity: 0.8,
      }),
    );
    locatorRing.position.copy(locator.position);
    locatorRing.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      locator.position.clone().normalize(),
    );
    globe.add(locatorRing);

    const region = new THREE.Group();
    region.scale.setScalar(0.008);
    region.position.y = -0.35;
    region.visible = false;
    scene.add(region);
    const vertices = new Float32Array(terrain.columns * terrain.rows * 3),
      colors = new Float32Array(vertices.length),
      indices: number[] = [];
    const longitude = ((terrain.gridNorthLongitudeDeg ?? 0) * Math.PI) / 180,
      shade = new THREE.Color();
    const min = Math.min(...terrain.elevationsMeters),
      max = Math.max(...terrain.elevationsMeters);
    for (let row = 0; row < terrain.rows; row++)
      for (let col = 0; col < terrain.columns; col++) {
        const i = row * terrain.columns + col,
          dx = (col - Math.floor(terrain.columns / 2)) * terrain.spacingMeters,
          dy = -(row - Math.floor(terrain.rows / 2)) * terrain.spacingMeters;
        vertices.set(
          [
            dx * Math.cos(longitude) - dy * Math.sin(longitude),
            terrain.elevationsMeters[i] - terrain.referenceElevationMeters,
            -(dx * Math.sin(longitude) + dy * Math.cos(longitude)),
          ],
          i * 3,
        );
        const lum =
          0.25 +
          (0.23 * (terrain.elevationsMeters[i] - min)) / Math.max(1, max - min);
        shade.setRGB(lum * 0.98, lum, lum * 1.02);
        colors.set([shade.r, shade.g, shade.b], i * 3);
        if (row < terrain.rows - 1 && col < terrain.columns - 1) {
          const j = i + terrain.columns;
          indices.push(i, j, i + 1, i + 1, j, j + 1);
        }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const surface = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.98,
        side: THREE.DoubleSide,
      }),
    );
    surface.castShadow = true;
    surface.receiveShadow = true;
    region.add(surface);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({
        color: 0x8dc2cc,
        transparent: true,
        opacity: 0.07,
      }),
    );
    wire.position.y = 0.3;
    region.add(wire);
    const markerGeo = new THREE.RingGeometry(3, 4.3, 32),
      markerMat = new THREE.MeshBasicMaterial({
        color: 0x8eb6bd,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
    const markers = points
      .filter((p) => p.elevationMeters !== null)
      .map((p) => {
        const m = new THREE.Mesh(markerGeo, markerMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(
          p.eastMeters,
          p.elevationMeters! - terrain.referenceElevationMeters + 0.8,
          -p.northMeters,
        );
        m.userData.id = p.id;
        region.add(m);
        return m;
      });
    const overlayPositions = geo.getAttribute("position").clone();
    for (let i = 0; i < overlayPositions.count; i++)
      overlayPositions.setY(i, overlayPositions.getY(i) + 0.08);
    const cells = points.map((p) => {
      const selectedIndices: number[] = [];
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = indices.slice(i, i + 3);
        const east =
          triangle.reduce((sum, j) => sum + overlayPositions.getX(j), 0) / 3;
        const north =
          -triangle.reduce((sum, j) => sum + overlayPositions.getZ(j), 0) / 3;
        if (
          east >= p.eastMeters - 50 &&
          east < p.eastMeters + 50 &&
          north >= p.northMeters - 50 &&
          north < p.northMeters + 50
        )
          selectedIndices.push(...triangle);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", overlayPositions);
      geometry.setIndex(selectedIndices);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: 0x8797a3,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.id = p.id;
      region.add(mesh);
      return mesh;
    });
    const selectedRing = new THREE.Mesh(
      new THREE.RingGeometry(8, 9, 64),
      new THREE.MeshBasicMaterial({
        color: 0x98e2dc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    selectedRing.rotation.x = -Math.PI / 2;
    region.add(selectedRing);
    const keptRing = new THREE.Mesh(
      new THREE.RingGeometry(11, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0xe6bd7e, side: THREE.DoubleSide }),
    );
    keptRing.rotation.x = -Math.PI / 2;
    region.add(keptRing);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 1, 8),
      new THREE.MeshStandardMaterial({
        color: 0xe5c495,
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    region.add(mast);
    const sensor = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.26, 0.32),
      new THREE.MeshStandardMaterial({
        color: 0xb8d8d9,
        metalness: 0.65,
        roughness: 0.3,
      }),
    );
    region.add(sensor);
    const lander = createLander();
    region.add(lander);
    const rangeRings = [50, 100, 200].map((radius, i) => {
      const line = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
          color: 0x7bb7bb,
          transparent: true,
          opacity: 0.4 - i * 0.07,
        }),
      );
      line.userData.radius = radius;
      region.add(line);
      return line;
    });
    let ringPosition = "";
    const sun = new THREE.DirectionalLight(0xfff0cc, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -4,
      right: 4,
      top: 4,
      bottom: -4,
      near: 0.01,
      far: 40,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.003;
    sun.shadow.bias = -0.00001;
    scene.add(sun, sun.target);
    const skyBodies = createSkyBodies();
    const sunMark = skyBodies.sun,
      earthMark = skyBodies.earth;
    textures.push(...skyBodies.textures);
    loadDisplayTexture("/textures/earth-blue-marble.jpg", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      skyBodies.material.uniforms.map.value = texture;
      skyBodies.material.uniforms.loaded.value = true;
    });
    scene.add(sunMark, earthMark);
    const skyline = new THREE.LineLoop(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0x718c9c,
        transparent: true,
        opacity: 0.8,
      }),
    );
    scene.add(skyline);
    const starsGeo = new THREE.BufferGeometry(),
      stars: number[] = [];
    for (let i = 0; i < 430; i++) {
      const az = i * 2.399,
        el = Math.asin(((i * 37) % 431) / 215.5 - 1);
      stars.push(
        Math.cos(az) * Math.cos(el) * 30,
        Math.sin(el) * 30,
        Math.sin(az) * Math.cos(el) * 30,
      );
    }
    starsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(stars, 3),
    );
    scene.add(
      new THREE.Points(
        starsGeo,
        new THREE.PointsMaterial({
          color: 0x91a1b3,
          size: 0.017,
          transparent: true,
          opacity: 0.4,
          sizeAttenuation: true,
        }),
      ),
    );

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let tween: {
      start: number;
      from: THREE.Vector3;
      to: THREE.Vector3;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
    } | null = null;
    const selectedPoint = () =>
      points.find((p) => p.id === live.selected) ?? points[0];
    const pointInWorld = (p: ScenePoint) =>
      new THREE.Vector3(
        p.eastMeters * 0.008,
        (p.elevationMeters! - terrain.referenceElevationMeters) * 0.008 - 0.35,
        -p.northMeters * 0.008,
      );
    const preset = () => {
      if (live.view === "overview")
        return {
          camera: new THREE.Vector3(0, 0.2, 7.6),
          target: new THREE.Vector3(0, 0, 0),
        };
      if (live.view === "terrain")
        return {
          camera: new THREE.Vector3(3.4, 2.8, 4.2),
          target: new THREE.Vector3(0, -0.15, 0),
        };
      const body = live.lookAt === "sun" ? live.sun : live.earth;
      const az = (body.az * Math.PI) / 180;
      const cameraEast = selectedPoint().eastMeters + 3 - Math.sin(az) * 18;
      const cameraNorth = selectedPoint().northMeters - Math.cos(az) * 18;
      const cameraElevation =
        terrainHeightAt(terrain, cameraEast, cameraNorth) ??
        selectedPoint().elevationMeters!;
      const eye = new THREE.Vector3(
        cameraEast * 0.008,
        (cameraElevation -
          terrain.referenceElevationMeters +
          Math.max(1.6, live.height)) *
          0.008 -
          0.35,
        -cameraNorth * 0.008,
      );
      return {
        camera: eye,
        target: eye
          .clone()
          .add(
            new THREE.Vector3(...skyDirection(body.az, body.el)).multiplyScalar(
              2,
            ),
          ),
      };
    };
    const transition = () => {
      const pose = preset();
      if (reduced.matches) {
        camera.position.copy(pose.camera);
        controls.target.copy(pose.target);
        tween = null;
      } else
        tween = {
          start: performance.now(),
          from: camera.position.clone(),
          to: pose.camera,
          targetFrom: controls.target.clone(),
          targetTo: pose.target,
        };
      controls.minDistance = live.view === "ground" ? 0.05 : 2.1;
      controls.maxDistance = live.view === "ground" ? 4 : 12;
      controls.enableRotate = live.view !== "ground";
      controls.enableZoom = live.view !== "ground";
      controls.maxPolarAngle =
        live.view === "terrain" ? Math.PI * 0.49 : Math.PI;
      request();
    };
    const draw = (time: number) => {
      frame = 0;
      if (disposed || document.hidden) return;
      if (tween) {
        const t = Math.min(1, (time - tween.start) / 1300),
          ease = 1 - (1 - t) ** 4;
        camera.position.lerpVectors(tween.from, tween.to, ease);
        controls.target.lerpVectors(tween.targetFrom, tween.targetTo, ease);
        if (t === 1) tween = null;
      }
      const dt = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      const animate = live.motion && !reduced.matches;
      if (animate && globe.visible) orbitPhase += dt * 0.12;
      lroOrbit.rotation.z = orbitPhase;
      lroOrbit.visible = live.view === "overview";

      globe.visible = live.view === "overview" || live.intro;
      globe.position.x = live.intro && camera.aspect > 1.2 ? 1.65 : 0;
      region.visible = live.view !== "overview";
      sunMark.visible = earthMark.visible = region.visible;
      skyline.visible = live.view === "ground";
      key.intensity = globe.visible ? 3.2 : 0.45;
      sun.intensity = region.visible ? (live.sun.el > 0 ? 3.5 : 0.15) : 0;
      controls.autoRotate = animate && live.view === "overview" && !tween;
      controls.autoRotateSpeed = 0.25;
      controls.update();
      renderer.render(scene, camera);
      if (tween || controls.autoRotate) request();
    };
    function request() {
      if (!frame && !disposed && !document.hidden)
        frame = requestAnimationFrame(draw);
    }
    controls.addEventListener("change", request);
    controls.addEventListener("start", () => {
      tween = null;
    });
    update.current = (next) => {
      const old = live;
      live = next;
      selectedRing.visible = next.view !== "ground";
      for (const marker of markers) marker.visible = next.view !== "ground";
      for (const cell of cells) {
        const meets = next.pointStatus[cell.userData.id];
        cell.visible = next.view === "terrain";
        cell.material.color.setHex(
          meets === undefined ? 0x8797a3 : meets ? 0x5bb9a2 : 0xc77d78,
        );
      }
      selectedRing.position.set(
        selectedPoint().eastMeters,
        selectedPoint().elevationMeters! - terrain.referenceElevationMeters + 1,
        -selectedPoint().northMeters,
      );
      keptRing.visible = !!next.keptPosition && next.view !== "ground";
      const kept = points.find((p) => p.id === next.keptPosition);
      if (kept)
        keptRing.position.set(
          kept.eastMeters,
          kept.elevationMeters! - terrain.referenceElevationMeters + 1,
          -kept.northMeters,
        );
      wire.visible = next.contours;
      for (const ring of rangeRings) ring.visible = next.rings;
      if (ringPosition !== next.selected) {
        ringPosition = next.selected;
        for (const ring of rangeRings) {
          const coordinates: number[] = [];
          let previous: THREE.Vector3 | null = null;
          for (let i = 0; i <= 360; i++) {
            const angle = (i * Math.PI) / 180,
              east =
                selectedPoint().eastMeters +
                Math.cos(angle) * ring.userData.radius,
              north =
                selectedPoint().northMeters +
                Math.sin(angle) * ring.userData.radius;
            const elevation = terrainHeightAt(terrain, east, north);
            const current =
              elevation === null
                ? null
                : new THREE.Vector3(
                    east,
                    elevation - terrain.referenceElevationMeters + 0.08,
                    -north,
                  );
            if (previous && current)
              coordinates.push(
                previous.x,
                previous.y,
                previous.z,
                current.x,
                current.y,
                current.z,
              );
            previous = current;
          }
          ring.geometry.dispose();
          ring.geometry = new THREE.BufferGeometry();
          ring.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(coordinates, 3),
          );
        }
      }
      lander.position.set(
        selectedPoint().eastMeters + 3,
        selectedPoint().elevationMeters! - terrain.referenceElevationMeters,
        -selectedPoint().northMeters,
      );
      const hE = terrainHeightAt(
          terrain,
          selectedPoint().eastMeters + 1,
          selectedPoint().northMeters,
        ),
        hW = terrainHeightAt(
          terrain,
          selectedPoint().eastMeters - 1,
          selectedPoint().northMeters,
        ),
        hN = terrainHeightAt(
          terrain,
          selectedPoint().eastMeters,
          selectedPoint().northMeters + 1,
        ),
        hS = terrainHeightAt(
          terrain,
          selectedPoint().eastMeters,
          selectedPoint().northMeters - 1,
        );
      if (hE !== null && hW !== null && hN !== null && hS !== null)
        lander.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(-(hE - hW) / 2, 1, (hN - hS) / 2).normalize(),
        );
      const dish = lander.getObjectByName("earth-dish");
      if (dish)
        dish.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(
            ...skyDirection(next.earth.az, next.earth.el),
          ).applyQuaternion(lander.quaternion.clone().invert()),
        );
      const p = pointInWorld(selectedPoint());
      mast.visible = next.height > 0;
      mast.scale.y = Math.max(0.1, next.height);
      mast.position.set(
        selectedPoint().eastMeters,
        selectedPoint().elevationMeters! -
          terrain.referenceElevationMeters +
          next.height / 2,
        -selectedPoint().northMeters,
      );
      sensor.position.set(
        selectedPoint().eastMeters,
        selectedPoint().elevationMeters! -
          terrain.referenceElevationMeters +
          next.height,
        -selectedPoint().northMeters,
      );
      const eye =
        next.view === "ground"
          ? preset().camera
          : p.clone().add(new THREE.Vector3(0, next.height * 0.008, 0));
      sun.position
        .copy(eye)
        .add(
          new THREE.Vector3(
            ...skyDirection(next.sun.az, next.sun.el),
          ).multiplyScalar(10),
        );
      sun.target.position.copy(eye);
      skyBodies.material.uniforms.sunDirection.value.set(
        ...skyDirection(next.sun.az, next.sun.el),
      );
      sunMark.position
        .copy(eye)
        .add(
          new THREE.Vector3(
            ...skyDirection(next.sun.az, next.sun.el),
          ).multiplyScalar(6),
        );
      earthMark.position
        .copy(eye)
        .add(
          new THREE.Vector3(
            ...skyDirection(next.earth.az, next.earth.el),
          ).multiplyScalar(5.8),
        );
      const horizon: number[] = [];
      next.azimuths.forEach((az, i) => {
        const d = new THREE.Vector3(...skyDirection(az, next.horizon[i]))
          .multiplyScalar(5.5)
          .add(eye);
        horizon.push(d.x, d.y, d.z);
      });
      skyline.geometry.dispose();
      skyline.geometry = new THREE.BufferGeometry();
      skyline.geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(horizon, 3),
      );
      if (
        next.view !== activeView ||
        next.focusVersion !== old.focusVersion ||
        next.intro !== old.intro ||
        (next.view === "ground" &&
          (old.selected !== next.selected ||
            old.height !== next.height ||
            old.lookAt !== next.lookAt))
      ) {
        activeView = next.view;
        transition();
      }
      if (
        next.view === "ground" &&
        old.view === "ground" &&
        !tween &&
        (old.sun.az !== next.sun.az || old.earth.az !== next.earth.az)
      ) {
        const pose = preset();
        camera.position.copy(pose.camera);
        controls.target.copy(pose.target);
      }
      request();
    };
    update.current(latest.current);
    const resize = new ResizeObserver(() => {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (w && h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        request();
      }
    });
    resize.observe(container);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 },
      groundAz = 0,
      groundEl = 0;
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
      if (live.view === "ground") {
        tween = null;
        const direction = camera.getWorldDirection(new THREE.Vector3());
        groundAz = (Math.atan2(direction.x, -direction.z) * 180) / Math.PI;
        groundEl = (Math.asin(direction.y) * 180) / Math.PI;
        renderer.domElement.setPointerCapture(event.pointerId);
      }
    };
    const onMove = (event: PointerEvent) => {
      if (live.view !== "ground" || event.buttons !== 1) return;
      const az = groundAz - (event.clientX - down.x) * 0.15,
        el = Math.max(
          -85,
          Math.min(85, groundEl + (event.clientY - down.y) * 0.15),
        );
      controls.target
        .copy(camera.position)
        .add(new THREE.Vector3(...skyDirection(az, el)).multiplyScalar(2));
      camera.lookAt(controls.target);
      request();
    };
    const onUp = (event: PointerEvent) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId))
        renderer.domElement.releasePointerCapture(event.pointerId);
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6)
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      if (live.view === "overview") {
        if (ray.intersectObject(locator).length) live.onEnter();
      } else {
        const hit = ray.intersectObjects([
          ...markers,
          ...cells.filter((c) => c.visible),
        ])[0];
        if (hit) live.onSelect(hit.object.userData.id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    document.addEventListener("visibilitychange", request);
    reduced.addEventListener("change", request);
    request();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      update.current = null;
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", request);
      reduced.removeEventListener("change", request);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (
          o instanceof THREE.Mesh ||
          o instanceof THREE.Points ||
          o instanceof THREE.Line
        ) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      sun.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [terrain, points]);
  return (
    <div className="lunar-world">
      <div
        ref={host}
        className="world-canvas"
        role="img"
        aria-label={`Interactive lunar ${props.view} view. Use the view buttons and location selector for keyboard navigation.`}
      />
      {error && (
        <p className="world-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
