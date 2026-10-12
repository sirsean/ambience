import * as THREE from 'three';
import type { WeatherModifiers } from '../audio/types';
import { ChimeVisualBridge, createDefaultVisualState, type VisualState } from './ChimeVisualBridge';
import { GlassGrid, GLASS_PANE_COUNT, GRID_ROWS, paneSeed } from './GlassGrid';
import { drawingSize, RENDER_FRAME_MS } from './renderBudget';
import { fragmentShader, milieuColors, vertexShader } from './milieus/shaders';

export class AmbienceRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly grid = new GlassGrid();
  private readonly paneColors = new Float32Array(GLASS_PANE_COUNT * 3);
  private readonly paneEffects = new Float32Array(GLASS_PANE_COUNT * 2);
  private readonly rectAttribute = new THREE.InstancedBufferAttribute(this.grid.rects, 4).setUsage(THREE.DynamicDrawUsage);
  private readonly colorAttribute = new THREE.InstancedBufferAttribute(this.paneColors, 3).setUsage(THREE.DynamicDrawUsage);
  private readonly effectAttribute = new THREE.InstancedBufferAttribute(this.paneEffects, 2).setUsage(THREE.DynamicDrawUsage);
  private readonly paletteIndices = new Uint8Array(GLASS_PANE_COUNT);
  private readonly lightPhases = new Float32Array(GLASS_PANE_COUNT);
  private readonly chimeBridge = new ChimeVisualBridge();
  private readonly visualState = createDefaultVisualState();
  private readonly resizeObserver: ResizeObserver;
  private readonly startTime = performance.now();
  private animationId: number | null = null;
  private lastFrameTime: number | null = null;
  private audioLevelSource: (() => number) | null = null;
  private smoothedAudioLevel = 0;
  private disposed = false;
  private contextLost = false;
  private hasSize = false;

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    this.renderer.setClearColor(0x06080d, 1);
    this.renderer.setPixelRatio(1);
    container.appendChild(this.renderer.domElement);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBorderPx: { value: 2.5 },
      },
    });

    this.geometry.setIndex([0, 1, 2, 0, 2, 3]);
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
    ], 3));
    this.geometry.setAttribute('aRect', this.rectAttribute);
    this.geometry.setAttribute('aPaneColor', this.colorAttribute);
    this.geometry.setAttribute('aEffect', this.effectAttribute);
    this.geometry.instanceCount = GLASS_PANE_COUNT;

    const mesh = new THREE.Mesh(this.geometry, this.material);
    // Instance rectangles supply clip-space positions; the unit quad bounds don't describe them.
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    for (let pane = 0; pane < GLASS_PANE_COUNT; pane++) {
      const column = Math.floor(pane / GRID_ROWS);
      const row = pane % GRID_ROWS;
      this.paletteIndices[pane] = (column * 3 + row * 5 + Math.floor(column / 3)) % 8;
      this.lightPhases[pane] = paneSeed(pane + 500) * Math.PI * 2;
    }

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(container);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.handleResize();
  }

  getChimeBridge(): ChimeVisualBridge {
    return this.chimeBridge;
  }

  updateState(partial: Partial<VisualState>): void {
    Object.assign(this.visualState, partial);
  }

  setWeather(modifiers: WeatherModifiers): void {
    this.visualState.weather = modifiers;
  }

  setAudioLevelSource(source: (() => number) | null): void {
    this.audioLevelSource = source;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAnimation();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.audioLevelSource = null;
    this.material.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private stopAnimation(): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.lastFrameTime = null;
  }

  private startAnimation(): void {
    if (this.disposed || this.contextLost || document.hidden || this.animationId !== null) return;
    if (!this.hasSize) return;
    this.animationId = requestAnimationFrame(this.animate);
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.stopAnimation();
    else this.startAnimation();
  };

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.stopAnimation();
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.handleResize();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const { clientWidth, clientHeight } = this.container;
    this.hasSize = clientWidth > 0 && clientHeight > 0;
    if (!this.hasSize) {
      this.stopAnimation();
      return;
    }

    const size = drawingSize(clientWidth, clientHeight, window.devicePixelRatio);
    const canvas = this.renderer.domElement;
    if (canvas.width !== size.width || canvas.height !== size.height) {
      this.renderer.setSize(size.width, size.height, false);
    }
    this.material.uniforms.uResolution.value.set(size.width, size.height);
    this.material.uniforms.uBorderPx.value = Math.max(1.25, (clientWidth < 600 ? 1.5 : 2.5) * size.scale);
    this.startAnimation();
  };

  private animate = (now: number): void => {
    this.animationId = null;
    if (this.disposed || this.contextLost || document.hidden) return;
    this.startAnimation();

    const delta = this.lastFrameTime === null ? RENDER_FRAME_MS : now - this.lastFrameTime;
    if (delta < RENDER_FRAME_MS - 0.5) return;
    this.lastFrameTime = now;

    const elapsed = Math.max(0, (now - this.startTime) / 1000);
    const { milieuBlend, weather } = this.visualState;
    const audioLevel = this.audioLevelSource?.() ?? this.visualState.audioLevel;
    this.smoothedAudioLevel += (audioLevel - this.smoothedAudioLevel) * Math.min(1, delta / 350);
    const chime = this.chimeBridge.update(now);

    this.grid.update(elapsed);
    this.paneEffects.fill(0);
    if (chime.pane >= 0) {
      this.paneEffects[chime.pane * 2] = chime.amount;
      this.paneEffects[chime.pane * 2 + 1] = chime.sweep;
    }

    const fromColors = milieuColors[milieuBlend.from].panes;
    const toColors = milieuColors[milieuBlend.to].panes;
    const blend = milieuBlend.t;
    // Keep weather variation visible without crushing the colors on a dim panel.
    const brightness = Math.max(0.82, Math.min(1.08, weather.brightness));
    const desaturation = weather.desaturate * 0.65 + weather.humidityBlur * 0.08;
    const warmth = weather.warmth * 0.06;

    for (let pane = 0; pane < GLASS_PANE_COUNT; pane++) {
      const paletteIndex = this.paletteIndices[pane];
      const from = fromColors[paletteIndex];
      const to = toColors[paletteIndex];
      const light = brightness * (0.9 + Math.sin(elapsed * 0.12 + this.lightPhases[pane]) * 0.055)
        + this.smoothedAudioLevel * 0.025;
      const offset = pane * 3;
      const red = (from[0] + (to[0] - from[0]) * blend) * light + weather.colorTint[0] * 0.3 + warmth;
      const green = (from[1] + (to[1] - from[1]) * blend) * light + weather.colorTint[1] * 0.3 + warmth * 0.5;
      const blue = (from[2] + (to[2] - from[2]) * blend) * light + weather.colorTint[2] * 0.3;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      this.paneColors[offset] = red + (luminance - red) * desaturation;
      this.paneColors[offset + 1] = green + (luminance - green) * desaturation;
      this.paneColors[offset + 2] = blue + (luminance - blue) * desaturation;

      if (pane === chime.pane) {
        for (let channel = 0; channel < 3; channel++) {
          const base = this.paneColors[offset + channel];
          this.paneColors[offset + channel] = base
            + (chime.color[channel] - base) * chime.amount * 0.7 + chime.amount * 0.1;
        }
      }
    }

    this.rectAttribute.needsUpdate = true;
    this.colorAttribute.needsUpdate = true;
    this.effectAttribute.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  };
}
