import { useRef } from "react";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { TOUCH } from "three";
import { DIMMED_OPACITY, arcId, objectOpacity } from "../model/match";
import type { FilterId, FloorModel, Selection } from "../model/types";
import { Arc } from "./Arc";
import { PadMesh } from "./Pad";
import { PawnMesh } from "./Pawn";
import { RackMesh } from "./Rack";

interface FloorSceneProps {
  floor: FloorModel;
  filter: FilterId;
  selection: Selection;
  animate: boolean;
  rolling: boolean;
  frameloop: "always" | "demand" | "never";
  onSelect: (selection: Selection) => void;
  onFrame: () => void;
}

export function FloorScene({ floor, filter, selection, animate, rolling, frameloop, onSelect, onFrame }: FloorSceneProps) {
  const vault = vaultBounds(floor);
  const vaultOpacity = floor.database_racks.every((rack) => objectOpacity("rack", rack.id, filter, floor) < 1) ? DIMMED_OPACITY : 1;
  return (
    <Canvas
      dpr={[1, 1.75]}
      performance={{ min: 0.5 }}
      frameloop={frameloop}
      camera={{ position: [0.6, 6.4, 8.6], fov: 36, near: 0.1, far: 70 }}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#101012")}
    >
      <FramePing onFrame={onFrame} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#c5d4ea", "#1a1a1e", 0.55]} />
      <directionalLight position={[4, 10, 6]} intensity={1.45} />
      <Grid
        args={[30, 30]}
        position={[0, 0, 0]}
        cellSize={0.5}
        cellThickness={0.7}
        cellColor="#4a4a54"
        sectionSize={2.5}
        sectionThickness={1.15}
        sectionColor="#6d6d78"
        fadeDistance={16}
        fadeStrength={1.35}
        infiniteGrid={false}
      />
      {vault ? (
        <group>
          <mesh position={[vault.x, 0.08, vault.z]}>
            <boxGeometry args={[vault.width, 0.16, vault.depth]} />
            <meshStandardMaterial
              color="#0b2a66"
              emissive="#123f8a"
              emissiveIntensity={rolling ? 0.9 : 0.4}
              roughness={0.32}
              metalness={0.18}
              transparent
              opacity={vaultOpacity}
              depthWrite={vaultOpacity === 1}
            />
          </mesh>
          <Html position={[vault.x, 0.4, vault.z + vault.depth / 2 - 0.2]} center distanceFactor={12} zIndexRange={[8, 0]} wrapperClass="cf-html">
            <div className="vault-tag" style={{ opacity: vaultOpacity }}>DATA VAULT</div>
          </Html>
        </group>
      ) : null}
      {floor.project_pads.map((pad) =>
        pad.connected_db_ids.map((rackId) => {
          const rack = floor.database_racks.find((item) => item.id === rackId);
          if (!rack) return null;
          return (
            <Arc
              key={arcId(rackId, pad.id)}
              x1={rack.position.x}
              y1={1.35}
              z1={rack.position.z}
              x2={pad.position.x}
              y2={0.4 + pad.position.y}
              z2={pad.position.z}
              color={pad.pad_color}
              opacity={objectOpacity("arc", arcId(rackId, pad.id), filter, floor)}
              animate={animate}
              rolling={rolling}
            />
          );
        }),
      )}
      {floor.project_pads.map((pad) => (
        <PadMesh
          key={pad.id}
          pad={pad}
          opacity={objectOpacity("pad", pad.id, filter, floor)}
          selected={selection.kind === "pad" && selection.id === pad.id}
          onSelect={() => onSelect({ kind: "pad", id: pad.id })}
        />
      ))}
      {floor.database_racks.map((rack) => (
        <RackMesh
          key={rack.id}
          rack={rack}
          opacity={objectOpacity("rack", rack.id, filter, floor)}
          selected={selection.kind === "rack" && selection.id === rack.id}
          onSelect={() => onSelect({ kind: "rack", id: rack.id })}
        />
      ))}
      {floor.agents.map((agent) => {
        const pad = floor.project_pads.find((item) => item.id === agent.assigned_pad_id);
        return (
          <PawnMesh
            key={agent.id}
            agent={agent}
            x={(pad?.position.x ?? 0) + agent.offset.x}
            y={pad?.position.y ?? 0}
            z={(pad?.position.z ?? 0) + agent.offset.z}
            opacity={objectOpacity("pawn", agent.id, filter, floor)}
            animate={animate}
            selected={selection.kind === "pawn" && selection.id === agent.id}
            onSelect={() => onSelect({ kind: "pawn", id: agent.id })}
          />
        );
      })}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        enablePan
        minDistance={4.5}
        maxDistance={18}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.4, 0.55]}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  );
}

function FramePing({ onFrame }: { onFrame: () => void }) {
  const sent = useRef(false);
  useFrame(() => {
    if (sent.current) return;
    sent.current = true;
    onFrame();
  });
  return null;
}

function vaultBounds(floor: FloorModel): { x: number; z: number; width: number; depth: number } | null {
  if (floor.database_racks.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const rack of floor.database_racks) {
    minX = Math.min(minX, rack.position.x);
    maxX = Math.max(maxX, rack.position.x);
    minZ = Math.min(minZ, rack.position.z);
    maxZ = Math.max(maxZ, rack.position.z);
  }
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    width: Math.max(4.8, maxX - minX + 2.3),
    depth: Math.max(1.9, maxZ - minZ + 1.7),
  };
}
