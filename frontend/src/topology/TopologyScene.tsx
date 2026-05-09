import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import type { TopologyScores } from "./types";
import { DIMENSION_ORDER, DIMENSION_LABELS } from "./types";
import { buildBlobGeometry } from "./terrainGeometry";

function BlobMesh({
  scores,
  color,
  wireframe,
  opacity,
}: {
  scores: TopologyScores;
  color: string;
  wireframe?: boolean;
  opacity?: number;
}) {
  const geom = useMemo(() => buildBlobGeometry(scores), [scores]);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        transparent
        opacity={opacity ?? 1}
        metalness={0.15}
        roughness={0.6}
        side={2}
        depthWrite={!wireframe}
      />
    </mesh>
  );
}

function SpokeLabels({ scores }: { scores: TopologyScores }) {
  const labelRadius = 3.2;
  return (
    <>
      {DIMENSION_ORDER.map((dim, i) => {
        const angle = (i / 7) * Math.PI * 2;
        const x = Math.cos(angle) * labelRadius;
        const z = Math.sin(angle) * labelRadius;
        return (
          <Text
            key={dim}
            position={[x, 2.5, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.22}
            color="#1a2233"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {DIMENSION_LABELS[dim]} ({(scores[dim] * 100).toFixed(0)}%)
          </Text>
        );
      })}
    </>
  );
}

function RotatingGroup({ children, autoRotate }: { children: React.ReactNode; autoRotate: boolean }) {
  const ref = useRef<any>(null);
  useFrame((_, delta) => {
    if (autoRotate && ref.current) {
      ref.current.rotation.y += delta * 0.15;
    }
  });
  return <group ref={ref}>{children}</group>;
}

interface TopologySceneProps {
  primary: TopologyScores;
  secondary?: TopologyScores;
  showLabels?: boolean;
  comparisonMode?: boolean;
  autoRotate?: boolean;
}

export function TopologyScene({
  primary,
  secondary,
  showLabels = true,
  comparisonMode = false,
  autoRotate = true,
}: TopologySceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 3, 7], fov: 45 }}
      style={{ background: "linear-gradient(180deg, #f8f9fc 0%, #edf0f5 100%)" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-3, 8, -3]} intensity={0.3} />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={16}
      />

      <RotatingGroup autoRotate={autoRotate}>
        <BlobMesh
          scores={primary}
          color="#0848b8"
          opacity={comparisonMode ? 0.45 : 0.75}
        />
        <BlobMesh
          scores={primary}
          color="#0848b8"
          wireframe
          opacity={comparisonMode ? 0.6 : 0.9}
        />

        {comparisonMode && secondary && (
          <>
            <BlobMesh
              scores={secondary}
              color="#dc2626"
              opacity={0.35}
            />
            <BlobMesh
              scores={secondary}
              color="#dc2626"
              wireframe
              opacity={0.7}
            />
          </>
        )}

        {showLabels && <SpokeLabels scores={primary} />}
      </RotatingGroup>
    </Canvas>
  );
}
