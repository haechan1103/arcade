import { describe, expect, it } from "vitest";
import {
  JOYSTICK_ACTIVATION_THRESHOLD,
  JOYSTICK_RELEASE_THRESHOLD,
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
