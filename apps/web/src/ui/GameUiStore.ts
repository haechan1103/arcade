import type { Difficulty } from "@bubble-battle/game-core";

export type UiScreen = "menu" | "battle";
export type UiOverlay =
  | { kind: "none" }
  | { kind: "countdown"; title: string; subtitle: string }
  | { kind: "pause"; title: string; subtitle: string };
export type UiResult = "win" | "lose" | "draw" | null;

export interface PlayerHudState {
  name: string;
  balloons: string;
  range: number;
  speed: number;
  needles: number;
  status: "alive" | "trapped" | "dead";
}

export interface GameUiState {
  screen: UiScreen;
  difficulty: Difficulty;
  mapName: string;
  time: string;
  human: PlayerHudState | null;
  bot: PlayerHudState | null;
  botMode: string;
  overlay: UiOverlay;
  result: UiResult;
  toast: { id: number; message: string } | null;
}

export const INITIAL_GAME_UI_STATE: GameUiState = {
  screen: "menu",
  difficulty: "normal",
  mapName: "",
  time: "2:30",
  human: null,
  bot: null,
  botMode: "",
  overlay: { kind: "none" },
  result: null,
  toast: null,
};

type Listener = (state: Readonly<GameUiState>) => void;

export class GameUiStore {
  private state: GameUiState = INITIAL_GAME_UI_STATE;
  private readonly listeners = new Set<Listener>();

  getState(): Readonly<GameUiState> {
    return this.state;
  }

  setState(state: GameUiState): void {
    this.state = state;
    this.emit();
  }

  patch(patch: Partial<GameUiState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
