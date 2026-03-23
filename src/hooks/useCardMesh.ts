import { useMemo } from 'react';
import * as THREE from 'three';
import type { CardConfig } from '../../shared/types.ts';

const PREVIEW_Z_SCALE = 3;

/**
 * Extrahiert den R-Kanal aus RGBA-Pixeldaten.
 */
function extractGrayscale(
  pixels: Uint8ClampedArray | Uint8Array,
  cols: number,
  rows: number,
): Uint8Array {
  const result = new Uint8Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    result[i] = pixels[i * 4];
  }
  return result;
}

/**
 * Box-Blur auf Grayscale-Array (nicht RGBA).
 */
function blurGrayscale(
  data: Uint8Array,
  cols: number,
  rows: number,
  radius: number,
): Uint8Array {
  const result = new Uint8Array(cols * rows);
  const r = Math.max(1, Math.round(radius));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = row + dy;
          const nx = col + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
            sum += data[ny * cols + nx];
            count++;
          }
        }
      }
      result[row * cols + col] = Math.round(sum / count);
    }
  }
  return result;
}

/**
 * Binärer Threshold: unter Schwelle = 0, darüber = 255.
 * threshold = 0: kein Effekt (Originalwerte)
 * threshold > 0: zunehmend binär
 */
function applyThreshold(value: number, threshold: number): number {
  if (threshold <= 0) return value;
  // Schwellenwert bei 128 (Mitte), threshold bestimmt die Schärfe
  const cutoff = 128;
  if (threshold >= 0.9) return value >= cutoff ? 255 : 0;
  // Weicher Übergang
  const range = Math.max(1, 128 * (1 - threshold));
  const t = (value - cutoff + range) / (2 * range);
  return Math.round(Math.max(0, Math.min(255, t * 255)));
}

function isInsideRoundedRect(
  x: number, y: number,
  w: number, h: number,
  radius: number,
): boolean {
  if (radius <= 0) return true;
  const r = Math.min(radius, w / 2, h / 2);
  if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
  if (x > w - r && y < r) return (x - (w - r)) ** 2 + (y - r) ** 2 <= r * r;
  if (x < r && y > h - r) return (x - r) ** 2 + (y - (h - r)) ** 2 <= r * r;
  if (x > w - r && y > h - r) return (x - (w - r)) ** 2 + (y - (h - r)) ** 2 <= r * r;
  return x >= 0 && x <= w && y >= 0 && y <= h;
}

export function useCardMesh(
  heightmapData: ImageData | null,
  config: CardConfig,
): THREE.BufferGeometry | null {
  return useMemo(() => {
    if (!heightmapData) return null;

    const { width: imgW, height: imgH, data: pixels } = heightmapData;
    const { width: cardW, height: cardH, baseThickness, reliefHeight } = config;
    const threshold = config.threshold ?? 0.5;
    const cornerRadius = config.cornerRadius ?? 3;
    const shouldInvert = config.invert ?? true;

    // Downsample für Preview
    const maxPreviewRes = 200;
    let cols = imgW;
    let rows = imgH;
    let sampledPixels: Uint8ClampedArray | Uint8Array = pixels;

    if (cols > maxPreviewRes || rows > maxPreviewRes) {
      const scale = maxPreviewRes / Math.max(cols, rows);
      cols = Math.round(cols * scale);
      rows = Math.round(rows * scale);
      const downsampled = new Uint8ClampedArray(cols * rows * 4);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const srcC = Math.round((c / (cols - 1)) * (imgW - 1));
          const srcR = Math.round((r / (rows - 1)) * (imgH - 1));
          const srcIdx = (srcR * imgW + srcC) * 4;
          const dstIdx = (r * cols + c) * 4;
          downsampled[dstIdx] = pixels[srcIdx];
        }
      }
      sampledPixels = downsampled;
    }

    // Grayscale extrahieren, dann zweimal glätten für saubere Kanten
    const gray = extractGrayscale(sampledPixels, cols, rows);
    const smoothed = blurGrayscale(blurGrayscale(gray, cols, rows, 3), cols, rows, 3);

    const scaledBase = baseThickness * PREVIEW_Z_SCALE;
    const scaledRelief = reliefHeight * PREVIEW_Z_SCALE;

    function getZ(c: number, r: number): number {
      const x = (c / (cols - 1)) * cardW;
      const y = (r / (rows - 1)) * cardH;
      if (!isInsideRoundedRect(x, y, cardW, cardH, cornerRadius)) return 0;

      let raw = smoothed[r * cols + c];
      if (shouldInvert) raw = 255 - raw;
      const val = applyThreshold(raw, threshold);
      return scaledBase + (val / 255) * scaledRelief;
    }

    function isInside(c: number, r: number): boolean {
      return isInsideRoundedRect(
        (c / (cols - 1)) * cardW,
        (r / (rows - 1)) * cardH,
        cardW, cardH, cornerRadius,
      );
    }

    // Farben: Basis = weiß/cream, Relief = rot/dunkelrot (wie im Beispiel)
    const baseColor = [0.96, 0.92, 0.84]; // cream
    const reliefColor = [0.75, 0.15, 0.15]; // rot

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    let vertIdx = 0;
    const addVert = (x: number, y: number, z: number, isRelief: boolean) => {
      positions.push(x, y, z);
      const col = isRelief ? reliefColor : baseColor;
      colors.push(col[0], col[1], col[2]);
      return vertIdx++;
    };
    const addTri = (a: number, b: number, c: number) => { indices.push(a, b, c); };

    // Schwelle: ab wann gilt ein Vertex als "Relief"?
    const reliefThreshold = scaledBase + scaledRelief * 0.1;

    // TOP SURFACE
    const topStart = vertIdx;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const z = getZ(c, r);
        addVert((c / (cols - 1)) * cardW, (r / (rows - 1)) * cardH, z, z > reliefThreshold);
      }

    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        if (!isInside(c, r) && !isInside(c + 1, r) && !isInside(c, r + 1) && !isInside(c + 1, r + 1)) continue;
        const tl = topStart + r * cols + c;
        addTri(tl, tl + cols, tl + 1);
        addTri(tl + 1, tl + cols, tl + cols + 1);
      }

    // BOTTOM SURFACE
    const botStart = vertIdx;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        addVert((c / (cols - 1)) * cardW, (r / (rows - 1)) * cardH, 0, false);

    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        if (!isInside(c, r) && !isInside(c + 1, r) && !isInside(c, r + 1) && !isInside(c + 1, r + 1)) continue;
        const tl = botStart + r * cols + c;
        addTri(tl, tl + 1, tl + cols);
        addTri(tl + 1, tl + cols + 1, tl + cols);
      }

    // SIDE WALLS (Ränder) — immer Basisfarbe
    for (let c = 0; c < cols - 1; c++) {
      if (isInside(c, 0) && isInside(c + 1, 0)) {
        const x0 = (c / (cols - 1)) * cardW, x1 = ((c + 1) / (cols - 1)) * cardW;
        const a = addVert(x0, 0, getZ(c, 0), false), b = addVert(x1, 0, getZ(c + 1, 0), false);
        const d = addVert(x0, 0, 0, false), e = addVert(x1, 0, 0, false);
        addTri(a, d, b); addTri(b, d, e);
      }
      if (isInside(c, rows - 1) && isInside(c + 1, rows - 1)) {
        const x0 = (c / (cols - 1)) * cardW, x1 = ((c + 1) / (cols - 1)) * cardW;
        const a = addVert(x0, cardH, getZ(c, rows - 1), false), b = addVert(x1, cardH, getZ(c + 1, rows - 1), false);
        const d = addVert(x0, cardH, 0, false), e = addVert(x1, cardH, 0, false);
        addTri(a, b, d); addTri(b, e, d);
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      if (isInside(0, r) && isInside(0, r + 1)) {
        const y0 = (r / (rows - 1)) * cardH, y1 = ((r + 1) / (rows - 1)) * cardH;
        const a = addVert(0, y0, getZ(0, r), false), b = addVert(0, y1, getZ(0, r + 1), false);
        const d = addVert(0, y0, 0, false), e = addVert(0, y1, 0, false);
        addTri(a, b, d); addTri(b, e, d);
      }
      if (isInside(cols - 1, r) && isInside(cols - 1, r + 1)) {
        const y0 = (r / (rows - 1)) * cardH, y1 = ((r + 1) / (rows - 1)) * cardH;
        const a = addVert(cardW, y0, getZ(cols - 1, r), false), b = addVert(cardW, y1, getZ(cols - 1, r + 1), false);
        const d = addVert(cardW, y0, 0, false), e = addVert(cardW, y1, 0, false);
        addTri(a, d, b); addTri(b, d, e);
      }
    }

    // Rounded corner perimeter
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        const i00 = isInside(c, r), i10 = isInside(c + 1, r);
        const i01 = isInside(c, r + 1), i11 = isInside(c + 1, r + 1);
        const edges: [number, number, number, number, boolean][] = [];
        if (i00 !== i10) edges.push([c, r, c + 1, r, i00]);
        if (i00 !== i01) edges.push([c, r, c, r + 1, i00]);
        if (i10 !== i11) edges.push([c + 1, r, c + 1, r + 1, i10]);
        if (i01 !== i11) edges.push([c, r + 1, c + 1, r + 1, i01]);
        for (const [c1, r1, c2, r2, firstInside] of edges) {
          if (!firstInside) continue;
          const x1 = (c1 / (cols - 1)) * cardW, y1 = (r1 / (rows - 1)) * cardH;
          const x2 = (c2 / (cols - 1)) * cardW, y2 = (r2 / (rows - 1)) * cardH;
          const a = addVert(x1, y1, getZ(c1, r1), false), b = addVert(x2, y2, getZ(c2, r2), false);
          const d = addVert(x1, y1, 0, false), e = addVert(x2, y2, 0, false);
          addTri(a, b, d); addTri(b, e, d);
        }
      }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [heightmapData, config]);
}
