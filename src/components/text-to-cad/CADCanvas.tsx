import { useRef, Suspense, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function RingModel({ autoRotate }: { autoRotate: boolean }) {
  const { scene } = useGLTF("/models/ring.glb");
  const groupRef = useRef<THREE.Group>(null);
  const autoAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (autoRotate) {
      autoAngle.current += delta * 0.5;
      groupRef.current.rotation.y = autoAngle.current;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene.clone()} scale={10} position={[0, 0, 0]} />
    </group>
  );
}

interface CADCanvasProps {
  hasModel: boolean;
}

export default function CADCanvas({ hasModel }: CADCanvasProps) {
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
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 7.5]} intensity={5.0} castShadow />
          <directionalLight position={[-5, 4, -8]} intensity={2.0} />
          <directionalLight position={[0, -5, 3]} intensity={1.0} color="#aaccff" />
          <directionalLight position={[8, 2, 0]} intensity={1.5} color="#aaccff" />
          <Environment preset="studio" />
          {hasModel && <RingModel autoRotate={false} />}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableDamping
            dampingFactor={0.05}
            autoRotate={false}
            autoRotateSpeed={1.0}
            minDistance={1}
            maxDistance={20}
          />
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
