import { describe, expect, it } from "vitest";
import { HISTORY_LIMIT, canRedo, canUndo, historyReducer, initHistory, type History } from "../history";

const run = (h: History<number>, ...actions: Parameters<typeof historyReducer<number>>[1][]) => actions.reduce((s, a) => historyReducer(s, a), h);

describe("history reducer", () => {
  it("records steps and undoes / redoes them", () => {
    let h = run(initHistory(0), { type: "set", value: 1 }, { type: "set", value: 2 });
    expect(h.present).toBe(2);
    expect(canUndo(h)).toBe(true);
    h = run(h, { type: "undo" });
    expect(h.present).toBe(1);
    expect(canRedo(h)).toBe(true);
    h = run(h, { type: "redo" });
    expect(h.present).toBe(2);
    expect(canRedo(h)).toBe(false);
  });

  it("collapses a drag (same coalesce key) into one undo step", () => {
    const h = run(initHistory(0), { type: "set", value: 1, coalesce: "drag:a" }, { type: "set", value: 2, coalesce: "drag:a" }, { type: "set", value: 3, coalesce: "drag:a" });
    expect(h.present).toBe(3);
    expect(h.past).toEqual([0]);
    expect(run(h, { type: "undo" }).present).toBe(0);
  });

  it("starts a new step after seal or a different key", () => {
    const h = run(
      initHistory(0),
      { type: "set", value: 1, coalesce: "k" },
      { type: "seal" },
      { type: "set", value: 2, coalesce: "k" },
      { type: "set", value: 3, coalesce: "other" },
    );
    expect(h.past).toEqual([0, 1, 2]);
  });

  it("clears redo on a new edit and ignores no-op sets", () => {
    let h = run(initHistory(0), { type: "set", value: 1 }, { type: "undo" });
    expect(canRedo(h)).toBe(true);
    h = run(h, { type: "set", value: 5 });
    expect(canRedo(h)).toBe(false);
    expect(run(h, { type: "set", value: 5 })).toBe(h);
  });

  it("caps the undo stack", () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = historyReducer(h, { type: "set", value: i });
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });

  it("reset replaces everything", () => {
    const h = run(initHistory(0), { type: "set", value: 1 }, { type: "reset", value: 9 });
    expect(h).toEqual({ past: [], present: 9, future: [], lastKey: null });
  });
});
