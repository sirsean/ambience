export const GRID_COLUMNS = 8;
export const GRID_ROWS = 6;
export const GLASS_PANE_COUNT = GRID_COLUMNS * GRID_ROWS;

/** Stable variation, used only when initializing panes. */
export function paneSeed(index: number): number {
  let value = Math.imul(index + 1, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

/** A fixed tiling: positive weights keep every pane visible as neighbors trade space. */
export class GlassGrid {
  readonly rects = new Float32Array(GLASS_PANE_COUNT * 4);
  private readonly columnWeights = new Float64Array(GRID_COLUMNS);
  private readonly rowWeights = new Float64Array(GRID_ROWS);
  private readonly columnPhases = new Float64Array(GRID_COLUMNS);
  private readonly rowPhases = new Float64Array(GLASS_PANE_COUNT);
  private readonly rowSpeeds = new Float64Array(GLASS_PANE_COUNT);
  private readonly rowBases = new Float64Array(GLASS_PANE_COUNT);

  constructor() {
    for (let column = 0; column < GRID_COLUMNS; column++) {
      this.columnPhases[column] = paneSeed(column + 100) * Math.PI * 2;
    }
    for (let pane = 0; pane < GLASS_PANE_COUNT; pane++) {
      this.rowPhases[pane] = paneSeed(pane + 200) * Math.PI * 2;
      this.rowSpeeds[pane] = 0.1 + paneSeed(pane + 300) * 0.08;
      this.rowBases[pane] = 0.84 + paneSeed(pane + 400) * 0.3;
    }
    this.update(0);
  }

  update(timeSeconds: number): void {
    let totalWidth = 0;
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const weight = 1 + Math.sin(timeSeconds * 0.095 + this.columnPhases[column]) * 0.38;
      this.columnWeights[column] = weight;
      totalWidth += weight;
    }

    let x = 0;
    for (let column = 0; column < GRID_COLUMNS; column++) {
      const width = column === GRID_COLUMNS - 1 ? 1 - x : this.columnWeights[column] / totalWidth;
      let totalHeight = 0;
      for (let row = 0; row < GRID_ROWS; row++) {
        const pane = column * GRID_ROWS + row;
        const weight = this.rowBases[pane]
          + Math.sin(timeSeconds * this.rowSpeeds[pane] + this.rowPhases[pane]) * 0.36;
        this.rowWeights[row] = weight;
        totalHeight += weight;
      }

      let y = 0;
      for (let row = 0; row < GRID_ROWS; row++) {
        const offset = (column * GRID_ROWS + row) * 4;
        const height = row === GRID_ROWS - 1 ? 1 - y : this.rowWeights[row] / totalHeight;
        this.rects[offset] = x;
        this.rects[offset + 1] = y;
        this.rects[offset + 2] = width;
        this.rects[offset + 3] = height;
        y += height;
      }
      x += width;
    }
  }
}
