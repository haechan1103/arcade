import {
  BotController,
  TICK_MS,
  createGameState,
  noInput,
  stepGame,
  type Difficulty,
  type GameState,
  type InputByPlayer,
  type PlayerInput,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import { soundFx } from "../audio/SoundFx";
import { KeyboardController } from "../input/KeyboardController";
import { TouchController } from "../input/TouchController";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARD_X,
  BOARD_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  UI_FONT,
} from "../layout";
import { BattleRenderer } from "../render/BattleRenderer";
import { createButton } from "../ui/createButton";

interface BattleSceneData {
  difficulty?: Difficulty;
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

  constructor() {
    super("BattleScene");
  }

  init(data: BattleSceneData): void {
    this.difficulty = data.difficulty ?? "normal";
  }

  create(): void {
    this.accumulator = 0;
    this.countdownMs = 3200;
    this.paused = false;
    this.resultVisible = false;

    const seed = (Date.now() ^ 0xa53c9e17) >>> 0;
    this.state = createGameState({
      seed,
      playerNames: ["플레이어", this.botName()],
    });
    this.registry.set("debug:state", this.state);
    this.bot = new BotController(2, this.difficulty, seed);
    this.controls = new KeyboardController(this);
    this.touchControls = new TouchController();
    this.battleRenderer = new BattleRenderer(this);
    this.previousPositions = new Map(
      this.state.players.map((player) => [
        player.id,
        { x: player.x, y: player.y },
      ]),
    );
    this.battleRenderer.setOverlay(
      "countdown",
      "3",
      "빈 공간을 만들고 먼저 성장하세요",
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
      this.battleRenderer.setOverlay(
        this.paused ? "pause" : "none",
        this.paused ? "PAUSED" : "",
        this.paused ? "ESC를 눌러 계속하기" : "",
      );
    }

    if (this.countdownMs > 0) {
      this.controls.readInput();
      this.touchControls.clearOneShots();
      this.updateCountdown(safeDelta);
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
    this.battleRenderer.render(
      this.state,
      this.previousPositions,
      Math.min(1, this.accumulator / TICK_MS),
      time,
      this.bot.getDebugInfo(),
    );
  }

  private readHumanInput(): PlayerInput {
    const keyboard = this.controls.readInput();
    const touch = this.touchControls.readInput();
    return {
      move: touch.move ?? keyboard.move,
      placeBalloon:
        touch.placeBalloon || keyboard.placeBalloon,
      useNeedle: touch.useNeedle || keyboard.useNeedle,
    };
  }

  private updateCountdown(delta: number): void {
    this.countdownMs = Math.max(0, this.countdownMs - delta);
    if (this.countdownMs > 2400) {
      this.battleRenderer.setOverlay(
        "countdown",
        "3",
        "빈 공간을 만들고 먼저 성장하세요",
      );
    } else if (this.countdownMs > 1600) {
      this.battleRenderer.setOverlay(
        "countdown",
        "2",
        "물줄기는 단단한 벽에서 멈춥니다",
      );
    } else if (this.countdownMs > 800) {
      this.battleRenderer.setOverlay(
        "countdown",
        "1",
        "자신의 물풍선에서도 반드시 탈출하세요",
      );
    } else if (this.countdownMs > 0) {
      this.battleRenderer.setOverlay("countdown", "BUBBLE!", "");
    } else {
      this.battleRenderer.setOverlay("none");
      this.accumulator = 0;
    }
  }

  private showResult(): void {
    if (this.resultVisible) {
      return;
    }
    this.resultVisible = true;

    const won = this.state.result?.winnerId === 1;
    const draw = this.state.result?.winnerId === null;
    const overlay = this.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        0x050918,
        0.78,
      )
      .setDepth(30)
      .setInteractive();
    const panel = this.add
      .rectangle(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2,
        470,
        365,
        0x14223d,
        0.98,
      )
      .setStrokeStyle(2, won ? 0x63e8ff : 0xff789e, 0.38)
      .setDepth(31);

    const badgeColor = draw ? 0xffd66b : won ? 0x4de0ef : 0xff668f;
    this.add
      .circle(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 - 112,
        42,
        badgeColor,
        1,
      )
      .setDepth(32);
    this.add
      .text(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 - 112,
        draw ? "－" : won ? "★" : "!",
        {
          fontFamily: UI_FONT,
          fontSize: "37px",
          fontStyle: "bold",
          color: "#102038",
        },
      )
      .setOrigin(0.5)
      .setDepth(33);
    this.add
      .text(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 - 42,
        draw ? "DRAW" : won ? "YOU WIN!" : "YOU LOSE",
        {
          fontFamily: UI_FONT,
          fontSize: won ? "42px" : "34px",
          fontStyle: "bold",
          color: "#f7fbff",
        },
      )
      .setOrigin(0.5)
      .setDepth(33);
    this.add
      .text(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 + 5,
        won
          ? "위험한 길을 읽고 상대를 먼저 가뒀습니다."
          : draw
            ? "같은 순간 물방울이 터졌습니다."
            : "물방울에서 빠져나오지 못했습니다. 다시 도전하세요.",
        {
          fontFamily: UI_FONT,
          fontSize: "14px",
          color: "#a9bfdc",
        },
      )
      .setOrigin(0.5)
      .setDepth(33);

    createButton(
      this,
      BOARD_X + BOARD_WIDTH / 2 - 108,
      BOARD_Y + BOARD_HEIGHT / 2 + 100,
      "다시 대결",
      () => {
        soundFx.unlock();
        this.scene.restart({ difficulty: this.difficulty });
      },
      {
        width: 195,
        height: 58,
        color: 0x43d1e8,
        hoverColor: 0x68e5f7,
        fontSize: 18,
      },
    ).setDepth(34);
    createButton(
      this,
      BOARD_X + BOARD_WIDTH / 2 + 108,
      BOARD_Y + BOARD_HEIGHT / 2 + 100,
      "난이도 선택",
      () => this.scene.start("MenuScene"),
      {
        width: 195,
        height: 58,
        color: 0x334868,
        hoverColor: 0x456083,
        textColor: "#edf7ff",
        fontSize: 18,
      },
    ).setDepth(34);

    void overlay;
    void panel;
  }

  private showToast(message: string): void {
    const toast = this.add
      .text(GAME_WIDTH - 28, 24, message, {
        fontFamily: UI_FONT,
        fontSize: "13px",
        fontStyle: "bold",
        color: "#f5fbff",
        backgroundColor: "#172744",
        padding: { x: 12, y: 7 },
      })
      .setOrigin(1, 0)
      .setDepth(40)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 120,
      yoyo: true,
      hold: 700,
      onComplete: () => toast.destroy(),
    });
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
