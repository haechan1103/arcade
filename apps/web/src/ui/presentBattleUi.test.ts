import { createGameState, type AiDebugInfo } from "@bubble-battle/game-core";
import { describe, expect, it } from "vitest";
import { presentBattleUi } from "./presentBattleUi";

const botDebug: AiDebugInfo = {
  mode: "escape",
  target: null,
  path: [],
};

describe("presentBattleUi", () => {
  it("maps simulation state to a serializable HUD model", () => {
    const state = createGameState({
      seed: 0x1234,
      playerNames: ["플레이어", "영리한 버블봇"],
    });
    const ui = presentBattleUi({
      state,
      botDebug,
      countdownMs: 0,
      paused: false,
      resultVisible: false,
      compact: false,
    });

    expect(ui).toMatchObject({
      screen: "battle",
      time: "2:30",
      phase: "ROUND TIME",
      human: { name: "플레이어", balloons: "0/1", status: "alive" },
      bot: { name: "영리한 버블봇", balloons: "0/1", status: "alive" },
      botMode: "위험 회피 중",
      seed: "SEED 00001234",
      overlay: { kind: "none" },
      result: null,
    });
  });

  it("presents countdown, pause, and round result independently of Phaser", () => {
    const state = createGameState({ seed: 7 });
    expect(
      presentBattleUi({
        state,
        botDebug,
        countdownMs: 2_500,
        paused: false,
        resultVisible: false,
        compact: false,
      }).overlay,
    ).toMatchObject({ kind: "countdown", title: "3" });

    expect(
      presentBattleUi({
        state,
        botDebug,
        countdownMs: 0,
        paused: true,
        resultVisible: false,
        compact: true,
      }).overlay,
    ).toEqual({
      kind: "pause",
      title: "PAUSED",
      subtitle: "일시정지 버튼으로 계속하기",
    });

    state.result = { winnerId: 1, reason: "knockout" };
    expect(
      presentBattleUi({
        state,
        botDebug,
        countdownMs: 0,
        paused: false,
        resultVisible: true,
        compact: false,
      }).result,
    ).toBe("win");
  });
});
