import {
  HALF_TILE,
  ROUND_DURATION_TICKS,
  STORM_START_TICK,
  TICK_RATE,
  TILE_UNITS,
  type AiDebugInfo,
  type Cell,
  type GameEvent,
  type GameState,
  type ItemType,
  type PlayerState,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARD_X,
  BOARD_Y,
  cellToScreen,
  GAME_HEIGHT,
  GAME_WIDTH,
  SIDEBAR_X,
  TILE_SIZE,
  UI_FONT,
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

export type OverlayKind = "none" | "countdown" | "pause";

const PLAYER_COLORS: Record<number, { main: number; dark: number }> = {
  1: { main: 0x35d7f0, dark: 0x077d9b },
  2: { main: 0xff668f, dark: 0xa41e57 },
};

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
  private readonly overlayPrimary: Phaser.GameObjects.Text;
  private readonly overlaySecondary: Phaser.GameObjects.Text;
  private readonly particles: Particle[] = [];
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
    this.graphics.clear();
    this.drawBackdrop(elapsedMs);
    this.drawBoard(state, elapsedMs);
    this.drawSidebar(state, botDebug);
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
          this.drawHardBlock(col, row);
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

  private drawHardBlock(col: number, row: number): void {
    const { x, y } = cellToScreen(col, row);
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
        this.drawBlast(cell, elapsedMs);
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
      this.drawPlayer(player, x, y, elapsedMs, state.tick);
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
    const pulse =
      Math.sin(elapsedMs * (0.009 + urgency * 0.012)) *
      (1.2 + urgency * 2.5);

    this.graphics.fillStyle(0x03101e, 0.48);
    this.graphics.fillEllipse(centerX, y + 41, 31, 10);
    this.graphics.fillStyle(
      urgency > 0.72 ? 0xff6b8c : 0x2bbce0,
      1,
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

  private drawBlast(cell: Cell, elapsedMs: number): void {
    const { x, y } = cellToScreen(cell.col, cell.row);
    const pulse = Math.sin(elapsedMs * 0.03 + cell.col + cell.row) * 2;
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
    elapsedMs: number,
    currentTick: number,
  ): void {
    if (player.status === "dead") {
      return;
    }

    const x = worldToScreenX(worldX);
    const y = worldToScreenY(worldY);
    const palette = PLAYER_COLORS[player.team] ?? PLAYER_COLORS[1];
    const bob = Math.sin(elapsedMs * 0.008 + player.id) * 1.4;
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
    this.mapText.setText(`ARENA 01  ·  ${state.mapName}`);

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
      this.overlayPrimary.setFontSize(44);
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
      this.overlayPrimary.setFontSize(76);
    }
  }
}
