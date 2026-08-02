import { describe, expect, it } from "vitest";
import { ANALOG_INPUT_SCALE } from "@bubble-battle/game-core";
import {
  JOYSTICK_ACTIVATION_THRESHOLD,
  JOYSTICK_RELEASE_THRESHOLD,
  resolveJoystickAnalogMove,
  resolveJoystickDirection,
  resolveJoystickFallbackDirection,
} from "./JoystickMath";

describe("resolveJoystickDirection", () => {
  it("requires deliberate movement before activating", () => {
    expect(
      resolveJoystickDirection(
        { x: JOYSTICK_ACTIVATION_THRESHOLD - 0.01, y: 0 },
        null,
      ),
    ).toBeNull();
    expect(
      resolveJoystickDirection(
        { x: JOYSTICK_ACTIVATION_THRESHOLD, y: 0 },
        null,
      ),
    ).toBe("right");
  });

  it("uses a smaller release threshold to prevent idle flicker", () => {
    expect(
      resolveJoystickDirection(
        { x: JOYSTICK_RELEASE_THRESHOLD + 0.01, y: 0 },
        "right",
      ),
    ).toBe("right");
    expect(
      resolveJoystickDirection(
        { x: JOYSTICK_RELEASE_THRESHOLD - 0.01, y: 0 },
        "right",
      ),
    ).toBeNull();
  });

  it("holds its direction through small diagonal finger jitter", () => {
    expect(
      resolveJoystickDirection({ x: 0.7, y: 0.75 }, "right"),
    ).toBe("right");
    expect(
      resolveJoystickDirection({ x: 0.7, y: 0.9 }, "right"),
    ).toBe("down");
  });

  it("allows an intentional opposite turn immediately", () => {
    expect(
      resolveJoystickDirection({ x: -0.8, y: 0.05 }, "right"),
    ).toBe("left");
  });
});

describe("resolveJoystickAnalogMove", () => {
  it("converts the joystick angle into cosine and sine components", () => {
    expect(
      resolveJoystickAnalogMove({ x: 1, y: 0 }, "right"),
    ).toEqual({ x: ANALOG_INPUT_SCALE, y: 0 });
    expect(
      resolveJoystickAnalogMove(
        { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) },
        "right",
      ),
    ).toEqual({ x: 887, y: 512 });
  });

  it("keeps total speed constant at a 45 degree angle", () => {
    const move = resolveJoystickAnalogMove(
      { x: 0.8, y: -0.8 },
      "right",
    );

    expect(move).toEqual({ x: 724, y: -724 });
    expect(Math.hypot(move?.x ?? 0, move?.y ?? 0)).toBeCloseTo(
      ANALOG_INPUT_SCALE,
      0,
    );
  });

  it("does not create analog movement inside the dead zone", () => {
    expect(
      resolveJoystickAnalogMove({ x: 0.05, y: 0 }, null),
    ).toBeNull();
  });
});

describe("resolveJoystickFallbackDirection", () => {
  it("keeps the other axis of a deliberate diagonal input", () => {
    expect(
      resolveJoystickFallbackDirection(
        { x: 0.72, y: -0.68 },
        "right",
      ),
    ).toBe("up");
    expect(
      resolveJoystickFallbackDirection(
        { x: -0.7, y: 0.8 },
        "down",
      ),
    ).toBe("left");
  });

  it("ignores small off-axis finger drift", () => {
    expect(
      resolveJoystickFallbackDirection(
        { x: 0.9, y: 0.2 },
        "right",
      ),
    ).toBeNull();
  });
});
