import {
  HALF_TILE,
  ROUND_DURATION_TICKS,
  STORM_START_TICK,
  TICK_RATE,
  TILE_UNITS,
  type AiDebugInfo,
  type BlastState,
  type Cell,
  type GameEvent,
  type GameState,
  type ItemType,
  type PlayerState,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import {
  BLAST_FRAME,
  BLAST_SHEET,
  BRAND_LOGO,
  CHARACTER_FRAME,
  CHARACTER_SHEET,
  OBJECT_FRAME,
  OBJECT_SHEET,
  WARNING_BALLOON,
} from "../assets";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARD_X,
  BOARD_Y,
  cellToScreen,
  GAME_HEIGHT,
  GAME_WIDTH,
  IS_COMPACT_LAYOUT,
  SIDEBAR_X,
  TILE_SIZE,
  UI_FONT,
  isPortraitLayout,
  worldToScreenX,
  worldToScreenY,
} from "../layout";

interface Position {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  radius: number;
  color: number;
}

interface SpriteOptions {
  width: number;
  height: number;
  depth: number;
  alpha?: number;
  angle?: number;
  flipX?: boolean;
}

export type OverlayKind = "none" | "countdown" | "pause";

const PLAYER_COLORS: Record<number, { main: number; dark: number }> = {
  1: { main: 0x35d7f0, dark: 0x077d9b },
  2: { main: 0xff668f, dark: 0xa41e57 },
};

const HARD_BLOCK_FRAME_BY_MAP: Readonly<Record<string, number>> = {
  "neon-garden": OBJECT_FRAME.gardenWall,
  "metro-crossing": OBJECT_FRAME.metroWall,
  "coral-maze": OBJECT_FRAME.coralWall,
};

const PICKUP_FRAME: Readonly<Record<ItemType, number>> = {
  capacity: OBJECT_FRAME.capacity,
  range: OBJECT_FRAME.range,
  speed: OBJECT_FRAME.speed,
  needle: OBJECT_FRAME.needle,
};

const CHARACTER_SIZE = 58;
const WALK_FRAME_MS = 125;
const BALLOON_WARNING_TICKS = Math.round(TICK_RATE * 1.25);

const BOT_MODE_LABELS: Record<AiDebugInfo["mode"], string> = {
  escape: "위험 회피 중",
  pickup: "아이템 탐색 중",
  attack: "공격 각도 계산 중",
  break: "블록 공략 중",
  wander: "경로 탐색 중",
  trapped: "물방울 탈출 중",
};

export class BattleRenderer {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;
  private readonly overlayGraphics: Phaser.GameObjects.Graphics;
  private readonly brandLogo: Phaser.GameObjects.Image | null;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly mapText: Phaser.GameObjects.Text;
  private readonly timeText: Phaser.GameObjects.Text;
  private readonly phaseText: Phaser.GameObjects.Text;
  private readonly humanNameText: Phaser.GameObjects.Text;
  private readonly humanStatsText: Phaser.GameObjects.Text;
  private readonly botNameText: Phaser.GameObjects.Text;
  private readonly botStatsText: Phaser.GameObjects.Text;
  private readonly botModeText: Phaser.GameObjects.Text;
  private readonly helpText: Phaser.GameObjects.Text;
  private readonly seedText: Phaser.GameObjects.Text;
  private readonly compactHumanText: Phaser.GameObjects.Text;
  private readonly compactTimeText: Phaser.GameObjects.Text;
  private readonly compactBotText: Phaser.GameObjects.Text;
  private readonly overlayPrimary: Phaser.GameObjects.Text;
  private readonly overlaySecondary: Phaser.GameObjects.Text;
  private readonly particles: Particle[] = [];
  private readonly spritePools = new Map<
    string,
    Phaser.GameObjects.Image[]
  >();
  private readonly spriteUseCount = new Map<string, number>();
  private overlayKind: OverlayKind = "none";
  private overlayTitle = "";
  private overlaySubtitle = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(1);
    this.effectGraphics = scene.add.graphics().setDepth(4);
    this.overlayGraphics = scene.add.graphics().setDepth(20);

    this.titleText = this.makeText(
      SIDEBAR_X + 18,
      45,
      "BUBBLE\nBATTLE",
      35,
      "#f6fbff",
      900,
    ).setLineSpacing(-8);
    this.brandLogo = scene.textures.exists(BRAND_LOGO)
      ? scene.add
          .image(SIDEBAR_X + 141, 74, BRAND_LOGO)
          .setDisplaySize(214, 86)
          .setDepth(6)
      : null;
    this.mapText = this.makeText(
      SIDEBAR_X + 20,
      132,
      "",
      13,
      "#8ca2c9",
      700,
    );
    this.timeText = this.makeText(
      SIDEBAR_X + 142,
      165,
      "2:30",
      42,
      "#ffffff",
      900,
    ).setOrigin(0.5);
    this.phaseText = this.makeText(
      SIDEBAR_X + 142,
      200,
      "ROUND TIME",
      11,
      "#7088b7",
      800,
    ).setOrigin(0.5);

    this.humanNameText = this.makeText(
      SIDEBAR_X + 28,
      276,
      "플레이어",
      20,
      "#dffaff",
      900,
    );
    this.humanStatsText = this.makeText(
      SIDEBAR_X + 28,
      310,
      "",
      13,
      "#a9bedf",
      700,
    ).setLineSpacing(7);
    this.botNameText = this.makeText(
      SIDEBAR_X + 28,
      423,
      "버블봇",
      20,
      "#ffe6ef",
      900,
    );
    this.botStatsText = this.makeText(
      SIDEBAR_X + 28,
      457,
      "",
      13,
      "#a9bedf",
      700,
    ).setLineSpacing(7);
    this.botModeText = this.makeText(
      SIDEBAR_X + 28,
      533,
      "",
      12,
      "#ff9fbe",
      800,
    );
    this.helpText = this.makeText(
      SIDEBAR_X + 22,
      600,
      "SPACE  물풍선\nE       바늘\nESC     일시정지\nM       음소거",
      12,
      "#788cad",
      700,
    ).setLineSpacing(6);
    this.seedText = this.makeText(
      SIDEBAR_X + 22,
      690,
      "",
      10,
      "#536484",
      700,
    );

    this.compactHumanText = this.makeText(
      BOARD_X + 17,
      BOARD_Y + 24,
      "",
      18,
      "#75efff",
      900,
    )
      .setOrigin(0, 0.5)
      .setVisible(IS_COMPACT_LAYOUT);
    this.compactTimeText = this.makeText(
      BOARD_X + BOARD_WIDTH / 2,
      BOARD_Y + 24,
      "2:30",
      26,
      "#ffffff",
      900,
    )
      .setOrigin(0.5)
      .setVisible(IS_COMPACT_LAYOUT);
    this.compactBotText = this.makeText(
      BOARD_X + BOARD_WIDTH - 17,
      BOARD_Y + 24,
      "",
      18,
      "#ff8bac",
      900,
    )
      .setOrigin(1, 0.5)
      .setVisible(IS_COMPACT_LAYOUT);

    for (const text of [
      this.titleText,
      this.mapText,
      this.timeText,
      this.phaseText,
      this.humanNameText,
      this.humanStatsText,
      this.botNameText,
      this.botStatsText,
      this.botModeText,
      this.helpText,
      this.seedText,
    ]) {
      text.setVisible(!IS_COMPACT_LAYOUT);
    }
    if (this.brandLogo !== null) {
      this.titleText.setVisible(false);
      this.brandLogo.setVisible(!IS_COMPACT_LAYOUT);
    }

    this.overlayPrimary = this.makeText(
      BOARD_X + BOARD_WIDTH / 2,
      BOARD_Y + BOARD_HEIGHT / 2 - 14,
      "",
      76,
      "#ffffff",
      900,
    )
      .setOrigin(0.5)
      .setDepth(21)
      .setVisible(false);
    this.overlaySecondary = this.makeText(
      BOARD_X + BOARD_WIDTH / 2,
      BOARD_Y + BOARD_HEIGHT / 2 + 57,
      "",
      16,
      "#b9d9eb",
      800,
    )
      .setOrigin(0.5)
      .setAlign("center")
      .setWordWrapWidth(BOARD_WIDTH - 100, true)
      .setDepth(21)
      .setVisible(false);
  }

  setOverlay(
    kind: OverlayKind,
    title = "",
    subtitle = "",
  ): void {
    this.overlayKind = kind;
    this.overlayTitle = title;
    this.overlaySubtitle = subtitle;
  }

  handleEvent(event: GameEvent): void {
    if (event.type === "balloon-exploded") {
      this.scene.cameras.main.shake(75, 0.0016);
      for (const cell of event.cells) {
        const screen = cellToScreen(cell.col, cell.row);
        for (let index = 0; index < 2; index += 1) {
          const angle =
            ((cell.col * 17 + cell.row * 31 + index * 137) % 360) *
            (Math.PI / 180);
          this.particles.push({
            x: screen.x + TILE_SIZE / 2,
            y: screen.y + TILE_SIZE / 2,
            velocityX: Math.cos(angle) * (35 + index * 18),
            velocityY: Math.sin(angle) * (35 + index * 18),
            life: 0.42,
            maxLife: 0.42,
            radius: 3 + index,
            color: index === 0 ? 0xffffff : 0x5eeaff,
          });
        }
      }
    } else if (event.type === "item-picked") {
      const screen = cellToScreen(event.cell.col, event.cell.row);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        this.particles.push({
          x: screen.x + TILE_SIZE / 2,
          y: screen.y + TILE_SIZE / 2,
          velocityX: Math.cos(angle) * 72,
          velocityY: Math.sin(angle) * 72,
          life: 0.5,
          maxLife: 0.5,
          radius: 3,
          color: 0xffe372,
        });
      }
    }
  }

  updateParticles(deltaSeconds: number): void {
    for (const particle of this.particles) {
      particle.x += particle.velocityX * deltaSeconds;
      particle.y += particle.velocityY * deltaSeconds;
      particle.velocityY += 38 * deltaSeconds;
      particle.life -= deltaSeconds;
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      if ((this.particles[index]?.life ?? 0) <= 0) {
        this.particles.splice(index, 1);
      }
    }
  }

  render(
    state: GameState,
    previousPositions: ReadonlyMap<number, Position>,
    interpolation: number,
    elapsedMs: number,
    botDebug: AiDebugInfo,
  ): void {
    this.beginSpriteFrame();
    this.graphics.clear();
    this.drawBackdrop(elapsedMs);
    this.drawBoard(state, elapsedMs);
    if (IS_COMPACT_LAYOUT) {
      this.drawCompactHud(state);
    } else {
      this.drawSidebar(state, botDebug);
    }
    this.drawEntities(
      state,
      previousPositions,
      interpolation,
      elapsedMs,
    );
    this.drawParticles();
    this.drawOverlay();
  }

  destroy(): void {
    for (const pool of this.spritePools.values()) {
      for (const sprite of pool) {
        sprite.destroy();
      }
    }
    this.spritePools.clear();
    this.spriteUseCount.clear();
    this.graphics.destroy();
    this.effectGraphics.destroy();
    this.overlayGraphics.destroy();
  }

  private makeText(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: string,
    fontWeight: number,
  ): Phaser.GameObjects.Text {
    return this.scene.add
      .text(x, y, text, {
        fontFamily: UI_FONT,
        fontSize: `${fontSize}px`,
        fontStyle: fontWeight >= 800 ? "bold" : "normal",
        color,
      })
      .setDepth(6);
  }

  private beginSpriteFrame(): void {
    this.spriteUseCount.clear();
    for (const pool of this.spritePools.values()) {
      for (const sprite of pool) {
        sprite.setVisible(false);
      }
    }
  }

  private drawSprite(
    texture: string,
    frame: number,
    x: number,
    y: number,
    options: SpriteOptions,
  ): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(texture)) {
      return null;
    }

    const used = this.spriteUseCount.get(texture) ?? 0;
    let pool = this.spritePools.get(texture);
    if (pool === undefined) {
      pool = [];
      this.spritePools.set(texture, pool);
    }

    let sprite = pool[used];
    if (sprite === undefined) {
      sprite = this.scene.add.image(x, y, texture, frame);
      pool.push(sprite);
    }
    this.spriteUseCount.set(texture, used + 1);

    sprite
      .setTexture(texture, frame)
      .setPosition(x, y)
      .setDisplaySize(options.width, options.height)
      .setDepth(options.depth)
      .setAlpha(options.alpha ?? 1)
      .setAngle(options.angle ?? 0)
      .setFlipX(options.flipX ?? false)
      .setFlipY(false)
      .clearTint()
      .setVisible(true);
    return sprite;
  }

  private drawBackdrop(elapsedMs: number): void {
    const pulse = (Math.sin(elapsedMs * 0.0006) + 1) / 2;
    this.graphics.fillStyle(0x090f28, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.graphics.fillStyle(0x13335e, 0.12 + pulse * 0.05);
    this.graphics.fillCircle(120, 10, 260);
    this.graphics.fillStyle(0x5b174c, 0.1);
    this.graphics.fillCircle(1080, 720, 360);

    this.graphics.fillStyle(0x000000, 0.28);
    this.graphics.fillRoundedRect(
      BOARD_X - 8,
      BOARD_Y + 8,
      BOARD_WIDTH + 16,
      BOARD_HEIGHT + 12,
      24,
    );
    if (!IS_COMPACT_LAYOUT) {
      this.graphics.fillStyle(0x17233e, 0.9);
      this.graphics.fillRoundedRect(
        SIDEBAR_X,
        28,
        282,
        664,
        24,
      );
      this.graphics.lineStyle(1, 0x8edfff, 0.16);
      this.graphics.strokeRoundedRect(
        SIDEBAR_X,
        28,
        282,
        664,
        24,
      );
    }
  }

  private drawBoard(state: GameState, elapsedMs: number): void {
    this.graphics.fillStyle(0x122746, 1);
    this.graphics.fillRoundedRect(
      BOARD_X - 4,
      BOARD_Y - 4,
      BOARD_WIDTH + 8,
      BOARD_HEIGHT + 8,
      18,
    );

    for (let row = 0; row < state.height; row += 1) {
      for (let col = 0; col < state.width; col += 1) {
        const screen = cellToScreen(col, row);
        const alternate = (col + row) % 2 === 0;
        this.graphics.fillStyle(
          alternate ? 0x183b5d : 0x163653,
          1,
        );
        this.graphics.fillRoundedRect(
          screen.x + 1,
          screen.y + 1,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          6,
        );
        this.graphics.lineStyle(1, 0x8ccce0, 0.045);
        this.graphics.strokeRoundedRect(
          screen.x + 3,
          screen.y + 3,
          TILE_SIZE - 6,
          TILE_SIZE - 6,
          5,
        );
      }
    }

    this.drawStorm(state, elapsedMs);

    for (let row = 0; row < state.height; row += 1) {
      for (let col = 0; col < state.width; col += 1) {
        const tile = state.tiles[row * state.width + col];
        if (tile?.kind === "hard") {
          this.drawHardBlock(state.mapId, col, row);
        } else if (tile?.kind === "soft") {
          this.drawSoftBlock(col, row);
        }
      }
    }
  }

  private drawStorm(state: GameState, elapsedMs: number): void {
    const wave = Math.sin(elapsedMs * 0.008) * 3;
    for (const cell of state.stormCells) {
      const screen = cellToScreen(cell.col, cell.row);
      if (
        this.drawSprite(
          OBJECT_SHEET,
          OBJECT_FRAME.storm,
          screen.x + TILE_SIZE / 2,
          screen.y + TILE_SIZE / 2,
          {
            width: TILE_SIZE + 4,
            height: TILE_SIZE + 4,
            depth: 1.5,
            alpha: 0.84,
          },
        ) !== null
      ) {
        continue;
      }
      this.graphics.fillStyle(0x79194f, 0.78);
      this.graphics.fillRoundedRect(
        screen.x + 2,
        screen.y + 2,
        TILE_SIZE - 4,
        TILE_SIZE - 4,
        7,
      );
      this.graphics.lineStyle(3, 0xff74b2, 0.38);
      this.graphics.beginPath();
      this.graphics.moveTo(screen.x + 5, screen.y + 17 + wave);
      this.graphics.lineTo(
        screen.x + TILE_SIZE - 5,
        screen.y + 17 - wave,
      );
      this.graphics.moveTo(screen.x + 5, screen.y + 31 - wave);
      this.graphics.lineTo(
        screen.x + TILE_SIZE - 5,
        screen.y + 31 + wave,
      );
      this.graphics.strokePath();
    }
  }

  private drawHardBlock(
    mapId: string,
    col: number,
    row: number,
  ): void {
    const { x, y } = cellToScreen(col, row);
    if (
      this.drawSprite(
        OBJECT_SHEET,
        HARD_BLOCK_FRAME_BY_MAP[mapId] ?? OBJECT_FRAME.hardBlock,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 8,
          height: TILE_SIZE + 8,
          depth: 2,
        },
      ) !== null
    ) {
      return;
    }
    this.graphics.fillStyle(0x071527, 0.42);
    this.graphics.fillRoundedRect(x + 5, y + 7, 40, 39, 9);
    this.graphics.fillStyle(0x45678f, 1);
    this.graphics.fillRoundedRect(x + 4, y + 3, 40, 40, 9);
    this.graphics.fillStyle(0x5e83ac, 1);
    this.graphics.fillRoundedRect(x + 8, y + 7, 32, 29, 7);
    this.graphics.fillStyle(0x9ec5df, 0.32);
    this.graphics.fillRoundedRect(x + 10, y + 8, 27, 7, 4);
    this.graphics.fillStyle(0x1d3d64, 1);
    this.graphics.fillCircle(x + 14, y + 31, 3);
    this.graphics.fillCircle(x + 34, y + 31, 3);
  }

  private drawSoftBlock(col: number, row: number): void {
    const { x, y } = cellToScreen(col, row);
    if (
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.softBlock,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 8,
          height: TILE_SIZE + 8,
          depth: 2.1,
        },
      ) !== null
    ) {
      return;
    }
    this.graphics.fillStyle(0x071527, 0.38);
    this.graphics.fillRoundedRect(x + 5, y + 7, 40, 38, 8);
    this.graphics.fillStyle(0xb66943, 1);
    this.graphics.fillRoundedRect(x + 4, y + 4, 40, 38, 7);
    this.graphics.fillStyle(0xe29a5b, 1);
    this.graphics.fillRoundedRect(x + 8, y + 8, 32, 30, 5);
    this.graphics.lineStyle(5, 0x9a4f37, 0.92);
    this.graphics.beginPath();
    this.graphics.moveTo(x + 10, y + 10);
    this.graphics.lineTo(x + 38, y + 36);
    this.graphics.moveTo(x + 38, y + 10);
    this.graphics.lineTo(x + 10, y + 36);
    this.graphics.strokePath();
    this.graphics.lineStyle(2, 0xffc87d, 0.35);
    this.graphics.strokeRoundedRect(x + 7, y + 7, 34, 32, 5);
  }

  private drawEntities(
    state: GameState,
    previousPositions: ReadonlyMap<number, Position>,
    interpolation: number,
    elapsedMs: number,
  ): void {
    for (const pickup of state.pickups) {
      this.drawPickup(pickup, elapsedMs);
    }

    for (const balloon of state.balloons) {
      this.drawBalloon(balloon, state.tick, elapsedMs);
    }

    for (const blast of state.blasts) {
      for (const cell of blast.cells) {
        this.drawBlast(blast, cell, state.tick, elapsedMs);
      }
    }

    for (const player of state.players) {
      const previous = previousPositions.get(player.id) ?? {
        x: player.x,
        y: player.y,
      };
      const x =
        previous.x + (player.x - previous.x) * interpolation;
      const y =
        previous.y + (player.y - previous.y) * interpolation;
      const isMoving =
        Math.abs(player.x - previous.x) > 0.5 ||
        Math.abs(player.y - previous.y) > 0.5;
      this.drawPlayer(
        player,
        x,
        y,
        isMoving,
        elapsedMs,
        state.tick,
      );
    }
  }

  private drawPickup(
    pickup: { col: number; row: number; type: ItemType },
    elapsedMs: number,
  ): void {
    const { x, y } = cellToScreen(pickup.col, pickup.row);
    const centerX = x + TILE_SIZE / 2;
    const centerY =
      y + TILE_SIZE / 2 + Math.sin(elapsedMs * 0.006 + pickup.col) * 2;

    if (this.scene.textures.exists(OBJECT_SHEET)) {
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.shadow,
        centerX,
        y + 39,
        {
          width: 36,
          height: 17,
          depth: 2.7,
          alpha: 0.56,
        },
      );
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.sparkle,
        centerX,
        centerY,
        {
          width: 48,
          height: 48,
          depth: 2.8,
          alpha: 0.32,
          angle: (elapsedMs * 0.025) % 360,
        },
      );
      this.drawSprite(
        OBJECT_SHEET,
        PICKUP_FRAME[pickup.type],
        centerX,
        centerY,
        {
          width: 47,
          height: 47,
          depth: 3,
        },
      );
      return;
    }

    this.graphics.fillStyle(0x061423, 0.42);
    this.graphics.fillEllipse(centerX, y + 39, 27, 9);

    if (pickup.type === "capacity") {
      this.graphics.fillStyle(0x48c9ff, 1);
      this.graphics.fillCircle(centerX, centerY, 14);
      this.graphics.lineStyle(2, 0xd9f7ff, 0.8);
      this.graphics.strokeCircle(centerX - 3, centerY - 4, 8);
      this.graphics.fillStyle(0xffffff, 0.9);
      this.graphics.fillRect(centerX + 3, centerY - 2, 10, 4);
      this.graphics.fillRect(centerX + 6, centerY - 5, 4, 10);
    } else if (pickup.type === "range") {
      this.graphics.fillStyle(0xb77aff, 1);
      this.graphics.fillCircle(centerX, centerY, 12);
      this.graphics.lineStyle(4, 0xf1d9ff, 0.9);
      this.graphics.beginPath();
      this.graphics.moveTo(centerX - 18, centerY);
      this.graphics.lineTo(centerX + 18, centerY);
      this.graphics.moveTo(centerX, centerY - 18);
      this.graphics.lineTo(centerX, centerY + 18);
      this.graphics.strokePath();
      this.graphics.fillStyle(0xffffff, 1);
      this.graphics.fillCircle(centerX, centerY, 5);
    } else if (pickup.type === "speed") {
      this.graphics.fillStyle(0xffd34f, 1);
      this.graphics.fillRoundedRect(
        centerX - 17,
        centerY - 15,
        34,
        30,
        9,
      );
      this.graphics.fillStyle(0x8a5214, 1);
      this.graphics.fillTriangle(
        centerX - 10,
        centerY - 8,
        centerX + 3,
        centerY,
        centerX - 10,
        centerY + 8,
      );
      this.graphics.fillTriangle(
        centerX,
        centerY - 8,
        centerX + 13,
        centerY,
        centerX,
        centerY + 8,
      );
    } else {
      this.graphics.fillStyle(0x4de1a1, 1);
      this.graphics.fillCircle(centerX, centerY, 15);
      this.graphics.lineStyle(4, 0x0b6049, 1);
      this.graphics.beginPath();
      this.graphics.moveTo(centerX - 9, centerY + 8);
      this.graphics.lineTo(centerX + 9, centerY - 10);
      this.graphics.strokePath();
      this.graphics.fillStyle(0xeafff8, 1);
      this.graphics.fillCircle(centerX + 10, centerY - 11, 4);
    }
  }

  private drawBalloon(
    balloon: {
      col: number;
      row: number;
      placedTick: number;
      explodeTick: number;
    },
    currentTick: number,
    elapsedMs: number,
  ): void {
    const { x, y } = cellToScreen(balloon.col, balloon.row);
    const centerX = x + TILE_SIZE / 2;
    const centerY = y + TILE_SIZE / 2 + 2;
    const remaining = Math.max(
      0,
      balloon.explodeTick - currentTick,
    );
    const urgency = 1 - Math.min(1, remaining / 75);
    const warningActive = remaining <= BALLOON_WARNING_TICKS;
    const warningProgress = warningActive
      ? 1 - remaining / BALLOON_WARNING_TICKS
      : 0;
    const warningElapsedTicks = Math.max(
      0,
      BALLOON_WARNING_TICKS - remaining,
    );
    const warningBlinkTicks = Math.max(
      3,
      Math.round(6 - warningProgress * 3),
    );
    const warningBright =
      Math.floor(warningElapsedTicks / warningBlinkTicks) % 2 === 0;
    const pulse =
      Math.sin(elapsedMs * (0.009 + urgency * 0.012)) *
      (1.2 + urgency * 2.5);

    if (this.scene.textures.exists(OBJECT_SHEET)) {
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.shadow,
        centerX,
        y + 41,
        {
          width: 38,
          height: 18,
          depth: 2.7,
          alpha: 0.62,
        },
      );
      const warningTextureReady =
        warningActive &&
        this.scene.textures.exists(WARNING_BALLOON);
      const warningSizeOffset = warningTextureReady
        ? warningBright
          ? 2.4 + warningProgress * 1.4
          : -0.6
        : 0;
      this.drawSprite(
        warningTextureReady ? WARNING_BALLOON : OBJECT_SHEET,
        warningTextureReady ? 0 : OBJECT_FRAME.balloon,
        centerX,
        centerY,
        {
          width: 49 + pulse * 0.25 + warningSizeOffset,
          height: 49 + pulse * 0.25 + warningSizeOffset,
          depth: 3.1,
          alpha:
            warningTextureReady && !warningBright
              ? 0.76
              : 1,
        },
      );
      if (warningTextureReady) {
        this.graphics.fillStyle(
          0xff315f,
          warningBright ? 0.1 + warningProgress * 0.08 : 0.035,
        );
        this.graphics.fillCircle(
          centerX,
          centerY,
          24 + warningProgress * 2,
        );
        this.graphics.lineStyle(
          warningBright ? 3 : 1.5,
          0xff6f91,
          warningBright ? 0.92 : 0.34,
        );
        this.graphics.strokeCircle(
          centerX,
          centerY,
          20 + warningProgress * 3 + (warningBright ? 2 : 0),
        );
      }
      return;
    }

    this.graphics.fillStyle(0x03101e, 0.48);
    this.graphics.fillEllipse(centerX, y + 41, 31, 10);
    this.graphics.fillStyle(
      warningActive ? 0xff315f : 0x2bbce0,
      warningActive && !warningBright ? 0.76 : 1,
    );
    this.graphics.fillCircle(centerX, centerY, 16 + pulse);
    this.graphics.fillStyle(0x07496f, 0.76);
    this.graphics.fillCircle(centerX + 4, centerY + 5, 12 + pulse * 0.4);
    this.graphics.fillStyle(0xbaf6ff, 0.92);
    this.graphics.fillEllipse(centerX - 6, centerY - 7, 8, 5);
    this.graphics.lineStyle(3, 0x8deaff, 0.86);
    this.graphics.beginPath();
    this.graphics.moveTo(centerX + 7, centerY - 13);
    this.graphics.lineTo(centerX + 12, centerY - 20);
    this.graphics.lineTo(centerX + 17, centerY - 18);
    this.graphics.strokePath();
  }

  private drawBlast(
    blast: BlastState,
    cell: Cell,
    currentTick: number,
    elapsedMs: number,
  ): void {
    const { x, y } = cellToScreen(cell.col, cell.row);
    const duration = Math.max(1, blast.expireTick - blast.createdTick);
    const progress = Phaser.Math.Clamp(
      (currentTick - blast.createdTick) / duration,
      0,
      0.999,
    );
    const frame = Math.min(
      BLAST_FRAME.dissipate,
      Math.floor(progress * 4),
    );
    const flashOn =
      (Math.floor(elapsedMs / 55) + cell.col + cell.row) % 2 === 0;
    const pulse = Math.sin(elapsedMs * 0.035 + cell.col + cell.row);

    if (
      this.drawSprite(
        BLAST_SHEET,
        frame,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 18 + pulse * 1.5,
          height: TILE_SIZE + 18 + pulse * 1.5,
          depth: 4,
          alpha: flashOn ? 1 : 0.76,
          angle: (cell.col + cell.row) % 2 === 0 ? -4 : 4,
        },
      ) !== null
    ) {
      if (frame === BLAST_FRAME.peak && flashOn) {
        this.drawSprite(
          OBJECT_SHEET,
          OBJECT_FRAME.sparkle,
          x + TILE_SIZE / 2,
          y + TILE_SIZE / 2,
          {
            width: TILE_SIZE + 10,
            height: TILE_SIZE + 10,
            depth: 4.1,
            alpha: 0.32,
            angle: (elapsedMs * 0.08) % 360,
          },
        );
      }
      return;
    }

    if (
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.blast,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 8 + pulse * 2,
          height: TILE_SIZE + 8 + pulse * 2,
          depth: 4,
          alpha: 0.9,
          angle: (cell.col + cell.row) % 2 === 0 ? 0 : 45,
        },
      ) !== null
    ) {
      return;
    }
    this.graphics.fillStyle(0x33dff5, 0.66);
    this.graphics.fillRoundedRect(
      x + 2 - pulse * 0.2,
      y + 2 - pulse * 0.2,
      TILE_SIZE - 4 + pulse * 0.4,
      TILE_SIZE - 4 + pulse * 0.4,
      15,
    );
    this.graphics.fillStyle(0xe9ffff, 0.74);
    this.graphics.fillRoundedRect(
      x + 10,
      y + 10,
      TILE_SIZE - 20,
      TILE_SIZE - 20,
      10,
    );
    this.graphics.fillStyle(0xffffff, 0.9);
    this.graphics.fillCircle(x + 15, y + 14, 4);
  }

  private drawPlayer(
    player: PlayerState,
    worldX: number,
    worldY: number,
    isMoving: boolean,
    elapsedMs: number,
    currentTick: number,
  ): void {
    if (player.status === "dead") {
      return;
    }

    const x = worldToScreenX(worldX);
    const y = worldToScreenY(worldY);
    const bob = isMoving
      ? Math.sin(elapsedMs * 0.025 + player.id) * 0.75
      : Math.sin(elapsedMs * 0.006 + player.id) * 0.35;

    if (
      this.drawGeneratedPlayer(
        player,
        x,
        y,
        bob,
        isMoving,
        elapsedMs,
        currentTick,
      )
    ) {
      return;
    }

    const palette = PLAYER_COLORS[player.team] ?? PLAYER_COLORS[1];
    const directionOffset = {
      left: { x: -2, y: 0 },
      right: { x: 2, y: 0 },
      up: { x: 0, y: -2 },
      down: { x: 0, y: 2 },
    }[player.direction];

    this.graphics.fillStyle(0x020813, 0.42);
    this.graphics.fillEllipse(x, y + 17, 33, 11);

    if (player.status === "trapped") {
      const bubblePulse = Math.sin(elapsedMs * 0.01) * 2;
      this.graphics.fillStyle(0x6cecff, 0.22);
      this.graphics.fillCircle(x, y - 2, 27 + bubblePulse);
      this.graphics.lineStyle(3, 0xc8fbff, 0.72);
      this.graphics.strokeCircle(x, y - 2, 27 + bubblePulse);
      this.graphics.fillStyle(0xeaffff, 0.72);
      this.graphics.fillCircle(x - 9, y - 17, 5);
      this.graphics.fillCircle(x + 14, y - 23, 3);
    }

    this.graphics.fillStyle(palette?.dark ?? 0x077d9b, 1);
    this.graphics.fillEllipse(x - 10, y + 12, 13, 11);
    this.graphics.fillEllipse(x + 10, y + 12, 13, 11);
    this.graphics.fillStyle(palette?.main ?? 0x35d7f0, 1);
    this.graphics.fillCircle(x, y - 1 + bob, 19);
    this.graphics.fillRoundedRect(x - 18, y - 2 + bob, 36, 21, 12);
    this.graphics.fillStyle(0xffffff, 0.92);
    this.graphics.fillEllipse(
      x - 7 + directionOffset.x,
      y - 4 + directionOffset.y + bob,
      7,
      9,
    );
    this.graphics.fillEllipse(
      x + 7 + directionOffset.x,
      y - 4 + directionOffset.y + bob,
      7,
      9,
    );
    this.graphics.fillStyle(0x10213c, 1);
    this.graphics.fillCircle(
      x - 7 + directionOffset.x,
      y - 3 + directionOffset.y + bob,
      2.2,
    );
    this.graphics.fillCircle(
      x + 7 + directionOffset.x,
      y - 3 + directionOffset.y + bob,
      2.2,
    );

    this.graphics.lineStyle(2, 0x10213c, 0.8);
    this.graphics.beginPath();
    if (player.status === "trapped") {
      this.graphics.moveTo(x - 5, y + 8 + bob);
      this.graphics.lineTo(x, y + 4 + bob);
      this.graphics.lineTo(x + 5, y + 8 + bob);
    } else {
      this.graphics.arc(x, y + 4 + bob, 6, 0.2, Math.PI - 0.2);
    }
    this.graphics.strokePath();

    if (player.team === 2) {
      this.graphics.fillStyle(0xffd06a, 1);
      this.graphics.fillTriangle(
        x,
        y - 27 + bob,
        x - 7,
        y - 17 + bob,
        x + 7,
        y - 17 + bob,
      );
      this.graphics.fillStyle(0xfff0a8, 1);
      this.graphics.fillCircle(x, y - 28 + bob, 3);
    } else {
      this.graphics.lineStyle(4, 0xffffff, 0.72);
      this.graphics.beginPath();
      this.graphics.moveTo(x - 15, y - 12 + bob);
      this.graphics.lineTo(x + 15, y - 12 + bob);
      this.graphics.strokePath();
    }

    if (player.invulnerableUntilTick > currentTick) {
      const shieldPulse = Math.sin(elapsedMs * 0.018) * 2;
      this.graphics.lineStyle(2, 0xfff18a, 0.86);
      this.graphics.strokeCircle(x, y, 25 + shieldPulse);
    }
  }

  private drawGeneratedPlayer(
    player: PlayerState,
    x: number,
    y: number,
    bob: number,
    isMoving: boolean,
    elapsedMs: number,
    currentTick: number,
  ): boolean {
    if (!this.scene.textures.exists(CHARACTER_SHEET)) {
      return false;
    }

    if (this.scene.textures.exists(OBJECT_SHEET)) {
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.shadow,
        x,
        y + 19,
        {
          width: 34,
          height: 14,
          depth: 4.4,
          alpha: 0.68,
        },
      );
    }

    const secondFootfall =
      (Math.floor(elapsedMs / WALK_FRAME_MS) + player.id) % 2 === 1;
    const footfallOffset = isMoving
      ? secondFootfall
        ? 0.7
        : -0.7
      : 0;
    const frame = player.team === 1
      ? isMoving
        ? secondFootfall
          ? CHARACTER_FRAME.humanWalkB
          : CHARACTER_FRAME.humanWalkA
        : CHARACTER_FRAME.humanIdle
      : isMoving
        ? secondFootfall
          ? CHARACTER_FRAME.botWalkB
          : CHARACTER_FRAME.botWalkA
        : CHARACTER_FRAME.botIdle;
    const character = this.drawSprite(
      CHARACTER_SHEET,
      frame,
      x,
      y + bob + footfallOffset,
      {
        width: CHARACTER_SIZE,
        height: CHARACTER_SIZE,
        depth: 5,
        angle: isMoving ? (secondFootfall ? -1.1 : 1.1) : 0,
        flipX: player.direction === "left",
        alpha:
          player.invulnerableUntilTick > currentTick
            ? 0.72 + Math.sin(elapsedMs * 0.02) * 0.18
            : 1,
      },
    );

    if (
      character !== null &&
      player.status === "trapped" &&
      this.scene.textures.exists(OBJECT_SHEET)
    ) {
      const bubblePulse = Math.sin(elapsedMs * 0.01) * 2;
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.trappedBubble,
        x,
        y - 3,
        {
          width: 62 + bubblePulse,
          height: 62 + bubblePulse,
          depth: 5.4,
          alpha: 0.9,
        },
      );
    }

    if (
      character !== null &&
      player.invulnerableUntilTick > currentTick &&
      this.scene.textures.exists(OBJECT_SHEET)
    ) {
      this.drawSprite(
        OBJECT_SHEET,
        OBJECT_FRAME.sparkle,
        x,
        y - 2,
        {
          width: 64,
          height: 64,
          depth: 5.5,
          alpha: 0.52,
          angle: (elapsedMs * 0.04) % 360,
        },
      );
    }

    return character !== null;
  }

  private drawSidebar(
    state: GameState,
    botDebug: AiDebugInfo,
  ): void {
    this.graphics.fillStyle(0x20cce6, 1);
    this.graphics.fillRoundedRect(SIDEBAR_X + 20, 40, 7, 70, 4);
    this.graphics.fillStyle(0xff668f, 1);
    this.graphics.fillRoundedRect(SIDEBAR_X + 31, 40, 7, 47, 4);

    this.graphics.fillStyle(0x0c1630, 0.86);
    this.graphics.fillRoundedRect(SIDEBAR_X + 17, 145, 250, 77, 17);
    this.graphics.lineStyle(1, 0x8feaff, 0.12);
    this.graphics.strokeRoundedRect(
      SIDEBAR_X + 17,
      145,
      250,
      77,
      17,
    );

    this.drawPlayerCard(1, 250, 0x35d7f0);
    this.drawPlayerCard(2, 397, 0xff668f);

    this.graphics.fillStyle(0x0a132b, 0.64);
    this.graphics.fillRoundedRect(
      SIDEBAR_X + 17,
      578,
      250,
      101,
      15,
    );

    const remainingTicks = Math.max(
      0,
      ROUND_DURATION_TICKS - state.tick,
    );
    const seconds = Math.ceil(remainingTicks / TICK_RATE);
    const minutes = Math.floor(seconds / 60);
    const secondPart = String(seconds % 60).padStart(2, "0");
    this.timeText.setText(`${minutes}:${secondPart}`);
    this.timeText.setColor(
      state.tick >= STORM_START_TICK ? "#ff8bb5" : "#ffffff",
    );
    this.phaseText.setText(
      state.tick >= STORM_START_TICK ? "TIDAL SURGE" : "ROUND TIME",
    );
    this.phaseText.setColor(
      state.tick >= STORM_START_TICK ? "#ff739e" : "#7088b7",
    );
    this.mapText.setText(`RANDOM ARENA  ·  ${state.mapName}`);

    const human = state.players.find((player) => player.id === 1);
    const bot = state.players.find((player) => player.id === 2);
    if (human !== undefined) {
      this.humanNameText.setText(human.name);
      this.humanStatsText.setText(this.playerStats(human));
      this.humanNameText.setAlpha(human.status === "dead" ? 0.4 : 1);
    }
    if (bot !== undefined) {
      this.botNameText.setText(bot.name);
      this.botStatsText.setText(this.playerStats(bot));
      this.botNameText.setAlpha(bot.status === "dead" ? 0.4 : 1);
    }

    this.botModeText.setText(
      `AI  ·  ${BOT_MODE_LABELS[botDebug.mode]}`,
    );
    this.seedText.setText(
      `SEED ${state.seed.toString(16).toUpperCase().padStart(8, "0")}`,
    );
  }

  private drawCompactHud(state: GameState): void {
    this.graphics.fillStyle(0x07152d, 0.9);
    this.graphics.fillRoundedRect(
      BOARD_X + 6,
      BOARD_Y + 5,
      BOARD_WIDTH - 12,
      38,
      13,
    );
    this.graphics.lineStyle(1, 0xa5ecff, 0.2);
    this.graphics.strokeRoundedRect(
      BOARD_X + 6,
      BOARD_Y + 5,
      BOARD_WIDTH - 12,
      38,
      13,
    );

    const remainingTicks = Math.max(
      0,
      ROUND_DURATION_TICKS - state.tick,
    );
    const seconds = Math.ceil(remainingTicks / TICK_RATE);
    const minutes = Math.floor(seconds / 60);
    const secondPart = String(seconds % 60).padStart(2, "0");
    this.compactTimeText
      .setText(`${minutes}:${secondPart}`)
      .setColor(
        state.tick >= STORM_START_TICK ? "#ff8bb5" : "#ffffff",
      );

    const human = state.players.find((player) => player.id === 1);
    const bot = state.players.find((player) => player.id === 2);
    if (human !== undefined) {
      this.compactHumanText
        .setText(this.compactPlayerStats("YOU", human, true))
        .setColor(this.compactStatusColor(human, "#75efff"));
    }
    if (bot !== undefined) {
      this.compactBotText
        .setText(this.compactPlayerStats("BOT", bot, false))
        .setColor(this.compactStatusColor(bot, "#ff8bac"));
    }
  }

  private compactPlayerStats(
    label: string,
    player: PlayerState,
    includeNeedle: boolean,
  ): string {
    const status =
      player.status === "trapped"
        ? "!"
        : player.status === "dead"
          ? "×"
          : "";
    const needle = includeNeedle ? `  ◇${player.needles}` : "";
    return `${label}${status}  ●${player.activeBalloons}/${player.balloonCapacity}  ✦${player.blastRange}  »${player.speedLevel + 1}${needle}`;
  }

  private compactStatusColor(
    player: PlayerState,
    defaultColor: string,
  ): string {
    if (player.status === "dead") {
      return "#687893";
    }
    if (player.status === "trapped") {
      return "#ffe17a";
    }
    return defaultColor;
  }

  private drawPlayerCard(
    team: number,
    top: number,
    color: number,
  ): void {
    this.graphics.fillStyle(0x0c1630, 0.78);
    this.graphics.fillRoundedRect(
      SIDEBAR_X + 17,
      top,
      250,
      130,
      17,
    );
    this.graphics.fillStyle(color, 0.95);
    this.graphics.fillRoundedRect(
      SIDEBAR_X + 17,
      top,
      6,
      130,
      4,
    );
    this.graphics.fillStyle(color, 0.18);
    this.graphics.fillCircle(SIDEBAR_X + 229, top + 27, 30);
    this.graphics.fillStyle(color, 0.78);
    this.graphics.fillCircle(SIDEBAR_X + 229, top + 27, 11);
    this.graphics.fillStyle(0xffffff, 0.75);
    this.graphics.fillCircle(
      SIDEBAR_X + 225 + (team === 1 ? -1 : 1),
      top + 24,
      3,
    );
  }

  private playerStats(player: PlayerState): string {
    const status =
      player.status === "alive"
        ? "READY"
        : player.status === "trapped"
          ? "TRAPPED!"
          : "OUT";
    return [
      `● 풍선  ${player.activeBalloons}/${player.balloonCapacity}     ✦ 사거리  ${player.blastRange}`,
      `» 속도  ${player.speedLevel + 1}       ◇ 바늘  ${player.needles}`,
      status,
    ].join("\n");
  }

  private drawParticles(): void {
    this.effectGraphics.clear();
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      this.effectGraphics.fillStyle(particle.color, alpha);
      this.effectGraphics.fillCircle(
        particle.x,
        particle.y,
        particle.radius * (0.6 + alpha * 0.4),
      );
    }
  }

  private drawOverlay(): void {
    const portrait = isPortraitLayout();
    this.overlayGraphics.clear();
    if (this.overlayKind === "none") {
      this.overlayPrimary.setVisible(false);
      this.overlaySecondary.setVisible(false);
      return;
    }

    this.overlayPrimary
      .setText(this.overlayTitle)
      .setVisible(true);
    this.overlaySecondary
      .setText(this.overlaySubtitle)
      .setFontSize(portrait ? 26 : IS_COMPACT_LAYOUT ? 21 : 16)
      .setVisible(this.overlaySubtitle.length > 0);

    if (this.overlayKind === "pause") {
      this.overlayGraphics.fillStyle(0x050a18, 0.74);
      this.overlayGraphics.fillRoundedRect(
        BOARD_X,
        BOARD_Y,
        BOARD_WIDTH,
        BOARD_HEIGHT,
        16,
      );
      this.overlayGraphics.fillStyle(0x14223c, 0.94);
      this.overlayGraphics.fillRoundedRect(
        BOARD_X + BOARD_WIDTH / 2 - 160,
        BOARD_Y + BOARD_HEIGHT / 2 - 93,
        320,
        175,
        24,
      );
      this.overlayGraphics.lineStyle(2, 0x79e9ff, 0.28);
      this.overlayGraphics.strokeRoundedRect(
        BOARD_X + BOARD_WIDTH / 2 - 160,
        BOARD_Y + BOARD_HEIGHT / 2 - 93,
        320,
        175,
        24,
      );
      this.overlayPrimary.setFontSize(
        portrait ? 50 : IS_COMPACT_LAYOUT ? 46 : 44,
      );
    } else {
      this.overlayGraphics.fillStyle(0x061225, 0.58);
      this.overlayGraphics.fillCircle(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 - 10,
        86,
      );
      this.overlayGraphics.lineStyle(4, 0x6beeff, 0.4);
      this.overlayGraphics.strokeCircle(
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT / 2 - 10,
        86,
      );
      this.overlayPrimary.setFontSize(
        portrait ? 86 : IS_COMPACT_LAYOUT ? 80 : 76,
      );
    }
  }
}
