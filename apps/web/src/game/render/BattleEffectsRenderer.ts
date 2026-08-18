import type { GameEvent } from "@bubble-battle/game-core";
import Phaser from "phaser";
import { cellToScreen, TILE_SIZE } from "../layout";

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

export class BattleEffectsRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly particles: Particle[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(4);
  }

  handleEvent(event: GameEvent): void {
    if (event.type === "balloon-exploded") {
      this.scene.cameras.main.shake(75, 0.0016);
      this.addExplosionParticles(event.cells);
    } else if (event.type === "item-picked") {
      this.addPickupParticles(event.cell);
    }
  }

  update(deltaSeconds: number): void {
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

  render(): void {
    this.graphics.clear();
    for (const particle of this.particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      this.graphics.fillStyle(particle.color, alpha);
      this.graphics.fillCircle(
        particle.x,
        particle.y,
        particle.radius * (0.6 + alpha * 0.4),
      );
    }
  }

  destroy(): void {
    this.particles.length = 0;
    this.graphics.destroy();
  }

  private addExplosionParticles(
    cells: ReadonlyArray<{ col: number; row: number }>,
  ): void {
    for (const cell of cells) {
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
  }

  private addPickupParticles(cell: { col: number; row: number }): void {
    const screen = cellToScreen(cell.col, cell.row);
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
