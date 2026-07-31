const BLOCKED_GESTURE_EVENTS = [
  "gesturestart",
  "gesturechange",
  "gestureend",
] as const;

export function setupMobileInteractionGuards(): void {
  if (document.documentElement.dataset.gameLayout !== "compact") {
    return;
  }

  const preventDefault = (event: Event): void => {
    event.preventDefault();
  };

  for (const eventName of [
    "contextmenu",
    "selectstart",
    "dragstart",
  ] as const) {
    document.addEventListener(eventName, preventDefault, {
      passive: false,
    });
  }

  for (const eventName of BLOCKED_GESTURE_EVENTS) {
    document.addEventListener(eventName, preventDefault, {
      passive: false,
    });
  }
}
