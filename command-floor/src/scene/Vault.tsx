import { Html } from "@react-three/drei";
import type { SceneLayout } from "./layout";

interface VaultProps {
  vault: SceneLayout["vault"];
  opacity: number;
  rolling: boolean;
  distanceFactor: number;
}

export function VaultMesh({ vault, opacity, rolling, distanceFactor }: VaultProps) {
  if (!vault) return null;
  const radius = Math.max(vault.width, vault.depth) * 0.46;
  const height = Math.max(vault.thickness * 2.4, 0.22);
  return (
    <group position={[vault.x, 0, vault.z]}>
      <mesh position={[0, height / 2, 0]} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[radius, radius * 0.9, height, 6]} />
        <meshStandardMaterial
          color="#0b2a66"
          emissive="#1d4ed8"
          emissiveIntensity={rolling ? 1.15 : 0.62}
          roughness={0.28}
          metalness={0.2}
          transparent
          opacity={opacity}
          depthWrite={opacity === 1}
        />
      </mesh>
      <mesh position={[0, height + 0.03, 0]} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[radius * 1.05, radius * 1.05, 0.045, 6]} />
        <meshBasicMaterial color="#5cefff" wireframe transparent opacity={0.7 * opacity} toneMapped={false} />
      </mesh>
      <Html position={[0, height + 0.35, radius * 0.2]} center distanceFactor={distanceFactor} zIndexRange={[8, 0]} wrapperClass="cf-html">
        <div className="vault-tag" style={{ opacity, background: "rgba(0, 0, 0, 0.75)" }}>DATA VAULT</div>
      </Html>
    </group>
  );
}
