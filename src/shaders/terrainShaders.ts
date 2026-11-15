import * as THREE from "three";

export function createTerrainMaterial(heightTexture: THREE.Texture, heightRangeM: number, centerOffsetM: number) {
  const material = new THREE.MeshStandardMaterial({ color: 0xc8c6bd, roughness: 0.94, metalness: 0.02, displacementMap: heightTexture,
    displacementScale: Math.max(heightRangeM, 0.01), displacementBias: -centerOffsetM, flatShading: false });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHeightTexel = { value: new THREE.Vector2(1 / heightTexture.image.width, 1 / heightTexture.image.height) };
    shader.uniforms.uTerrainWidth = { value: 500.0 };
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vRegolithHeight;\nuniform vec2 uHeightTexel;\nuniform float uTerrainWidth;");
    shader.vertexShader = shader.vertexShader.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>
      float hLeft = texture2D(displacementMap, uv - vec2(uHeightTexel.x, 0.0)).r * displacementScale + displacementBias;
      float hRight = texture2D(displacementMap, uv + vec2(uHeightTexel.x, 0.0)).r * displacementScale + displacementBias;
      float hDown = texture2D(displacementMap, uv - vec2(0.0, uHeightTexel.y)).r * displacementScale + displacementBias;
      float hUp = texture2D(displacementMap, uv + vec2(0.0, uHeightTexel.y)).r * displacementScale + displacementBias;
      float spacingX = uTerrainWidth * uHeightTexel.x * 2.0;
      float spacingZ = uTerrainWidth * uHeightTexel.y * 2.0;
      objectNormal = normalize(vec3(-(hRight - hLeft) / spacingX, 1.0, (hUp - hDown) / spacingZ));`);
    shader.vertexShader = shader.vertexShader.replace("#include <displacementmap_vertex>", "#include <displacementmap_vertex>\nvRegolithHeight = transformed.y;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vRegolithHeight;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float elevationBand = smoothstep(-30.0, 70.0, vRegolithHeight);
      vec3 regolithLow = vec3(0.20, 0.23, 0.25);
      vec3 regolithHigh = vec3(0.76, 0.73, 0.64);
      diffuseColor.rgb *= mix(regolithLow, regolithHigh, elevationBand);`);
  };
  material.customProgramCacheKey = () => "firstcontact-regolith-height-normal-ramp-v2";
  return material;
}

export function createSlopeHazardMaterial(albedoMap: THREE.Texture, bumpMap: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      albedoMap: { value: albedoMap },
      bumpMap: { value: bumpMap },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(viewMatrix) * normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D albedoMap;
      uniform sampler2D bumpMap;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        float slopeDeg = acos(clamp(dot(normalize(vWorldNormal), vec3(0.0, 1.0, 0.0)), 0.0, 1.0)) * 57.2958;
        vec3 slopeColor;

        if (slopeDeg < 8.0) {
          vec3 regolithSilver = vec3(0.78, 0.78, 0.75);
          vec3 emerald = vec3(0.0196, 0.5882, 0.4118);
          slopeColor = mix(regolithSilver, emerald, 0.12);
        } else if (slopeDeg < 15.0) {
          slopeColor = vec3(0.8510, 0.4667, 0.0235);
        } else {
          slopeColor = vec3(0.8824, 0.1137, 0.2824);
        }

        vec3 albedo = texture2D(albedoMap, vUv).rgb;
        float bumpDetail = texture2D(bumpMap, vUv).r;
        albedo *= mix(0.94, 1.06, bumpDetail);
        gl_FragColor = vec4(mix(slopeColor, albedo, 0.6), 1.0);
      }
    `,
  });
}

export function createContourShaderMaterial(intervalMeters: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uIntervalMeters: { value: Math.max(intervalMeters, 0.001) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uIntervalMeters;
      varying vec3 vWorldPosition;

      void main() {
        float contourPosition = fract(vWorldPosition.y / uIntervalMeters);
        float contourDistance = min(contourPosition, 1.0 - contourPosition);
        float lineWidth = fwidth(contourPosition);
        float contourLine = 1.0 - smoothstep(lineWidth, lineWidth * 2.0, contourDistance);
        gl_FragColor = vec4(0.0, 0.95, 1.0, contourLine);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
}
