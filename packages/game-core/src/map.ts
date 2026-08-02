import {
  HALF_TILE,
  MAX_SPEED_LEVEL,
  TILE_UNITS,
} from "./config";
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

function builtInMap(
  id: string,
  name: string,
  layout: string[],
  softBlockChance: number,
): MapDefinition {
  return {
    id,
    name,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    layout,
    softBlockChance,
    mirrorRandomBlocks: true,
  };
}

export const GAME_MAPS: readonly MapDefinition[] = [
  builtInMap(
    "neon-garden",
    "네온 가든",
    [
      "###############",
      "#1..???#???...#",
      "#.##.#...#.##?#",
      "#??..#???#..??#",
      "#.#.###.###.#.#",
      "#??#.......#??#",
      "##..##...##..##",
      "#??#.......#??#",
      "#.#.###.###.#.#",
      "#??..#???#..??#",
      "#?##.#...#.##.#",
      "#...???#???..2#",
      "###############",
    ],
    0.66,
  ),
  builtInMap(
    "metro-crossing",
    "메트로 크로싱",
    [
      "###############",
      "#1...??#??....#",
      "#..###...###..#",
      "#??..#...#..??#",
      "#.#.##...##.#.#",
      "#?...#...#...?#",
      "####...#...####",
      "#?...#...#...?#",
      "#.#.##...##.#.#",
      "#??..#...#..??#",
      "#..###...###..#",
      "#....??#??...2#",
      "###############",
    ],
    0.72,
  ),
  builtInMap(
    "coral-maze",
    "코럴 메이즈",
    [
      "###############",
      "#1...#???#....#",
      "#.##.#...#.##.#",
      "#?..#??#??#..?#",
      "#.#...###...#.#",
      "#??##.....##??#",
      "##...##.##...##",
      "#??##.....##??#",
      "#.#...###...#.#",
      "#?..#??#??#..?#",
      "#.##.#...#.##.#",
      "#....#???#...2#",
      "###############",
    ],
    0.6,
  ),
];

export const DEFAULT_MAP = GAME_MAPS[0]!;

export function getGameMap(mapId: string): MapDefinition | undefined {
  return GAME_MAPS.find((map) => map.id === mapId);
}

export function selectGameMap(seed: number): MapDefinition {
  return GAME_MAPS[normalizeSeed(seed) % GAME_MAPS.length]!;
}

function resolveGameMap(options: NewGameOptions): MapDefinition {
  if (options.map !== undefined) {
    return options.map;
  }
  if (options.mapId !== undefined) {
    const selected = getGameMap(options.mapId);
    if (selected === undefined) {
      throw new Error(`Unknown map id: ${options.mapId}`);
    }
    return selected;
  }
  return selectGameMap(options.seed);
}

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
  speedLevel: number,
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
    speedLevel,
    needles: 0,
    trappedUntilTick: -1,
    invulnerableUntilTick: -1,
  };
}

export function createGameState(options: NewGameOptions): GameState {
  const map = resolveGameMap(options);
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
  const requestedSpeedLevel = options.initialSpeedLevel ?? 0;
  const initialSpeedLevel = Number.isFinite(requestedSpeedLevel)
    ? Math.min(
        MAX_SPEED_LEVEL,
        Math.max(0, Math.trunc(requestedSpeedLevel)),
      )
    : 0;

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
      toPlayer(
        1,
        names[0],
        1,
        playerOneSpawn,
        initialSpeedLevel,
      ),
      toPlayer(
        2,
        names[1],
        2,
        playerTwoSpawn,
        initialSpeedLevel,
      ),
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
