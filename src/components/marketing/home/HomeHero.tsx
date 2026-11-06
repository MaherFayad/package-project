"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import s from "./home.module.css";

/** Per-word spans for the slide-in (Arabic words stay whole; the browser shapes each one). */
function Words({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  let w = 0;
  return (
    <>
      {parts.map((p, i) =>
        /^\s+$/.test(p) ? (
          p
        ) : (
          <span key={i} className={s.word} style={{ ["--w" as string]: w++ }}>
            {p}
          </span>
        ),
      )}
    </>
  );
}

const ROTATE_MS = 7000;

/**
 * Full-bleed hero (shopify.com/sa hero): rotating headline over our box "video", copy at the
 * bottom start, two pills. The first headline is the real <h1>; the alternates are visual only
 * (aria-hidden) so assistive tech reads one stable title. A loop video is used when the assets
 * branch provides one (poster first, played only when visible and motion is allowed); otherwise
 * the poster render drifts. One control pauses the rotation, the video and the drift
 * (WCAG 2.2.2); everything starts paused under prefers-reduced-motion (2.3.3).
 */
export function HomeHero({
  titles,
  lead,
  actions,
  poster,
  video,
  labels,
}: {
  titles: string[];
  lead: string;
  actions: ReactNode;
  poster: ReactNode;
  video?: { webm?: string; mp4?: string; poster: string } | null;
  labels: { pause: string; play: string; mediaAlt: string };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const root = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible || titles.length < 2) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % titles.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, visible, titles.length]);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (paused || !visible) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, visible, videoReady]);

  return (
    <section ref={root} className={s.hero} aria-labelledby="hero-title" data-paused={paused ? "true" : "false"}>
      <div className={s.heroMedia} aria-hidden="true">
        <div className={s.heroStage}>
          <div className={s.heroFloor} />
          <div className={s.heroDrift}>{poster}</div>
          {video ? (
            <video
              ref={vid}
              className={s.heroVideo}
              data-ready={videoReady ? "true" : "false"}
              muted
              loop
              playsInline
              preload="none"
              poster={video.poster}
              onCanPlay={() => setVideoReady(true)}
            >
              {video.webm ? <source src={video.webm} type="video/webm" /> : null}
              {video.mp4 ? <source src={video.mp4} type="video/mp4" /> : null}
            </video>
          ) : null}
        </div>
      </div>
      <div className={s.heroScrim} aria-hidden="true" />
      <div className={s.wrap}>
        <div className={s.heroCopy}>
          <div className={s.heroTitles}>
            {titles.map((t, i) =>
              i === 0 ? (
                <h1 key={i} id="hero-title" className={`${s.h1} ${s.heroTitle}`} data-active={active === i ? "true" : "false"}>
                  <Words text={t} />
                </h1>
              ) : (
                <p key={i} className={`${s.h1} ${s.heroTitle}`} data-active={active === i ? "true" : "false"} aria-hidden="true">
                  <Words text={t} />
                </p>
              ),
            )}
          </div>
          <p className={s.heroLead}>{lead}</p>
          {actions}
        </div>
      </div>
      <button
        type="button"
        className={`${s.iconBtn} ${s.heroControl}`}
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? labels.play : labels.pause}
      >
        {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
      </button>
    </section>
  );
}
