/**
 * Undo/redo history for the design document.
 *
 * - `set` records a step. Consecutive `set`s with the same `coalesce` key (a drag, typing in one
 *   field) collapse into ONE undo step, so a drag is undone in one go.
 * - `undo` / `redo` move through the stack; any new `set` clears the redo stack.
 * - `reset` replaces everything (loading a design).
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Coalesce key of the last `set`, or null after undo/redo/reset. */
  lastKey: string | null;
}

export type HistoryAction<T> =
  | { type: "set"; value: T; coalesce?: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T }
  /** End the current coalescing group (e.g. on pointer up / field blur). */
  | { type: "seal" };

export const HISTORY_LIMIT = 100;

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [], lastKey: null };
}

export function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case "set": {
      if (action.value === state.present) return state;
      const key = action.coalesce ?? null;
      if (key !== null && key === state.lastKey && state.past.length > 0) {
        return { ...state, present: action.value, future: [] };
      }
      const past = [...state.past, state.present];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      return { past, present: action.value, future: [], lastKey: key };
    }
    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], lastKey: null };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest, lastKey: null };
    }
    case "seal":
      return state.lastKey === null ? state : { ...state, lastKey: null };
    case "reset":
      return initHistory(action.value);
  }
}

export const canUndo = <T>(h: History<T>) => h.past.length > 0;
export const canRedo = <T>(h: History<T>) => h.future.length > 0;
