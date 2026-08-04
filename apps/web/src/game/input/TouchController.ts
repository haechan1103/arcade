import type {
  Direction,
  PlayerInput,
} from "@bubble-battle/game-core";
import {
  resolveJoystickCardinalStep,
  resolveJoystickDirection,
  resolveJoystickFallbackDirection,
  type JoystickVector,
} from "./JoystickMath";

type TouchAction = "balloon" | "needle" | "pause" | "mute";

interface JoystickGesture {
  originX: number;
  originY: number;
  maxDistance: number;
}

const DIRECTION_LABEL: Record<Direction, string> = {
  up: "위",
  right: "오른쪽",
  down: "아래",
  left: "왼쪽",
};

export class TouchController {
  private readonly root: HTMLElement | null;
  private readonly shell: HTMLElement | null;
  private readonly joystick: HTMLElement | null;
  private readonly joystickKnob: HTMLElement | null;
  private readonly cleanup: Array<() => void> = [];
  private joystickPointerId: number | null = null;
  private joystickGesture: JoystickGesture | null = null;
  private joystickDirection: Direction | null = null;
  private joystickFallbackDirection: Direction | null = null;
  private joystickVector: JoystickVector | null = null;
  private joystickStepRemainder = 0;
  private balloonQueued = false;
  private needleQueued = false;
  private pauseQueued = false;
  private muteQueued = false;

  constructor() {
    this.root = document.querySelector<HTMLElement>(
      "[data-touch-controls]",
    );
    this.shell =
      this.root?.closest<HTMLElement>(".app-shell") ?? null;
    this.joystick =
      this.root?.querySelector<HTMLElement>("[data-joystick]") ??
      null;
    this.joystickKnob =
      this.joystick?.querySelector<HTMLElement>(
        "[data-joystick-knob]",
      ) ?? null;
    this.root?.classList.add("is-active");
    this.shell?.classList.add("has-active-touch-controls");
    this.setupJoystick();

    const buttons =
      this.root?.querySelectorAll<HTMLButtonElement>(
        "[data-control]",
      ) ?? [];
    for (const button of buttons) {
      const onPointerDown = (event: PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        const control = button.dataset.control as
          | TouchAction
          | undefined;
        if (control === undefined) {
          return;
        }

        button.classList.add("is-pressed");
        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic test events may not own an active pointer.
        }

        if (control === "balloon") {
          this.balloonQueued = true;
        } else if (control === "needle") {
          this.needleQueued = true;
        } else if (control === "pause") {
          this.pauseQueued = true;
        } else {
          this.muteQueued = true;
        }
      };
      const onPointerEnd = (event: PointerEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.remove("is-pressed");
        button.blur();
      };
      const onContextMenu = (event: Event): void => {
        event.preventDefault();
      };

      button.addEventListener("pointerdown", onPointerDown);
      button.addEventListener("pointerup", onPointerEnd);
      button.addEventListener("pointercancel", onPointerEnd);
      button.addEventListener("lostpointercapture", onPointerEnd);
      button.addEventListener("contextmenu", onContextMenu);
      this.cleanup.push(() => {
        button.removeEventListener("pointerdown", onPointerDown);
        button.removeEventListener("pointerup", onPointerEnd);
        button.removeEventListener("pointercancel", onPointerEnd);
        button.removeEventListener(
          "lostpointercapture",
          onPointerEnd,
        );
        button.removeEventListener("contextmenu", onContextMenu);
        button.classList.remove("is-pressed");
      });
    }
  }

  readInput(): PlayerInput {
    const joystickStep = resolveJoystickCardinalStep(
      this.joystickVector ?? { x: 0, y: 0 },
      this.joystickDirection,
      this.joystickFallbackDirection,
      this.joystickStepRemainder,
    );
    this.joystickStepRemainder = joystickStep.remainder;
    const fallbackMove =
      joystickStep.direction === null
        ? null
        : joystickStep.direction === this.joystickDirection
          ? this.joystickFallbackDirection
          : this.joystickDirection;
    const input: PlayerInput = {
      move: joystickStep.direction,
      fallbackMove,
      placeBalloon: this.balloonQueued,
      useNeedle: this.needleQueued,
    };

    this.balloonQueued = false;
    this.needleQueued = false;
    return input;
  }

  consumePause(): boolean {
    const queued = this.pauseQueued;
    this.pauseQueued = false;
    return queued;
  }

  consumeMute(): boolean {
    const queued = this.muteQueued;
    this.muteQueued = false;
    return queued;
  }

  clearOneShots(): void {
    this.balloonQueued = false;
    this.needleQueued = false;
  }

  destroy(): void {
    for (const removeListener of this.cleanup) {
      removeListener();
    }
    this.cleanup.length = 0;
    this.resetJoystick();
    this.clearOneShots();
    this.pauseQueued = false;
    this.muteQueued = false;
    this.root?.classList.remove("is-active");
    this.shell?.classList.remove("has-active-touch-controls");
  }

  private setupJoystick(): void {
    if (this.joystick === null) {
      return;
    }
    const joystick = this.joystick;

    const onPointerDown = (event: PointerEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (
        this.joystickPointerId !== null &&
        this.joystickPointerId !== event.pointerId
      ) {
        return;
      }

      this.joystickPointerId = event.pointerId;
      this.beginJoystickGesture(event);
      joystick.classList.add("is-active");
      try {
        joystick.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic test events may not own an active pointer.
      }
      this.updateJoystick(event);
    };
    const onPointerMove = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.updateJoystick(event);
    };
    const onPointerEnd = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.resetJoystick();
    };

    joystick.addEventListener("pointerdown", onPointerDown);
    joystick.addEventListener("pointermove", onPointerMove);
    joystick.addEventListener("pointerup", onPointerEnd);
    joystick.addEventListener("pointercancel", onPointerEnd);
    joystick.addEventListener(
      "lostpointercapture",
      onPointerEnd,
    );
    this.cleanup.push(() => {
      joystick.removeEventListener("pointerdown", onPointerDown);
      joystick.removeEventListener("pointermove", onPointerMove);
      joystick.removeEventListener("pointerup", onPointerEnd);
      joystick.removeEventListener(
        "pointercancel",
        onPointerEnd,
      );
      joystick.removeEventListener(
        "lostpointercapture",
        onPointerEnd,
      );
    });
  }

  private updateJoystick(event: PointerEvent): void {
    if (this.joystick === null || this.joystickGesture === null) {
      return;
    }

    const samples = event.getCoalescedEvents?.() ?? [];
    const sample = samples.at(-1) ?? event;
    const deltaX = sample.clientX - this.joystickGesture.originX;
    const deltaY = sample.clientY - this.joystickGesture.originY;
    const distance = Math.hypot(deltaX, deltaY);
    const maxDistance = this.joystickGesture.maxDistance;
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const knobX = deltaX * scale;
    const knobY = deltaY * scale;

    if (this.joystickKnob !== null) {
      this.joystickKnob.style.transform =
        `translate(-50%, -50%) translate3d(${knobX}px, ${knobY}px, 0)`;
    }

    const vector = {
      x: deltaX / maxDistance,
      y: deltaY / maxDistance,
    };
    const previousDirection = this.joystickDirection;
    const previousFallbackDirection =
      this.joystickFallbackDirection;
    this.joystickDirection = resolveJoystickDirection(
      vector,
      this.joystickDirection,
    );
    this.joystickFallbackDirection =
      resolveJoystickFallbackDirection(
        vector,
        this.joystickDirection,
      );
    this.joystickVector = vector;
    if (
      previousDirection !== this.joystickDirection ||
      previousFallbackDirection !== this.joystickFallbackDirection
    ) {
      this.joystickStepRemainder = 0;
    }
    this.joystick.dataset.direction =
      this.joystickDirection ?? "idle";
    this.joystick.dataset.fallbackDirection =
      this.joystickFallbackDirection ?? "idle";
    this.joystick.setAttribute(
      "aria-label",
      this.joystickDirection === null
        ? "이동 조이스틱"
        : [
            `이동 조이스틱: ${DIRECTION_LABEL[this.joystickDirection]}`,
            this.joystickFallbackDirection === null
              ? ""
              : `${DIRECTION_LABEL[this.joystickFallbackDirection]} 성분 포함`,
          ]
            .filter((label) => label.length > 0)
            .join(", "),
    );
  }

  private resetJoystick(): void {
    this.joystickPointerId = null;
    this.joystickGesture = null;
    this.joystickDirection = null;
    this.joystickFallbackDirection = null;
    this.joystickVector = null;
    this.joystickStepRemainder = 0;
    this.joystick?.classList.remove("is-active");
    if (this.joystick !== null) {
      this.joystick.dataset.direction = "idle";
      this.joystick.dataset.fallbackDirection = "idle";
      this.joystick.setAttribute("aria-label", "이동 조이스틱");
    }
    if (this.joystickKnob !== null) {
      this.joystickKnob.style.transform = "";
    }
  }

  private beginJoystickGesture(event: PointerEvent): void {
    if (this.joystick === null) {
      return;
    }

    const bounds = this.joystick.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const distanceFromCenter = Math.hypot(
      event.clientX - centerX,
      event.clientY - centerY,
    );
    const size = Math.min(bounds.width, bounds.height);
    const grabbedKnob = distanceFromCenter <= size * 0.23;

    this.joystickGesture = {
      originX: grabbedKnob ? event.clientX : centerX,
      originY: grabbedKnob ? event.clientY : centerY,
      maxDistance: size * 0.22,
    };
  }
}
