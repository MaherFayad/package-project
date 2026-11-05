import type { DesignDoc } from "@/types";
import { ANON_DESIGN_TTL_DAYS } from "@/types";
import { parseDesignDoc, withoutInlineImages } from "./doc";

/**
 * Per-browser autosave. Every write is wrapped in try/catch: storage can be full, blocked or
 * missing (private mode). The server copy (POST /api/designs) is the durable one.
 */
export const LOCAL_KEY = "elba.designer.last.v1";

export interface LocalDraft {
  doc: DesignDoc;
  /** Server design id once the draft has been saved there. */
  designId: string | null;
  savedAt: number;
}

interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function store(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Save the draft; if it does not fit (big images), save it without inline images. */
export function saveLocalDraft(draft: LocalDraft, s: StorageLike | null = store()): "full" | "partial" | "failed" {
  if (!s) return "failed";
  try {
    s.setItem(LOCAL_KEY, JSON.stringify(draft));
    return "full";
  } catch {
    try {
      s.setItem(LOCAL_KEY, JSON.stringify({ ...draft, doc: withoutInlineImages(draft.doc) }));
      return "partial";
    } catch {
      return "failed";
    }
  }
}

export function loadLocalDraft(s: StorageLike | null = store(), now = Date.now()): LocalDraft | null {
  if (!s) return null;
  try {
    const raw = s.getItem(LOCAL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LocalDraft>;
    const doc = parseDesignDoc(v.doc);
    if (!doc || typeof v.savedAt !== "number") return null;
    if (now - v.savedAt > ANON_DESIGN_TTL_DAYS * 86_400_000) {
      s.removeItem(LOCAL_KEY);
      return null;
    }
    return { doc, designId: typeof v.designId === "string" ? v.designId : null, savedAt: v.savedAt };
  } catch {
    return null;
  }
}

export function clearLocalDraft(s: StorageLike | null = store()) {
  try {
    s?.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}
