export type AudioLogDetail = Record<string, unknown>;

export function audioLog(event: string, detail?: AudioLogDetail): void {
  if (detail) {
    console.log(`[Ambience Audio] ${event}`, detail);
  } else {
    console.log(`[Ambience Audio] ${event}`);
  }
}
