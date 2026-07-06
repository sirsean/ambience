export const milieuColors = {
  night: { primary: [0.05, 0.04, 0.15] as const, accent: [0.3, 0.2, 0.6] as const },
  sunrise: { primary: [0.25, 0.08, 0.05] as const, accent: [1.0, 0.55, 0.15] as const },
  day: { primary: [0.03, 0.08, 0.22] as const, accent: [0.15, 0.42, 0.78] as const },
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
  uniform vec3 uWeatherTint;
  uniform float uWeatherBrightness;
  uniform float uWeatherWarmth;

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

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;

    float t = uTime * (0.12 + uMilieuStyle * 0.08);
    float breathe = 0.5 + 0.5 * sin(uTime * 0.35) + uAudioLevel * 0.2;

    // Chime zone — style-specific motion and color computed below
    vec2 chimeDelta = uv - uChimeCenter;
    float chimeDist = length(chimeDelta);
    float chimeAngle = atan(chimeDelta.y, chimeDelta.x);
    float chimePhase = uChimeRipplePhase;
    vec2 chimeDir = normalize(chimeDelta + 0.0001);

    vec2 chimeWarpOffset = vec2(0.0);
    vec3 chimeCol = vec3(0.0);
    float chimeBlend = 0.0;

    if (uChimeBurst > 0.001) {
      if (uChimeStyle < 0.5) {
        // Ripple — concentric water rings, cool palette, strong radial warp
        float rings = sin(chimeDist * 48.0 - chimePhase * 16.0);
        float ringBands = smoothstep(0.55, 0.0, abs(fract(chimeDist * 14.0 - chimePhase * 4.5) - 0.5));
        float zone = exp(-chimeDist * 3.8) * uChimeBurst;

        chimeWarpOffset = chimeDir * rings * 0.09 * zone;
        vec2 rippleLocal = chimeDelta + chimeDir * rings * 0.14;
        float rippleN = fbm(rippleLocal * 6.0 + vec2(chimePhase * 0.35));
        vec3 coolA = mix(uColorB, vec3(0.2, 0.75, 0.95), 0.55);
        vec3 coolB = mix(uColorD, vec3(0.45, 0.95, 1.0), 0.45);
        chimeCol = mix(coolA * 1.3, coolB * 1.5, rippleN);
        chimeCol += coolB * ringBands * 0.55;
        chimeCol *= 0.8 + abs(rings) * 0.25;
        chimeBlend = zone * (0.5 + ringBands * 0.45 + abs(rings) * 0.12);

      } else if (uChimeStyle < 1.5) {
        // Flare — hot radial bloom with soft rays, minimal ring structure
        float bloom = exp(-chimeDist * 1.6) * uChimeBurst;
        float hotCore = exp(-chimeDist * 10.0) * (0.7 + 0.3 * sin(chimePhase * 4.0));
        float rays = pow(max(0.0, sin(chimeAngle * 6.0 + chimePhase * 1.5)), 3.0);
        rays *= exp(-chimeDist * 2.2);
        float warmN = fbm(chimeDelta * 3.5 + vec2(chimePhase * 0.12, chimePhase * 0.08));

        chimeCol = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.72, 0.22), warmN);
        chimeCol = mix(chimeCol, vec3(1.0, 0.95, 0.75), hotCore);
        chimeCol += vec3(1.0, 0.88, 0.55) * rays * 0.45 * uChimeBurst;
        chimeCol *= 0.85 + hotCore * 0.55;
        chimeBlend = bloom * (0.65 + hotCore * 0.35 + rays * 0.15);

      } else {
        // Pulse — breathing radial bands that expand and contract
        float breathe = 0.5 + 0.5 * sin(chimePhase * 10.0);
        float expand = chimeDist - chimePhase * 0.08 * breathe;
        float bands = sin(expand * 32.0) * 0.5 + 0.5;
        float bandEdges = smoothstep(0.42, 0.0, abs(fract(expand * 9.0) - 0.5));
        float zone = exp(-chimeDist * (2.2 - breathe * 0.6)) * uChimeBurst;

        chimeWarpOffset = chimeDir * sin(chimePhase * 10.0) * 0.035 * zone;
        vec3 bright = mix(uColorD, uColorB, 0.4) * 2.2;
        vec3 dim = mix(uColorA, uColorC, 0.35) * 0.45;
        chimeCol = mix(dim, bright, bands);
        chimeCol = mix(chimeCol, bright * 1.3, bandEdges * breathe);
        chimeCol *= 0.55 + breathe * 0.65;
        chimeBlend = zone * (0.45 + bandEdges * 0.5 + bands * 0.2);
      }

      chimeBlend = clamp(chimeBlend * smoothstep(0.6, 0.0, chimeDist), 0.0, 0.94);
    }

    vec2 flow = vec2(
      fbm(centered * 1.8 + vec2(t * 0.04, t * 0.03)),
      fbm(centered * 1.8 + vec2(4.1, 2.7) + vec2(-t * 0.03, t * 0.05))
    );
    vec2 warped = centered + (flow - 0.5) * 0.35 + chimeWarpOffset;

    float n = fbm(warped * (2.2 + uParticleDensity * 0.3) + vec2(t * 0.08, t * 0.06));
    float n2 = fbm(warped * 3.5 - vec2(t * 0.05, t * 0.09));

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
      col += uColorD * rings * 0.1;

      col *= uWeatherBrightness;
      col += uWeatherTint;
      vec3 warmSky = vec3(0.18, 0.14, 0.06);
      col = mix(col, col + warmSky, uWeatherWarmth);
    }

    col = mix(col, chimeCol, chimeBlend);

    if (uStreakIntensity > 0.01) {
      float rain = fbm(uv * vec2(8.0, 40.0) + vec2(-t * 0.6, t * 1.2));
      col += vec3(0.25, 0.35, 0.5) * rain * uStreakIntensity * 0.08;
    }

    col = mix(col, mix(uColorA, uColorB, uBlend), uHumidityBlur * 0.5);
    col = desaturate(col, uDesaturate);

    gl_FragColor = vec4(col, 1.0);
  }
`;
