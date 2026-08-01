import type { Direction } from "@bubble-battle/game-core";

export interface JoystickVector {
  x: number;
  y: number;
}

export const JOYSTICK_ACTIVATION_THRESHOLD = 0.14;
export const JOYSTICK_RELEASE_THRESHOLD = 0.08;
export const JOYSTICK_DIRECTION_SWITCH_BIAS = 1.22;
export const JOYSTICK_FALLBACK_THRESHOLD = 0.32;

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  up: "down",
  right: "left",
  down: "up",
  left: "right",
};

function isHorizontal(direction: Direction): boolean {
  return direction === "left" || direction === "right";
}

function dominantDirection(vector: JoystickVector): Direction {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? "right" : "left";
  }
  return vector.y >= 0 ? "down" : "up";
}

export function resolveJoystickDirection(
  vector: JoystickVector,
  previous: Direction | null,
): Direction | null {
  const force = Math.hypot(vector.x, vector.y);
  const threshold =
    previous === null
      ? JOYSTICK_ACTIVATION_THRESHOLD
      : JOYSTICK_RELEASE_THRESHOLD;
  if (force < threshold) {
    return null;
  }

  const candidate = dominantDirection(vector);
  if (
    previous === null ||
    candidate === previous ||
    candidate === OPPOSITE_DIRECTION[previous]
  ) {
    return candidate;
  }

  const previousMagnitude = isHorizontal(previous)
    ? Math.abs(vector.x)
    : Math.abs(vector.y);
  const candidateMagnitude = isHorizontal(candidate)
    ? Math.abs(vector.x)
    : Math.abs(vector.y);

  return candidateMagnitude >=
    previousMagnitude * JOYSTICK_DIRECTION_SWITCH_BIAS
    ? candidate
    : previous;
}

export function resolveJoystickFallbackDirection(
  vector: JoystickVector,
  primary: Direction | null,
): Direction | null {
  if (primary === null) {
    return null;
  }

  if (isHorizontal(primary)) {
    if (Math.abs(vector.y) < JOYSTICK_FALLBACK_THRESHOLD) {
      return null;
    }
    return vector.y >= 0 ? "down" : "up";
  }

  if (Math.abs(vector.x) < JOYSTICK_FALLBACK_THRESHOLD) {
    return null;
  }
  return vector.x >= 0 ? "right" : "left";
}
