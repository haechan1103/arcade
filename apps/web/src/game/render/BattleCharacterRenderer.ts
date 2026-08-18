import type {
  Difficulty,
  GameState,
  PlayerState,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import {
  BOT_CHARACTER_BY_DIFFICULTY,
  CHARACTER_FRAME,
  CHARACTER_SHEET,
  OBJECT_FRAME,
  OBJECT_SHEET,
} from "../assets";
import { worldToScreenX, worldToScreenY } from "../layout";
import type { SpritePool } from "./SpritePool";
import type { RenderPosition } from "./types";

const PLAYER_COLORS: Record<number, { main: number; dark: number }> = {
  1: { main: 0x35d7f0, dark: 0x077d9b },
  2: { main: 0xff668f, dark: 0xa41e57 },
};

// Generated frames include transparent padding. These dimensions keep the
// visible character inside one map tile and centered on its world position.
const CHARACTER_WIDTH = 76;
const CHARACTER_HEIGHT = 62;
const CHARACTER_SHADOW_OFFSET = 22;
const BOT_CHARACTER_WIDTH = 62;
const BOT_CHARACTER_HEIGHT = 76;
const WALK_FRAME_MS = 125;

export class BattleCharacterRenderer {
  private readonly botCharacterTexture: string;

  constructor(
    difficulty: Difficulty,
    private readonly graphics: Phaser.GameObjects.Graphics,
    private readonly sprites: SpritePool,
  ) {
    this.botCharacterTexture = BOT_CHARACTER_BY_DIFFICULTY[difficulty];
  }

  render(
    state: GameState,
    previousPositions: ReadonlyMap<number, RenderPosition>,
    interpolation: number,
    elapsedMs: number,
  ): void {
    for (const player of state.players) {
      const previous = previousPositions.get(player.id) ?? {
        x: player.x,
        y: player.y,
      };
      const x = previous.x + (player.x - previous.x) * interpolation;
      const y = previous.y + (player.y - previous.y) * interpolation;
      const isMoving =
        Math.abs(player.x - previous.x) > 0.5 ||
        Math.abs(player.y - previous.y) > 0.5;
      this.drawPlayer(player, x, y, isMoving, elapsedMs, state.tick);
    }
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

    this.drawFallbackPlayer(player, x, y, bob, elapsedMs, currentTick);
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
    const useBotPortrait =
      player.team === 2 && this.sprites.hasTexture(this.botCharacterTexture);
    if (!useBotPortrait && !this.sprites.hasTexture(CHARACTER_SHEET)) {
      return false;
    }

    if (this.sprites.hasTexture(OBJECT_SHEET)) {
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.shadow, x, y + CHARACTER_SHADOW_OFFSET, {
        width: 40,
        height: 14,
        depth: 4.4,
        alpha: 0.68,
      });
    }

    const secondFootfall =
      (Math.floor(elapsedMs / WALK_FRAME_MS) + player.id) % 2 === 1;
    const footfallOffset = isMoving ? (secondFootfall ? 0.7 : -0.7) : 0;
    const frame = this.getCharacterFrame(player, isMoving, secondFootfall);
    const character = this.sprites.draw(
      useBotPortrait ? this.botCharacterTexture : CHARACTER_SHEET,
      useBotPortrait ? 0 : frame,
      x,
      y + bob + footfallOffset - (useBotPortrait ? 3 : 0),
      {
        width: useBotPortrait ? BOT_CHARACTER_WIDTH : CHARACTER_WIDTH,
        height: useBotPortrait ? BOT_CHARACTER_HEIGHT : CHARACTER_HEIGHT,
        depth: 5,
        angle: isMoving ? (secondFootfall ? -1.1 : 1.1) : 0,
        flipX: player.direction === "left",
        alpha:
          player.invulnerableUntilTick > currentTick
            ? 0.72 + Math.sin(elapsedMs * 0.02) * 0.18
            : 1,
      },
    );

    if (character !== null) {
      this.drawPlayerOverlays(player, x, y, elapsedMs, currentTick);
    }
    return character !== null;
  }

  private getCharacterFrame(
    player: PlayerState,
    isMoving: boolean,
    secondFootfall: boolean,
  ): number {
    if (player.team === 1) {
      return isMoving
        ? secondFootfall
          ? CHARACTER_FRAME.humanWalkB
          : CHARACTER_FRAME.humanWalkA
        : CHARACTER_FRAME.humanIdle;
    }
    return isMoving
      ? secondFootfall
        ? CHARACTER_FRAME.botWalkB
        : CHARACTER_FRAME.botWalkA
      : CHARACTER_FRAME.botIdle;
  }

  private drawPlayerOverlays(
    player: PlayerState,
    x: number,
    y: number,
    elapsedMs: number,
    currentTick: number,
  ): void {
    if (player.status === "trapped" && this.sprites.hasTexture(OBJECT_SHEET)) {
      const bubblePulse = Math.sin(elapsedMs * 0.01) * 2;
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.trappedBubble, x, y, {
        width: 62 + bubblePulse,
        height: 62 + bubblePulse,
        depth: 5.4,
        alpha: 0.9,
      });
    }
    if (
      player.invulnerableUntilTick > currentTick &&
      this.sprites.hasTexture(OBJECT_SHEET)
    ) {
      this.sprites.draw(OBJECT_SHEET, OBJECT_FRAME.sparkle, x, y, {
        width: 66,
        height: 66,
        depth: 5.5,
        alpha: 0.52,
        angle: (elapsedMs * 0.04) % 360,
      });
    }
  }

  private drawFallbackPlayer(
    player: PlayerState,
    x: number,
    y: number,
    bob: number,
    elapsedMs: number,
    currentTick: number,
  ): void {
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
}
