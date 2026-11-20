import { createContext, useContext } from 'react';

export interface Palette {
  sea: string;
  seaDeep: string;
  accent: string;
  light: string;
}

export const DEFAULT_PALETTE: Palette = {
  sea: '#2fb4c9',
  seaDeep: '#0a4a78',
  accent: '#ffd36b',
  light: '#fff0d2',
};

/** Изменяемое состояние камеры, которое читают жетоны, море и т.п. (обновляется каждый кадр). */
export interface Rig {
  az: number;
  pol: number;
  /** Насколько жетоны/таблички поворачиваются к камере (рад). */
  tilt: number;
  /** Сила волн: 0 (2d) … 1 (3d). */
  amp: number;
}

export interface Env {
  palette: Palette;
  reduced: boolean;
  lowPower: boolean;
  rig: Rig;
}

export const EnvCtx = createContext<Env>(null as unknown as Env);
export const useEnv = () => useContext(EnvCtx);
