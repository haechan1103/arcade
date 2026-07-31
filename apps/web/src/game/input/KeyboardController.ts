import type { Direction, PlayerInput } from "@bubble-battle/game-core";
import Phaser from "phaser";

interface DirectionKey {
  direction: Direction;
  key: Phaser.Input.Keyboard.Key;
}

export class KeyboardController {
  private readonly directions: DirectionKey[];
  private readonly space: Phaser.Input.Keyboard.Key;
  private readonly needle: Phaser.Input.Keyboard.Key;
  private readonly pause: Phaser.Input.Keyboard.Key;
  private readonly mute: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error("Keyboard input is unavailable.");
    }

    this.directions = [
      {
        direction: "up",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      },
      {
        direction: "up",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      },
      {
        direction: "right",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      },
      {
        direction: "right",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      },
      {
        direction: "down",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      },
      {
        direction: "down",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      },
      {
        direction: "left",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      },
      {
        direction: "left",
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      },
    ];
    this.space = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.needle = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.pause = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.mute = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.E,
      Phaser.Input.Keyboard.KeyCodes.ESC,
    ]);
  }

  readInput(): PlayerInput {
    const activeDirections = this.directions
      .filter(({ key }) => key.isDown)
      .sort((a, b) => b.key.timeDown - a.key.timeDown);

    return {
      move: activeDirections[0]?.direction ?? null,
      placeBalloon: Phaser.Input.Keyboard.JustDown(this.space),
      useNeedle: Phaser.Input.Keyboard.JustDown(this.needle),
    };
  }

  consumePause(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.pause);
  }

  consumeMute(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.mute);
  }
}
