import * as THREE from 'three';

// Shared uniforms so one update per frame drives every material
export const lightUniforms = {
  daylight: { value: 1 },
  fogColor: { value: new THREE.Color(0x87b8ff) },
  fogNear: { value: 40 },
  fogFar: { value: 80 },
};

const vertex = /* glsl */`
  attribute vec2 light;
  varying vec2 vUv;
  varying vec2 vLight;
  varying float vFog;
  void main() {
    vUv = uv;
    vLight = light;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFog = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */`
  uniform sampler2D map;
  uniform float daylight;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform float opacity;
  uniform float alphaCut;
  uniform vec3 tint;
  varying vec2 vUv;
  varying vec2 vLight;
  varying float vFog;
  void main() {
    vec4 t = texture2D(map, vUv);
    if (t.a < alphaCut) discard;
    vec3 sky = vec3(vLight.x * daylight);
    vec3 blk = vLight.y * vec3(1.0, 0.9, 0.72);
    vec3 l = max(max(sky, blk), vec3(0.025));
    vec3 c = t.rgb * l * tint;
    float f = smoothstep(fogNear, fogFar, vFog);
    gl_FragColor = vec4(mix(c, fogColor, f), t.a * opacity);
  }
`;

export function blockMaterial(map, { transparent = false, opacity = 1, alphaCut = 0.5, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...lightUniforms,
      map: { value: map },
      opacity: { value: opacity },
      alphaCut: { value: alphaCut },
      tint: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent,
    depthWrite: !transparent,
    side,
  });
}

// Per-entity material: lit by a single light value set each frame
export function entityMaterial(map, color = 0xffffff) {
  return new THREE.MeshBasicMaterial({ map, color, alphaTest: 0.5 });
}
