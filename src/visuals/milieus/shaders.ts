export const milieuColors = {
  night: { primary: [0.05, 0.04, 0.15] as const, accent: [0.3, 0.2, 0.6] as const },
  sunrise: { primary: [0.25, 0.08, 0.05] as const, accent: [1.0, 0.55, 0.15] as const },
  day: { primary: [0.04, 0.12, 0.14] as const, accent: [0.3, 0.65, 0.55] as const },
};

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAudioLevel;
  uniform float uChimeBurst;
  uniform float uChimeStyle;
  uniform vec2 uChimeCenter;
  uniform float uChimeRipplePhase;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform vec3 uColorD;
  uniform float uBlend;
  uniform float uDesaturate;
  uniform float uParticleDensity;
  uniform float uStreakIntensity;
  uniform float uGlowSharpness;
  uniform float uHumidityBlur;
  uniform float uMilieuStyle;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot * p * 2.02 + vec2(0.07, 0.11);
      a *= 0.5;
    }
    return v;
  }

  vec3 desaturate(vec3 color, float amount) {
    float l = dot(color, vec3(0.299, 0.587, 0.114));
    return mix(color, vec3(l), amount);
  }

  float pondRipple(vec2 uv, vec2 center, float phase, float strength) {
    vec2 delta = uv - center;
    float r = length(delta);
    float wave = sin(r * 28.0 - phase * 6.0) * 0.6
               + sin(r * 28.0 - phase * 6.0 + 2.1) * 0.3
               + sin(r * 28.0 - phase * 6.0 + 4.2) * 0.15;
    float falloff = exp(-r * 3.5) * (1.0 - smoothstep(0.0, 0.55, r));
    return wave * falloff * strength;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;

    float t = uTime * (0.12 + uMilieuStyle * 0.08);
    float breathe = 0.5 + 0.5 * sin(uTime * 0.35) + uAudioLevel * 0.2;

    vec2 flow = vec2(
      fbm(centered * 1.8 + vec2(t * 0.04, t * 0.03)),
      fbm(centered * 1.8 + vec2(4.1, 2.7) + vec2(-t * 0.03, t * 0.05))
    );
    vec2 warped = centered + (flow - 0.5) * 0.35;

    float n = fbm(warped * (2.2 + uParticleDensity * 0.3) + vec2(t * 0.08, t * 0.06));
    float n2 = fbm(warped * 3.5 - vec2(t * 0.05, t * 0.09));

    float ripple = pondRipple(uv, uChimeCenter, uChimeRipplePhase, uChimeBurst);
    vec2 rippleWarp = normalize(uv - uChimeCenter + 0.0001) * ripple * 0.018;
    float nRipple = fbm((warped + rippleWarp) * 2.5 + vec2(t * 0.07));

    vec3 col = mix(uColorA, uColorB, n);
    col = mix(col, uColorC, n2 * breathe);
    col = mix(col, uColorD, smoothstep(0.25, 0.85, length(centered)));

    if (uMilieuStyle < 0.5) {
      float starField = fbm(uv * 120.0 + vec2(t * 0.01));
      float stars = smoothstep(0.92, 0.97, starField) * uGlowSharpness * 0.6;
      col += vec3(0.75, 0.8, 1.0) * stars;
    } else if (uMilieuStyle < 1.5) {
      col += vec3(1.0, 0.55, 0.18) * smoothstep(0.75, 0.0, uv.y) * 0.35 * breathe;
      col += vec3(1.0, 0.75, 0.28) * max(0.0, centered.y + 0.1) * 0.2;
    } else {
      float rings = sin(length(centered) * 24.0 - uTime * 0.4) * 0.5 + 0.5;
      col += uColorD * rings * 0.12;
    }

    col = mix(col, col * (1.0 + ripple * 0.12) + uColorB * ripple * 0.08, clamp(uChimeBurst, 0.0, 1.0));
    col = mix(col, mix(uColorA, uColorC, nRipple), abs(ripple) * 0.35 * uChimeBurst);

    if (uChimeStyle > 0.5 && uChimeStyle < 1.5 && uChimeBurst > 0.01) {
      float local = pondRipple(uv, uChimeCenter, uChimeRipplePhase, uChimeBurst);
      col += vec3(1.0, 0.7, 0.35) * max(0.0, local) * 0.12;
    }

    if (uStreakIntensity > 0.01) {
      float rain = fbm(uv * vec2(8.0, 40.0) + vec2(-t * 0.6, t * 1.2));
      col += vec3(0.25, 0.35, 0.5) * rain * uStreakIntensity * 0.08;
    }

    col = mix(col, mix(uColorA, uColorB, uBlend), uHumidityBlur * 0.5);
    col = desaturate(col, uDesaturate);

    gl_FragColor = vec4(col, 1.0);
  }
`;
