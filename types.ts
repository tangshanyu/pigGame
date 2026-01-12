export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum MoleState {
  HIDDEN = 'HIDDEN',
  RISING = 'RISING', // Going up
  VISIBLE = 'VISIBLE', // Fully up
  HIT = 'HIT', // Bonked
}

export interface Mole {
  id: number;
  state: MoleState;
  nextAppearanceTime: number;
}
