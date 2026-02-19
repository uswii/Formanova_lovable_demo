import { useRef, useState, useCallback, useEffect, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls, TransformControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";

// Clickable mesh wrapper — highlights selected, emits click
function SelectableMesh({
  mesh,
  isSelected,
  onClick,
}: {
  mesh: THREE.Mesh;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const mat = ref.current.material as THREE.MeshStandardMaterial;
    if (mat && "emissive" in mat) {
      mat.emissive = new THREE.Color(isSelected ? 0x334455 : 0x000000);
      mat.emissiveIntensity = isSelected ? 0.4 : 0;
    }
  }, [isSelected]);

  return (
    <mesh
      ref={ref}
      geometry={mesh.geometry}
      material={mesh.material}
      position={mesh.position.clone()}
      rotation={mesh.rotation.clone()}
      scale={mesh.scale.clone()}
      onClick={onClick}
    />
  );
}

function LoadedModel({
  url,
  selectedMeshNames,
  onMeshClick,
  transformMode,
}: {
  url: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
}) {
  const { scene } = useGLTF(url);
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const found: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        // Ensure material is cloned so emissive changes are independent
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mat) => mat.clone());
        } else {
          m.material = m.material.clone();
        }
        found.push(m);
      }
    });
    setMeshes(found);
  }, [scene]);

  // Get the first selected mesh for TransformControls
  const selectedMesh = meshes.find((m) => selectedMeshNames.has(m.name));

  return (
    <group ref={groupRef} scale={10}>
      {meshes.map((mesh) => (
        <SelectableMesh
          key={mesh.uuid}
          mesh={mesh}
          isSelected={selectedMeshNames.has(mesh.name)}
          onClick={(e) => {
            e.stopPropagation();
            onMeshClick(mesh.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}
      {selectedMesh && transformMode !== "orbit" && (
        <TransformControls
          object={selectedMesh}
          mode={transformMode as "translate" | "rotate" | "scale"}
          size={0.6}
        />
      )}
    </group>
  );
}

// Deselect on empty click
function ClickAwayHandler({ onDeselect }: { onDeselect: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // Only if clicking on the canvas background
      if ((e.target as HTMLElement)?.tagName === "CANVAS") {
        // We'll rely on the mesh onClick stopPropagation
      }
    };
    gl.domElement.addEventListener("pointerdown", handler);
    return () => gl.domElement.removeEventListener("pointerdown", handler);
  }, [gl, onDeselect]);
  return null;
}

interface CADCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
}

export default function CADCanvas({ hasModel, glbUrl, selectedMeshNames, onMeshClick, transformMode }: CADCanvasProps) {
  const modelUrl = glbUrl || "/models/ring.glb";

  return (
    <div className="w-full h-full" style={{ background: "#111" }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 2]}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 2, 5] }}
        onPointerMissed={() => onMeshClick("", false)}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 7.5]} intensity={5.0} castShadow />
          <directionalLight position={[-5, 4, -8]} intensity={2.0} />
          <directionalLight position={[0, -5, 3]} intensity={1.0} color="#aaccff" />
          <directionalLight position={[8, 2, 0]} intensity={1.5} color="#aaccff" />
          <Environment preset="studio" />
          {hasModel && (
            <LoadedModel
              url={modelUrl}
              selectedMeshNames={selectedMeshNames}
              onMeshClick={onMeshClick}
              transformMode={transformMode}
            />
          )}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping
            dampingFactor={0.05}
            autoRotate={false}
            autoRotateSpeed={1.0}
            minDistance={1}
            maxDistance={20}
            makeDefault
          />
          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport labelColor="white" axisHeadScale={0.8} />
          </GizmoHelper>
        </Suspense>
      </Canvas>

      {/* Empty state */}
      {!hasModel && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ border: "1px solid #333" }}>
              <svg className="w-8 h-8 text-[#444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 0l-2.25 1.313" />
              </svg>
            </div>
            <p className="text-[#555] text-[10px] uppercase tracking-[3px]">
              Describe your ring to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/models/ring.glb");
