import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { ledGeometry, rackBaseGeometry, rackGeometry, rackPanelGeometry } from "./geometries";
import type { DatabaseRack, Level } from "../model/types";

interface RackProps {
  rack: DatabaseRack;
  opacity: number;
  selected: boolean;
  scale: number;
  labelDistance: number;
  onSelect: () => void;
}

const PLATFORM_TOP = 0.16;

export function RackMesh({ rack, opacity, selected, scale, labelDistance, onSelect }: RackProps) {
  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  const bodyY = PLATFORM_TOP + 0.62;
  const leds = ledColors(rack.level);
  return (
    <group position={[rack.position.x, rack.position.y, rack.position.z]} scale={scale}>
      <mesh geometry={rackBaseGeometry} position={[0, PLATFORM_TOP + 0.03, 0]} onClick={choose} onPointerOver={showPointer} onPointerOut={hidePointer}>
        <meshStandardMaterial color="#0c0c0e" roughness={0.45} metalness={0.4} transparent opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
      <mesh geometry={rackGeometry} position={[0, bodyY, 0]} onClick={choose}>
        <meshStandardMaterial
          color="#16161a"
          emissive={selected ? "#12304a" : "#000000"}
          emissiveIntensity={selected ? 0.45 : 0}
          roughness={0.38}
          metalness={0.62}
          transparent
          opacity={opacity}
          depthWrite={opacity === 1}
        />
      </mesh>
      <mesh geometry={rackPanelGeometry} position={[0, bodyY + 0.02, 0.24]} onClick={choose}>
        <meshStandardMaterial color="#070709" roughness={0.8} transparent opacity={opacity} depthWrite={opacity === 1} />
      </mesh>
      {leds.map((color, index) => (
        <mesh key={color + index} geometry={ledGeometry} position={[0.2, bodyY + 0.24 - index * 0.16, 0.27]}>
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
      <Html position={[0, bodyY + 0.78, 0]} center distanceFactor={labelDistance} zIndexRange={[12, 0]} wrapperClass="cf-html">
        <button
          type="button"
          className={selected ? "cf-label is-selected" : "cf-label"}
          style={{ opacity }}
          data-testid={`rack-label-${rack.id}`}
          onClick={onSelect}
        >
          {rack.name}
        </button>
      </Html>
    </group>
  );
}

function ledColors(level: Level): [string, string, string] {
  switch (level) {
    case "CRITICAL":
      return ["#ff3355", "#ff3355", "#3a1a22"];
    case "WARNING":
      return ["#f5a524", "#f5a524", "#3a2e14"];
    case "HEALTHY":
      return ["#39ff14", "#1d3a22", "#1d3a22"];
    case "IDLE":
      return ["#6b7280", "#2a2e33", "#2a2e33"];
    default: {
      const neverLevel: never = level;
      return neverLevel;
    }
  }
}

function showPointer(event: ThreeEvent<PointerEvent>) {
  event.stopPropagation();
  document.body.style.cursor = "pointer";
}

function hidePointer() {
  document.body.style.cursor = "";
}
