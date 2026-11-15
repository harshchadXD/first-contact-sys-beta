import * as THREE from "three";

/** Display glyphs preserve angular directions; texture orientation and halo are illustrative. */
export function createSkyBodies() {
  const textures: THREE.Texture[] = [];
  const earth = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      sunDirection: { value: new THREE.Vector3(1, 0, 0) },
      loaded: { value: false },
    },
    vertexShader: `varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D map;uniform vec3 sunDirection;uniform bool loaded;varying vec2 vUv;varying vec3 vNormal;void main(){vec3 base=loaded?texture2D(map,vUv).rgb:vec3(.15,.35,.5);float day=max(0.,dot(normalize(vNormal),normalize(sunDirection)));gl_FragColor=vec4(base*(.03+.97*day),1.);}`,
  });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(0.096, 32, 24), material));
  earth.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.099, 32, 24),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
        fragmentShader: `varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-max(0.,dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(.2,.65,.9,rim*.5);}`,
      }),
    ),
  );
  const sun = new THREE.Group();
  sun.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,251,235,.9)");
    gradient.addColorStop(0.15, "rgba(255,217,158,.18)");
    gradient.addColorStop(1, "rgba(255,205,130,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    textures.push(texture);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.scale.setScalar(0.38);
    sun.add(glow);
  }
  return { earth, sun, material, textures };
}
