import type { Difficulty } from "@bubble-battle/game-core";
import type { GameUiActions } from "./GameUiActions";
import type {
  GameUiState,
  GameUiStore,
  PlayerHudState,
} from "./GameUiStore";

function required<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Required game UI element is missing: ${selector}`);
  }
  return element;
}

export class GameUiView {
  private readonly root: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly battle: HTMLElement;
  private readonly result: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly cleanup: Array<() => void> = [];
  private toastTimer: number | null = null;
  private renderedToastId = -1;

  constructor(
    root: HTMLElement,
    store: GameUiStore,
    actions: GameUiActions,
  ) {
    this.root = root;
    this.menu = required(root, "[data-ui-menu]");
    this.battle = required(root, "[data-ui-battle]");
    this.result = required(root, "[data-ui-result]");
    this.overlay = required(root, "[data-ui-overlay]");
    this.toast = required(root, "[data-ui-toast]");

    for (const button of root.querySelectorAll<HTMLButtonElement>(
      "[data-difficulty]",
    )) {
      const onClick = (): void => {
        actions.dispatch({
          type: "start-battle",
          difficulty: button.dataset.difficulty as Difficulty,
        });
      };
      button.addEventListener("click", onClick);
      this.cleanup.push(() => button.removeEventListener("click", onClick));
    }

    this.bindAction("[data-ui-retry]", () =>
      actions.dispatch({ type: "retry" }),
    );
    this.bindAction("[data-ui-open-menu]", () =>
      actions.dispatch({ type: "open-menu" }),
    );
    this.cleanup.push(store.subscribe((state) => this.render(state)));
  }

  destroy(): void {
    for (const cleanup of this.cleanup) {
      cleanup();
    }
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
  }

  private bindAction(selector: string, action: () => void): void {
    const element = required<HTMLButtonElement>(this.root, selector);
    element.addEventListener("click", action);
    this.cleanup.push(() => element.removeEventListener("click", action));
  }

  private render(state: Readonly<GameUiState>): void {
    this.menu.hidden = state.screen !== "menu";
    this.battle.hidden = state.screen !== "battle";
    this.root.dataset.screen = state.screen;
    if (state.screen !== "battle") {
      this.result.hidden = true;
      this.overlay.hidden = true;
      return;
    }

    this.setText("[data-ui-map]", state.mapName);
    this.setText("[data-ui-time]", state.time);
    this.setText("[data-ui-phase]", state.phase);
    this.setText("[data-ui-bot-mode]", state.botMode);
    this.setText("[data-ui-seed]", state.seed);
    this.renderPlayer("human", state.human);
    this.renderPlayer("bot", state.bot);
    this.renderOverlay(state);
    this.renderResult(state.result);
    this.renderToast(state);
  }

  private renderPlayer(
    slot: "human" | "bot",
    player: PlayerHudState | null,
  ): void {
    const card = required<HTMLElement>(
      this.root,
      `[data-ui-player="${slot}"]`,
    );
    card.dataset.status = player?.status ?? "alive";
    this.setText(`[data-ui-${slot}-name]`, player?.name ?? "");
    this.setText(`[data-ui-${slot}-balloons]`, player?.balloons ?? "-");
    this.setText(`[data-ui-${slot}-range]`, String(player?.range ?? "-"));
    this.setText(`[data-ui-${slot}-speed]`, String(player?.speed ?? "-"));
    this.setText(`[data-ui-${slot}-needles]`, String(player?.needles ?? "-"));
    this.setText(
      `[data-ui-${slot}-status]`,
      player?.status === "trapped"
        ? "TRAPPED"
        : player?.status === "dead"
          ? "OUT"
          : "READY",
    );
  }

  private renderOverlay(state: Readonly<GameUiState>): void {
    this.overlay.hidden = state.overlay.kind === "none" || state.result !== null;
    if (state.overlay.kind === "none") {
      return;
    }
    this.overlay.dataset.kind = state.overlay.kind;
    this.setText("[data-ui-overlay-title]", state.overlay.title);
    this.setText("[data-ui-overlay-subtitle]", state.overlay.subtitle);
  }

  private renderResult(result: GameUiState["result"]): void {
    this.result.hidden = result === null;
    if (result === null) {
      return;
    }
    this.result.dataset.result = result;
    const copy = {
      win: {
        badge: "★",
        title: "YOU WIN",
        message: "상대를 먼저 물방울에 가뒀어요.",
      },
      lose: {
        badge: "!",
        title: "YOU LOSE",
        message: "탈출 경로가 막혔어요. 다시 도전해 보세요.",
      },
      draw: {
        badge: "−",
        title: "DRAW",
        message: "두 선수가 같은 순간 물방울에 갇혔어요.",
      },
    }[result];
    this.setText("[data-ui-result-badge]", copy.badge);
    this.setText("[data-ui-result-title]", copy.title);
    this.setText("[data-ui-result-message]", copy.message);
  }

  private renderToast(state: Readonly<GameUiState>): void {
    if (state.toast === null || state.toast.id === this.renderedToastId) {
      return;
    }
    this.renderedToastId = state.toast.id;
    this.toast.textContent = state.toast.message;
    this.toast.classList.add("is-visible");
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove("is-visible");
    }, 1_100);
  }

  private setText(selector: string, value: string): void {
    const elements = this.root.querySelectorAll<HTMLElement>(selector);
    if (elements.length === 0) {
      throw new Error(`Required game UI element is missing: ${selector}`);
    }
    for (const element of elements) {
      if (element.textContent !== value) {
        element.textContent = value;
      }
    }
  }
}
