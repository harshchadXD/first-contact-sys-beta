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
