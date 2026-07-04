import * as THREE from 'three';
import type { Milieu, WeatherModifiers } from '../audio/types';
import { ChimeVisualBridge, type VisualState } from './ChimeVisualBridge';
import { fragmentShader, milieuColors, vertexShader } from './milieus/shaders';

const MILIEU_STYLE: Record<Milieu, number> = {
  night: 0,
  sunrise: 1,
  day: 2,
};

function lerpColor(a: readonly [number, number, number], b: readonly [number, number, number], t: number): THREE.Vector3 {
  return new THREE.Vector3(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
}

export class AmbienceRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private chimeBridge = new ChimeVisualBridge();
  private animationId: number | null = null;
  private startTime = performance.now();
  private visualState: VisualState;
  private resizeObserver: ResizeObserver;

  constructor(private container: HTMLElement) {
    this.visualState = {
      audioLevel: 0,
      chimeBurst: 0,
      milieuBlend: { from: 'day', to: 'day', t: 1 },
      weather: {
        desaturate: 0,
        particleDensity: 1,
        streakIntensity: 0,
        glowSharpness: 1,
        humidityBlur: 0,
        colorTint: [0, 0, 0],
        brightness: 1,
        warmth: 0,
      },
      time: 0,
    };

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uAudioLevel: { value: 0 },
        uChimeBurst: { value: 0 },
        uChimeStyle: { value: 0 },
        uChimeCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uChimeRipplePhase: { value: 0 },
        uColorA: { value: new THREE.Vector3(...milieuColors.day.primary) },
        uColorB: { value: new THREE.Vector3(...milieuColors.day.accent) },
        uColorC: { value: new THREE.Vector3(...milieuColors.day.primary) },
        uColorD: { value: new THREE.Vector3(...milieuColors.day.accent) },
        uBlend: { value: 1 },
        uDesaturate: { value: 0 },
        uParticleDensity: { value: 1 },
        uStreakIntensity: { value: 0 },
        uGlowSharpness: { value: 1 },
        uHumidityBlur: { value: 0 },
        uMilieuStyle: { value: 2 },
        uWeatherTint: { value: new THREE.Vector3(0, 0, 0) },
        uWeatherBrightness: { value: 1 },
        uWeatherWarmth: { value: 0 },
      },
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    this.handleResize();
    this.animate();
  }

  getChimeBridge(): ChimeVisualBridge {
    return this.chimeBridge;
  }

  updateState(partial: Partial<VisualState>): void {
    this.visualState = { ...this.visualState, ...partial };
  }

  setWeather(modifiers: WeatherModifiers): void {
    this.visualState.weather = modifiers;
  }

  dispose(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    this.material.dispose();
    this.mesh.geometry.dispose();
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }

  private handleResize(): void {
    const { clientWidth, clientHeight } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const elapsed = (performance.now() - this.startTime) / 1000;
    const { milieuBlend, weather, audioLevel } = this.visualState;
    const { burst, style: chimeStyle, center, ripplePhase } = this.chimeBridge.update();

    const fromColors = milieuColors[milieuBlend.from];
    const toColors = milieuColors[milieuBlend.to];
    const t = milieuBlend.t;

    const styleFrom = MILIEU_STYLE[milieuBlend.from];
    const styleTo = MILIEU_STYLE[milieuBlend.to];
    const milieuStyle = styleFrom + (styleTo - styleFrom) * t;

    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uAudioLevel.value = audioLevel;
    this.material.uniforms.uChimeBurst.value = burst;
    this.material.uniforms.uChimeStyle.value = chimeStyle;
    this.material.uniforms.uChimeCenter.value.set(center.x, center.y);
    this.material.uniforms.uChimeRipplePhase.value = ripplePhase;
    this.material.uniforms.uColorA.value = lerpColor(fromColors.primary, toColors.primary, t);
    this.material.uniforms.uColorB.value = lerpColor(fromColors.accent, toColors.accent, t);
    this.material.uniforms.uColorC.value = lerpColor(fromColors.primary, toColors.accent, t * 0.5);
    this.material.uniforms.uColorD.value = lerpColor(fromColors.accent, toColors.primary, t * 0.5);
    this.material.uniforms.uBlend.value = t;
    this.material.uniforms.uDesaturate.value = weather.desaturate;
    this.material.uniforms.uParticleDensity.value = weather.particleDensity;
    this.material.uniforms.uStreakIntensity.value = weather.streakIntensity;
    this.material.uniforms.uGlowSharpness.value = weather.glowSharpness;
    this.material.uniforms.uHumidityBlur.value = weather.humidityBlur;
    this.material.uniforms.uMilieuStyle.value = milieuStyle;
    this.material.uniforms.uWeatherTint.value.set(...weather.colorTint);
    this.material.uniforms.uWeatherBrightness.value = weather.brightness;
    this.material.uniforms.uWeatherWarmth.value = weather.warmth;

    this.renderer.render(this.scene, this.camera);
  };
}
