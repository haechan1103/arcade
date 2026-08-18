import type {
  Difficulty,
  GameEvent,
  GameState,
} from "@bubble-battle/game-core";
import Phaser from "phaser";
import { BattleBoardRenderer } from "./BattleBoardRenderer";
import { BattleCharacterRenderer } from "./BattleCharacterRenderer";
import { BattleEffectsRenderer } from "./BattleEffectsRenderer";
import { BattleObjectRenderer } from "./BattleObjectRenderer";
import { SpritePool } from "./SpritePool";
import type { RenderPosition } from "./types";

/** Coordinates focused renderers while keeping Phaser lifecycle ownership here. */
export class BattleRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly sprites: SpritePool;
  private readonly board: BattleBoardRenderer;
  private readonly objects: BattleObjectRenderer;
  private readonly characters: BattleCharacterRenderer;
  private readonly effects: BattleEffectsRenderer;

  constructor(scene: Phaser.Scene, difficulty: Difficulty) {
    this.graphics = scene.add.graphics().setDepth(1);
    this.sprites = new SpritePool(scene);
    this.board = new BattleBoardRenderer(this.graphics, this.sprites);
    this.objects = new BattleObjectRenderer(this.graphics, this.sprites);
    this.characters = new BattleCharacterRenderer(
      difficulty,
      this.graphics,
      this.sprites,
    );
    this.effects = new BattleEffectsRenderer(scene);
  }

  handleEvent(event: GameEvent): void {
    this.effects.handleEvent(event);
  }

  updateParticles(deltaSeconds: number): void {
    this.effects.update(deltaSeconds);
  }

  render(
    state: GameState,
    previousPositions: ReadonlyMap<number, RenderPosition>,
    interpolation: number,
    elapsedMs: number,
  ): void {
    this.sprites.beginFrame();
    this.graphics.clear();
    this.board.render(state, elapsedMs);
    this.objects.render(state, elapsedMs);
    this.characters.render(
      state,
      previousPositions,
      interpolation,
      elapsedMs,
    );
    this.effects.render();
  }

  destroy(): void {
    this.sprites.destroy();
    this.graphics.destroy();
    this.effects.destroy();
  }
}
