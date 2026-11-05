import type { en } from "./en";

/** Recursively widen string literals so ar.ts can hold different text with the same keys. */
type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;

/** Dot paths to every string leaf: "auth.errors.INVALID_PHONE", "nav.home", ... */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];

export type DictKey = Paths<Dictionary>;
export type TVars = Record<string, string | number>;
export type TFunction = (key: DictKey, vars?: TVars) => string;
