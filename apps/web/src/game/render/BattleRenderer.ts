import {
  HALF_TILE,
  TICK_RATE,
  TILE_UNITS,
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
  TILE_SIZE,
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

// The generated frames contain generous transparent padding. These display
// dimensions keep the visible character ink inside one 48px map tile and
// center it on the simulation coordinate instead of anchoring its tall body
// above the tile.
const CHARACTER_WIDTH = 76;
const CHARACTER_HEIGHT = 62;
const CHARACTER_SHADOW_OFFSET = 22;
const BLOCK_OCCLUSION_DEPTH = 5.1;
const WALK_FRAME_MS = 125;
const BALLOON_WARNING_TICKS = Math.round(TICK_RATE * 1.25);

export class BattleRenderer {
  private readonly scene: Phaser.Scene;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly effectGraphics: Phaser.GameObjects.Graphics;
  private readonly particles: Particle[] = [];
  private readonly spritePools = new Map<
    string,
    Phaser.GameObjects.Image[]
  >();
  private readonly spriteUseCount = new Map<string, number>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(1);
    this.effectGraphics = scene.add.graphics().setDepth(4);
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
  ): void {
    this.beginSpriteFrame();
    this.graphics.clear();
    this.drawBackdrop(elapsedMs);
    this.drawBoard(state, elapsedMs);
    this.drawEntities(
      state,
      previousPositions,
      interpolation,
      elapsedMs,
    );
    this.drawParticles();
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
      this.drawSprite(
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
        y + CHARACTER_SHADOW_OFFSET,
        {
          width: 40,
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
        width: CHARACTER_WIDTH,
        height: CHARACTER_HEIGHT,
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
        y,
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
        y,
        {
          width: 66,
          height: 66,
          depth: 5.5,
          alpha: 0.52,
          angle: (elapsedMs * 0.04) % 360,
        },
      );
    }

    return character !== null;
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

}
