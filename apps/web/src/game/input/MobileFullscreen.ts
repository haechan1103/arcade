interface WebkitFullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

const HINT_VISIBLE_MS = 5_500;

export function setupMobileFullscreen(): void {
  const button = document.querySelector<HTMLButtonElement>(
    "[data-fullscreen-toggle]",
  );
  const label = document.querySelector<HTMLElement>(
    "[data-fullscreen-label]",
  );
  const hint = document.querySelector<HTMLElement>(
    "[data-fullscreen-hint]",
  );
  if (button === null || label === null || hint === null) {
    return;
  }

  let hintTimer = 0;
  const extendedDocument = document as WebkitFullscreenDocument;
  const root = document.documentElement as WebkitFullscreenElement;

  const fullscreenElement = (): Element | null =>
    document.fullscreenElement ??
    extendedDocument.webkitFullscreenElement ??
    null;

  const isStandalone = (): boolean =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as StandaloneNavigator).standalone === true;

  const syncButton = (): void => {
    const active = fullscreenElement() !== null || isStandalone();
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    label.textContent = active ? "전체화면 종료" : "전체화면";
  };

  const showInstallHint = (): void => {
    window.clearTimeout(hintTimer);
    hint.classList.add("is-visible");
    hintTimer = window.setTimeout(() => {
      hint.classList.remove("is-visible");
    }, HINT_VISIBLE_MS);
  };

  const lockLandscape = async (): Promise<void> => {
    const orientation = window.screen.orientation;
    try {
      if (typeof orientation.lock === "function") {
        await orientation.lock("landscape");
      }
    } catch {
      // Orientation locking is optional and is unavailable on some Safari versions.
    }
  };

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (fullscreenElement() !== null) {
        if (document.exitFullscreen !== undefined) {
          await document.exitFullscreen();
        } else {
          await extendedDocument.webkitExitFullscreen?.();
        }
        return;
      }

      if (root.requestFullscreen !== undefined) {
        await root.requestFullscreen({ navigationUI: "hide" });
        await lockLandscape();
      } else if (root.webkitRequestFullscreen !== undefined) {
        await root.webkitRequestFullscreen();
        await lockLandscape();
      } else {
        showInstallHint();
      }
    } catch {
      showInstallHint();
    } finally {
      syncButton();
    }
  };

  button.addEventListener("click", () => {
    void toggleFullscreen();
  });
  hint.addEventListener("click", () => {
    hint.classList.remove("is-visible");
  });
  document.addEventListener("fullscreenchange", syncButton);
  document.addEventListener("webkitfullscreenchange", syncButton);
  syncButton();
}
