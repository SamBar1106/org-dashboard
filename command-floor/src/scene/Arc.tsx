import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { QuadraticBezierCurve3, Vector3 } from "three";
import type { Line2, LineMaterial } from "three-stdlib";

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
}

export function Arc({ x1, y1, z1, x2, y2, z2, color, opacity, animate, rolling }: ArcProps) {
  const ref = useRef<Line2>(null);
  const points = useMemo(() => {
    const curve = new QuadraticBezierCurve3(
      new Vector3(x1, y1, z1),
      new Vector3((x1 + x2) / 2, Math.max(y1, y2) + 1.25, (z1 + z2) / 2),
      new Vector3(x2, y2, z2),
    );
    return curve.getPoints(22);
  }, [x1, y1, z1, x2, y2, z2]);

  useFrame((_, delta) => {
    const material = ref.current?.material;
    if (!material || Array.isArray(material)) return;
    const lineMaterial = material as LineMaterial;
    lineMaterial.opacity = opacity;
    if (animate) lineMaterial.dashOffset -= delta * (rolling ? 1.6 : 0.45);
  });

  return (
    <Line
      ref={ref}
      points={points}
      color={color}
      dashed
      dashSize={0.16}
      gapSize={0.11}
      lineWidth={2}
      worldUnits={false}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
  );
}
