// @vitest-environment jsdom
/** COOKIE_HIDE_SCRIPT (inline, runs during parse right after the cookie notice). */
import { afterEach, describe, expect, it } from "vitest";
import { COOKIE_ACK, COOKIE_HIDE_SCRIPT } from "../cookieAck";

function run(fontsStatus: string | null) {
  document.body.innerHTML = `<div id="n">notice</div><script id="s"></script>`;
  const notice = document.getElementById("n") as HTMLElement;
  Object.defineProperty(notice, "offsetHeight", { configurable: true, value: 159 });
  Object.defineProperty(document, "fonts", { configurable: true, value: fontsStatus ? { status: fontsStatus } : undefined });
  const script = document.getElementById("s") as HTMLScriptElement;
  Object.defineProperty(document, "currentScript", { configurable: true, value: script });
  new Function(COOKIE_HIDE_SCRIPT)();
  return notice;
}

afterEach(() => {
  document.cookie = `${COOKIE_ACK}=; max-age=0; path=/`;
});

describe("COOKIE_HIDE_SCRIPT", () => {
  it("hides the notice for a returning visitor", () => {
    document.cookie = `${COOKIE_ACK}=1; path=/`;
    const n = run("loading");
    expect(n.style.display).toBe("none");
    expect(n.style.minBlockSize).toBe("");
  });

  it("reserves the first-paint height while web fonts load (R5-PL-16), released by the first tap", () => {
    const n = run("loading");
    expect(n.style.display).toBe("");
    expect(n.style.minBlockSize).toBe("159px");
    window.dispatchEvent(new Event("pointerdown"));
    expect(n.style.minBlockSize).toBe("");
  });

  it("reserves nothing when the fonts are already loaded or the API is missing", () => {
    expect(run("loaded").style.minBlockSize).toBe("");
    expect(run(null).style.minBlockSize).toBe("");
  });
});
