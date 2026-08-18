import {
  BotController,
  TICK_MS,
  createGameState,
  noInput,
  stepGame,
  type AiDebugInfo,
  type Difficulty,
  type GameState,
  type InputByPlayer,
  type PlayerInput,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import { preloadGeneratedAssets } from "../assets";
import { soundFx } from "../audio/SoundFx";
import { KeyboardController } from "../input/KeyboardController";
import { TouchController } from "../input/TouchController";
import { IS_COMPACT_LAYOUT } from "../layout";
import { BattleRenderer } from "../render/BattleRenderer";
import { gameUiActions, gameUiStore } from "../../ui/gameUi";
import { presentBattleUi } from "../../ui/presentBattleUi";

interface BattleSceneData {
  difficulty?: Difficulty;
  mapId?: string;
}

interface Position {
  x: number;
  y: number;
}

export interface BattleUiDebugState {
  countdownMs: number;
  paused: boolean;
  resultVisible: boolean;
}

export class BattleScene extends Phaser.Scene {
  private difficulty: Difficulty = "normal";
  private mapId: string | undefined;
  private state!: GameState;
  private bot!: BotController;
  private controls!: KeyboardController;
  private touchControls!: TouchController;
  private battleRenderer!: BattleRenderer;
  private previousPositions = new Map<number, Position>();
  private accumulator = 0;
  private countdownMs = 3200;
  private paused = false;
  private resultVisible = false;
  private lastUiSignature = "";
  private toastId = 0;

  constructor() {
    super("BattleScene");
  }

  init(data: BattleSceneData): void {
    this.difficulty = data.difficulty ?? "normal";
    this.mapId = data.mapId;
  }

  preload(): void {
    preloadGeneratedAssets(this);
  }

  create(): void {
    this.accumulator = 0;
    this.countdownMs = 3200;
    this.paused = false;
    this.resultVisible = false;
    this.lastUiSignature = "";

    const seed = (Date.now() ^ 0xa53c9e17) >>> 0;
    this.state = createGameState({
      seed,
      ...(this.mapId === undefined ? {} : { mapId: this.mapId }),
      playerNames: ["플레이어", this.botName()],
    });
    this.registry.set("debug:state", this.state);
    this.bot = new BotController(2, this.difficulty, seed);
    this.controls = new KeyboardController(this);
    this.touchControls = new TouchController();
    this.battleRenderer = new BattleRenderer(this, this.difficulty);
    this.previousPositions = new Map(
      this.state.players.map((player) => [
        player.id,
        { x: player.x, y: player.y },
      ]),
    );
    gameUiStore.patch({
      screen: "battle",
      difficulty: this.difficulty,
      result: null,
      toast: null,
    });

    const stopUiActions = gameUiActions.subscribe((action) => {
      if (action.type === "retry") {
        soundFx.unlock();
        this.scene.restart({
          difficulty: this.difficulty,
          mapId: this.mapId,
        });
      } else if (action.type === "open-menu") {
        this.scene.start("MenuScene");
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      stopUiActions();
      this.touchControls.destroy();
      this.battleRenderer.destroy();
    });
  }

  getDebugUiState(): BattleUiDebugState {
    return {
      countdownMs: this.countdownMs,
      paused: this.paused,
      resultVisible: this.resultVisible,
    };
  }

  update(time: number, delta: number): void {
    const safeDelta = Math.min(delta, 100);
    const countdownDelta = Math.min(delta, 250);

    const keyboardMute = this.controls.consumeMute();
    const touchMute = this.touchControls.consumeMute();
    if (keyboardMute || touchMute) {
      const muted = soundFx.toggleMuted();
      this.showToast(muted ? "음소거 켜짐" : "음소거 꺼짐");
    }

    const keyboardPause = this.controls.consumePause();
    const touchPause = this.touchControls.consumePause();
    if (
      (keyboardPause || touchPause) &&
      !this.resultVisible &&
      this.countdownMs <= 0
    ) {
      this.paused = !this.paused;
    }

    if (this.countdownMs > 0) {
      this.controls.readInput();
      this.touchControls.clearOneShots();
      this.updateCountdown(countdownDelta);
    } else if (!this.paused && this.state.phase === "playing") {
      this.accumulator += safeDelta;
      while (this.accumulator >= TICK_MS) {
        this.previousPositions = new Map(
          this.state.players.map((player) => [
            player.id,
            { x: player.x, y: player.y },
          ]),
        );
        const humanInput = this.readHumanInput();
        const botInput = this.bot.decide(this.state);
        const inputs: InputByPlayer = {
          1: humanInput,
          2: botInput,
        };
        const events = stepGame(this.state, inputs);
        for (const event of events) {
          this.battleRenderer.handleEvent(event);
          soundFx.playEvent(event);
          if (event.type === "round-ended") {
            this.time.delayedCall(620, () => this.showResult());
          }
        }
        this.accumulator -= TICK_MS;
      }
    } else {
      this.controls.readInput();
      this.touchControls.readInput();
    }

    this.battleRenderer.updateParticles(safeDelta / 1000);
    const botDebug = this.bot.getDebugInfo();
    this.battleRenderer.render(
      this.state,
      this.previousPositions,
      Math.min(1, this.accumulator / TICK_MS),
      time,
    );
    this.syncUi(botDebug);
  }

  private readHumanInput(): PlayerInput {
    const keyboard = this.controls.readInput();
    const touch = this.touchControls.readInput();
    return {
      move: touch.move ?? keyboard.move,
      fallbackMove:
        touch.move === null ? null : touch.fallbackMove ?? null,
      placeBalloon:
        touch.placeBalloon || keyboard.placeBalloon,
      useNeedle: touch.useNeedle || keyboard.useNeedle,
    };
  }

  private updateCountdown(delta: number): void {
    const wasCountingDown = this.countdownMs > 0;
    this.countdownMs = Math.max(0, this.countdownMs - delta);
    if (wasCountingDown && this.countdownMs === 0) {
      this.accumulator = 0;
    }
  }

  private showResult(): void {
    if (this.resultVisible) {
      return;
    }
    this.resultVisible = true;
  }

  private showToast(message: string): void {
    this.toastId += 1;
    gameUiStore.patch({
      toast: { id: this.toastId, message },
    });
  }

  private syncUi(botDebug: AiDebugInfo): void {
    const snapshot = presentBattleUi({
      state: this.state,
      botDebug,
      countdownMs: this.countdownMs,
      paused: this.paused,
      resultVisible: this.resultVisible,
      compact: IS_COMPACT_LAYOUT,
    });
    const signature = JSON.stringify(snapshot);
    if (signature === this.lastUiSignature) {
      return;
    }
    this.lastUiSignature = signature;
    gameUiStore.patch(snapshot);
  }

  private botName(): string {
    if (this.difficulty === "easy") {
      return "느긋한 버블봇";
    }
    if (this.difficulty === "hard") {
      return "집요한 버블봇";
    }
    return "영리한 버블봇";
  }

}
