import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { PointLight } from "three";

export function AlertLight() {
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.intensity = 1.6 + Math.sin(clock.elapsedTime * 5) * 1.15;
  });
  return <pointLight ref={light} color="#ff2244" distance={7} decay={2} position={[0, 1.15, 0]} />;
}
