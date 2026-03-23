import type { CardConfig } from '../../shared/types.ts';

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

function applyThreshold(value: number, threshold: number): number {
  if (threshold <= 0) return value;
  if (threshold >= 1) return value >= 128 ? 255 : 0;
  const mid = 128;
  const contrast = 1 + threshold * 10;
  const shifted = (value - mid) * contrast + mid;
  return Math.max(0, Math.min(255, Math.round(shifted)));
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

export function generateMesh(
  pixels: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  config: CardConfig,
): MeshData {
  const { width: cardW, height: cardH, baseThickness, reliefHeight, threshold, cornerRadius, invert } = config;
  const cols = imgWidth;
  const rows = imgHeight;

  const positions: number[] = [];
  const indexArr: number[] = [];
  let vi = 0;

  function addVertex(x: number, y: number, z: number): number {
    positions.push(x, y, z);
    return vi++;
  }

  function addTriangle(a: number, b: number, c: number) {
    indexArr.push(a, b, c);
  }

  function getX(c: number) { return (c / (cols - 1)) * cardW; }
  function getY(r: number) { return (r / (rows - 1)) * cardH; }

  function isInside(c: number, r: number): boolean {
    return isInsideRoundedRect(getX(c), getY(r), cardW, cardH, cornerRadius);
  }

  function getHeight(c: number, r: number): number {
    if (!isInside(c, r)) return 0;
    let raw = pixels[r * cols + c];
    if (invert) raw = 255 - raw;
    const val = applyThreshold(raw, threshold);
    return baseThickness + (val / 255) * reliefHeight;
  }

  // TOP SURFACE
  const topStart = vi;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      addVertex(getX(c), getY(r), getHeight(c, r));
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (!isInside(c, r) && !isInside(c + 1, r) && !isInside(c, r + 1) && !isInside(c + 1, r + 1)) continue;
      const tl = topStart + r * cols + c;
      addTriangle(tl, tl + cols, tl + 1);
      addTriangle(tl + 1, tl + cols, tl + cols + 1);
    }
  }

  // BOTTOM SURFACE
  const botStart = vi;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      addVertex(getX(c), getY(r), 0);
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (!isInside(c, r) && !isInside(c + 1, r) && !isInside(c, r + 1) && !isInside(c + 1, r + 1)) continue;
      const tl = botStart + r * cols + c;
      addTriangle(tl, tl + 1, tl + cols);
      addTriangle(tl + 1, tl + cols + 1, tl + cols);
    }
  }

  // SIDE WALLS (outer edges + rounded corner perimeter)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i00 = isInside(c, r);
      const i10 = isInside(c + 1, r);
      const i01 = isInside(c, r + 1);
      const i11 = isInside(c + 1, r + 1);

      // Bottom edge
      if (r === 0 && i00 && i10) {
        const a = addVertex(getX(c), 0, getHeight(c, 0));
        const b = addVertex(getX(c + 1), 0, getHeight(c + 1, 0));
        const d = addVertex(getX(c), 0, 0);
        const e = addVertex(getX(c + 1), 0, 0);
        addTriangle(a, d, b); addTriangle(b, d, e);
      }
      // Top edge
      if (r === rows - 2 && i01 && i11) {
        const a = addVertex(getX(c), cardH, getHeight(c, rows - 1));
        const b = addVertex(getX(c + 1), cardH, getHeight(c + 1, rows - 1));
        const d = addVertex(getX(c), cardH, 0);
        const e = addVertex(getX(c + 1), cardH, 0);
        addTriangle(a, b, d); addTriangle(b, e, d);
      }
      // Left edge
      if (c === 0 && i00 && i01) {
        const a = addVertex(0, getY(r), getHeight(0, r));
        const b = addVertex(0, getY(r + 1), getHeight(0, r + 1));
        const d = addVertex(0, getY(r), 0);
        const e = addVertex(0, getY(r + 1), 0);
        addTriangle(a, b, d); addTriangle(b, e, d);
      }
      // Right edge
      if (c === cols - 2 && i10 && i11) {
        const a = addVertex(cardW, getY(r), getHeight(cols - 1, r));
        const b = addVertex(cardW, getY(r + 1), getHeight(cols - 1, r + 1));
        const d = addVertex(cardW, getY(r), 0);
        const e = addVertex(cardW, getY(r + 1), 0);
        addTriangle(a, d, b); addTriangle(b, d, e);
      }

      // Rounded corner perimeter walls
      const edges: [number, number, number, number, boolean][] = [];
      if (i00 !== i10) edges.push([c, r, c + 1, r, i00]);
      if (i00 !== i01) edges.push([c, r, c, r + 1, i00]);
      if (i10 !== i11) edges.push([c + 1, r, c + 1, r + 1, i10]);
      if (i01 !== i11) edges.push([c, r + 1, c + 1, r + 1, i01]);

      for (const [c1, r1, c2, r2, firstInside] of edges) {
        if (!firstInside) continue;
        const x1 = getX(c1), y1 = getY(r1);
        const x2 = getX(c2), y2 = getY(r2);
        const z1 = getHeight(c1, r1), z2 = getHeight(c2, r2);
        const a = addVertex(x1, y1, z1);
        const b = addVertex(x2, y2, z2);
        const d = addVertex(x1, y1, 0);
        const e = addVertex(x2, y2, 0);
        addTriangle(a, b, d); addTriangle(b, e, d);
      }
    }
  }

  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indexArr),
  };
}
