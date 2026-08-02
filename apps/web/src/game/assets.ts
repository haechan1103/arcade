import Phaser from "phaser";

export const CHARACTER_SHEET = "generated-characters";
export const OBJECT_SHEET = "generated-objects";
export const BRAND_LOGO = "bubble-battle-logo";

export const CHARACTER_FRAME = {
  humanIdle: 0,
  botIdle: 1,
  humanWalk: 2,
  botWalk: 3,
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
      "/assets/generated/character-sheet.png",
      { frameWidth: 512, frameHeight: 512 },
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
