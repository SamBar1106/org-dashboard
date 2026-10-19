import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { Vector3 } from "three";
import { packetGeometry, packetGlowGeometry } from "./geometries";

interface PacketProps {
  points: Vector3[];
  color: string;
  offset: number;
  hot: boolean;
  opacity: number;
}

export function Packet({ points, color, offset, hot, opacity }: PacketProps) {
  const mesh = useRef<Mesh>(null);
  const scratch = useMemo(() => new Vector3(), []);
  useFrame(({ clock }) => {
    const current = mesh.current;
    if (!current || points.length < 2) return;
    const speed = hot ? 0.42 : 0.14;
    const t = (clock.elapsedTime * speed + offset) % 1;
    const scaled = t * (points.length - 1);
    const index = Math.floor(scaled);
    const next = Math.min(index + 1, points.length - 1);
    current.position.lerpVectors(points[index], points[next], scaled - index);
    current.scale.setScalar(hot ? 1.35 : 1);
  });
  return (
    <mesh ref={mesh} position={scratch}>
      <mesh geometry={packetGeometry}>
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh geometry={packetGlowGeometry}>
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35 * opacity} depthWrite={false} />
      </mesh>
    </mesh>
  );
}
