import type { Difficulty } from "@bubble-battle/game-core";

export type GameUiAction =
  | { type: "start-battle"; difficulty: Difficulty }
  | { type: "retry" }
  | { type: "open-menu" };

type ActionListener = (action: GameUiAction) => void;

export class GameUiActions {
  private readonly listeners = new Set<ActionListener>();

  dispatch(action: GameUiAction): void {
    // A Scene transition can unsubscribe the current adapter and subscribe
    // the next one while handling an action. Iterate over a snapshot so the
    // new Scene never receives the action that created it.
    for (const listener of [...this.listeners]) {
      listener(action);
    }
  }

  subscribe(listener: ActionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
