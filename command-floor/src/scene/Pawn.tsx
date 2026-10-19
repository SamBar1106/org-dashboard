import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Vector3 } from "three";
import { AlertLight } from "./AlertLight";
import { armGeometry, orbGeometry, pawnGeometry } from "./geometries";
import { NameLabel } from "./Label";
import type { AgentPawn, PawnState } from "../model/types";

interface PawnProps {
  agent: AgentPawn;
  homeX: number;
  homeY: number;
  homeZ: number;
  goalX: number;
  goalY: number;
  goalZ: number;
  walkSerial: number;
  opacity: number;
  animate: boolean;
  selected: boolean;
  alert: boolean;
  scale: number;
  labelDistance: number;
  showMesh: boolean;
  showAlert: boolean;
  onSelect: () => void;
}

export function PawnMesh({
  agent,
  homeX,
  homeY,
  homeZ,
  goalX,
  goalY,
  goalZ,
  walkSerial,
  opacity,
  animate,
  selected,
  alert,
  scale,
  labelDistance,
  showMesh,
  showAlert,
  onSelect,
}: PawnProps) {
  const shift = useRef<Group>(null);
  const orb = useRef<Mesh>(null);
  const arms = useRef<Group>(null);
  const phase = useMemo(() => phaseOf(agent.id), [agent.id]);
  const trip = useRef({ phase: "idle" as "idle" | "out" | "back", t: 1, from: new Vector3(), to: new Vector3() });
  const goalRef = useRef({ x: goalX - homeX, y: goalY - homeY, z: goalZ - homeZ });
  goalRef.current = { x: goalX - homeX, y: goalY - homeY, z: goalZ - homeZ };
  const showLabel = selected || agent.state === "red_alert";
  const blocked = agent.state === "waiting_samuel" || agent.state === "red_alert";

  useEffect(() => {
    const mesh = shift.current;
    if (!mesh || walkSerial === 0 || !animate) return;
    const dest = goalRef.current;
    trip.current.from.copy(mesh.position);
    trip.current.to.set(dest.x, dest.y, dest.z);
    trip.current.phase = "out";
    trip.current.t = 0;
  }, [walkSerial, animate]);

  useFrame(({ clock }, delta) => {
    const mesh = shift.current;
    if (mesh) {
      const state = trip.current;
      if (state.phase !== "idle") {
        state.t = Math.min(1, state.t + Math.min(delta, 0.05) / 1.5);
        const eased = state.t * state.t * (3 - 2 * state.t);
        mesh.position.lerpVectors(state.from, state.to, eased);
        if (state.t >= 1 && state.phase === "out") {
          state.phase = "back";
          state.t = 0;
          state.from.copy(mesh.position);
          state.to.set(0, 0, 0);
        } else if (state.t >= 1) {
          state.phase = "idle";
          mesh.position.set(0, 0, 0);
        }
      }
    }
    if (orb.current) {
      const bob = animate ? Math.sin(clock.elapsedTime * 2.1 + phase) * 0.055 : 0;
      orb.current.position.y = 0.58 + bob;
    }
    if (arms.current) {
      const typing = animate && trip.current.phase === "idle" && (agent.state === "active" || agent.state === "idle");
      arms.current.rotation.x = typing ? Math.sin(clock.elapsedTime * 8 + phase) * 0.45 : 0;
    }
  });

  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <group position={[homeX, homeY, homeZ]} scale={scale}>
      <group ref={shift}>
        {showMesh ? (
          <group>
            <mesh geometry={pawnGeometry} position={[0, 0.29, 0]} onClick={choose} onPointerOver={showPointer} onPointerOut={hidePointer}>
              <meshStandardMaterial
                color={selected ? "#3a4454" : "#2a2e38"}
                emissive={selected ? "#145060" : "#000000"}
                emissiveIntensity={selected ? 0.4 : 0}
                roughness={0.45}
                metalness={0.25}
                transparent
                opacity={opacity}
                depthWrite={opacity === 1}
              />
            </mesh>
            <mesh ref={orb} geometry={orbGeometry} position={[0, 0.58, 0]} onClick={choose}>
              <meshBasicMaterial color={orbColor(agent.state)} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
            </mesh>
            <group ref={arms} position={[0, 0.34, 0.12]}>
              <mesh geometry={armGeometry} position={[-0.12, 0, 0]}>
                <meshStandardMaterial color="#9aa3b2" roughness={0.5} transparent opacity={opacity} />
              </mesh>
              <mesh geometry={armGeometry} position={[0.12, 0, 0]}>
                <meshStandardMaterial color="#9aa3b2" roughness={0.5} transparent opacity={opacity} />
              </mesh>
            </group>
            {selected ? (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                <ringGeometry args={[0.2, 0.28, 28]} />
                <meshBasicMaterial color="#5cefff" transparent opacity={0.95 * opacity} depthWrite={false} toneMapped={false} />
              </mesh>
            ) : null}
            {showAlert && alert ? <AlertLight /> : null}
          </group>
        ) : null}
        {showMesh && blocked ? (
          <Html center position={[0, 1.05, 0]} distanceFactor={labelDistance} zIndexRange={[12, 0]} wrapperClass="cf-html">
            <div className="blocked-flag" style={{ background: "rgba(0, 0, 0, 0.75)" }} data-testid={`blocked-${agent.id}`}>Blocked</div>
          </Html>
        ) : null}
        {showLabel ? (
          <NameLabel
            position={[0, 1.35, 0]}
            text={agent.name}
            testId={`pawn-label-${agent.id}`}
            selected={selected}
            alert={alert}
            opacity={opacity}
            distanceFactor={labelDistance}
            zIndex={18}
            onSelect={onSelect}
          />
        ) : null}
      </group>
    </group>
  );
}

function orbColor(state: PawnState): string {
  switch (state) {
    case "active":
      return "#5cefff";
    case "waiting_samuel":
      return "#3b82f6";
    case "red_alert":
      return "#ff3355";
    case "idle":
      return "#6b7280";
    default: {
      const neverState: never = state;
      return neverState;
    }
  }
}

function phaseOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return (hash % 628) / 100;
}

function showPointer(event: ThreeEvent<PointerEvent>) {
  event.stopPropagation();
  document.body.style.cursor = "pointer";
}

function hidePointer() {
  document.body.style.cursor = "";
}
