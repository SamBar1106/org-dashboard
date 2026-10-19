import type { ThreeEvent } from "@react-three/fiber";
import { AlertLight } from "./AlertLight";
import { deskGeometry, glowGeometry, padGeometry, screenGeometry, standGeometry } from "./geometries";
import { NameLabel } from "./Label";
import type { ProjectPad } from "../model/types";

interface PadProps {
  pad: ProjectPad;
  opacity: number;
  selected: boolean;
  ring: boolean;
  alert: boolean;
  scale: number;
  labelDistance: number;
  showMesh: boolean;
  showAlert: boolean;
  onSelect: () => void;
}

export function PadMesh({ pad, opacity, selected, ring, alert, scale, labelDistance, showMesh, showAlert, onSelect }: PadProps) {
  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };
  return (
    <group position={[pad.position.x, pad.position.y, pad.position.z]} scale={scale}>
      {showMesh ? (
        <group>
          <mesh geometry={padGeometry} position={[0, 0.06, 0]} onClick={choose} onPointerOver={showPointer} onPointerOut={hidePointer}>
            <meshStandardMaterial
              color={pad.pad_color}
              emissive={pad.pad_color}
              emissiveIntensity={selected ? 0.9 : 0.62}
              roughness={0.38}
              metalness={0.08}
              transparent
              opacity={opacity}
              depthWrite={opacity === 1}
            />
          </mesh>
          {ring ? (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.14, 0]}>
              <ringGeometry args={[0.92, 1.05, 40]} />
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
          {showAlert && alert ? <AlertLight /> : null}
        </group>
      ) : null}
      <NameLabel
        position={[0, 1.2, 0]}
        text={pad.name}
        testId={`pad-label-${pad.id}`}
        selected={selected}
        alert={alert}
        opacity={opacity}
        distanceFactor={labelDistance}
        zIndex={40}
        onSelect={onSelect}
      />
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
