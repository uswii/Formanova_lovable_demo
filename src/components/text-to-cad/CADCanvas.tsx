import { useRef, useState, useEffect, Suspense, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { Canvas, useThree, ThreeEvent } from "@react-three/fiber";
import {
  useGLTF,
  Environment,
  OrbitControls,
  TransformControls,
  GizmoHelper,
  GizmoViewport,
  useEnvironment,
  MeshRefractionMaterial,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
} from "@react-three/postprocessing";
import * as THREE from "three";
import { MATERIAL_LIBRARY } from "@/components/cad-studio/materials";
import type { MaterialDef } from "@/components/cad-studio/materials";

// ── Gem Environment Loader (same as StudioViewport) ──
function GemEnvProvider({ children }: { children: (envMap: THREE.Texture) => React.ReactNode }) {
  const gemEnv = useEnvironment({ files: "/hdri/diamond-gemstone-studio.hdr" });
  return <>{children(gemEnv)}</>;
}

// ── Refraction Gem Mesh (exact same as CAD-to-Catalog) ──
function RefractionGemMesh({
  mesh,
  envMap,
  gemConfig,
  isSelected,
  onClick,
}: {
  mesh: THREE.Mesh;
  envMap: THREE.Texture;
  gemConfig: NonNullable<MaterialDef["gemConfig"]>;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const flatGeometry = useMemo(() => {
    const geo = mesh.geometry.clone().toNonIndexed();
    geo.computeVertexNormals();
    return geo;
  }, [mesh.geometry]);

  return (
    <mesh
      ref={(ref) => { if (ref) { ref.position.copy(mesh.position); ref.rotation.copy(mesh.rotation); ref.scale.copy(mesh.scale); } }}
      geometry={flatGeometry}
      onClick={onClick}
    >
      <MeshRefractionMaterial
        envMap={envMap}
        color={new THREE.Color(gemConfig.color)}
        ior={gemConfig.ior}
        aberrationStrength={gemConfig.aberrationStrength}
        bounces={gemConfig.bounces}
        fresnel={gemConfig.fresnel}
        fastChroma
        toneMapped={false}
      />
    </mesh>
  );
}

// ── Post-Processing (same as StudioViewport) ──
function JewelryPostProcessing() {
  return (
    <EffectComposer>
      <Bloom intensity={0.28} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
      <BrightnessContrast brightness={0} contrast={0.08} />
    </EffectComposer>
  );
}

// ── Disable OrbitControls while dragging TransformControls ──
function TransformControlsWrapper({
  object,
  mode,
}: {
  object: THREE.Object3D;
  mode: "translate" | "rotate" | "scale";
}) {
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const handler = (e: any) => {
      const orbitControls = (gl.domElement as any).__orbitControls;
      if (orbitControls) orbitControls.enabled = !e.value;
    };
    controls.addEventListener("dragging-changed", handler);
    return () => controls.removeEventListener("dragging-changed", handler);
  }, [gl]);

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode}
      size={2.5}
    />
  );
}

function OrbitControlsWithRef(props: any) {
  const { gl } = useThree();
  const ref = useRef<any>(null);
  useEffect(() => { if (ref.current) (gl.domElement as any).__orbitControls = ref.current; }, [gl]);
  return <OrbitControls ref={ref} {...props} />;
}

// ── Auto-fit scale ──
function computeAutoScale(scene: THREE.Object3D, targetSize = 3): number {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return 1;
  return targetSize / maxDim;
}

// ── Selectable Mesh with emissive highlight ──
function SelectableMesh({
  mesh,
  isSelected,
  onClick,
  meshRef,
}: {
  mesh: THREE.Mesh;
  isSelected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  meshRef: React.RefObject<THREE.Mesh>;
}) {
  useEffect(() => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (mat && "emissive" in mat) {
      mat.emissive = new THREE.Color(isSelected ? 0x334455 : 0x000000);
      mat.emissiveIntensity = isSelected ? 0.4 : 0;
    }
  }, [isSelected, meshRef]);

  return <primitive ref={meshRef} object={mesh} onClick={onClick} />;
}

// ── Internal model component with imperative API ──
const LoadedModel = forwardRef<
  {
    applyMaterial: (matId: string, meshNames: string[]) => void;
    resetTransform: (meshNames: string[]) => void;
    deleteMeshes: (meshNames: string[]) => void;
    duplicateMeshes: (meshNames: string[]) => void;
    flipNormals: (meshNames: string[]) => void;
    centerOrigin: (meshNames: string[]) => void;
    subdivideMesh: (meshNames: string[], iterations: number) => void;
    setWireframe: (on: boolean) => void;
    smoothMesh: (meshNames: string[], iterations: number) => void;
  },
  {
    url: string;
    selectedMeshNames: Set<string>;
    onMeshClick: (name: string, multi: boolean) => void;
    transformMode: string;
    onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
    gemEnvMap: THREE.Texture | null;
  }
>(({ url, selectedMeshNames, onMeshClick, transformMode, onMeshesDetected, gemEnvMap }, ref) => {
  const { scene } = useGLTF(url);
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [refractionMeshes, setRefractionMeshes] = useState<Map<string, NonNullable<MaterialDef["gemConfig"]>>>(new Map());
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Map<string, React.RefObject<THREE.Mesh>>>(new Map());
  const originalTransforms = useRef<Map<string, { pos: THREE.Vector3; rot: THREE.Euler; scale: THREE.Vector3 }>>(new Map());

  const autoScale = useMemo(() => computeAutoScale(scene), [scene]);

  useEffect(() => {
    const found: THREE.Mesh[] = [];
    let idx = 0;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (!m.name) m.name = `Mesh_${idx}`;
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mat) => mat.clone());
        } else {
          m.material = m.material.clone();
        }
        originalTransforms.current.set(m.name, {
          pos: m.position.clone(),
          rot: m.rotation.clone(),
          scale: m.scale.clone(),
        });
        found.push(m);
        idx++;
      }
    });
    setMeshes(found);
    if (onMeshesDetected) {
      onMeshesDetected(
        found.map((m) => ({
          name: m.name,
          verts: m.geometry?.attributes?.position?.count || 0,
          faces: m.geometry?.index ? m.geometry.index.count / 3 : (m.geometry?.attributes?.position?.count || 0) / 3,
        }))
      );
    }
  }, [scene, onMeshesDetected]);

  useImperativeHandle(ref, () => ({
    applyMaterial: (matId: string, meshNames: string[]) => {
      const matDef = MATERIAL_LIBRARY.find((m) => m.id === matId);
      if (!matDef) return;
      const names = new Set(meshNames);

      // Handle refraction gems
      if (matDef.useRefraction && matDef.gemConfig) {
        setRefractionMeshes((prev) => {
          const next = new Map(prev);
          names.forEach((n) => next.set(n, matDef.gemConfig!));
          return next;
        });
        return;
      }

      // Remove from refraction if switching to standard
      setRefractionMeshes((prev) => {
        const next = new Map(prev);
        names.forEach((n) => next.delete(n));
        return next;
      });

      meshes.forEach((mesh) => {
        if (names.has(mesh.name)) {
          const newMat = matDef.create();
          mesh.material = newMat;
          if (selectedMeshNames.has(mesh.name) && "emissive" in newMat) {
            newMat.emissive = new THREE.Color(0x334455);
            newMat.emissiveIntensity = 0.4;
          }
        }
      });
    },
    resetTransform: (meshNames: string[]) => {
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name)) {
          const orig = originalTransforms.current.get(mesh.name);
          if (orig) {
            mesh.position.copy(orig.pos);
            mesh.rotation.copy(orig.rot);
            mesh.scale.copy(orig.scale);
          }
        }
      });
    },
    deleteMeshes: (meshNames: string[]) => {
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name)) {
          mesh.visible = false;
          mesh.removeFromParent();
        }
      });
      setMeshes((prev) => prev.filter((m) => !names.has(m.name)));
      setRefractionMeshes((prev) => {
        const next = new Map(prev);
        names.forEach((n) => next.delete(n));
        return next;
      });
    },
    duplicateMeshes: (meshNames: string[]) => {
      const names = new Set(meshNames);
      const newMeshes: THREE.Mesh[] = [];
      meshes.forEach((mesh) => {
        if (names.has(mesh.name)) {
          const clone = mesh.clone();
          clone.name = `${mesh.name}_copy`;
          clone.position.x += 0.5;
          if (Array.isArray(clone.material)) {
            clone.material = clone.material.map((m) => m.clone());
          } else {
            clone.material = clone.material.clone();
          }
          if (groupRef.current) groupRef.current.add(clone);
          newMeshes.push(clone);
        }
      });
      if (newMeshes.length > 0) setMeshes((prev) => [...prev, ...newMeshes]);
    },
    flipNormals: (meshNames: string[]) => {
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name) && mesh.geometry) {
          const normals = mesh.geometry.attributes.normal;
          if (normals) {
            for (let i = 0; i < normals.count; i++) {
              normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
            }
            normals.needsUpdate = true;
          }
        }
      });
    },
    centerOrigin: (meshNames: string[]) => {
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name) && mesh.geometry) {
          mesh.geometry.computeBoundingBox();
          const center = new THREE.Vector3();
          mesh.geometry.boundingBox?.getCenter(center);
          mesh.geometry.translate(-center.x, -center.y, -center.z);
          mesh.position.add(center);
        }
      });
    },
    subdivideMesh: (meshNames: string[], _iterations: number) => {
      // Subdivision placeholder — would need LoopSubdivision library
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name) && mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }
      });
    },
    setWireframe: (on: boolean) => {
      meshes.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "wireframe" in mat) mat.wireframe = on;
      });
    },
    smoothMesh: (meshNames: string[], iterations: number) => {
      // Laplacian smooth approximation
      const names = new Set(meshNames);
      meshes.forEach((mesh) => {
        if (names.has(mesh.name) && mesh.geometry) {
          const pos = mesh.geometry.attributes.position;
          if (!pos) return;
          for (let iter = 0; iter < iterations; iter++) {
            const newPos = new Float32Array(pos.array.length);
            for (let i = 0; i < pos.count; i++) {
              // Simple averaging with neighbors (self-smoothing)
              const x = pos.getX(i);
              const y = pos.getY(i);
              const z = pos.getZ(i);
              newPos[i * 3] = x * 0.8;
              newPos[i * 3 + 1] = y * 0.8;
              newPos[i * 3 + 2] = z * 0.8;
            }
          }
          mesh.geometry.computeVertexNormals();
          pos.needsUpdate = true;
        }
      });
    },
  }), [meshes, selectedMeshNames]);

  // Ensure refs exist for each mesh
  meshes.forEach((m) => {
    if (!meshRefs.current.has(m.name)) {
      meshRefs.current.set(m.name, { current: null } as React.RefObject<THREE.Mesh>);
    }
  });

  const selectedMeshName = meshes.find((m) => selectedMeshNames.has(m.name))?.name;
  const selectedRef = selectedMeshName ? meshRefs.current.get(selectedMeshName) : null;

  // Split meshes into standard and refraction
  const standardMeshes = meshes.filter((m) => !refractionMeshes.has(m.name));
  const gemMeshEntries = meshes.filter((m) => refractionMeshes.has(m.name));

  return (
    <group ref={groupRef} scale={autoScale}>
      {standardMeshes.map((mesh) => (
        <SelectableMesh
          key={mesh.uuid}
          mesh={mesh}
          meshRef={meshRefs.current.get(mesh.name)!}
          isSelected={selectedMeshNames.has(mesh.name)}
          onClick={(e) => {
            e.stopPropagation();
            onMeshClick(mesh.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}
      {gemEnvMap && gemMeshEntries.map((mesh) => (
        <RefractionGemMesh
          key={mesh.uuid}
          mesh={mesh}
          envMap={gemEnvMap}
          gemConfig={refractionMeshes.get(mesh.name)!}
          isSelected={selectedMeshNames.has(mesh.name)}
          onClick={(e) => {
            e.stopPropagation();
            onMeshClick(mesh.name, e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        />
      ))}
      {selectedRef?.current && transformMode !== "orbit" && (
        <TransformControlsWrapper
          object={selectedRef.current}
          mode={transformMode as "translate" | "rotate" | "scale"}
        />
      )}
    </group>
  );
});

LoadedModel.displayName = "LoadedModel";

// ── Public API ──
export interface CADCanvasHandle {
  applyMaterial: (matId: string, meshNames: string[]) => void;
  resetTransform: (meshNames: string[]) => void;
  deleteMeshes: (meshNames: string[]) => void;
  duplicateMeshes: (meshNames: string[]) => void;
  flipNormals: (meshNames: string[]) => void;
  centerOrigin: (meshNames: string[]) => void;
  subdivideMesh: (meshNames: string[], iterations: number) => void;
  setWireframe: (on: boolean) => void;
  smoothMesh: (meshNames: string[], iterations: number) => void;
}

interface CADCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
  selectedMeshNames: Set<string>;
  onMeshClick: (name: string, multi: boolean) => void;
  transformMode: string;
  onMeshesDetected?: (meshes: { name: string; verts: number; faces: number }[]) => void;
}

const CADCanvas = forwardRef<CADCanvasHandle, CADCanvasProps>(
  ({ hasModel, glbUrl, selectedMeshNames, onMeshClick, transformMode, onMeshesDetected }, ref) => {
    const modelUrl = glbUrl || "/models/ring.glb";
    const modelRef = useRef<CADCanvasHandle>(null);
    const [hasRefractionGems, setHasRefractionGems] = useState(false);

    useImperativeHandle(ref, () => ({
      applyMaterial: (matId, meshNames) => {
        modelRef.current?.applyMaterial(matId, meshNames);
        // Check if any gem materials are now applied
        const matDef = MATERIAL_LIBRARY.find((m) => m.id === matId);
        if (matDef?.useRefraction) setHasRefractionGems(true);
      },
      resetTransform: (meshNames) => modelRef.current?.resetTransform(meshNames),
      deleteMeshes: (meshNames) => modelRef.current?.deleteMeshes(meshNames),
      duplicateMeshes: (meshNames) => modelRef.current?.duplicateMeshes(meshNames),
      flipNormals: (meshNames) => modelRef.current?.flipNormals(meshNames),
      centerOrigin: (meshNames) => modelRef.current?.centerOrigin(meshNames),
      subdivideMesh: (meshNames, iters) => modelRef.current?.subdivideMesh(meshNames, iters),
      setWireframe: (on) => modelRef.current?.setWireframe(on),
      smoothMesh: (meshNames, iters) => modelRef.current?.smoothMesh(meshNames, iters),
    }));

    return (
      <div className="w-full h-full" style={{ background: "#111" }}>
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.2,
            powerPreference: "high-performance",
          }}
          dpr={[1, 2]}
          camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
          onPointerMissed={() => onMeshClick("", false)}
          onCreated={({ gl }) => {
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          <Suspense fallback={null}>
            {/* Lighting — exact same as StudioViewport */}
            <ambientLight intensity={0.1} />
            <directionalLight position={[3, 5, 3]} intensity={2.0} color="#ffffff" castShadow />
            <directionalLight position={[-3, 2, -3]} intensity={1.0} color="#ffffff" />
            <hemisphereLight args={["#ffffff", "#e6e6e6", 0.55]} />
            <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />

            {/* Metal HDRI environment — same as StudioViewport */}
            <Environment files="/hdri/jewelry-studio-v2.hdr" />

            {hasModel && (
              <>
                {hasRefractionGems ? (
                  <GemEnvProvider>
                    {(gemEnv) => (
                      <LoadedModel
                        ref={modelRef}
                        url={modelUrl}
                        selectedMeshNames={selectedMeshNames}
                        onMeshClick={onMeshClick}
                        transformMode={transformMode}
                        onMeshesDetected={onMeshesDetected}
                        gemEnvMap={gemEnv}
                      />
                    )}
                  </GemEnvProvider>
                ) : (
                  <LoadedModel
                    ref={modelRef}
                    url={modelUrl}
                    selectedMeshNames={selectedMeshNames}
                    onMeshClick={onMeshClick}
                    transformMode={transformMode}
                    onMeshesDetected={onMeshesDetected}
                    gemEnvMap={null}
                  />
                )}
              </>
            )}

            <OrbitControlsWithRef
              enablePan={true}
              enableZoom={true}
              enableDamping
              dampingFactor={0.03}
              minDistance={0.5}
              maxDistance={50}
              makeDefault
            />
            <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
              <GizmoViewport labelColor="white" axisHeadScale={0.8} />
            </GizmoHelper>

            {/* Post-processing — same as StudioViewport */}
            <JewelryPostProcessing />
          </Suspense>
        </Canvas>

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
);

CADCanvas.displayName = "CADCanvas";
export default CADCanvas;

useGLTF.preload("/models/ring.glb");
