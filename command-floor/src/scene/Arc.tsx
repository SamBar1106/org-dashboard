import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierCurve3, Vector3 } from "three";
import type { Line2, LineMaterial } from "three-stdlib";
import { Packet } from "./Packet";

interface ArcProps {
  x1: number;
  y1: number;
  z1: number;
  x2: number;
  y2: number;
  z2: number;
  color: string;
  opacity: number;
  animate: boolean;
  rolling: boolean;
  dashSize: number;
  gapSize: number;
  showPacket: boolean;
  hot: boolean;
  packetOffset: number;
}

export function arcPoints(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): Vector3[] {
  const span = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
  const curve = new QuadraticBezierCurve3(
    new Vector3(x1, y1, z1),
    new Vector3((x1 + x2) / 2, Math.max(y1, y2) + Math.max(span * 0.2, 0.6), (z1 + z2) / 2),
    new Vector3(x2, y2, z2),
  );
  return curve.getPoints(22);
}

export function Arc({ x1, y1, z1, x2, y2, z2, color, opacity, animate, rolling, dashSize, gapSize, showPacket, hot, packetOffset }: ArcProps) {
  const ref = useRef<Line2>(null);
  const points = useMemo(() => arcPoints(x1, y1, z1, x2, y2, z2), [x1, y1, z1, x2, y2, z2]);

  useFrame((_, delta) => {
    const material = ref.current?.material;
    if (!material || Array.isArray(material)) return;
    const lineMaterial = material as LineMaterial;
    lineMaterial.opacity = opacity;
    if (animate) lineMaterial.dashOffset -= delta * (rolling || hot ? 1.6 : 0.45);
  });

  if (opacity <= 0) return null;

  return (
    <group>
      <Line
        ref={ref}
        points={points}
        color={color}
        dashed
        dashSize={dashSize}
        gapSize={gapSize}
        lineWidth={2}
        worldUnits={false}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
      {showPacket ? <Packet points={points} color={color} offset={packetOffset} hot={hot} opacity={opacity} /> : null}
    </group>
  );
}
