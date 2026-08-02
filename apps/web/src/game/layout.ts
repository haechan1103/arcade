import { TILE_UNITS } from "@bubble-battle/game-core";

const hasCompactPointer =
  window.matchMedia("(pointer: coarse)").matches ||
  (navigator.maxTouchPoints > 0 &&
    Math.min(window.screen.width, window.screen.height) <= 1_024);

export const IS_COMPACT_LAYOUT = hasCompactPointer;
export const UI_TEXT_RESOLUTION = IS_COMPACT_LAYOUT
  ? 2
  : Math.min(2, Math.max(1, window.devicePixelRatio || 1));
export const GAME_WIDTH = IS_COMPACT_LAYOUT ? 800 : 1100;
export const GAME_HEIGHT = IS_COMPACT_LAYOUT ? 680 : 720;
export const BOARD_X = IS_COMPACT_LAYOUT ? 40 : 34;
export const BOARD_Y = IS_COMPACT_LAYOUT ? 28 : 48;
export const TILE_SIZE = 48;
export const BOARD_WIDTH = 15 * TILE_SIZE;
export const BOARD_HEIGHT = 13 * TILE_SIZE;
export const SIDEBAR_X = 790;

export const UI_FONT =
  '"Arial Rounded MT Bold", "Apple SD Gothic Neo", system-ui, sans-serif';

export function isPortraitLayout(): boolean {
  return IS_COMPACT_LAYOUT && window.innerHeight > window.innerWidth;
}

export function worldToScreenX(worldX: number): number {
  return BOARD_X + (worldX / TILE_UNITS) * TILE_SIZE;
}

export function worldToScreenY(worldY: number): number {
  return BOARD_Y + (worldY / TILE_UNITS) * TILE_SIZE;
}

export function cellToScreen(
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: BOARD_X + col * TILE_SIZE,
    y: BOARD_Y + row * TILE_SIZE,
  };
}
