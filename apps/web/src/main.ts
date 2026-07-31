import Phaser from "phaser";
import { BattleScene } from "./game/scenes/BattleScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/layout";
import "./style.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#090f28",
  render: {
    antialias: true,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    keyboard: true,
  },
  scene: [MenuScene, BattleScene],
};

const game = new Phaser.Game(config);

function getBattleUiState(): unknown {
  const battleScene = game.scene.getScene(
    "BattleScene",
  ) as BattleScene;
  return battleScene.getDebugUiState();
}

window.__BUBBLE_BATTLE__ = {
  game,
  getState: () => game.registry.get("debug:state") as unknown,
  getUiState: getBattleUiState,
};
