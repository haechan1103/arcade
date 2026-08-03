import { describe, expect, it } from "vitest";
import {
  JOYSTICK_ACTIVATION_THRESHOLD,
  JOYSTICK_RELEASE_THRESHOLD,
  resolveJoystickCardinalStep,
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

describe("resolveJoystickCardinalStep", () => {
  it("alternates cardinal steps for a 45 degree gesture", () => {
    let remainder = 0;
    const directions = Array.from({ length: 4 }, () => {
      const step = resolveJoystickCardinalStep(
        { x: 0.8, y: -0.8 },
        "right",
        "up",
        remainder,
      );
      remainder = step.remainder;
      return step.direction;
    });

    expect(directions).toEqual(["right", "up", "right", "up"]);
  });

  it("distributes steps according to the two axis magnitudes", () => {
    let remainder = 0;
    const directions = Array.from({ length: 4 }, () => {
      const step = resolveJoystickCardinalStep(
        { x: 0.9, y: -0.3 },
        "right",
        "up",
        remainder,
      );
      remainder = step.remainder;
      return step.direction;
    });

    expect(directions).toEqual(["right", "right", "right", "up"]);
  });

  it("returns one primary direction when there is no second axis", () => {
    expect(
      resolveJoystickCardinalStep(
        { x: 1, y: 0.1 },
        "right",
        null,
        0.75,
      ),
    ).toEqual({ direction: "right", remainder: 0 });
    expect(
      resolveJoystickCardinalStep(
        { x: 0, y: 0 },
        null,
        null,
        0.75,
      ),
    ).toEqual({ direction: null, remainder: 0 });
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
