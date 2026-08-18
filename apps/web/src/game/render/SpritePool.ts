import Phaser from "phaser";
import type { SpriteRenderOptions } from "./types";

export class SpritePool {
  private readonly pools = new Map<string, Phaser.GameObjects.Image[]>();
  private readonly useCount = new Map<string, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame(): void {
    this.useCount.clear();
    for (const pool of this.pools.values()) {
      for (const sprite of pool) {
        sprite.setVisible(false);
      }
    }
  }

  hasTexture(texture: string): boolean {
    return this.scene.textures.exists(texture);
  }

  draw(
    texture: string,
    frame: number,
    x: number,
    y: number,
    options: SpriteRenderOptions,
  ): Phaser.GameObjects.Image | null {
    if (!this.hasTexture(texture)) {
      return null;
    }

    const used = this.useCount.get(texture) ?? 0;
    const pool = this.getOrCreatePool(texture);
    const sprite = pool[used] ?? this.createSprite(pool, texture, frame, x, y);
    this.useCount.set(texture, used + 1);

    return sprite
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
  }

  destroy(): void {
    for (const pool of this.pools.values()) {
      for (const sprite of pool) {
        sprite.destroy();
      }
    }
    this.pools.clear();
    this.useCount.clear();
  }

  private getOrCreatePool(texture: string): Phaser.GameObjects.Image[] {
    const existing = this.pools.get(texture);
    if (existing !== undefined) {
      return existing;
    }
    const pool: Phaser.GameObjects.Image[] = [];
    this.pools.set(texture, pool);
    return pool;
  }

  private createSprite(
    pool: Phaser.GameObjects.Image[],
    texture: string,
    frame: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(x, y, texture, frame);
    pool.push(sprite);
    return sprite;
  }
}
