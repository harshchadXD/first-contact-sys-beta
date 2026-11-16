import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export function MoonExperience({ paused }: { paused: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  const [failed, setFailed] = useState(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x080909, 0);
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 4.3);
    const geometry = new THREE.SphereGeometry(1, 96, 64);
    const material = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 1, bumpScale: 0.018 });
    const moon = new THREE.Mesh(geometry, material);
    moon.rotation.set(0.12, -0.8, -0.2);
    scene.add(moon);
    scene.add(new THREE.AmbientLight(0xb3bdca, 0.16));
    const sun = new THREE.DirectionalLight(0xfff4df, 3.2);
    sun.position.set(-3, 2, 4); scene.add(sun);
    let disposed = false;
    const textures: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();
    loader.load('/textures/moon-lroc-2k.jpg', texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      material.map = texture; material.needsUpdate = true; textures.push(texture);
    }, undefined, () => { if (!disposed) setFailed(true); });
    loader.load('/textures/moon-bump-1k.jpg', texture => {
      if (disposed) { texture.dispose(); return; }
      material.bumpMap = texture; material.needsUpdate = true; textures.push(texture);
    });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false; controls.enablePan = false;
    controls.enableDamping = true; controls.dampingFactor = 0.055; controls.rotateSpeed = 0.45;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(element);
    const resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    });
    resize.observe(element);
    let previous = performance.now();
    renderer.setAnimationLoop(now => {
      const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
      if (!visible || document.hidden) return;
      controls.autoRotate = !pausedRef.current && !reduced.matches;
      controls.autoRotateSpeed = 0.24; controls.update(dt);
      const progress = reduced.matches ? 0 : Math.min(window.scrollY / window.innerHeight, 1);
      moon.position.y = progress * 0.18; moon.scale.setScalar(1 + progress * 0.08);
      renderer.render(scene, camera);
    });
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      disposed = true; renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      resize.disconnect(); observer.disconnect(); controls.dispose();
      geometry.dispose(); material.dispose(); textures.forEach(texture => texture.dispose());
      renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  return <div className="moon-stage" ref={host} role="img" aria-label="Interactive Moon globe, display lighting is illustrative">{failed && <div className="moon-fallback"><img src="/brand/first-contact.png" alt="First Contact lunar artwork"/><p>3D view unavailable. The explorer is still accessible.</p></div>}</div>;
}
