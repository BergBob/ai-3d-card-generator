import sharp from 'sharp';
import potrace from 'potrace';
import earcut from 'earcut';
import opentype from 'opentype.js';
import path from 'path';
import type { CardConfig, TextOverlay } from '../../shared/types.ts';

export interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

/**
 * Konvertiert ein Bitmap-Bild über Potrace-Vektorisierung in ein sauberes 3D-Mesh.
 *
 * Pipeline:
 * 1. sharp: Resize, Threshold → sauberes Schwarz/Weiß-Bild
 * 2. potrace: Bitmap → SVG-Pfade (echte Vektoren)
 * 3. SVG-Pfade parsen → Polygone
 * 4. Basis-Box + extrudierte Relief-Polygone → sauberes 3D-Mesh
 */
export async function generateVectorMesh(
  pixels: Uint8Array,
  imgWidth: number,
  imgHeight: number,
  config: CardConfig,
  _isPreview: boolean = false,
): Promise<MeshData> {
  const { width: cardW, height: cardH } = config;

  // Schritt 1: Bildverarbeitung → sauberes Schwarz/Weiß
  const prepWidth = 800;
  const prepHeight = Math.round(prepWidth * (cardH / cardW));

  let processed = sharp(Buffer.from(pixels.buffer), {
    raw: { width: imgWidth, height: imgHeight, channels: 1 },
  })
    .resize(prepWidth, prepHeight, { fit: 'fill' })
    .grayscale();

  // KI-Bilder sind weiß auf schwarz.
  // Potrace tracet immer die DUNKLEN Pixel.
  // invert=true (default): Design soll erhöht werden → negate → Design wird dunkel → Potrace tracet Design ✓
  // invert=false: Hintergrund soll erhöht werden → kein negate → Hintergrund ist dunkel → Potrace tracet Hintergrund ✓
  if (config.invert) {
    processed = processed.negate();
  }

  processed = processed.normalize();

  const thresholdValue = config.threshold ?? 0.7;
  const sharpThreshold = Math.round(128 + (thresholdValue - 0.5) * 100);
  processed = processed.threshold(sharpThreshold);

  const pngBuffer = await processed.png().toBuffer();

  // Schritt 2: Potrace Vektorisierung → SVG
  const svgString = await new Promise<string>((resolve, reject) => {
    potrace.trace(pngBuffer, {
      turdSize: 15,
      alphaMax: 1.2,
      optCurve: true,
      optTolerance: 0.5,
      threshold: 128,
      color: 'white',
      background: 'black',
    }, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });

  // Schritt 3: SVG-Pfade parsen
  const polygons = parseSvgPaths(svgString, prepWidth, prepHeight, cardW, cardH);

  // Schritt 4: Mesh bauen — glatte Basis + extrudierte Vektoren
  return buildVectorMesh(polygons, config);
}

/** Ein Polygon mit optionalen Löchern */
interface Polygon {
  outer: number[][];     // [[x,y], [x,y], ...]
  holes: number[][][];   // Array von Loch-Konturen
}

/**
 * Parst SVG-Pfade aus Potrace-Output und skaliert sie auf Karten-Koordinaten.
 *
 * Potrace erzeugt Pfade mit even-odd fill rule:
 * - Subpfade mit großer Fläche (Bildrand) werden übersprungen
 * - Subpfade werden nach Windung gruppiert: äußere Konturen + Löcher
 */
function parseSvgPaths(
  svg: string,
  svgW: number, svgH: number,
  cardW: number, cardH: number,
): Polygon[] {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  let vbW = svgW, vbH = svgH;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    vbW = parts[2];
    vbH = parts[3];
  }

  const scaleX = cardW / vbW;
  const scaleY = cardH / vbH;
  const totalArea = vbW * vbH;

  // Alle path d-Attribute extrahieren
  const pathRegex = /\bd="([^"]+)"/g;
  const allSubPaths: number[][][] = [];
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(svg)) !== null) {
    const subPaths = parseDAttribute(match[1]);
    allSubPaths.push(...subPaths);
  }

  // Skalieren und Y invertieren (SVG Y-down → Mesh Y-up)
  const scaled = allSubPaths.map(sp =>
    sp.map(([x, y]) => [x * scaleX, (vbH - y) * scaleY])
  );

  // Potrace nutzt even-odd fill rule → Containment-Test statt Windungsrichtung
  // Alle gültigen Subpfade sammeln (nur zu kleine rausfiltern)
  const validPaths = scaled.filter(sp => sp.length >= 3);

  // Schritt 2: Für jeden Pfad zählen, in wie vielen anderen er enthalten ist
  // Even-odd: 0 Container = äußere Kontur, 1 Container = Loch, 2 = nested fill, etc.
  const containCount = new Array(validPaths.length).fill(0);
  const containerOf = new Array(validPaths.length).fill(-1);

  for (let i = 0; i < validPaths.length; i++) {
    // Testpunkt: erster Punkt des Pfads
    const testPt = validPaths[i][0];
    for (let j = 0; j < validPaths.length; j++) {
      if (i === j) continue;
      if (pointInPolygon(testPt, validPaths[j])) {
        containCount[i]++;
        // Merke den kleinsten Container (nächster äußerer Pfad)
        if (containerOf[i] === -1 ||
            Math.abs(signedArea(validPaths[j])) < Math.abs(signedArea(validPaths[containerOf[i]]))) {
          containerOf[i] = j;
        }
      }
    }
  }

  // Schritt 3: Gruppieren — even containCount = äußere Kontur, odd = Loch
  const polygons: Polygon[] = [];
  const outerIndices = new Map<number, number>(); // validPaths-Index → polygons-Index

  // Erst alle äußeren Konturen (containCount gerade)
  for (let i = 0; i < validPaths.length; i++) {
    if (containCount[i] % 2 === 0) {
      outerIndices.set(i, polygons.length);
      polygons.push({ outer: validPaths[i], holes: [] });
    }
  }

  // Dann Löcher zuordnen (containCount ungerade → gehört zum nächsten Container)
  for (let i = 0; i < validPaths.length; i++) {
    if (containCount[i] % 2 === 1 && containerOf[i] !== -1) {
      const parentIdx = outerIndices.get(containerOf[i]);
      if (parentIdx !== undefined) {
        polygons[parentIdx].holes.push(validPaths[i]);
      }
    }
  }

  return polygons;
}

/**
 * Parst ein SVG path d-Attribut in Punkt-Arrays.
 * Unterstützt: M, L, C, Q, Z (absolut und relativ)
 */
function parseDAttribute(d: string): number[][][] {
  const subPaths: number[][][] = [];
  let currentPath: number[][] = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  // Tokenize
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return subPaths;

  let i = 0;
  let cmd = '';

  function nextNum(): number {
    return parseFloat(tokens![i++]);
  }

  while (i < tokens.length) {
    const token = tokens[i];
    if (/[A-Za-z]/.test(token)) {
      cmd = token;
      i++;
    }

    switch (cmd) {
      case 'M':
        if (currentPath.length >= 3) subPaths.push(currentPath);
        cx = nextNum(); cy = nextNum();
        startX = cx; startY = cy;
        currentPath = [[cx, cy]];
        cmd = 'L'; // Nachfolgende Koordinaten sind implizit L
        break;
      case 'm':
        if (currentPath.length >= 3) subPaths.push(currentPath);
        cx += nextNum(); cy += nextNum();
        startX = cx; startY = cy;
        currentPath = [[cx, cy]];
        cmd = 'l';
        break;
      case 'L':
        cx = nextNum(); cy = nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'l':
        cx += nextNum(); cy += nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'H':
        cx = nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'h':
        cx += nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'V':
        cy = nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'v':
        cy += nextNum();
        currentPath.push([cx, cy]);
        break;
      case 'C': {
        const x1 = nextNum(), y1 = nextNum();
        const x2 = nextNum(), y2 = nextNum();
        const x3 = nextNum(), y3 = nextNum();
        subdivideCubic(cx, cy, x1, y1, x2, y2, x3, y3, currentPath, 8);
        cx = x3; cy = y3;
        break;
      }
      case 'c': {
        const dx1 = nextNum(), dy1 = nextNum();
        const dx2 = nextNum(), dy2 = nextNum();
        const dx3 = nextNum(), dy3 = nextNum();
        subdivideCubic(cx, cy, cx + dx1, cy + dy1, cx + dx2, cy + dy2, cx + dx3, cy + dy3, currentPath, 8);
        cx += dx3; cy += dy3;
        break;
      }
      case 'Q': {
        const qx1 = nextNum(), qy1 = nextNum();
        const qx2 = nextNum(), qy2 = nextNum();
        subdivideQuadratic(cx, cy, qx1, qy1, qx2, qy2, currentPath, 8);
        cx = qx2; cy = qy2;
        break;
      }
      case 'q': {
        const qdx1 = nextNum(), qdy1 = nextNum();
        const qdx2 = nextNum(), qdy2 = nextNum();
        subdivideQuadratic(cx, cy, cx + qdx1, cy + qdy1, cx + qdx2, cy + qdy2, currentPath, 8);
        cx += qdx2; cy += qdy2;
        break;
      }
      case 'Z':
      case 'z':
        cx = startX; cy = startY;
        if (currentPath.length >= 3) {
          subPaths.push(currentPath);
        }
        currentPath = [];
        break;
      default:
        i++; // Unbekannten Befehl überspringen
        break;
    }
  }

  if (currentPath.length >= 3) subPaths.push(currentPath);

  // Subpaths nach Orientierung gruppieren:
  // CCW (positive area) = äußere Kontur
  // CW (negative area) = Loch
  const result: number[][][] = [];
  const grouped: Polygon[] = [];

  for (const sp of subPaths) {
    const area = signedArea(sp);
    if (area > 0) {
      // Äußere Kontur (CCW in SVG-Koordinaten, aber Y ist invertiert)
      grouped.push({ outer: sp, holes: [] });
    } else if (area < 0 && grouped.length > 0) {
      // Loch zur letzten äußeren Kontur
      grouped[grouped.length - 1].holes.push(sp);
    } else if (area < 0) {
      // Kein äußerer Pfad vorhanden, als äußeren behandeln (umkehren)
      grouped.push({ outer: sp.slice().reverse(), holes: [] });
    }
  }

  // Zurück in einfaches Format: erster = outer, rest = holes
  for (const g of grouped) {
    const paths = [g.outer, ...g.holes];
    result.push(...paths.map(p => [p]));
  }

  // Flach zurückgeben als subPaths
  return subPaths.length > 0 ? [subPaths[0], ...subPaths.slice(1)] : [];
}

function signedArea(pts: number[][]): number {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  return area / 2;
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(pt: number[], polygon: number[][]): boolean {
  let inside = false;
  const [px, py] = pt;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) &&
        px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function subdivideCubic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  out: number[][],
  steps: number,
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
    out.push([x, y]);
  }
}

function subdivideQuadratic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  out: number[][],
  steps: number,
) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
    const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
    out.push([x, y]);
  }
}

/**
 * Baut das 3D-Mesh: glatte Basis-Box + extrudierte Relief-Polygone
 */
async function buildVectorMesh(polygons: Polygon[], config: CardConfig): Promise<MeshData> {
  const { width: cardW, height: cardH, baseThickness, reliefHeight, cornerRadius } = config;
  const positions: number[] = [];
  const indexArr: number[] = [];
  let vi = 0;

  function addV(x: number, y: number, z: number): number {
    positions.push(x, y, z);
    return vi++;
  }

  function addTri(a: number, b: number, c: number) {
    indexArr.push(a, b, c);
  }

  // === 1. BASIS-BOX mit abgerundeten Ecken ===
  const baseOutline = createRoundedRect(cardW, cardH, cornerRadius);

  // Oberseite der Basis (Z = baseThickness)
  triangulatePolygon(baseOutline, [], baseThickness, addV, addTri, false);

  // Unterseite der Basis (Z = 0)
  triangulatePolygon(baseOutline, [], 0, addV, addTri, true);

  // Seitenwände der Basis
  extrudeWalls(baseOutline, 0, baseThickness, addV, addTri);

  // === 2. RELIEF-POLYGONE extrudieren ===
  const topZ = baseThickness + reliefHeight;
  for (const poly of polygons) {
    // Polygon auf Karten-Bereich clippen
    const clippedOuter = clipToCard(poly.outer, cardW, cardH);
    if (clippedOuter.length < 3) continue;

    const clippedHoles = poly.holes
      .map(h => clipToCard(h, cardW, cardH))
      .filter(h => h.length >= 3);

    // Oberseite des Reliefs (Z = baseThickness + reliefHeight)
    triangulatePolygon(clippedOuter, clippedHoles, topZ, addV, addTri, false);

    // Unterseite des Reliefs (Z = baseThickness) — damit es wasserdicht ist
    triangulatePolygon(clippedOuter, clippedHoles, baseThickness, addV, addTri, true);

    // Seitenwände des Reliefs
    extrudeWalls(clippedOuter, baseThickness, topZ, addV, addTri);
    for (const hole of clippedHoles) {
      extrudeWalls(hole, baseThickness, topZ, addV, addTri);
    }
  }

  // === 3. TEXT-OVERLAYS als 3D-Relief ===
  if (config.textOverlays && config.textOverlays.length > 0) {
    const textPolygons = await getTextPolygons(config.textOverlays, cardW, cardH);
    for (const poly of textPolygons) {
      triangulatePolygon(poly.outer, poly.holes, topZ, addV, addTri, false);
      triangulatePolygon(poly.outer, poly.holes, baseThickness, addV, addTri, true);
      extrudeWalls(poly.outer, baseThickness, topZ, addV, addTri);
      for (const hole of poly.holes) {
        extrudeWalls(hole, baseThickness, topZ, addV, addTri);
      }
    }
  }

  // === 4. BORDER/RAHMEN (optional) ===
  if (config.border?.enabled) {
    const bw = config.border.width;
    const bh = config.border.height;
    const borderTopZ = baseThickness + bh;

    // Äußere Kontur = Karten-Rand
    const outerBorder = createRoundedRect(cardW, cardH, cornerRadius);
    // Innere Kontur = Karten-Rand minus border.width
    const innerR = Math.max(0, cornerRadius - bw);
    const innerBorder = createRoundedRect(cardW - 2 * bw, cardH - 2 * bw, innerR)
      .map(([x, y]) => [x + bw, y + bw]); // Offset zur Mitte

    // Rahmen = äußere Kontur mit innerem Loch
    triangulatePolygon(outerBorder, [innerBorder], borderTopZ, addV, addTri, false);
    triangulatePolygon(outerBorder, [innerBorder], baseThickness, addV, addTri, true);
    extrudeWalls(outerBorder, baseThickness, borderTopZ, addV, addTri);
    extrudeWalls(innerBorder, baseThickness, borderTopZ, addV, addTri);
  }

  return {
    vertices: new Float32Array(positions),
    indices: new Uint32Array(indexArr),
  };
}

/**
 * Erstellt eine abgerundete Rechteck-Kontur.
 */
function createRoundedRect(w: number, h: number, r: number): number[][] {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) {
    return [[0, 0], [w, 0], [w, h], [0, h]];
  }

  const pts: number[][] = [];
  const steps = 8; // Punkte pro Ecke

  // Unten-rechts
  for (let i = 0; i <= steps; i++) {
    const a = (-Math.PI / 2) + (Math.PI / 2) * (i / steps);
    pts.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]);
  }
  // Oben-rechts
  for (let i = 0; i <= steps; i++) {
    const a = 0 + (Math.PI / 2) * (i / steps);
    pts.push([w - r + r * Math.cos(a), h - r + r * Math.sin(a)]);
  }
  // Oben-links
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) + (Math.PI / 2) * (i / steps);
    pts.push([r + r * Math.cos(a), h - r + r * Math.sin(a)]);
  }
  // Unten-links
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (Math.PI / 2) * (i / steps);
    pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]);
  }

  return pts;
}

/**
 * Trianguliert ein Polygon (mit optionalen Löchern) und fügt die Dreiecke hinzu.
 */
function triangulatePolygon(
  outer: number[][],
  holes: number[][][],
  z: number,
  addV: (x: number, y: number, z: number) => number,
  addTri: (a: number, b: number, c: number) => void,
  flipWinding: boolean,
) {
  // Flatten für earcut
  const coords: number[] = [];
  const holeIndices: number[] = [];

  for (const pt of outer) {
    coords.push(pt[0], pt[1]);
  }

  for (const hole of holes) {
    holeIndices.push(coords.length / 2);
    for (const pt of hole) {
      coords.push(pt[0], pt[1]);
    }
  }

  const triangles = earcut(coords, holeIndices.length > 0 ? holeIndices : undefined, 2);
  if (triangles.length === 0) return;

  // Vertices anlegen
  const totalPts = coords.length / 2;
  const startVi = addV(coords[0], coords[1], z); // Ersten Vertex anlegen
  for (let i = 1; i < totalPts; i++) {
    addV(coords[i * 2], coords[i * 2 + 1], z);
  }

  // Dreiecke anlegen
  for (let i = 0; i < triangles.length; i += 3) {
    if (flipWinding) {
      addTri(startVi + triangles[i], startVi + triangles[i + 2], startVi + triangles[i + 1]);
    } else {
      addTri(startVi + triangles[i], startVi + triangles[i + 1], startVi + triangles[i + 2]);
    }
  }
}

/**
 * Erstellt Seitenwände zwischen zwei Z-Ebenen entlang einer Kontur.
 */
function extrudeWalls(
  contour: number[][],
  zBottom: number,
  zTop: number,
  addV: (x: number, y: number, z: number) => number,
  addTri: (a: number, b: number, c: number) => void,
) {
  const n = contour.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x0, y0] = contour[i];
    const [x1, y1] = contour[j];

    const a = addV(x0, y0, zTop);
    const b = addV(x1, y1, zTop);
    const c = addV(x0, y0, zBottom);
    const d = addV(x1, y1, zBottom);

    addTri(a, b, c);
    addTri(b, d, c);
  }
}

/**
 * Einfaches Clipping: Punkte auf den Karten-Bereich beschränken.
 */
function clipToCard(pts: number[][], w: number, h: number): number[][] {
  return pts.map(([x, y]) => [
    Math.max(0, Math.min(w, x)),
    Math.max(0, Math.min(h, y)),
  ]);
}

// Font cache
const fontCache = new Map<string, opentype.Font>();

const FONT_PATHS: Record<string, string> = {
  'Helvetica': '/System/Library/Fonts/Helvetica.ttc',
  'Arial': '/System/Library/Fonts/Supplemental/Arial.ttf',
  'Courier': '/System/Library/Fonts/Courier.ttc',
  'Times': '/System/Library/Fonts/Times.ttc',
};

async function loadFont(name: string): Promise<opentype.Font> {
  if (fontCache.has(name)) return fontCache.get(name)!;
  const fontPath = FONT_PATHS[name] || FONT_PATHS['Helvetica'];
  const font = await opentype.load(fontPath);
  fontCache.set(name, font);
  return font;
}

/**
 * Converts text overlays to 3D-extrudable polygons using opentype.js
 */
async function getTextPolygons(
  overlays: TextOverlay[],
  cardW: number,
  cardH: number,
): Promise<Polygon[]> {
  const polygons: Polygon[] = [];

  for (const overlay of overlays) {
    try {
      const font = await loadFont(overlay.fontFamily);
      // opentype uses points (1pt = ~0.353mm), but we work in mm
      // fontSize in mm, opentype expects a size that produces paths in the right scale
      const opPath = font.getPath(overlay.text, overlay.x, cardH - overlay.y, overlay.fontSize);

      // Parse opentype path commands to subpaths
      const subPaths: number[][][] = [];
      let current: number[][] = [];

      for (const cmd of opPath.commands) {
        switch (cmd.type) {
          case 'M':
            if (current.length >= 3) subPaths.push(current);
            current = [[cmd.x, cmd.y]];
            break;
          case 'L':
            current.push([cmd.x, cmd.y]);
            break;
          case 'Q': {
            // Quadratic bezier → subdivide
            const prev = current[current.length - 1];
            subdivideQuadratic(prev[0], prev[1], cmd.x1, cmd.y1, cmd.x, cmd.y, current, 6);
            break;
          }
          case 'C': {
            const prev2 = current[current.length - 1];
            subdivideCubic(prev2[0], prev2[1], cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y, current, 6);
            break;
          }
          case 'Z':
            if (current.length >= 3) subPaths.push(current);
            current = [];
            break;
        }
      }
      if (current.length >= 3) subPaths.push(current);

      if (subPaths.length === 0) continue;

      // Y is inverted in opentype (screen coords), flip to match our coordinate system
      const flipped = subPaths.map(sp => sp.map(([x, y]) => [x, cardH - y]));

      // Use containment test (same as Potrace polygons)
      const maxArea = cardW * cardH * 0.8;
      const validPaths = flipped.filter(sp => Math.abs(signedArea(sp)) <= maxArea);

      const containCount = new Array(validPaths.length).fill(0);
      const containerOf = new Array(validPaths.length).fill(-1);

      for (let i = 0; i < validPaths.length; i++) {
        const testPt = validPaths[i][0];
        for (let j = 0; j < validPaths.length; j++) {
          if (i === j) continue;
          if (pointInPolygon(testPt, validPaths[j])) {
            containCount[i]++;
            if (containerOf[i] === -1 ||
                Math.abs(signedArea(validPaths[j])) < Math.abs(signedArea(validPaths[containerOf[i]]))) {
              containerOf[i] = j;
            }
          }
        }
      }

      const outerIndices = new Map<number, number>();
      for (let i = 0; i < validPaths.length; i++) {
        if (containCount[i] % 2 === 0) {
          outerIndices.set(i, polygons.length);
          polygons.push({ outer: validPaths[i], holes: [] });
        }
      }
      for (let i = 0; i < validPaths.length; i++) {
        if (containCount[i] % 2 === 1 && containerOf[i] !== -1) {
          const parentIdx = outerIndices.get(containerOf[i]);
          if (parentIdx !== undefined) {
            polygons[parentIdx].holes.push(validPaths[i]);
          }
        }
      }
    } catch (err) {
      console.error(`Text overlay error for "${overlay.text}":`, err);
    }
  }

  return polygons;
}
