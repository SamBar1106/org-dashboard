import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import { Vector3 } from "three";
import { useReducedMotion } from "../hooks";
import { useFloor } from "../state/store";

interface FlyControls {
  target: Vector3;
  update: () => void;
}

interface CameraRigProps {
  homePosition: [number, number, number];
  homeTarget: [number, number, number];
  focus: [number, number, number] | null;
  flyToken: number;
  resetToken: number;
}

const PAN_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
const right = new Vector3();
const forward = new Vector3();
const pan = new Vector3();

export function CameraRig({ homePosition, homeTarget, focus, flyToken, resetToken }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useThree((state) => state.controls) as FlyControls | null;
  const reduce = useReducedMotion();
  const keys = useRef(new Set<string>());
  const homePos = useRef(homePosition);
  const homeTgt = useRef(homeTarget);
  const focusRef = useRef(focus);
  homePos.current = homePosition;
  homeTgt.current = homeTarget;
  focusRef.current = focus;

  useEffect(() => {
    const point = focusRef.current;
    if (!controls || flyToken === 0 || !point) return undefined;
    const offset = new Vector3(
      homePos.current[0] - homeTgt.current[0],
      homePos.current[1] - homeTgt.current[1],
      homePos.current[2] - homeTgt.current[2],
    );
    const length = offset.length() || 1;
    offset.setLength(Math.min(Math.max(length * 0.42, 8), length));
    const next = new Vector3(point[0], point[1], point[2]).add(offset);
    next.y = Math.max(next.y, point[1] + 2.5);
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    if (reduce) {
      camera.position.copy(next);
      controls.target.set(point[0], point[1], point[2]);
      controls.update();
      return undefined;
    }
    gsap.to(camera.position, {
      x: next.x,
      y: next.y,
      z: next.z,
      duration: 1.05,
      ease: "power2.inOut",
      onUpdate: () => controls.update(),
    });
    gsap.to(controls.target, {
      x: point[0],
      y: point[1],
      z: point[2],
      duration: 1.05,
      ease: "power2.inOut",
      onUpdate: () => controls.update(),
    });
    return undefined;
  }, [flyToken, controls, camera, reduce]);

  useEffect(() => {
    if (!controls || resetToken === 0) return undefined;
    const [x, y, z] = homePos.current;
    const [tx, ty, tz] = homeTgt.current;
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    if (reduce) {
      camera.position.set(x, y, z);
      controls.target.set(tx, ty, tz);
      controls.update();
      return undefined;
    }
    gsap.to(camera.position, { x, y, z, duration: 0.9, ease: "power2.inOut", onUpdate: () => controls.update() });
    gsap.to(controls.target, { x: tx, y: ty, z: tz, duration: 0.9, ease: "power2.inOut", onUpdate: () => controls.update() });
    return undefined;
  }, [resetToken, controls, camera, reduce]);

  useEffect(() => {
    const el = gl.domElement;
    let lastTime = 0;
    let lastX = 0;
    let lastY = 0;
    const downPos = { x: 0, y: 0, moved: false };
    const reset = () => useFloor.getState().resetView();
    const onDown = (event: PointerEvent) => {
      downPos.x = event.clientX;
      downPos.y = event.clientY;
      downPos.moved = false;
    };
    const onMove = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y) > 12) downPos.moved = true;
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || downPos.moved) return;
      const now = performance.now();
      if (now - lastTime < 320 && Math.hypot(event.clientX - lastX, event.clientY - lastY) < 24) reset();
      lastTime = now;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
    const down = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const key = event.key.toLowerCase();
      if (!PAN_KEYS.has(key)) return;
      keys.current.add(key);
      event.preventDefault();
      invalidate();
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
    };
    const blur = () => keys.current.clear();
    el.addEventListener("dblclick", reset);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("dblclick", reset);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      gsap.killTweensOf(camera.position);
      if (controls) gsap.killTweensOf(controls.target);
    };
  }, [gl, camera, controls, invalidate]);

  useFrame((_, delta) => {
    if (!controls || keys.current.size === 0) return;
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
    let strafe = 0;
    let move = 0;
    if (keys.current.has("a") || keys.current.has("arrowleft")) strafe -= 1;
    if (keys.current.has("d") || keys.current.has("arrowright")) strafe += 1;
    if (keys.current.has("w") || keys.current.has("arrowup")) move += 1;
    if (keys.current.has("s") || keys.current.has("arrowdown")) move -= 1;
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.set(-forward.z, 0, forward.x).normalize();
    const step = Math.min(delta, 0.05) * 12;
    pan.copy(right).multiplyScalar(strafe * step).addScaledVector(forward, move * step);
    camera.position.add(pan);
    controls.target.add(pan);
    controls.update();
    invalidate();
  });

  return null;
}
