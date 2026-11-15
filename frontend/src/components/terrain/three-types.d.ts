// Ambient fallback declarations for Three.js and OrbitControls
// Provided so TypeScript can compile TerrainViewport prior to Codex locking three in package.json.

declare module 'three' {
  export const SRGBColorSpace: string;
  export const NoColorSpace: string;
  export const ACESFilmicToneMapping: number;
  export const PCFSoftShadowMap: number;

  export class Scene {
    background: Color | null;
    add(...objects: any[]): void;
    remove(...objects: any[]): void;
    traverse(callback: (object: any) => void): void;
  }

  export class Color {
    constructor(color?: string | number);
    set(color: string | number): Color;
  }

  export class PerspectiveCamera {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    position: Vector3;
    updateProjectionMatrix(): void;
    lookAt(x: number | Vector3, y?: number, z?: number): void;
  }

  export class WebGLRenderer {
    constructor(parameters?: any);
    domElement: HTMLCanvasElement;
    shadowMap: { enabled: boolean; type: number };
    toneMapping: number;
    toneMappingExposure: number;
    outputColorSpace: string;
    capabilities: { getMaxAnisotropy(): number };
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): Vector3;
    copy(v: Vector3): Vector3;
    normalize(): Vector3;
    multiplyScalar(scalar: number): Vector3;
  }

  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
    set(x: number, y: number): Vector2;
  }

  export class Raycaster {
    constructor();
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(objects: any[], recursive?: boolean): Array<{ object: any }>;
  }

  export class Group {
    constructor();
    position: Vector3;
    children: any[];
    userData: any;
    add(...objects: any[]): void;
    remove(...objects: any[]): void;
    traverse(callback: (object: any) => void): void;
  }

  export class Mesh {
    constructor(geometry?: any, material?: any);
    position: Vector3;
    rotation: any;
    scale: Vector3;
    geometry: any;
    material: any;
    castShadow: boolean;
    receiveShadow: boolean;
    userData: any;
    visible: boolean;
  }

  export class BufferGeometry {
    constructor();
    setAttribute(name: string, attribute: any): BufferGeometry;
    setIndex(index: any): BufferGeometry;
    computeVertexNormals(): void;
    dispose(): void;
  }

  export class BufferAttribute {
    constructor(array: ArrayLike<number>, itemSize: number);
  }

  export class PlaneGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, widthSegments?: number, heightSegments?: number);
    rotateX(angle: number): BufferGeometry;
  }

  export class SphereGeometry extends BufferGeometry {
    constructor(radius?: number, widthSegments?: number, heightSegments?: number);
  }

  export class CylinderGeometry extends BufferGeometry {
    constructor(radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number);
  }

  export class BoxGeometry extends BufferGeometry {
    constructor(width?: number, height?: number, depth?: number);
  }

  export class GridHelper extends Mesh {
    constructor(size?: number, divisions?: number, colorCenterLine?: any, colorGrid?: any);
  }

  export class Material {
    dispose(): void;
  }

  export class MeshStandardMaterial extends Material {
    constructor(parameters?: any);
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    roughness: number;
    metalness: number;
  }

  export class MeshBasicMaterial extends Material {
    constructor(parameters?: any);
    color: Color;
  }

  export class DirectionalLight {
    constructor(color?: any, intensity?: number);
    position: Vector3;
    target: any;
    intensity: number;
    castShadow: boolean;
    shadow: {
      mapSize: Vector2;
      camera: { left: number; right: number; top: number; bottom: number; near: number; far: number };
      normalBias: number;
      bias: number;
      radius: number;
    };
  }

  export class HemisphereLight {
    constructor(skyColor?: any, groundColor?: any, intensity?: number);
  }

  export namespace MathUtils {
    export function degToRad(degrees: number): number;
    export function radToDeg(radians: number): number;
  }
}

declare module 'three/addons/controls/OrbitControls.js' {
  export class OrbitControls {
    constructor(camera: any, domElement: HTMLElement);
    enableDamping: boolean;
    dampingFactor: number;
    maxPolarAngle: number;
    minDistance: number;
    maxDistance: number;
    target: any;
    update(): void;
    reset(): void;
    dispose(): void;
  }
}
