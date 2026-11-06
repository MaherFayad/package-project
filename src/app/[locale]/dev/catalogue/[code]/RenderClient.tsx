"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import type { CatalogueRender } from "@/data/catalogue/types";

const CatalogueViewer = dynamic(() => import("@/components/catalogue/CatalogueViewer"), { ssr: false });

export function RenderClient({ code, render, source }: { code: string; render: CatalogueRender; source: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const onReady = useCallback(() => setState("ready"), []);
  const onError = useCallback((e: Error) => {
    setState("error");
    setMessage(e.message);
  }, []);
  return (
    <>
    <style>{"html,body{background:transparent!important}"}</style>
    <div data-testid="catalogue-render" data-ready={state === "ready" ? "true" : undefined} data-state={state} style={{ position: "relative", width: 640, height: 640, background: "transparent" }}>
      <CatalogueViewer code={code} render={render} source={source} onReady={onReady} onError={onError} />
      {state === "error" ? <p role="alert">{message}</p> : null}
    </div>
    </>
  );
}
