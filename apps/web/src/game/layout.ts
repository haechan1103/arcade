import { TILE_UNITS } from "@bubble-battle/game-core";

export const GAME_WIDTH = 1100;
export const GAME_HEIGHT = 720;
export const BOARD_X = 34;
export const BOARD_Y = 48;
export const TILE_SIZE = 48;
export const BOARD_WIDTH = 15 * TILE_SIZE;
export const BOARD_HEIGHT = 13 * TILE_SIZE;
export const SIDEBAR_X = 790;

export const UI_FONT =
  '"Arial Rounded MT Bold", "Apple SD Gothic Neo", system-ui, sans-serif';

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
