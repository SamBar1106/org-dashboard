import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { deskGeometry, glowGeometry, padGeometry, screenGeometry, standGeometry } from "./geometries";
import type { ProjectPad } from "../model/types";

interface PadProps {
  pad: ProjectPad;
  opacity: number;
  selected: boolean;
  scale: number;
  labelDistance: number;
  onSelect: () => void;
}

export function PadMesh({ pad, opacity, selected, scale, labelDistance, onSelect }: PadProps) {
  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  return (
    <group position={[pad.position.x, pad.position.y, pad.position.z]} scale={scale}>
      <mesh geometry={padGeometry} position={[0, 0.06, 0]} onClick={choose} onPointerOver={showPointer} onPointerOut={hidePointer}>
        <meshStandardMaterial
          color={pad.pad_color}
          emissive={pad.pad_color}
          emissiveIntensity={selected ? 0.7 : 0.48}
          roughness={0.42}
          metalness={0.08}
          transparent
          opacity={opacity}
          depthWrite={opacity === 1}
        />
      </mesh>
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.135, 0]}>
          <ringGeometry args={[0.9, 0.98, 28]} />
          <meshBasicMaterial color="#5cefff" transparent opacity={0.95 * opacity} depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null}
      <mesh geometry={deskGeometry} position={[0, 0.17, 0.08]} onClick={choose}>
        <meshStandardMaterial color="#23262e" roughness={0.6} metalness={0.1} transparent opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
      <mesh geometry={standGeometry} position={[0, 0.28, 0.24]} onClick={choose}>
        <meshStandardMaterial color="#1a1d24" roughness={0.5} transparent opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
      <mesh geometry={screenGeometry} position={[0, 0.44, 0.24]} onClick={choose}>
        <meshBasicMaterial color="#e7fdff" toneMapped={false} transparent opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
      <mesh geometry={glowGeometry} position={[0, 0.44, 0.28]}>
        <meshBasicMaterial color="#5cefff" toneMapped={false} transparent opacity={0.28 * opacity} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.12, 0]} center distanceFactor={labelDistance} zIndexRange={[12, 0]} wrapperClass="cf-html">
        <button
          type="button"
          className={selected ? "cf-label is-selected" : "cf-label"}
          style={{ opacity }}
          data-testid={`pad-label-${pad.id}`}
          onClick={onSelect}
        >
          {pad.name}
        </button>
      </Html>
    </group>
  );
}

function showPointer(event: ThreeEvent<PointerEvent>) {
  event.stopPropagation();
  document.body.style.cursor = "pointer";
}

function hidePointer() {
  document.body.style.cursor = "";
}
