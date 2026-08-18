import {
  ROUND_DURATION_TICKS,
  STORM_START_TICK,
  TICK_RATE,
  type AiDebugInfo,
  type GameState,
  type PlayerState,
} from "@bubble-battle/game-core";
import type {
  GameUiState,
  PlayerHudState,
  UiOverlay,
  UiResult,
} from "./GameUiStore";

const BOT_MODE_LABELS: Record<AiDebugInfo["mode"], string> = {
  escape: "위험 회피 중",
  pickup: "아이템 탐색 중",
  attack: "공격 각도 계산 중",
  break: "블록 공략 중",
  wander: "경로 탐색 중",
  trapped: "물방울 탈출 중",
};

export interface BattleUiContext {
  state: GameState;
  botDebug: AiDebugInfo;
  countdownMs: number;
  paused: boolean;
  resultVisible: boolean;
  compact: boolean;
}

export type BattleUiSnapshot = Pick<
  GameUiState,
  | "screen"
  | "mapName"
  | "time"
  | "phase"
  | "human"
  | "bot"
  | "botMode"
  | "seed"
  | "overlay"
  | "result"
>;

export function presentBattleUi({
  state,
  botDebug,
  countdownMs,
  paused,
  resultVisible,
  compact,
}: BattleUiContext): BattleUiSnapshot {
  const remainingTicks = Math.max(0, ROUND_DURATION_TICKS - state.tick);
  const seconds = Math.ceil(remainingTicks / TICK_RATE);
  const human = state.players.find((player) => player.id === 1) ?? null;
  const bot = state.players.find((player) => player.id === 2) ?? null;

  return {
    screen: "battle",
    mapName: state.mapName,
    time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
    phase: state.tick >= STORM_START_TICK ? "TIDAL SURGE" : "ROUND TIME",
    human: human === null ? null : presentPlayer(human),
    bot: bot === null ? null : presentPlayer(bot),
    botMode: BOT_MODE_LABELS[botDebug.mode],
    seed: `SEED ${state.seed.toString(16).toUpperCase().padStart(8, "0")}`,
    overlay: presentOverlay(state, countdownMs, paused, compact),
    result: presentResult(state, resultVisible),
  };
}

function presentPlayer(player: PlayerState): PlayerHudState {
  return {
    name: player.name,
    balloons: `${player.activeBalloons}/${player.balloonCapacity}`,
    range: player.blastRange,
    speed: player.speedStat,
    needles: player.needles,
    status: player.status,
  };
}

function presentOverlay(
  state: GameState,
  countdownMs: number,
  paused: boolean,
  compact: boolean,
): UiOverlay {
  if (paused) {
    return {
      kind: "pause",
      title: "PAUSED",
      subtitle: compact
        ? "일시정지 버튼으로 계속하기"
        : "ESC를 눌러 계속하기",
    };
  }
  if (countdownMs <= 0) {
    return { kind: "none" };
  }

  const step = countdownMs > 2400 ? 3 : countdownMs > 1600 ? 2 : countdownMs > 800 ? 1 : 0;
  const messages = compact
    ? {
        3: `${state.mapName} · 길을 먼저 확보하세요`,
        2: "벽 뒤는 안전합니다",
        1: "내 물풍선도 피하세요",
        0: "",
      }
    : {
        3: `${state.mapName} · 빈 공간을 만들고 먼저 성장하세요`,
        2: "물줄기는 단단한 벽에서 멈춥니다",
        1: "자신의 물풍선에서도 반드시 탈출하세요",
        0: "",
      };
  return {
    kind: "countdown",
    title: step === 0 ? "BUBBLE!" : String(step),
    subtitle: messages[step],
  };
}

function presentResult(state: GameState, visible: boolean): UiResult {
  if (!visible || state.result === null) {
    return null;
  }
  if (state.result.winnerId === null) {
    return "draw";
  }
  return state.result.winnerId === 1 ? "win" : "lose";
}
