import type { Difficulty } from "@bubble-battle/game-core";
import Phaser from "phaser";

export const CHARACTER_SHEET = "generated-characters";
export const OBJECT_SHEET = "generated-objects";
export const BLAST_SHEET = "generated-blast-animation";
export const WARNING_BALLOON = "generated-warning-balloon";

export const BOT_CHARACTER_BY_DIFFICULTY: Record<Difficulty, string> = {
  easy: "generated-bot-easy",
  normal: "generated-bot-normal",
  hard: "generated-bot-hard",
};

const BOT_CHARACTER_PATH_BY_DIFFICULTY: Record<Difficulty, string> = {
  easy: "/assets/generated/bot-easy-portrait.png",
  normal: "/assets/generated/bot-normal-portrait.png",
  hard: "/assets/generated/bot-hard-portrait.png",
};

export const CHARACTER_FRAME = {
  humanIdle: 0,
  humanWalkA: 1,
  humanWalkB: 2,
  botIdle: 3,
  botWalkA: 4,
  botWalkB: 5,
} as const;

export const BLAST_FRAME = {
  pop: 0,
  expand: 1,
  peak: 2,
  dissipate: 3,
} as const;

export const OBJECT_FRAME = {
  hardBlock: 0,
  softBlock: 1,
  balloon: 2,
  blast: 3,
  capacity: 4,
  range: 5,
  speed: 6,
  needle: 7,
  gardenWall: 8,
  metroWall: 9,
  coralWall: 10,
  debris: 11,
  trappedBubble: 12,
  storm: 13,
  sparkle: 14,
  shadow: 15,
} as const;

export function preloadGeneratedAssets(scene: Phaser.Scene): void {
  for (const difficulty of ["easy", "normal", "hard"] as const) {
    const key = BOT_CHARACTER_BY_DIFFICULTY[difficulty];
    if (!scene.textures.exists(key)) {
      scene.load.image(key, BOT_CHARACTER_PATH_BY_DIFFICULTY[difficulty]);
    }
  }
  if (!scene.textures.exists(CHARACTER_SHEET)) {
    scene.load.spritesheet(
      CHARACTER_SHEET,
      "/assets/generated/character-animation-sheet.png",
      { frameWidth: 256, frameHeight: 256 },
    );
  }
  if (!scene.textures.exists(BLAST_SHEET)) {
    scene.load.spritesheet(
      BLAST_SHEET,
      "/assets/generated/blast-animation-sheet.png",
      { frameWidth: 256, frameHeight: 256 },
    );
  }
  if (!scene.textures.exists(WARNING_BALLOON)) {
    scene.load.spritesheet(
      WARNING_BALLOON,
      "/assets/generated/warning-balloon.png",
      { frameWidth: 256, frameHeight: 256 },
    );
  }
  if (!scene.textures.exists(OBJECT_SHEET)) {
    scene.load.spritesheet(
      OBJECT_SHEET,
      "/assets/generated/object-sheet.png",
      { frameWidth: 256, frameHeight: 256 },
    );
  }
}
