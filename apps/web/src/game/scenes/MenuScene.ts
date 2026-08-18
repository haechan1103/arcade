import type { Difficulty } from "@bubble-battle/game-core";
import Phaser from "phaser";
import { soundFx } from "../audio/SoundFx";
import { GAME_HEIGHT, GAME_WIDTH } from "../layout";
import { gameUiActions, gameUiStore } from "../../ui/gameUi";

interface FloatingBubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  color: number;
}

export class MenuScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private bubbles: FloatingBubble[] = [];

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.registry.remove("debug:state");
    this.cameras.main.setBackgroundColor("#090f28");
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.createBubbles();
    gameUiStore.patch({
      screen: "menu",
      result: null,
      overlay: { kind: "none" },
    });

    const stopActions = gameUiActions.subscribe((action) => {
      if (action.type === "start-battle") {
        this.startBattle(action.difficulty);
      }
    });
    const keyboard = this.input.keyboard;
    keyboard?.once("keydown-ENTER", () => this.startBattle("normal"));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopActions);
  }

  update(time: number, delta: number): void {
    const seconds = delta / 1000;
    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(0x090f28, 1);
    this.backgroundGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.backgroundGraphics.fillStyle(0x164a76, 0.16);
    this.backgroundGraphics.fillCircle(120, 40, 340);
    this.backgroundGraphics.fillStyle(0x711d59, 0.12);
    this.backgroundGraphics.fillCircle(
      GAME_WIDTH - 70,
      GAME_HEIGHT - 20,
      390,
    );

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * seconds;
      bubble.x +=
        Math.sin(time * 0.0007 + bubble.phase) * bubble.drift * seconds;
      if (bubble.y < -bubble.radius * 2) {
        bubble.y = GAME_HEIGHT + bubble.radius * 2;
      }

      this.backgroundGraphics.fillStyle(bubble.color, 0.08);
      this.backgroundGraphics.fillCircle(bubble.x, bubble.y, bubble.radius);
      this.backgroundGraphics.lineStyle(2, bubble.color, 0.18);
      this.backgroundGraphics.strokeCircle(bubble.x, bubble.y, bubble.radius);
      this.backgroundGraphics.fillStyle(0xffffff, 0.16);
      this.backgroundGraphics.fillCircle(
        bubble.x - bubble.radius * 0.35,
        bubble.y - bubble.radius * 0.35,
        Math.max(2, bubble.radius * 0.12),
      );
    }

    this.backgroundGraphics.lineStyle(1, 0x9feaff, 0.04);
    for (let x = 20; x < GAME_WIDTH; x += 40) {
      this.backgroundGraphics.beginPath();
      this.backgroundGraphics.moveTo(x, 0);
      this.backgroundGraphics.lineTo(x, GAME_HEIGHT);
      this.backgroundGraphics.strokePath();
    }
    for (let y = 20; y < GAME_HEIGHT; y += 40) {
      this.backgroundGraphics.beginPath();
      this.backgroundGraphics.moveTo(0, y);
      this.backgroundGraphics.lineTo(GAME_WIDTH, y);
      this.backgroundGraphics.strokePath();
    }
  }

  private createBubbles(): void {
    const colors = [0x58e5ff, 0xff79a5, 0x8e78ff, 0x67e8b1];
    this.bubbles = Array.from({ length: 24 }, (_, index) => ({
      x: 25 + ((index * 197) % (GAME_WIDTH - 50)),
      y: 20 + ((index * 113) % (GAME_HEIGHT - 40)),
      radius: 9 + ((index * 17) % 34),
      speed: 7 + ((index * 11) % 17),
      drift: 3 + (index % 5),
      phase: index * 0.73,
      color: colors[index % colors.length] ?? 0x58e5ff,
    }));
  }

  private startBattle(difficulty: Difficulty): void {
    soundFx.unlock();
    window.localStorage.setItem("bubble-battle:difficulty", difficulty);
    this.scene.start("BattleScene", { difficulty });
  }
}
