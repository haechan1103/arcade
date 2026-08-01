import {
  BLAST_HITBOX_HALF,
  HALF_TILE,
  PLAYER_BODY_HALF,
  TILE_UNITS,
} from "./config";
import type {
  BalloonState,
  Cell,
  GameState,
  PlayerState,
} from "./types";

export const CARDINAL_STEPS: ReadonlyArray<Cell> = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

export function toIndex(
  width: number,
  col: number,
  row: number,
): number {
  return row * width + col;
}

export function inBounds(
  state: Pick<GameState, "width" | "height">,
  col: number,
  row: number,
): boolean {
  return col >= 0 && row >= 0 && col < state.width && row < state.height;
}

export function cellKey(cell: Cell): string {
  return `${cell.col},${cell.row}`;
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row;
}

export function playerCell(player: PlayerState): Cell {
  return {
    col: Math.floor(player.x / TILE_UNITS),
    row: Math.floor(player.y / TILE_UNITS),
  };
}

export function cellCenter(cell: Cell): { x: number; y: number } {
  return {
    x: cell.col * TILE_UNITS + HALF_TILE,
    y: cell.row * TILE_UNITS + HALF_TILE,
  };
}

export function isPlayerCentered(player: PlayerState): boolean {
  const center = cellCenter(playerCell(player));
  return (
    Math.abs(player.x - center.x) <= 180 &&
    Math.abs(player.y - center.y) <= 180
  );
}

export function bodyIntersectsCell(
  player: PlayerState,
  cell: Cell,
): boolean {
  return playerHitboxIntersectsCell(player, cell, PLAYER_BODY_HALF);
}

export function blastIntersectsPlayer(
  player: PlayerState,
  cell: Cell,
): boolean {
  return playerHitboxIntersectsCell(player, cell, BLAST_HITBOX_HALF);
}

function playerHitboxIntersectsCell(
  player: PlayerState,
  cell: Cell,
  hitboxHalf: number,
): boolean {
  const left = cell.col * TILE_UNITS;
  const top = cell.row * TILE_UNITS;
  const right = left + TILE_UNITS;
  const bottom = top + TILE_UNITS;

  return (
    player.x + hitboxHalf > left &&
    player.x - hitboxHalf < right &&
    player.y + hitboxHalf > top &&
    player.y - hitboxHalf < bottom
  );
}

export function playersTouch(
  first: PlayerState,
  second: PlayerState,
): boolean {
  const threshold = PLAYER_BODY_HALF * 1.75;
  return (
    Math.abs(first.x - second.x) < threshold &&
    Math.abs(first.y - second.y) < threshold
  );
}

export function balloonAt(
  state: Pick<GameState, "balloons">,
  col: number,
  row: number,
): BalloonState | undefined {
  return state.balloons.find(
    (balloon) => balloon.col === col && balloon.row === row,
  );
}

export function isStormCell(
  state: Pick<GameState, "stormCells">,
  col: number,
  row: number,
): boolean {
  return state.stormCells.some(
    (cell) => cell.col === col && cell.row === row,
  );
}

export function isWalkableCell(
  state: GameState,
  col: number,
  row: number,
  ignoreBalloonAt: Cell | null = null,
): boolean {
  if (!inBounds(state, col, row) || isStormCell(state, col, row)) {
    return false;
  }

  const tile = state.tiles[toIndex(state.width, col, row)];
  if (tile === undefined || tile.kind !== "floor") {
    return false;
  }

  const balloon = balloonAt(state, col, row);
  if (balloon === undefined) {
    return true;
  }

  return (
    ignoreBalloonAt !== null &&
    ignoreBalloonAt.col === col &&
    ignoreBalloonAt.row === row
  );
}
