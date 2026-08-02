import Phaser from "phaser";

export const CHARACTER_SHEET = "generated-characters";
export const OBJECT_SHEET = "generated-objects";
export const BLAST_SHEET = "generated-blast-animation";
export const WARNING_BALLOON = "generated-warning-balloon";
export const BRAND_LOGO = "bubble-battle-logo";

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
  if (!scene.textures.exists(BRAND_LOGO)) {
    scene.load.image(
      BRAND_LOGO,
      "/assets/brand/bubble-battle-logo.png",
    );
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
