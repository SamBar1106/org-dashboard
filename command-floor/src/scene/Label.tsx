import { Html } from "@react-three/drei";

interface LabelProps {
  position: [number, number, number];
  text: string;
  testId: string;
  selected: boolean;
  alert: boolean;
  opacity: number;
  distanceFactor: number;
  zIndex?: number;
  onSelect: () => void;
}

export function NameLabel({ position, text, testId, selected, alert, opacity, distanceFactor, zIndex = 24, onSelect }: LabelProps) {
  const className = ["cf-label", selected ? "is-selected" : ""].filter(Boolean).join(" ");
  return (
    <Html center position={position} distanceFactor={distanceFactor} zIndexRange={[zIndex, 0]} wrapperClass="cf-html">
      <button
        type="button"
        className={className}
        style={{ opacity, background: "rgba(0, 0, 0, 0.75)" }}
        data-testid={testId}
        data-alert={alert ? "true" : "false"}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <span className={alert ? "is-alert" : undefined}>{text}</span>
      </button>
    </Html>
  );
}
