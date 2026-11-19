// Публичный API движка правил Хексленда.
export * from './types';
export * from './constants';
export * from './rng';
export * from './events';
export * from './actions';
export * from './state';
export * from './views';
export { applyAction, applyHostAction, stealCandidates, RuleError } from './engine';
export type { ActionResult } from './engine';
export * from './board/geometry';
export * from './board/generate';
export * from './rules/placement';
export {
  longestRoadLength,
  publicVictoryPoints,
  hiddenVictoryPoints,
  victoryPoints,
} from './rules/scoring';
