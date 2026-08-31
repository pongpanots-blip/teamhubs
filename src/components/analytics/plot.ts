/** Shared geometry for the SVG charts — one viewBox so they stack consistently. */
export const PLOT = {
  width: 720,
  height: 220,
  padLeft: 44,
  padRight: 12,
  padTop: 12,
  padBottom: 26,
};

export const innerWidth = PLOT.width - PLOT.padLeft - PLOT.padRight;
export const innerHeight = PLOT.height - PLOT.padTop - PLOT.padBottom;

/** Value → x pixel, for a series of `count` evenly spaced points. */
export function xAt(index: number, count: number): number {
  if (count <= 1) return PLOT.padLeft + innerWidth / 2;
  return PLOT.padLeft + (index / (count - 1)) * innerWidth;
}

/** Value → y pixel, with 0 at the bottom of the plot. */
export function yAt(value: number, max: number): number {
  if (max <= 0) return PLOT.padTop + innerHeight;
  return PLOT.padTop + innerHeight * (1 - Math.min(1, value / max));
}

/** A max that leaves headroom and never collapses the axis to zero height. */
export function axisMax(values: number[]): number {
  const peak = Math.max(0, ...values);
  return peak === 0 ? 1 : peak * 1.1;
}

export function shortDate(iso: string): string {
  return iso.slice(5).replace("-", "/");
}
