import React, { useEffect, useRef, useState, useId, useCallback } from 'react';
import styles from './TerrainViewport.module.css';

export type TerrainViewportProps = {
  terrain: null | {
    id: string;
    columns: number;
    rows: number;
    spacingMeters: number;
    elevationsMeters: number[]; // row-major: columns increase east, rows increase north
    referenceElevationMeters: number;
    fidelity: 'SYNTHETIC' | 'NASA_DERIVED';
    sourceLabel: string;
  };
  positions: {
    id: string;
    label: string;
    eastMeters: number;
    northMeters: number;
    elevationMeters: number;
  }[];
  selectedPositionId: string;
  onSelectPosition: (id: string) => void;
  sun: { azimuthDeg: number; elevationDeg: number };
  earth: { azimuthDeg: number; elevationDeg: number };
  observerHeightMeters: number;
};

/**
 * Calculates a 3D unit direction vector matching the coordinate convention:
 * - East = +X
 * - Zenith = +Y
 * - North = -Z
 *
 * For an observer at (0, 0, 0):
 * Azimuth 0° (North) points towards -Z.
 * Azimuth 90° (East) points towards +X.
 * Azimuth 180° (South) points towards +Z.
 * Azimuth 270° (West) points towards -X.
 */
function celestialDirectionToVector(azimuthDeg: number, elevationDeg: number) {
  const azRad = (azimuthDeg * Math.PI) / 180.0;
  const elRad = (elevationDeg * Math.PI) / 180.0;

  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);

  const x = Math.sin(azRad) * cosEl; // East
  const y = sinEl;                   // Zenith
  const z = -Math.cos(azRad) * cosEl; // North is -Z

  return { x, y, z };
}

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export const TerrainViewport: React.FC<TerrainViewportProps> = ({
  terrain,
  positions,
  selectedPositionId,
  onSelectPosition,
  sun,
  earth,
  observerHeightMeters,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [webGlAvailable, setWebGlAvailable] = useState<boolean>(() => checkWebGLSupport());
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const groupLabelId = useId();

  // Keep a mutable ref to active props for animation frame updates
  const propsRef = useRef({
    terrain,
    positions,
    selectedPositionId,
    onSelectPosition,
    sun,
    earth,
    observerHeightMeters,
  });

  useEffect(() => {
    propsRef.current = {
      terrain,
      positions,
      selectedPositionId,
      onSelectPosition,
      sun,
      earth,
      observerHeightMeters,
    };
  });

  // Callback to reset camera orientation
  const resetCameraRef = useRef<(() => void) | null>(null);

  const handleResetCamera = useCallback(() => {
    resetCameraRef.current?.();
  }, []);

  useEffect(() => {
    let disposed = false;
    let animFrameId = 0;

    if (!webGlAvailable) return;

    // Dynamic import of Three.js to remain decoupled before npm installation
    import('three')
      .then(async (THREE) => {
        if (disposed || !canvasRef.current || !containerRef.current) return;

        let OrbitControlsClass: any;
        try {
          const controlsModule = await import('three/addons/controls/OrbitControls.js');
          OrbitControlsClass = controlsModule.OrbitControls;
        } catch {
          OrbitControlsClass = null;
        }

        const host = containerRef.current;
        const canvas = canvasRef.current;

        // Initialize Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#050608');

        // Camera: Initialized from an elevated perspective looking down toward the patch
        const camera = new THREE.PerspectiveCamera(45, host.clientWidth / Math.max(1, host.clientHeight), 1, 5000);
        const defaultCamPos = new THREE.Vector3(260, 220, 280);
        camera.position.copy(defaultCamPos);

        // Renderer
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        let controls: any = null;
        if (OrbitControlsClass) {
          controls = new OrbitControlsClass(camera, renderer.domElement);
          controls.enableDamping = true;
          controls.dampingFactor = 0.05;
          controls.maxPolarAngle = Math.PI * 0.49;
          controls.minDistance = 20;
          controls.maxDistance = 1500;
          controls.target.set(0, 0, 0);

          resetCameraRef.current = () => {
            camera.position.copy(defaultCamPos);
            controls.target.set(0, 0, 0);
            controls.update();
          };
          setIsCameraReady(true);
        }

        // Lighting: Calibrated directional Sun light
        const sunLight = new THREE.DirectionalLight(0xfffaed, 3.2);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.normalBias = 0.04;
        sunLight.shadow.bias = -0.00015;
        const d = 300;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 1600;
        scene.add(sunLight);
        scene.add(sunLight.target);

        // Ambient faint regolith fill
        const fillLight = new THREE.HemisphereLight(0x233142, 0x050608, 0.4);
        scene.add(fillLight);

        // Grid plane helper
        const groundGrid = new THREE.GridHelper(400, 8, 0x1e293b, 0x0f172a);
        groundGrid.position.y = -0.1;
        scene.add(groundGrid);

        // Sun & Earth visual markers
        const sunGlyph = new THREE.Mesh(
          new THREE.SphereGeometry(6, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        scene.add(sunGlyph);

        const earthGlyph = new THREE.Mesh(
          new THREE.SphereGeometry(5, 16, 12),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        scene.add(earthGlyph);

        // Dynamic Groups for terrain, markers, and lander
        let terrainMesh: any = null;
        const markersGroup = new THREE.Group();
        scene.add(markersGroup);

        const landerGroup = new THREE.Group();
        scene.add(landerGroup);

        // Lander Model
        const landerBody = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 5, 5, 6),
          new THREE.MeshStandardMaterial({ color: 0xc9d2d6, metalness: 0.4, roughness: 0.5 })
        );
        landerBody.position.y = 2.5;
        landerBody.castShadow = true;
        landerGroup.add(landerBody);

        const landerMast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 1, 6),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6, roughness: 0.3 })
        );
        landerMast.castShadow = true;
        landerGroup.add(landerMast);

        // Build Terrain Mesh from elevations
        const buildTerrain = (t: TerrainViewportProps['terrain']) => {
          if (terrainMesh) {
            scene.remove(terrainMesh);
            terrainMesh.geometry.dispose();
            terrainMesh.material.dispose();
            terrainMesh = null;
          }

          if (!t) return;

          const { columns, rows, spacingMeters, elevationsMeters, referenceElevationMeters } = t;
          const numVertices = columns * rows;
          const vertexPositions = new Float32Array(numVertices * 3);

          const originEast = -((columns - 1) * spacingMeters) / 2.0;
          const originNorth = -((rows - 1) * spacingMeters) / 2.0;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
              const idx = r * columns + c;
              const east = originEast + c * spacingMeters;
              const north = originNorth + r * spacingMeters;
              const elevation = elevationsMeters[idx] - referenceElevationMeters;

              // Coordinate mapping: East = +X, Zenith = +Y, North = -Z
              vertexPositions[idx * 3] = east;
              vertexPositions[idx * 3 + 1] = elevation;
              vertexPositions[idx * 3 + 2] = -north;
            }
          }

          const indices: number[] = [];
          for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < columns - 1; c++) {
              const i0 = r * columns + c;
              const i1 = r * columns + (c + 1);
              const i2 = (r + 1) * columns + c;
              const i3 = (r + 1) * columns + (c + 1);

              indices.push(i0, i2, i1);
              indices.push(i1, i2, i3);
            }
          }

          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(vertexPositions, 3));
          geo.setIndex(indices);
          geo.computeVertexNormals();

          const mat = new THREE.MeshStandardMaterial({
            color: 0x475569,
            roughness: 0.95,
            metalness: 0.05,
            flatShading: true,
          });

          terrainMesh = new THREE.Mesh(geo, mat);
          terrainMesh.receiveShadow = true;
          terrainMesh.castShadow = true;
          scene.add(terrainMesh);
        };

        buildTerrain(propsRef.current.terrain);

        // Raycasting for interactive marker selection
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const markerMeshes: any[] = [];

        const onPointerDown = (event: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(markerMeshes, false);
          if (hits.length > 0) {
            const hitId = hits[0].object.userData.positionId;
            if (hitId) {
              propsRef.current.onSelectPosition(hitId);
            }
          }
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);

        // ResizeObserver
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const width = Math.max(1, entry.contentRect.width);
            const height = Math.max(1, entry.contentRect.height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height, false);
          }
        });
        resizeObserver.observe(host);

        // Animation Loop
        let activeTerrainId = propsRef.current.terrain?.id;

        const animate = () => {
          if (disposed) return;
          animFrameId = requestAnimationFrame(animate);

          if (controls) controls.update();

          const current = propsRef.current;

          // Rebuild terrain if terrain data changed
          if (current.terrain?.id !== activeTerrainId) {
            buildTerrain(current.terrain);
            activeTerrainId = current.terrain?.id;
          }

          // Update Sun Light and Glyph
          const sunVec = celestialDirectionToVector(current.sun.azimuthDeg, current.sun.elevationDeg);
          const sunDist = 700;
          sunLight.position.set(sunVec.x * sunDist, sunVec.y * sunDist, sunVec.z * sunDist);
          sunLight.target.position.set(0, 0, 0);

          sunGlyph.position.set(sunVec.x * 380, sunVec.y * 380, sunVec.z * 380);
          sunGlyph.visible = current.sun.elevationDeg > -2.0;

          // Update Earth Glyph
          const earthVec = celestialDirectionToVector(current.earth.azimuthDeg, current.earth.elevationDeg);
          earthGlyph.position.set(earthVec.x * 320, earthVec.y * 320, earthVec.z * 320);

          // Update Markers
          markerMeshes.length = 0;
          while (markersGroup.children.length > 0) {
            const child = markersGroup.children[0];
            markersGroup.remove(child);
          }

          const refElev = current.terrain?.referenceElevationMeters ?? 0;
          let selectedPosCoord = { x: 0, y: 0, z: 0 };

          for (const pos of current.positions) {
            const isSelected = pos.id === current.selectedPositionId;
            const x = pos.eastMeters;
            const y = pos.elevationMeters - refElev + 1.5;
            const z = -pos.northMeters;

            if (isSelected) {
              selectedPosCoord = { x, y: y - 1.5, z };
            }

            const markerGeo = new THREE.SphereGeometry(isSelected ? 3.5 : 2.2, 12, 8);
            const markerMat = new THREE.MeshBasicMaterial({
              color: isSelected ? 0x38bdf8 : 0x94a3b8,
            });
            const markerMesh = new THREE.Mesh(markerGeo, markerMat);
            markerMesh.position.set(x, y, z);
            markerMesh.userData = { positionId: pos.id };
            markersGroup.add(markerMesh);
            markerMeshes.push(markerMesh);
          }

          // Update Lander Position and Mast Height
          landerGroup.position.set(selectedPosCoord.x, selectedPosCoord.y, selectedPosCoord.z);
          landerMast.scale.y = Math.max(0.5, current.observerHeightMeters);
          landerMast.position.y = 5.0 + current.observerHeightMeters / 2.0;

          renderer.render(scene, camera);
        };

        animate();

        return () => {
          disposed = true;
          cancelAnimationFrame(animFrameId);
          resizeObserver.disconnect();
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);

          if (controls) controls.dispose();
          if (terrainMesh) {
            terrainMesh.geometry.dispose();
            terrainMesh.material.dispose();
          }

          renderer.dispose();
        };
      })
      .catch(() => {
        setWebGlAvailable(false);
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(animFrameId);
    };
  }, [webGlAvailable]);

  return (
    <div className={styles.stageContainer} ref={containerRef}>
      {/* 3D Canvas Stage */}
      {webGlAvailable ? (
        <div className={styles.canvasWrapper}>
          <canvas ref={canvasRef} className={styles.canvas} />

          {/* Floating Telemetry Readout */}
          <div className={styles.overlayTop}>
            <div className={styles.telemetryBadge}>
              SOLAR VECTOR:{' '}
              <strong>
                {sun.azimuthDeg.toFixed(1)}° AZ / {sun.elevationDeg.toFixed(2)}° EL
              </strong>
            </div>
            <div className={`${styles.telemetryBadge} ${styles.earthBadge}`}>
              EARTH VECTOR:{' '}
              <strong>
                {earth.azimuthDeg.toFixed(1)}° AZ / {earth.elevationDeg.toFixed(2)}° EL
              </strong>
            </div>
            {isCameraReady && (
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleResetCamera}
              >
                RESET VIEW
              </button>
            )}
          </div>

          <div className={styles.axisIndicator}>
            <span>N (–Z)</span> ↑ · <span>E (+X)</span> →
          </div>
        </div>
      ) : (
        /* Honest No-WebGL or No-Runtime Fallback State */
        <div className={styles.fallbackStage}>
          <div className={styles.fallbackIcon}>◇</div>
          <div className={styles.fallbackTitle}>3D Terrain Viewport Standby</div>
          <p className={styles.fallbackText}>
            {terrain === null
              ? 'No terrain elevation grid loaded. Select candidate positions below to inspect geometry.'
              : 'WebGL rendering paused or pending Three.js runtime lock. Use accessible controls below.'}
          </p>
        </div>
      )}

      {/* Accessible DOM Position Selection & Illustrative Notice */}
      <nav className={styles.bottomControls} aria-labelledby={groupLabelId}>
        <div className={styles.positionGroup} id={groupLabelId} role="group" aria-label="Candidate Touchdown Positions">
          <span className={styles.positionLabel}>POSITIONS:</span>
          {positions.map((p) => {
            const isSelected = p.id === selectedPositionId;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.positionButton} ${isSelected ? styles.positionButtonActive : ''}`}
                onClick={() => onSelectPosition(p.id)}
                aria-pressed={isSelected}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className={styles.illustrativeNotice}>
          * Local terrain shadows are illustrative; distant crater horizon blockage is evaluated analytically.
        </div>
      </nav>
    </div>
  );
};

export default TerrainViewport;
