import { useMemo, useRef } from "react";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { TOUCH } from "three";
import { DIMMED_OPACITY, arcId, objectOpacity } from "../model/match";
import type { FilterId, FloorModel, Selection } from "../model/types";
import { Arc } from "./Arc";
import { frameScene } from "./layout";
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
  const layout = useMemo(() => frameScene(floor), [floor]);
  const vault = layout.vault;
  const vaultOpacity = floor.database_racks.every((rack) => objectOpacity("rack", rack.id, filter, floor) < 1) ? DIMMED_OPACITY : 1;
  return (
    <Canvas
      dpr={[1, 1.75]}
      performance={{ min: 0.5 }}
      frameloop={frameloop}
      camera={{ position: layout.cameraPosition, fov: layout.fov, near: layout.near, far: layout.far }}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#101012")}
    >
      <FramePing onFrame={onFrame} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#c5d4ea", "#1a1a1e", 0.55]} />
      <directionalLight position={[4, 10, 6]} intensity={1.45} />
      <Grid
        args={[layout.grid.size, layout.grid.size]}
        position={[layout.center[0], 0, layout.center[2]]}
        cellSize={layout.grid.cell}
        cellThickness={0.7}
        cellColor="#4a4a54"
        sectionSize={layout.grid.section}
        sectionThickness={1.15}
        sectionColor="#6d6d78"
        fadeDistance={layout.grid.fade}
        fadeStrength={1.35}
        infiniteGrid={false}
      />
      {vault ? (
        <group>
          <mesh position={[vault.x, vault.thickness / 2, vault.z]}>
            <boxGeometry args={[vault.width, vault.thickness, vault.depth]} />
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
          <Html
            position={[vault.x, vault.thickness + layout.meshScale * 0.2, vault.z + vault.depth / 2]}
            center
            distanceFactor={layout.labelDistance}
            zIndexRange={[8, 0]}
            wrapperClass="cf-html"
          >
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
              y1={rack.position.y + 1.35 * layout.meshScale}
              z1={rack.position.z}
              x2={pad.position.x}
              y2={pad.position.y + 0.4 * layout.meshScale}
              z2={pad.position.z}
              color={pad.pad_color}
              opacity={objectOpacity("arc", arcId(rackId, pad.id), filter, floor)}
              animate={animate}
              rolling={rolling}
              dashSize={layout.dashSize}
              gapSize={layout.gapSize}
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
          scale={layout.meshScale}
          labelDistance={layout.labelDistance}
          onSelect={() => onSelect({ kind: "pad", id: pad.id })}
        />
      ))}
      {floor.database_racks.map((rack) => (
        <RackMesh
          key={rack.id}
          rack={rack}
          opacity={objectOpacity("rack", rack.id, filter, floor)}
          selected={selection.kind === "rack" && selection.id === rack.id}
          scale={layout.meshScale}
          labelDistance={layout.labelDistance}
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
            scale={layout.meshScale}
            onSelect={() => onSelect({ kind: "pawn", id: agent.id })}
          />
        );
      })}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        enablePan
        minDistance={layout.minDistance}
        maxDistance={layout.maxDistance}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
        target={layout.center}
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
