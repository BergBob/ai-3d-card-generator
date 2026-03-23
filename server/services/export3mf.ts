import { zipSync } from 'fflate';
import type { MeshData } from './vectorMeshGenerator.ts';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

function buildModelXml(mesh: MeshData): string {
  const { vertices, indices } = mesh;
  const vertCount = vertices.length / 3;
  const triCount = indices.length / 3;

  const vertLines: string[] = [];
  for (let i = 0; i < vertCount; i++) {
    const x = vertices[i * 3].toFixed(4);
    const y = vertices[i * 3 + 1].toFixed(4);
    const z = vertices[i * 3 + 2].toFixed(4);
    vertLines.push(`        <vertex x="${x}" y="${y}" z="${z}"/>`);
  }

  const triLines: string[] = [];
  for (let i = 0; i < triCount; i++) {
    const v1 = indices[i * 3];
    const v2 = indices[i * 3 + 1];
    const v3 = indices[i * 3 + 2];
    triLines.push(`        <triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Application">CardGenerator</metadata>
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
${vertLines.join('\n')}
        </vertices>
        <triangles>
${triLines.join('\n')}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`;
}

export function export3mf(mesh: MeshData): Uint8Array {
  const modelXml = buildModelXml(mesh);
  const encoder = new TextEncoder();

  const zipData = zipSync({
    '[Content_Types].xml': encoder.encode(CONTENT_TYPES),
    '_rels/.rels': encoder.encode(RELS),
    '3D/3dmodel.model': encoder.encode(modelXml),
  });

  return zipData;
}
