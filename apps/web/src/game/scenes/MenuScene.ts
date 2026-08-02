import type { Difficulty } from "@bubble-battle/game-core";
import Phaser from "phaser";
import { soundFx } from "../audio/SoundFx";
import {
  BRAND_LOGO,
  preloadGeneratedAssets,
} from "../assets";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  IS_COMPACT_LAYOUT,
  UI_FONT,
  isPortraitLayout,
} from "../layout";
import { createDifficultyCard } from "../ui/createDifficultyCard";

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
  tag: string;
  power: number;
}> = [
  {
    id: "easy",
    label: "느긋한 봇",
    subtitle: "천천히 움직이며 기본 공격을 연습해요",
    color: 0x63dfb0,
    tag: "입문",
    power: 1,
  },
  {
    id: "normal",
    label: "영리한 봇",
    subtitle: "위험 회피와 공격을 균형 있게 판단해요",
    color: 0x42cce8,
    tag: "추천",
    power: 2,
  },
  {
    id: "hard",
    label: "집요한 봇",
    subtitle: "빠르게 길을 막고 탈출 경로를 압박해요",
    color: 0xff6f99,
    tag: "도전",
    power: 3,
  },
];

export class MenuScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private bubbles: FloatingBubble[] = [];

  constructor() {
    super("MenuScene");
  }

  preload(): void {
    preloadGeneratedAssets(this);
  }

  create(): void {
    const portrait = isPortraitLayout();
    const compact = IS_COMPACT_LAYOUT;
    this.cameras.main.setBackgroundColor("#090f28");
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.createBubbles();

    const logoWidth = compact ? 340 : 450;
    const logoY = compact ? 78 : 126;
    const taglineY = compact ? 160 : 240;
    const difficultyLabelY = compact ? 211 : 304;
    const difficultyY = compact ? 282 : 398;
    const difficultyWidth = compact ? 620 : 300;
    const difficultyHeight = compact ? 92 : 124;
    const difficultyGap = compact ? 102 : 326;
    const startX =
      GAME_WIDTH / 2 -
      difficultyGap * ((DIFFICULTIES.length - 1) / 2);

    const logo = this.add
      .image(GAME_WIDTH / 2, logoY, BRAND_LOGO)
      .setDepth(2);
    logo.setDisplaySize(
      logoWidth,
      logoWidth * (logo.height / logo.width),
    );
    this.add
      .text(
        GAME_WIDTH / 2,
        taglineY,
        portrait
          ? "물풍선으로 길을 만들고 AI를 먼저 가두세요."
          : "물풍선을 놓고, 길을 만들고, 먼저 상대를 가두세요.",
        {
          fontFamily: UI_FONT,
          fontSize: compact ? "19px" : "18px",
          color: "#b8cce9",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);

    const sectionWidth = compact ? 680 : 990;
    const sectionHeight = compact ? 324 : 154;
    const sectionY = compact ? 388 : 401;
    const difficultyPanel = this.add.graphics().setDepth(1.5);
    difficultyPanel.fillStyle(0x08152d, 0.56);
    difficultyPanel.fillRoundedRect(
      GAME_WIDTH / 2 - sectionWidth / 2,
      sectionY - sectionHeight / 2,
      sectionWidth,
      sectionHeight,
      25,
    );
    difficultyPanel.lineStyle(1, 0x8fdfff, 0.1);
    difficultyPanel.strokeRoundedRect(
      GAME_WIDTH / 2 - sectionWidth / 2,
      sectionY - sectionHeight / 2,
      sectionWidth,
      sectionHeight,
      25,
    );

    this.add
      .rectangle(
        GAME_WIDTH / 2 - (compact ? 126 : 142),
        difficultyLabelY,
        compact ? 56 : 70,
        1,
        0x8fdfff,
        0.16,
      )
      .setDepth(2);
    this.add
      .text(GAME_WIDTH / 2, difficultyLabelY, "AI 난이도", {
        fontFamily: UI_FONT,
        fontSize: compact ? "19px" : "15px",
        fontStyle: "bold",
        color: "#91aed3",
      })
      .setOrigin(0.5)
      .setDepth(2);
    this.add
      .rectangle(
        GAME_WIDTH / 2 + (compact ? 126 : 142),
        difficultyLabelY,
        compact ? 56 : 70,
        1,
        0x8fdfff,
        0.16,
      )
      .setDepth(2);
    if (!compact) {
      this.add
        .text(
          GAME_WIDTH / 2,
          difficultyLabelY + 22,
          "카드를 누르면 바로 대결이 시작돼요",
          {
            fontFamily: UI_FONT,
            fontSize: "11px",
            color: "#566f96",
          },
        )
        .setOrigin(0.5)
        .setDepth(2);
    }

    DIFFICULTIES.forEach((difficulty, index) => {
      createDifficultyCard(
        this,
        compact
          ? GAME_WIDTH / 2
          : startX + index * difficultyGap,
        compact ? difficultyY + index * difficultyGap : difficultyY,
        difficulty.label,
        () => this.startBattle(difficulty.id),
        {
          width: difficultyWidth,
          height: difficultyHeight,
          accentColor: difficulty.color,
          level: index + 1,
          subtitle: difficulty.subtitle,
          tag: difficulty.tag,
          power: difficulty.power,
          layout: compact ? "row" : "tile",
        },
      ).setDepth(3);
    });

    this.add
      .rectangle(
        GAME_WIDTH / 2,
        compact ? 560 : 515,
        compact ? 610 : 770,
        1,
        0xffffff,
        0.12,
      )
      .setDepth(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        compact ? 592 : 557,
        portrait
          ? "가로로 돌리면 더 넓게 플레이할 수 있어요"
          : compact
          ? "화면 버튼으로 이동 · 물풍선으로 공격 · ⛶ 전체화면"
          : "방향키 / WASD로 이동     SPACE로 물풍선     E로 바늘 사용",
        {
          fontFamily: UI_FONT,
          fontSize: portrait ? "18px" : compact ? "15px" : "14px",
          color: "#91a8ca",
        },
      )
      .setOrigin(0.5)
      .setDepth(2);
    if (!portrait) {
      this.add
        .text(
          GAME_WIDTH / 2,
          compact ? 628 : 620,
          "3 RANDOM ARENAS  ·  LOCAL 1 VS 1  ·  NO SERVER",
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
          compact ? 660 : 672,
          "원작 에셋을 사용하지 않은 독립 프로토타입",
          {
            fontFamily: UI_FONT,
            fontSize: "11px",
            color: "#435777",
          },
        )
        .setOrigin(0.5)
        .setDepth(2);
    }

    const keyboard = this.input.keyboard;
    keyboard?.once("keydown-ENTER", () => this.startBattle("normal"));

    const onViewportResize = (): void => {
      if (isPortraitLayout() !== portrait) {
        this.scene.restart();
      }
    };
    window.addEventListener("resize", onViewportResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("resize", onViewportResize);
    });
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
