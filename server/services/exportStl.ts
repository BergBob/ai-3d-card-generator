import type { MeshData } from './vectorMeshGenerator.ts';

/**
 * Erzeugt eine binäre STL-Datei aus MeshData.
 * Binäres STL ist kompakter und schneller zu laden als ASCII.
 */
export function exportBinaryStl(mesh: MeshData): Buffer {
  const { vertices, indices } = mesh;
  const triCount = indices.length / 3;

  // Binary STL: 80 bytes header + 4 bytes tri count + 50 bytes per triangle
  const bufferSize = 80 + 4 + triCount * 50;
  const buffer = Buffer.alloc(bufferSize);

  // Header (80 bytes, can be anything)
  buffer.write('CardGenerator STL', 0);

  // Triangle count
  buffer.writeUInt32LE(triCount, 80);

  let offset = 84;

  for (let i = 0; i < triCount; i++) {
    const i0 = indices[i * 3];
    const i1 = indices[i * 3 + 1];
    const i2 = indices[i * 3 + 2];

    // Vertex positions
    const ax = vertices[i0 * 3], ay = vertices[i0 * 3 + 1], az = vertices[i0 * 3 + 2];
    const bx = vertices[i1 * 3], by = vertices[i1 * 3 + 1], bz = vertices[i1 * 3 + 2];
    const cx = vertices[i2 * 3], cy = vertices[i2 * 3 + 1], cz = vertices[i2 * 3 + 2];

    // Compute face normal
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;

    // Normal
    buffer.writeFloatLE(nx, offset); offset += 4;
    buffer.writeFloatLE(ny, offset); offset += 4;
    buffer.writeFloatLE(nz, offset); offset += 4;

    // Vertex 1
    buffer.writeFloatLE(ax, offset); offset += 4;
    buffer.writeFloatLE(ay, offset); offset += 4;
    buffer.writeFloatLE(az, offset); offset += 4;

    // Vertex 2
    buffer.writeFloatLE(bx, offset); offset += 4;
    buffer.writeFloatLE(by, offset); offset += 4;
    buffer.writeFloatLE(bz, offset); offset += 4;

    // Vertex 3
    buffer.writeFloatLE(cx, offset); offset += 4;
    buffer.writeFloatLE(cy, offset); offset += 4;
    buffer.writeFloatLE(cz, offset); offset += 4;

    // Attribute byte count (unused)
    buffer.writeUInt16LE(0, offset); offset += 2;
  }

  return buffer;
}
