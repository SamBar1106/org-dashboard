import { useMemo, useRef } from "react";
import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { TOUCH } from "three";
import { usePageHidden, useReducedMotion } from "../hooks";
import { arcId, objectOpacity } from "../model/match";
import { isRedAlert } from "../model/metrics";
import type { Selection } from "../model/types";
import { useDisplayedFloor, useFloor } from "../state/store";
import { Arc } from "./Arc";
import { CameraRig } from "./CameraRig";
import { frameScene } from "./layout";
import { PadMesh } from "./Pad";
import { PawnMesh } from "./Pawn";
import { presentScene } from "./present";
import { MAX_DPR } from "./quality";
import { RackMesh } from "./Rack";
import { VaultMesh } from "./Vault";

export function FloorScene() {
  const floor = useDisplayedFloor();
  const filter = useFloor((state) => state.filter);
  const query = useFloor((state) => state.query);
  const hiddenRacks = useFloor((state) => state.hiddenRacks);
  const selection = useFloor((state) => state.selection);
  const layers = useFloor((state) => state.layers);
  const acknowledged = useFloor((state) => state.acknowledged);
  const rolling = useFloor((state) => state.rolling);
  const burstArcIds = useFloor((state) => state.burstArcIds);
  const walkSerial = useFloor((state) => state.walkSerial);
  const flyToken = useFloor((state) => state.flyToken);
  const resetToken = useFloor((state) => state.resetToken);
  const select = useFloor((state) => state.select);
  const setFramed = useFloor((state) => state.setFramed);
  const hidden = usePageHidden();
  const reduce = useReducedMotion();
  const presented = useMemo(() => presentScene(floor), [floor]);
  const layout = useMemo(() => frameScene(presented.layoutInput), [presented]);
  const options = useMemo(() => ({ query, hiddenRackIds: hiddenRacks }), [query, hiddenRacks]);
  const animate = !hidden && (rolling || !reduce);
  const frameloop = hidden ? "never" : animate ? "always" : "demand";
  const vaultOpacity = floor.database_racks.every((rack) => objectOpacity("rack", rack.id, filter, floor, options) < 1) ? 0.2 : 1;
  const focus = focusOf(selection, presented, layout.meshScale);
  const selectedPadId = selection.kind === "pad" ? selection.id : selection.kind === "pawn"
    ? floor.agents.find((agent) => agent.id === selection.id)?.assigned_pad_id ?? null
    : null;

  return (
    <Canvas
      dpr={[1, MAX_DPR]}
      performance={{ min: 0.5 }}
      frameloop={frameloop}
      camera={{ position: layout.cameraPosition, fov: layout.fov, near: layout.near, far: layout.far }}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor("#101012")}
    >
      <FramePing onFrame={() => setFramed(true)} />
      <ambientLight intensity={0.85} />
      <hemisphereLight args={["#c5d4ea", "#1a1a1e", 0.5]} />
      <directionalLight position={[4, 10, 6]} intensity={1.35} />
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
      {layers.mesh ? (
        <VaultMesh vault={layout.vault} opacity={vaultOpacity} rolling={rolling} distanceFactor={layout.labelDistance} />
      ) : null}
      {layers.traces
        ? floor.project_pads.map((pad) =>
            pad.connected_db_ids.map((rackId) => {
              const rackAt = presented.racks.get(rackId);
              const padAt = presented.pads.get(pad.id);
              if (!rackAt || !padAt) return null;
              const id = arcId(rackId, pad.id);
              return (
                <Arc
                  key={id}
                  x1={rackAt.x}
                  y1={rackAt.y + 1.35 * layout.meshScale}
                  z1={rackAt.z}
                  x2={padAt.x}
                  y2={padAt.y + 0.4 * layout.meshScale}
                  z2={padAt.z}
                  color={pad.pad_color}
                  opacity={objectOpacity("arc", id, filter, floor, options)}
                  animate={animate}
                  rolling={rolling}
                  dashSize={layout.dashSize}
                  gapSize={layout.gapSize}
                  showPacket={layers.telemetry}
                  hot={burstArcIds.includes(id)}
                  packetOffset={packetOffset(id)}
                />
              );
            }),
          )
        : null}
      {floor.project_pads.map((pad) => {
        const at = presented.pads.get(pad.id);
        if (!at) return null;
        const alert = isRedAlert("pad", pad.id, floor) && !acknowledged.includes(pad.id);
        return (
          <PadMesh
            key={pad.id}
            pad={{ ...pad, position: at }}
            opacity={objectOpacity("pad", pad.id, filter, floor, options)}
            selected={selection.kind === "pad" && selection.id === pad.id}
            ring={selectedPadId === pad.id}
            alert={alert}
            scale={layout.meshScale}
            labelDistance={layout.labelDistance}
            showMesh={layers.mesh}
            showAlert={layers.telemetry}
            onSelect={() => select({ kind: "pad", id: pad.id })}
          />
        );
      })}
      {floor.database_racks.map((rack) => {
        const at = presented.racks.get(rack.id);
        if (!at) return null;
        const alert = isRedAlert("rack", rack.id, floor) && !acknowledged.includes(rack.id);
        const radial = Math.hypot(at.x, at.z) || 1;
        return (
          <RackMesh
            key={rack.id}
            rack={{ ...rack, position: at }}
            opacity={objectOpacity("rack", rack.id, filter, floor, options)}
            selected={selection.kind === "rack" && selection.id === rack.id}
            alert={alert}
            scale={layout.meshScale}
            labelDistance={layout.labelDistance}
            labelOffset={[(at.x / radial) * 1.4, (at.z / radial) * 1.4]}
            showMesh={layers.mesh}
            showAlert={layers.telemetry}
            onSelect={() => select({ kind: "rack", id: rack.id })}
          />
        );
      })}
      {floor.agents.map((agent) => {
        const at = presented.agents.get(agent.id);
        if (!at) return null;
        const pad = floor.project_pads.find((item) => item.id === agent.assigned_pad_id);
        const rackId = pad?.connected_db_ids[0];
        const goal = (rackId ? presented.racks.get(rackId) : undefined) ?? presented.vault;
        const alert = isRedAlert("pawn", agent.id, floor) && !acknowledged.includes(agent.id);
        return (
          <PawnMesh
            key={agent.id}
            agent={agent}
            homeX={at.x}
            homeY={at.y}
            homeZ={at.z}
            goalX={goal.x}
            goalY={goal.y}
            goalZ={goal.z}
            walkSerial={walkSerial[agent.id] ?? 0}
            opacity={objectOpacity("pawn", agent.id, filter, floor, options)}
            animate={animate}
            selected={selection.kind === "pawn" && selection.id === agent.id}
            alert={alert}
            scale={layout.meshScale}
            labelDistance={layout.labelDistance}
            showMesh={layers.mesh}
            showAlert={layers.telemetry}
            onSelect={() => select({ kind: "pawn", id: agent.id })}
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
      <CameraRig
        homePosition={layout.cameraPosition}
        homeTarget={layout.center}
        focus={focus}
        flyToken={flyToken}
        resetToken={resetToken}
      />
    </Canvas>
  );
}

function focusOf(
  selection: Selection,
  presented: ReturnType<typeof presentScene>,
  lift: number,
): [number, number, number] | null {
  switch (selection.kind) {
    case "pad": {
      const at = presented.pads.get(selection.id);
      return at ? [at.x, at.y + lift, at.z] : null;
    }
    case "rack": {
      const at = presented.racks.get(selection.id);
      return at ? [at.x, at.y + lift, at.z] : null;
    }
    case "pawn": {
      const at = presented.agents.get(selection.id);
      return at ? [at.x, at.y + lift, at.z] : null;
    }
    default: {
      const neverKind: never = selection;
      return neverKind;
    }
  }
}

function packetOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return (hash % 100) / 100;
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
