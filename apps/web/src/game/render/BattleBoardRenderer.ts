import type { GameState } from "@bubble-battle/game-core";
import Phaser from "phaser";
import { OBJECT_FRAME, OBJECT_SHEET } from "../assets";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BOARD_X,
  BOARD_Y,
  cellToScreen,
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
} from "../layout";
import type { SpritePool } from "./SpritePool";

const HARD_BLOCK_FRAME_BY_MAP: Readonly<Record<string, number>> = {
  "neon-garden": OBJECT_FRAME.gardenWall,
  "metro-crossing": OBJECT_FRAME.metroWall,
  "coral-maze": OBJECT_FRAME.coralWall,
};

const BLOCK_OCCLUSION_DEPTH = 5.1;

export class BattleBoardRenderer {
  constructor(
    private readonly graphics: Phaser.GameObjects.Graphics,
    private readonly sprites: SpritePool,
  ) {}

  render(state: GameState, elapsedMs: number): void {
    this.drawBackdrop(elapsedMs);
    this.drawTiles(state);
    this.drawStorm(state, elapsedMs);
    this.drawBlocks(state);
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
  }

  private drawTiles(state: GameState): void {
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
        this.graphics.fillStyle(alternate ? 0x183b5d : 0x163653, 1);
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
  }

  private drawStorm(state: GameState, elapsedMs: number): void {
    const wave = Math.sin(elapsedMs * 0.008) * 3;
    for (const cell of state.stormCells) {
      const screen = cellToScreen(cell.col, cell.row);
      if (
        this.sprites.draw(
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
      this.graphics.lineTo(screen.x + TILE_SIZE - 5, screen.y + 17 - wave);
      this.graphics.moveTo(screen.x + 5, screen.y + 31 - wave);
      this.graphics.lineTo(screen.x + TILE_SIZE - 5, screen.y + 31 + wave);
      this.graphics.strokePath();
    }
  }

  private drawBlocks(state: GameState): void {
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

  private drawHardBlock(mapId: string, col: number, row: number): void {
    const { x, y } = cellToScreen(col, row);
    if (
      this.sprites.draw(
        OBJECT_SHEET,
        HARD_BLOCK_FRAME_BY_MAP[mapId] ?? OBJECT_FRAME.hardBlock,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 8,
          height: TILE_SIZE + 8,
          depth: BLOCK_OCCLUSION_DEPTH,
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
      this.sprites.draw(
        OBJECT_SHEET,
        OBJECT_FRAME.softBlock,
        x + TILE_SIZE / 2,
        y + TILE_SIZE / 2,
        {
          width: TILE_SIZE + 8,
          height: TILE_SIZE + 8,
          depth: BLOCK_OCCLUSION_DEPTH,
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
}
