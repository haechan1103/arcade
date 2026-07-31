/// <reference types="vite/client" />

import type Phaser from "phaser";

declare global {
  interface Window {
    __BUBBLE_BATTLE__: {
      game: Phaser.Game;
      getState: () => unknown;
      getUiState: () => unknown;
      layout: {
        width: number;
        height: number;
        compact: boolean;
      };
    };
  }
}
