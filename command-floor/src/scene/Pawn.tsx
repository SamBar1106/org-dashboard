import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type { Mesh } from "three";
import { orbGeometry, pawnGeometry } from "./geometries";
import type { AgentPawn, PawnState } from "../model/types";

interface PawnProps {
  agent: AgentPawn;
  x: number;
  y: number;
  z: number;
  opacity: number;
  animate: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function PawnMesh({ agent, x, y, z, opacity, animate, selected, onSelect }: PawnProps) {
  const orb = useRef<Mesh>(null);
  const phase = useMemo(() => phaseOf(agent.id), [agent.id]);
  useFrame(({ clock }) => {
    if (!orb.current) return;
    const bob = animate ? Math.sin(clock.elapsedTime * 2.1 + phase) * 0.055 : 0;
    orb.current.position.y = 0.58 + bob;
  });
  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  return (
    <group position={[x, y, z]}>
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
