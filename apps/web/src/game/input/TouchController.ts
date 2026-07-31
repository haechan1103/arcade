import type {
  Direction,
  PlayerInput,
} from "@bubble-battle/game-core";

type TouchControl =
  | Direction
  | "balloon"
  | "needle"
  | "pause"
  | "mute";

interface HeldDirection {
  direction: Direction;
  order: number;
}

const DIRECTIONS = new Set<TouchControl>([
  "up",
  "right",
  "down",
  "left",
]);

export class TouchController {
  private readonly root: HTMLElement | null;
  private readonly cleanup: Array<() => void> = [];
  private readonly heldDirections = new Map<number, HeldDirection>();
  private directionOrder = 0;
  private balloonQueued = false;
  private needleQueued = false;
  private pauseQueued = false;
  private muteQueued = false;

  constructor() {
    this.root = document.querySelector<HTMLElement>(
      "[data-touch-controls]",
    );
    this.root?.classList.add("is-active");

    const buttons =
      this.root?.querySelectorAll<HTMLButtonElement>(
        "[data-control]",
      ) ?? [];
    for (const button of buttons) {
      const onPointerDown = (event: PointerEvent): void => {
        event.preventDefault();
        const control = button.dataset.control as
          | TouchControl
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

        if (DIRECTIONS.has(control)) {
          this.directionOrder += 1;
          this.heldDirections.set(event.pointerId, {
            direction: control as Direction,
            order: this.directionOrder,
          });
        } else if (control === "balloon") {
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
        button.classList.remove("is-pressed");
        this.heldDirections.delete(event.pointerId);
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
    const move =
      [...this.heldDirections.values()].sort(
        (first, second) => second.order - first.order,
      )[0]?.direction ?? null;
    const input: PlayerInput = {
      move,
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
    this.heldDirections.clear();
    this.clearOneShots();
    this.pauseQueued = false;
    this.muteQueued = false;
    this.root?.classList.remove("is-active");
  }
}
