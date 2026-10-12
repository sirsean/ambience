export const milieuColors = {
  night: {
    panes: [
      [0.24, 0.25, 0.52], [0.23, 0.35, 0.64], [0.23, 0.51, 0.56], [0.43, 0.25, 0.65],
      [0.57, 0.27, 0.55], [0.15, 0.43, 0.43], [0.29, 0.35, 0.58], [0.6, 0.37, 0.48],
    ],
  },
  sunrise: {
    panes: [
      [0.91, 0.44, 0.19], [0.9, 0.65, 0.25], [0.87, 0.36, 0.44], [0.71, 0.29, 0.54],
      [0.5, 0.36, 0.65], [0.89, 0.61, 0.45], [0.25, 0.53, 0.55], [0.93, 0.55, 0.34],
    ],
  },
  day: {
    panes: [
      [0.11, 0.67, 0.62], [0.13, 0.65, 0.9], [0.17, 0.37, 0.76], [0.48, 0.31, 0.75],
      [0.74, 0.3, 0.65], [0.18, 0.59, 0.47], [0.9, 0.56, 0.19], [0.25, 0.49, 0.81],
    ],
  },
} as const;

export const vertexShader = /* glsl */ `
  attribute vec4 aRect;
  attribute vec3 aPaneColor;
  attribute vec2 aEffect;
  uniform vec2 uResolution;

  varying vec2 vUv;
  varying vec2 vSize;
  varying vec3 vColor;
  varying vec2 vEffect;

  void main() {
    vUv = position.xy;
    vSize = aRect.zw * uResolution;
    // Lighting is evaluated at four vertices, then interpolated across the glass.
    vColor = aPaneColor * (0.88 + position.x * 0.13 + position.y * 0.09);
    vEffect = aEffect;
    gl_Position = vec4((aRect.xy + position.xy * aRect.zw) * 2.0 - 1.0, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  uniform float uBorderPx;
  varying vec2 vUv;
  varying vec2 vSize;
  varying vec3 vColor;
  varying vec2 vEffect;

  void main() {
    vec2 edgeDistance = min(vUv, 1.0 - vUv) * vSize;
    float edge = min(edgeDistance.x, edgeDistance.y);
    float coverage = smoothstep(uBorderPx - 0.65, uBorderPx + 0.65, edge);
    float bevel = 1.0 - smoothstep(uBorderPx + 0.7, uBorderPx + 2.0, edge);
    vec3 glass = vColor * (1.0 + bevel * 0.16);

    // Only the selected pane runs the small sheen calculation. No noise or extra pass.
    if (vEffect.x > 0.0) {
      float diagonal = vUv.x * 0.65 + vUv.y * 0.35;
      float sheen = 1.0 - smoothstep(0.0, 0.2, abs(diagonal - vEffect.y));
      glass += vec3(0.16, 0.2, 0.18) * sheen * vEffect.x;
    }

    gl_FragColor = vec4(mix(vec3(0.025, 0.032, 0.052), glass, coverage), 1.0);
  }
`;
