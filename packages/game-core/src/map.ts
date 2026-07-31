import { HALF_TILE, TILE_UNITS } from "./config";
import { nextRandom, normalizeSeed } from "./rng";
import type {
  Cell,
  GameState,
  ItemType,
  MapDefinition,
  NewGameOptions,
  PlayerState,
  TileState,
} from "./types";

const DEFAULT_WIDTH = 15;
const DEFAULT_HEIGHT = 13;

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function isClassicPillar(col: number, row: number): boolean {
  return col > 0 && row > 0 && col % 2 === 0 && row % 2 === 0;
}

function createClassicLayout(): string[] {
  const rows: string[] = [];
  const safeCells = new Set([
    cellKey(1, 1),
    cellKey(2, 1),
    cellKey(1, 2),
    cellKey(DEFAULT_WIDTH - 2, DEFAULT_HEIGHT - 2),
    cellKey(DEFAULT_WIDTH - 3, DEFAULT_HEIGHT - 2),
    cellKey(DEFAULT_WIDTH - 2, DEFAULT_HEIGHT - 3),
  ]);

  for (let row = 0; row < DEFAULT_HEIGHT; row += 1) {
    let line = "";
    for (let col = 0; col < DEFAULT_WIDTH; col += 1) {
      const border =
        col === 0 ||
        row === 0 ||
        col === DEFAULT_WIDTH - 1 ||
        row === DEFAULT_HEIGHT - 1;

      if (border || isClassicPillar(col, row)) {
        line += "#";
      } else if (col === 1 && row === 1) {
        line += "1";
      } else if (
        col === DEFAULT_WIDTH - 2 &&
        row === DEFAULT_HEIGHT - 2
      ) {
        line += "2";
      } else if (safeCells.has(cellKey(col, row))) {
        line += ".";
      } else {
        line += "?";
      }
    }
    rows.push(line);
  }

  return rows;
}

export const DEFAULT_MAP: MapDefinition = {
  id: "neon-garden",
  name: "네온 가든",
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  layout: createClassicLayout(),
  softBlockChance: 0.72,
  mirrorRandomBlocks: true,
};

function validateMap(map: MapDefinition): void {
  if (map.layout.length !== map.height) {
    throw new Error(`Map ${map.id} has an invalid row count.`);
  }

  if (map.layout.some((row) => row.length !== map.width)) {
    throw new Error(`Map ${map.id} has an invalid column count.`);
  }

  const joined = map.layout.join("");
  if (!joined.includes("1") || !joined.includes("2")) {
    throw new Error(`Map ${map.id} must contain spawn markers 1 and 2.`);
  }
}

function randomItem(
  rngState: number,
): { state: number; item: ItemType | null } {
  const dropRoll = nextRandom(rngState);
  if (dropRoll.value >= 0.46) {
    return { state: dropRoll.state, item: null };
  }

  const itemRoll = nextRandom(dropRoll.state);
  if (itemRoll.value < 0.3) {
    return { state: itemRoll.state, item: "capacity" };
  }
  if (itemRoll.value < 0.6) {
    return { state: itemRoll.state, item: "range" };
  }
  if (itemRoll.value < 0.9) {
    return { state: itemRoll.state, item: "speed" };
  }
  return { state: itemRoll.state, item: "needle" };
}

function toPlayer(
  id: number,
  name: string,
  team: number,
  spawn: Cell,
): PlayerState {
  return {
    id,
    name,
    team,
    x: spawn.col * TILE_UNITS + HALF_TILE,
    y: spawn.row * TILE_UNITS + HALF_TILE,
    direction: team === 1 ? "right" : "left",
    status: "alive",
    balloonCapacity: 1,
    activeBalloons: 0,
    blastRange: 1,
    speedLevel: 0,
    needles: 0,
    trappedUntilTick: -1,
    invulnerableUntilTick: -1,
  };
}

export function createGameState(options: NewGameOptions): GameState {
  const map = options.map ?? DEFAULT_MAP;
  validateMap(map);

  const spawnCells: [Cell | null, Cell | null] = [null, null];
  const tiles: TileState[] = [];
  let rngState = normalizeSeed(options.seed);
  const randomSoftByPair = new Map<string, boolean>();

  for (let row = 0; row < map.height; row += 1) {
    const layoutRow = map.layout[row];
    if (layoutRow === undefined) {
      throw new Error(`Missing row ${row}.`);
    }

    for (let col = 0; col < map.width; col += 1) {
      const marker = layoutRow[col];
      let kind: TileState["kind"] = "floor";

      if (marker === "#") {
        kind = "hard";
      } else if (marker === "+") {
        kind = "soft";
      } else if (marker === "?") {
        const mirrorCol = map.width - 1 - col;
        const mirrorRow = map.height - 1 - row;
        const pairKey =
          cellKey(col, row) < cellKey(mirrorCol, mirrorRow)
            ? `${cellKey(col, row)}|${cellKey(mirrorCol, mirrorRow)}`
            : `${cellKey(mirrorCol, mirrorRow)}|${cellKey(col, row)}`;

        let shouldCreateSoft = randomSoftByPair.get(pairKey);
        if (shouldCreateSoft === undefined || !map.mirrorRandomBlocks) {
          const roll = nextRandom(rngState);
          rngState = roll.state;
          shouldCreateSoft = roll.value < map.softBlockChance;
          if (map.mirrorRandomBlocks) {
            randomSoftByPair.set(pairKey, shouldCreateSoft);
          }
        }
        kind = shouldCreateSoft ? "soft" : "floor";
      } else if (marker === "1" || marker === "2") {
        spawnCells[Number(marker) - 1] = { col, row };
      }

      let hiddenItem: ItemType | null = null;
      if (kind === "soft") {
        const generated = randomItem(rngState);
        rngState = generated.state;
        hiddenItem = generated.item;
      }

      tiles.push({
        kind,
        hiddenItem,
        revealTick: -1,
      });
    }
  }

  const playerOneSpawn = spawnCells[0];
  const playerTwoSpawn = spawnCells[1];
  if (playerOneSpawn === null || playerTwoSpawn === null) {
    throw new Error(`Map ${map.id} is missing a player spawn.`);
  }

  const names = options.playerNames ?? ["플레이어", "버블봇"];

  return {
    version: 1,
    seed: normalizeSeed(options.seed),
    rngState,
    tick: 0,
    phase: "playing",
    result: null,
    mapId: map.id,
    mapName: map.name,
    width: map.width,
    height: map.height,
    tiles,
    players: [
      toPlayer(1, names[0], 1, playerOneSpawn),
      toPlayer(2, names[1], 2, playerTwoSpawn),
    ],
    balloons: [],
    pickups: [],
    blasts: [],
    stormLevel: 0,
    stormCells: [],
    nextEntityId: 100,
  };
}

export function mapFromAscii(
  id: string,
  name: string,
  layout: string[],
): MapDefinition {
  const firstRow = layout[0];
  if (firstRow === undefined) {
    throw new Error("ASCII map cannot be empty.");
  }

  return {
    id,
    name,
    width: firstRow.length,
    height: layout.length,
    layout,
    softBlockChance: 0,
    mirrorRandomBlocks: false,
  };
}
