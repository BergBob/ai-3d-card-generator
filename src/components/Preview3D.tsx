import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CardConfig } from '../../shared/types.ts';

interface Props {
  stlUrl: string | null;
  config: CardConfig;
}

function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  r = Math.min(r, w / 2, h / 2);
  const shape = new THREE.Shape();
  shape.moveTo(r, 0);
  shape.lineTo(w - r, 0);
  shape.quadraticCurveTo(w, 0, w, r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(r, h);
  shape.quadraticCurveTo(0, h, 0, h - r);
  shape.lineTo(0, r);
  shape.quadraticCurveTo(0, 0, r, 0);
  return shape;
}

function createPlaceholderMesh(config: CardConfig): THREE.Mesh {
  const w = config.width;
  const h = config.height;
  const r = config.cornerRadius ?? 3;
  const thickness = (config.baseThickness ?? 1) * 2;

  const shape = createRoundedRectShape(w, h, r);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });

  const mat = new THREE.MeshStandardMaterial({
    color: 0xf5ead6,
    roughness: 0.45,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function Preview3D({ stlUrl, config }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    cardGroup: THREE.Group;
    table: THREE.Mesh;
    animId: number;
  } | null>(null);
  const initialCameraRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // Szene initialisieren
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a3e);

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      2000,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // Beleuchtung — flacher Winkel für Relief-Schatten
    const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
    keyLight.position.set(-80, -20, 30);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 500;
    keyLight.shadow.camera.left = -200;
    keyLight.shadow.camera.right = 200;
    keyLight.shadow.camera.top = 200;
    keyLight.shadow.camera.bottom = -200;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc0c8ff, 0.7);
    fillLight.position.set(100, 80, 60);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffd080, 0.4);
    rimLight.position.set(0, 120, 15);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0x505070, 0.5);
    scene.add(ambientLight);

    // Build-Plate mit Gitterlinien
    const plateSize = 600;
    const tableGeo = new THREE.PlaneGeometry(plateSize, plateSize);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a3a,
      roughness: 0.9,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.receiveShadow = true;
    table.position.set(75, 50, -0.5);
    scene.add(table);

    // Grid overlay
    const gridGroup = new THREE.Group();
    const gridSize = 300;
    const gridStep = 10; // 10mm grid
    const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.12, transparent: true });
    const gridMatBold = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.25, transparent: true });
    for (let i = -gridSize; i <= gridSize; i += gridStep) {
      const isBold = i % 50 === 0;
      const mat = isBold ? gridMatBold : gridMat;
      // Horizontal lines
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-gridSize, i, 0),
        new THREE.Vector3(gridSize, i, 0),
      ]);
      gridGroup.add(new THREE.Line(hGeo, mat));
      // Vertical lines
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(i, -gridSize, 0),
        new THREE.Vector3(i, gridSize, 0),
      ]);
      gridGroup.add(new THREE.Line(vGeo, mat));
    }
    gridGroup.position.set(75, 50, -0.4);
    scene.add(gridGroup);

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    camera.position.set(75, -60, 100);
    controls.target.set(75, 50, 0);
    controls.update();

    const state = {
      scene, camera, renderer, controls, cardGroup, table,
      animId: 0,
    };
    sceneRef.current = state;

    function animate() {
      state.animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(state.animId);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // STL laden oder Placeholder anzeigen
  useEffect(() => {
    const state = sceneRef.current;
    if (!state) return;

    // Alte Meshes entfernen
    while (state.cardGroup.children.length > 0) {
      const child = state.cardGroup.children[0];
      state.cardGroup.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    if (!stlUrl) {
      // Placeholder
      const placeholder = createPlaceholderMesh(config);
      state.cardGroup.add(placeholder);
      frameMesh(state, placeholder);
      return;
    }

    // STL vom Server laden (wie Gridfinity)
    const loader = new STLLoader();
    loader.load(
      stlUrl,
      (rawGeometry) => {
        // Vertices zusammenführen für glatte Normalen über Dreiecksgrenzen
        const geometry = mergeVertices(rawGeometry);
        geometry.computeVertexNormals();

        // Vertex-Colors basierend auf Höhe
        const positions = geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);

        // Min/Max Z bestimmen
        let minZ = Infinity, maxZ = -Infinity;
        for (let i = 0; i < positions.count; i++) {
          const z = positions.getZ(i);
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }

        // Alles knapp über Basis-Oberseite = Relief
        const baseLevel = config.baseThickness + 0.01;
        const bHex = new THREE.Color(config.baseColor ?? '#e0e0e0');
        const rHex = new THREE.Color(config.reliefColor ?? '#818cf8');
        const baseColor = [bHex.r, bHex.g, bHex.b];
        const reliefColor = [rHex.r, rHex.g, rHex.b];

        for (let i = 0; i < positions.count; i++) {
          const z = positions.getZ(i);
          const isRelief = z > baseLevel;
          const col = isRelief ? reliefColor : baseColor;
          colors[i * 3] = col[0];
          colors[i * 3 + 1] = col[1];
          colors[i * 3 + 2] = col[2];
        }

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.45,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        state.cardGroup.add(mesh);
        frameMesh(state, mesh, initialCameraRef);
      },
      undefined,
      (error) => {
        console.error('STL laden fehlgeschlagen:', error);
      },
    );
  }, [stlUrl, config]);

  const handleResetCamera = useCallback(() => {
    const state = sceneRef.current;
    const initial = initialCameraRef.current;
    if (!state || !initial) return;
    state.camera.position.copy(initial.pos);
    state.controls.target.copy(initial.target);
    state.controls.update();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '300px' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      />
      {stlUrl && (
        <button
          className="reset-camera-btn"
          onClick={handleResetCamera}
          title="Reset camera view"
        >
          Reset View
        </button>
      )}
    </div>
  );
}

function frameMesh(
  state: {
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    table: THREE.Mesh;
  },
  mesh: THREE.Mesh,
  saveTo?: React.MutableRefObject<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>,
) {
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  state.table.position.set(center.x, center.y, -0.5);

  const cardDiag = Math.max(size.x, size.y);
  state.controls.target.copy(center);
  state.camera.position.set(
    center.x,
    center.y - cardDiag * 0.8,
    center.z + cardDiag * 0.8,
  );
  state.controls.update();

  if (saveTo) {
    saveTo.current = { pos: state.camera.position.clone(), target: center.clone() };
  }
}
