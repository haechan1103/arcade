import {
  TICK_RATE,
  type BlastState,
  type Cell,
  type GameState,
  type ItemType,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import {
  BLAST_FRAME,
  BLAST_SHEET,
  OBJECT_FRAME,
  OBJECT_SHEET,
  WARNING_BALLOON,
} from "../assets";
import { cellToScreen, TILE_SIZE } from "../layout";
import type { SpritePool } from "./SpritePool";

const PICKUP_FRAME: Readonly<Record<ItemType, number>> = {
  capacity: OBJECT_FRAME.capacity,
  range: OBJECT_FRAME.range,
  speed: OBJECT_FRAME.speed,
  needle: OBJECT_FRAME.needle,
};

const BALLOON_WARNING_TICKS = Math.round(TICK_RATE * 1.25);

export class BattleObjectRenderer {
  constructor(
    private readonly graphics: Phaser.GameObjects.Graphics,
    private readonly sprites: SpritePool,
  ) {}

  render(state: GameState, elapsedMs: number): void {
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
  }

  private drawPickup(
    pickup: { col: number; row: number; type: ItemType },
    elapsedMs: number,
  ): void {
    const { x, y } = cellToScreen(pickup.col, pickup.row);
    const centerX = x + TILE_SIZE / 2;
    const centerY =
      y + TILE_SIZE / 2 + Math.sin(elapsedMs * 0.006 + pickup.col) * 2;

    if (this.sprites.hasTexture(OBJECT_SHEET)) {
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.shadow, centerX, y + 39, {
        width: 36,
        height: 17,
        depth: 2.7,
        alpha: 0.56,
      });
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.sparkle, centerX, centerY, {
        width: 48,
        height: 48,
        depth: 2.8,
        alpha: 0.32,
        angle: (elapsedMs * 0.025) % 360,
      });
      this.sprites.draw(OBJECT_SHEET, PICKUP_FRAME[pickup.type], centerX, centerY, {
        width: 47,
        height: 47,
        depth: 3,
      });
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
      this.graphics.fillRoundedRect(centerX - 17, centerY - 15, 34, 30, 9);
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
    const remaining = Math.max(0, balloon.explodeTick - currentTick);
    const urgency = 1 - Math.min(1, remaining / 75);
    const warningActive = remaining <= BALLOON_WARNING_TICKS;
    const warningProgress = warningActive
      ? 1 - remaining / BALLOON_WARNING_TICKS
      : 0;
    const warningElapsedTicks = Math.max(
      0,
      BALLOON_WARNING_TICKS - remaining,
    );
    const warningBlinkTicks = Math.max(3, Math.round(6 - warningProgress * 3));
    const warningBright =
      Math.floor(warningElapsedTicks / warningBlinkTicks) % 2 === 0;
    const pulse =
      Math.sin(elapsedMs * (0.009 + urgency * 0.012)) *
      (1.2 + urgency * 2.5);

    if (this.sprites.hasTexture(OBJECT_SHEET)) {
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.shadow, centerX, y + 41, {
        width: 38,
        height: 18,
        depth: 2.7,
        alpha: 0.62,
      });
      const warningTextureReady =
        warningActive && this.sprites.hasTexture(WARNING_BALLOON);
      const warningSizeOffset = warningTextureReady
        ? warningBright
          ? 2.4 + warningProgress * 1.4
          : -0.6
        : 0;
      this.sprites.draw(
        warningTextureReady ? WARNING_BALLOON : OBJECT_SHEET,
        warningTextureReady ? 0 : OBJECT_FRAME.balloon,
        centerX,
        centerY,
        {
          width: 49 + pulse * 0.25 + warningSizeOffset,
          height: 49 + pulse * 0.25 + warningSizeOffset,
          depth: 3.1,
          alpha: warningTextureReady && !warningBright ? 0.76 : 1,
        },
      );
      if (warningTextureReady) {
        this.graphics.fillStyle(
          0xff315f,
          warningBright ? 0.1 + warningProgress * 0.08 : 0.035,
        );
        this.graphics.fillCircle(centerX, centerY, 24 + warningProgress * 2);
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
    const frame = Math.min(BLAST_FRAME.dissipate, Math.floor(progress * 4));
    const flashOn =
      (Math.floor(elapsedMs / 55) + cell.col + cell.row) % 2 === 0;
    const pulse = Math.sin(elapsedMs * 0.035 + cell.col + cell.row);

    if (
      this.sprites.draw(
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
        this.sprites.draw(
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
      this.sprites.draw(
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
}
