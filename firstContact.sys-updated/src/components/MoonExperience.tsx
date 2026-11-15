import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface MoonExperienceProps {
  paused?: boolean;
  onReady?: () => void;
}

/**
 * The cover instrument. A single Moon, lit like an exhibit, with a small
 * Earth in the dark and a surface marker that is projected from the scene.
 * Drag to turn the Moon; the rest of the motion is deliberately quiet.
 */
export function MoonExperience({ paused = false, onReady }: MoonExperienceProps) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFailed(true);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const mobile = window.matchMedia('(max-width: 760px)');
    let disposed = false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile.matches ? 1.5 : 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setClearColor(0x060707, 0);
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

    // The Moon sits to the right of the editorial column on desktop and above
    // it on small screens. Kept as a group so camera framing stays stable.
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);

    const geometry = new THREE.SphereGeometry(1.22, 160, 110);
    const material = new THREE.MeshStandardMaterial({
      color: 0xd8d4ca,
      roughness: 0.99,
      metalness: 0,
      bumpScale: 0.026,
    });
    const moon = new THREE.Mesh(geometry, material);
    moon.rotation.order = 'YXZ';
    moon.rotation.set(-0.42, -0.62, -0.035);
    moonGroup.add(moon);

    scene.add(new THREE.AmbientLight(0x9dafc2, 0.1));

    const sun = new THREE.DirectionalLight(0xfff1d8, 3.65);
    sun.position.set(-4.4, 3.1, 4.6);
    scene.add(sun);

    const earthshine = new THREE.DirectionalLight(0x8fb6d4, 0.48);
    earthshine.position.set(3.6, -1.1, 2.4);
    scene.add(earthshine);

    const rim = new THREE.DirectionalLight(0xffd7a2, 0.52);
    rim.position.set(2.2, 2.4, -4.4);
    scene.add(rim);

    const textures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();

    loader.load(
      '/textures/moon-lroc-2k.jpg',
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        textures.push(texture);
        if (!readyRef.current) {
          readyRef.current = true;
          window.setTimeout(() => onReady?.(), 120);
        }
      },
      undefined,
      () => {
        // The procedural sphere remains a dignified fallback; do not fail the page.
        if (!readyRef.current) {
          readyRef.current = true;
          onReady?.();
        }
      }
    );

    loader.load(
      '/textures/moon-bump-1k.jpg',
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        material.bumpMap = texture;
        material.needsUpdate = true;
        textures.push(texture);
      },
      undefined,
      () => undefined
    );

    // A thin orbital registration line, not a physical claim.
    const makeArc = (radius: number, tiltX: number, tiltZ: number, opacity: number) => {
      const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.985, 0, Math.PI * 2);
      const points = curve.getPoints(220).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0xd9cfbd,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const line = new THREE.LineLoop(geo, mat);
      line.rotation.set(tiltX, 0, tiltZ);
      return line;
    };
    const arcs = new THREE.Group();
    arcs.add(makeArc(1.39, 1.12, 0.08, 0.16));
    arcs.add(makeArc(1.54, 1.36, -0.34, 0.08));
    moonGroup.add(arcs);

    // Stars: two quiet layers.
    const makeStars = (count: number, spread: number, size: number, opacity: number) => {
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        const radius = spread + Math.random() * 34;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.cos(phi);
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 12;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xd9d5c8,
        size,
        sizeAttenuation: true,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      return new THREE.Points(geo, mat);
    };
    scope: {
      const stars = makeStars(1100, 26, 0.035, 0.62);
      scene.add(stars);
      const bright = makeStars(56, 22, 0.075, 0.8);
      scene.add(bright);
    }

    // Earth, a small blue witness in the dark.
    const earthGeo = new THREE.SphereGeometry(0.052, 32, 24);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x6f8794,
      roughness: 1,
      metalness: 0,
      emissive: 0x07131d,
      emissiveIntensity: 0.7,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.set(-1.98, 1.36, -2.6);
    scene.add(earth);
    loader.load(
      '/textures/earth-blue-marble.jpg',
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        earthMat.map = texture;
        earthMat.color.set(0xffffff);
        earthMat.needsUpdate = true;
        textures.push(texture);
      },
      undefined,
      () => undefined
    );
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const glowCtx = glowCanvas.getContext('2d');
    if (glowCtx) {
      const grad = glowCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
      grad.addColorStop(0, 'rgba(148, 194, 216, .5)');
      grad.addColorStop(0.28, 'rgba(92, 145, 171, .2)');
      grad.addColorStop(1, 'rgba(20, 40, 54, 0)');
      glowCtx.fillStyle = grad;
      glowCtx.fillRect(0, 0, 128, 128);
    }
    const glowTexture = new THREE.CanvasTexture(glowCanvas);
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    glow.scale.set(0.42, 0.42, 1);
    glow.position.copy(earth.position);
    scene.add(glow);
    textures.push(glowTexture);

    // Surface marker, projected into the HTML callout each frame.
    const marker = new THREE.Object3D();
    marker.position.set(0, -1.205, 0.19);
    moon.add(marker);
    const markerWorld = new THREE.Vector3();
    const markerNormal = new THREE.Vector3();
    const moonCenter = new THREE.Vector3();
    const cameraDir = new THREE.Vector3();

    // Framing.
    let baseCameraX = 0.08;
    let baseCameraY = 0.04;
    let baseCameraZ = 4.55;
    let moonX = 1.0;
    let moonY = 0.02;
    let lookX = 0.46;
    let lookY = 0.01;

    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const isMobile = width < 900;
      const isTablet = width < 1100;
      baseCameraX = isMobile ? 0 : 0.08;
      baseCameraY = isMobile ? 0.05 : 0.04;
      baseCameraZ = isMobile ? 11 : isTablet ? 5.2 : 5.0;
      moonX = isMobile ? 0.42 : isTablet ? 1.02 : 1.22;
      moonY = isMobile ? 1.85 : 0.18;
      lookX = isMobile ? 0 : moonX * 0.46;
      lookY = isMobile ? 0 : moonY * 0.5;
      moonGroup.position.set(moonX, moonY, 0);
      camera.position.set(baseCameraX, baseCameraY, baseCameraZ);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);

    // Interaction.
    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    let dragging = false;
    let dragPointerId: number | null = null;
    let last = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };
    let targetRY = moon.rotation.y;
    let targetRX = moon.rotation.x;
    let lastInteraction = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      if (!dragging) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      targetRY += dx * 0.0052;
      targetRX = THREE.MathUtils.clamp(targetRX + dy * 0.0032, -0.72, 0.32);
      velocity.x = dx * 0.0052;
      velocity.y = dy * 0.0032;
      lastInteraction = performance.now();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      dragging = true;
      dragPointerId = event.pointerId;
      last = { x: event.clientX, y: event.clientY };
      velocity = { x: 0, y: 0 };
      element.setPointerCapture?.(event.pointerId);
      lastInteraction = performance.now();
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      dragPointerId = null;
      element.releasePointerCapture?.(event.pointerId);
      lastInteraction = performance.now();
    };
    const onPointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
      if (!dragging) lastInteraction = performance.now();
    };
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('pointerleave', onPointerLeave);

    let visible = true;
    const intersection = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { rootMargin: '120px' }
    );
    intersection.observe(element);

    const contextLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    let previous = performance.now();
    let scrollProgress = 0;
    let targetScroll = 0;
    const markerScreen = { x: 0.5, y: 0.5, visible: false };
    const moonPoint = new THREE.Vector3();
    const cameraPosition = new THREE.Vector3();

    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!visible || document.hidden) return;

      targetScroll = mobile.matches ? 0 : Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
      scrollProgress += (targetScroll - scrollProgress) * Math.min(1, dt * 5);

      const idle = !dragging && !pausedRef.current && !reduced.matches;
      const sinceInteraction = now - lastInteraction;
      if (idle && sinceInteraction > 900) {
        targetRY += dt * 0.028;
        velocity.x *= 0.94;
        velocity.y *= 0.94;
      } else if (!dragging) {
        targetRY += velocity.x * dt * 12;
        targetRX = THREE.MathUtils.clamp(targetRX + velocity.y * dt * 12, -0.72, 0.32);
        velocity.x *= 0.9;
        velocity.y *= 0.9;
      }

      moon.rotation.y += (targetRY - moon.rotation.y) * Math.min(1, dt * 8);
      moon.rotation.x += (targetRX - moon.rotation.x) * Math.min(1, dt * 8);

      const pxGoal = dragging ? pointer.x * 0.04 : pointer.x * 0.16;
      const pyGoal = dragging ? 0 : pointer.y * 0.11;
      smoothPointer.x += (pxGoal - smoothPointer.x) * Math.min(1, dt * 3.2);
      smoothPointer.y += (pyGoal - smoothPointer.y) * Math.min(1, dt * 3.2);
      camera.position.x = baseCameraX + smoothPointer.x;
      camera.position.y = baseCameraY + smoothPointer.y;
      camera.position.z = baseCameraZ;
      camera.lookAt(lookX, lookY, 0);

      const lift = scrollProgress * 0.3;
      moonGroup.position.y = moonY + lift;
      moonGroup.scale.setScalar(0.97 - scrollProgress * 0.11);
      arcs.rotation.y = now * 0.000018;
      arcs.rotation.z = 0.02 + scrollProgress * 0.08;

      // Project the surface marker into the page.
      marker.getWorldPosition(markerWorld);
      moonCenter.setFromMatrixPosition(moonGroup.matrixWorld);
      camera.getWorldPosition(cameraPosition);
      markerNormal.copy(markerWorld).sub(moonCenter).normalize();
      const towardCamera = cameraPosition.sub(markerWorld).normalize();
      markerScreen.visible = markerNormal.dot(towardCamera) > 0.02;
      moonPoint.copy(markerWorld).project(camera);
      markerScreen.x = (moonPoint.x * 0.5 + 0.5) * 100;
      markerScreen.y = (-moonPoint.y * 0.5 + 0.5) * 100;
      element.style.setProperty('--marker-x', `${markerScreen.x}%`);
      element.style.setProperty('--marker-y', `${markerScreen.y}%`);
      element.style.setProperty('--marker-opacity', markerScreen.visible ? '1' : '0');

      // Earth callout.
      const earthPoint = earth.position.clone().project(camera);
      element.style.setProperty('--earth-x', `${(earthPoint.x * 0.5 + 0.5) * 100}%`);
      element.style.setProperty('--earth-y', `${(-earthPoint.y * 0.5 + 0.5) * 100}%`);

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(loop);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      resizeObserver.disconnect();
      intersection.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry?.dispose();
          const mat = object.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose());
      geometry.dispose();
      material.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // The scene owns its own lifecycle; paused is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`moon-stage${failed ? ' moon-stage--failed' : ''}`}
      ref={host}
      role="img"
      aria-label="A slowly turning Moon above the lunar south pole, with Earth in the distance. Display lighting is illustrative."
    >
      <div className="moon-pin" aria-hidden="true">
        <span className="moon-pin-ring" />
        <span className="moon-pin-line" />
        <span className="moon-pin-label">
          <em>89.46°S · 137.49°W</em>
          Connecting Ridge
        </span>
      </div>
      <div className="earth-pin" aria-hidden="true">
        <span className="earth-pin-dot" />
      </div>
      {failed && (
        <div className="moon-fallback">
          <img src="/brand/first-contact.png" alt="" />
          <p>3D view unavailable. The lunar explorer is still accessible below.</p>
        </div>
      )}
    </div>
  );
}
