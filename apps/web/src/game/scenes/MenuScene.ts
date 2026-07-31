import type { Difficulty } from "@bubble-battle/game-core";
import Phaser from "phaser";
import { soundFx } from "../audio/SoundFx";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  UI_FONT,
} from "../layout";
import { createButton } from "../ui/createButton";

interface FloatingBubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  color: number;
}

const DIFFICULTIES: Array<{
  id: Difficulty;
  label: string;
  subtitle: string;
  color: number;
  hoverColor: number;
}> = [
  {
    id: "easy",
    label: "느긋한 봇",
    subtitle: "처음 익히기 좋은 반응 속도",
    color: 0x63dfb0,
    hoverColor: 0x81edc4,
  },
  {
    id: "normal",
    label: "영리한 봇",
    subtitle: "추천 · 위험과 공격을 균형 있게",
    color: 0x42cce8,
    hoverColor: 0x67def3,
  },
  {
    id: "hard",
    label: "집요한 봇",
    subtitle: "빠른 판단과 적극적인 포위",
    color: 0xff6f99,
    hoverColor: 0xff8caf,
  },
];

export class MenuScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private bubbles: FloatingBubble[] = [];

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#090f28");
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.createBubbles();

    this.add
      .text(GAME_WIDTH / 2, 103, "BUBBLE", {
        fontFamily: UI_FONT,
        fontSize: "86px",
        fontStyle: "bold",
        color: "#f7fcff",
        stroke: "#123852",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(GAME_WIDTH / 2, 181, "BATTLE", {
        fontFamily: UI_FONT,
        fontSize: "86px",
        fontStyle: "bold",
        color: "#62e9ff",
        stroke: "#123852",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        245,
        "물풍선을 놓고, 길을 만들고, 먼저 상대를 가두세요.",
        {
          fontFamily: UI_FONT,
          fontSize: "18px",
          color: "#b8cce9",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(GAME_WIDTH / 2, 307, "AI 난이도 선택", {
        fontFamily: UI_FONT,
        fontSize: "15px",
        fontStyle: "bold",
        color: "#7894bd",
      })
      .setOrigin(0.5)
      .setDepth(2);

    const startX = GAME_WIDTH / 2 - 316;
    DIFFICULTIES.forEach((difficulty, index) => {
      createButton(
        this,
        startX + index * 316,
        383,
        difficulty.label,
        () => this.startBattle(difficulty.id),
        {
          width: 282,
          height: 82,
          color: difficulty.color,
          hoverColor: difficulty.hoverColor,
          fontSize: 22,
          subtitle: difficulty.subtitle,
        },
      ).setDepth(3);
    });

    this.add
      .rectangle(GAME_WIDTH / 2, 510, 770, 1, 0xffffff, 0.12)
      .setDepth(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        552,
        "방향키 / WASD로 이동     SPACE로 물풍선     E로 바늘 사용",
        {
          fontFamily: UI_FONT,
          fontSize: "14px",
          color: "#91a8ca",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        614,
        "15 × 13 NEON GARDEN  ·  LOCAL 1 VS 1  ·  NO SERVER",
        {
          fontFamily: UI_FONT,
          fontSize: "11px",
          fontStyle: "bold",
          color: "#4e668c",
          letterSpacing: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        672,
        "원작 에셋을 사용하지 않은 독립 프로토타입",
        {
          fontFamily: UI_FONT,
          fontSize: "11px",
          color: "#435777",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    const keyboard = this.input.keyboard;
    keyboard?.once("keydown-ENTER", () => this.startBattle("normal"));
  }

  update(time: number, delta: number): void {
    const seconds = delta / 1000;
    this.backgroundGraphics.clear();
    this.backgroundGraphics.fillStyle(0x090f28, 1);
    this.backgroundGraphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.backgroundGraphics.fillStyle(0x164a76, 0.16);
    this.backgroundGraphics.fillCircle(120, 40, 340);
    this.backgroundGraphics.fillStyle(0x711d59, 0.12);
    this.backgroundGraphics.fillCircle(1030, 700, 390);

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * seconds;
      bubble.x +=
        Math.sin(time * 0.0007 + bubble.phase) *
        bubble.drift *
        seconds;
      if (bubble.y < -bubble.radius * 2) {
        bubble.y = GAME_HEIGHT + bubble.radius * 2;
      }

      this.backgroundGraphics.fillStyle(bubble.color, 0.08);
      this.backgroundGraphics.fillCircle(
        bubble.x,
        bubble.y,
        bubble.radius,
      );
      this.backgroundGraphics.lineStyle(2, bubble.color, 0.18);
      this.backgroundGraphics.strokeCircle(
        bubble.x,
        bubble.y,
        bubble.radius,
      );
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
    window.localStorage.setItem(
      "bubble-battle:difficulty",
      difficulty,
    );
    this.scene.start("BattleScene", { difficulty });
  }
}
