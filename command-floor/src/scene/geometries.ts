import { BoxGeometry, CylinderGeometry, SphereGeometry } from "three";

// Shared low-poly geometry. Per-object materials stay separate so filters can fade one mesh at a time.
// Pad width is the unit the scene scale is based on. Mesh groups are scaled so this width matches the data spacing.
export const BASE_PAD_WIDTH = 1.62;
export const padGeometry = new BoxGeometry(BASE_PAD_WIDTH, 0.12, BASE_PAD_WIDTH);
export const deskGeometry = new BoxGeometry(0.56, 0.08, 0.32);
export const screenGeometry = new BoxGeometry(0.36, 0.26, 0.04);
export const standGeometry = new BoxGeometry(0.045, 0.16, 0.045);
export const glowGeometry = new BoxGeometry(0.46, 0.34, 0.01);
export const pawnGeometry = new CylinderGeometry(0.1, 0.13, 0.34, 8);
export const orbGeometry = new SphereGeometry(0.065, 8, 6);
export const rackGeometry = new BoxGeometry(0.7, 1.12, 0.46);
export const rackPanelGeometry = new BoxGeometry(0.48, 0.7, 0.02);
export const ledGeometry = new SphereGeometry(0.032, 6, 5);
export const rackBaseGeometry = new BoxGeometry(0.78, 0.06, 0.52);
