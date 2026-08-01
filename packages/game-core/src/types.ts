export type Direction = "up" | "down" | "left" | "right";
export type PlayerStatus = "alive" | "trapped" | "dead";
export type GamePhase = "playing" | "ended";
export type TileKind = "floor" | "hard" | "soft";
export type ItemType = "capacity" | "range" | "speed" | "needle";
export type Difficulty = "easy" | "normal" | "hard";

export interface Cell {
  col: number;
  row: number;
}

export interface TileState {
  kind: TileKind;
  hiddenItem: ItemType | null;
  revealTick: number;
}

export interface MapDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  layout: string[];
  softBlockChance: number;
  mirrorRandomBlocks: boolean;
}

export interface PlayerInput {
  move: Direction | null;
  fallbackMove?: Direction | null;
  placeBalloon: boolean;
  useNeedle: boolean;
}

export interface PlayerState {
  id: number;
  name: string;
  team: number;
  x: number;
  y: number;
  direction: Direction;
  status: PlayerStatus;
  balloonCapacity: number;
  activeBalloons: number;
  blastRange: number;
  speedLevel: number;
  needles: number;
  trappedUntilTick: number;
  invulnerableUntilTick: number;
}

export interface BalloonState {
  id: number;
  ownerId: number;
  col: number;
  row: number;
  placedTick: number;
  explodeTick: number;
  range: number;
  passThroughPlayerIds: number[];
}

export interface PickupState {
  id: number;
  col: number;
  row: number;
  type: ItemType;
}

export interface BlastState {
  id: number;
  balloonId: number;
  ownerId: number;
  cells: Cell[];
  createdTick: number;
  expireTick: number;
}

export interface RoundResult {
  winnerId: number | null;
  reason: "knockout" | "draw";
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  tick: number;
  phase: GamePhase;
  result: RoundResult | null;
  mapId: string;
  mapName: string;
  width: number;
  height: number;
  tiles: TileState[];
  players: PlayerState[];
  balloons: BalloonState[];
  pickups: PickupState[];
  blasts: BlastState[];
  stormLevel: number;
  stormCells: Cell[];
  nextEntityId: number;
}

export interface NewGameOptions {
  seed: number;
  map?: MapDefinition;
  playerNames?: readonly [string, string];
  initialSpeedLevel?: number;
}

export type GameEvent =
  | {
      type: "balloon-placed";
      balloonId: number;
      ownerId: number;
      cell: Cell;
    }
  | {
      type: "balloon-exploded";
      balloonId: number;
      ownerId: number;
      cells: Cell[];
    }
  | {
      type: "block-destroyed";
      cell: Cell;
    }
  | {
      type: "item-revealed";
      itemId: number;
      itemType: ItemType;
      cell: Cell;
    }
  | {
      type: "item-picked";
      playerId: number;
      itemType: ItemType;
      cell: Cell;
    }
  | {
      type: "player-trapped";
      playerId: number;
      source: "blast" | "storm";
    }
  | {
      type: "player-freed";
      playerId: number;
      source: "needle" | "teammate";
    }
  | {
      type: "player-died";
      playerId: number;
      source: "opponent" | "timeout";
    }
  | {
      type: "storm-advanced";
      level: number;
      cells: Cell[];
    }
  | {
      type: "round-ended";
      result: RoundResult;
    };

export type InputByPlayer = Readonly<
  Record<number, PlayerInput | undefined>
>;

export interface AiDebugInfo {
  mode: "escape" | "pickup" | "attack" | "break" | "wander" | "trapped";
  target: Cell | null;
  path: Cell[];
}
