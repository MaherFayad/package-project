"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { Sheet } from "@/components/marketing/kit/Sheet";
import { HeroTitle } from "@/components/marketing/kit/HeroTitle";
import { IconPill } from "@/components/marketing/kit/Pill";
import { useReducedMotion } from "@/components/marketing/kit/motion";
import s from "./home.module.css";

const ROTATE_MS = 7000;

export interface HeroVideo {
  sources: { src: string; type: string; media?: string }[];
  poster: string;
}

/** One full-bleed studio scene per headline: the poster (LCP for the first) and its turntable loop. */
export interface HeroScene {
  poster: ReactNode;
  video: HeroVideo | null;
}

/**
 * Full-bleed hero (shopify.com/sa hero) on the kit <Sheet hero> (transparent header over it):
 * rotating headline over our box "video", copy at the bottom start, two pills.
 * The first headline is the real <h1> (kit HeroTitle, word slide-in without fade, the LCP);
 * the alternates are aria-hidden so assistive tech reads one stable title. The turntable loop
 * (assets branch) plays only while visible and motion is allowed, poster first; without it the
 * studio render drifts. One control pauses rotation, video and drift (WCAG 2.2.2); nothing
 * moves under prefers-reduced-motion (2.3.3), so the control is not shown there.
 */
export function HomeHero({
  titles,
  lead,
  actions,
  scenes,
  props,
  labels,
}: {
  titles: string[];
  lead: string;
  actions: ReactNode;
  /** Aligned with `titles`: the scene swaps with the headline, as on the reference. */
  scenes: HeroScene[];
  /** Static set pieces around the turntable (cutouts on the studio floor). */
  props?: ReactNode;
  labels: { pause: string; play: string };
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState<Record<number, boolean>>({});
  const root = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const paused = userPaused || reduce;

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !visible || titles.length < 2) return;
    const id = window.setTimeout(() => {
      setActive((a) => (a + 1) % titles.length);
      setCycle((c) => c + 1);
    }, ROTATE_MS);
    return () => window.clearTimeout(id);
  }, [paused, visible, titles.length, active]);

  // Only the active scene's loop plays (and only it is fetched: preload stays "none" until then).
  useEffect(() => {
    vids.current.forEach((v, i) => {
      if (!v) return;
      if (paused || !visible || i !== active) v.pause();
      else {
        if (v.preload === "none") v.preload = "auto";
        void v.play().catch(() => undefined);
      }
    });
  }, [paused, visible, active]);

  return (
    <Sheet tone="dark" hero pad="none" container={false} className={s.heroSheet} aria-labelledby="hero-title">
      <div ref={root} className={s.hero} data-paused={paused ? "true" : "false"}>
        <div className={s.heroMedia} aria-hidden="true">
          <div className={s.heroFloor} />
          {scenes.map((sc, i) => (
            <div key={i} className={s.heroStage} data-active={active === i ? "true" : "false"}>
              <div className={s.heroDrift}>
                {sc.poster}
                {sc.video && !reduce ? (
                  <video
                    ref={(el) => void (vids.current[i] = el)}
                    className={s.heroVideo}
                    data-ready={ready[i] ? "true" : "false"}
                    muted
                    loop
                    playsInline
                    preload="none"
                    poster={sc.video.poster}
                    onPlaying={() => setReady((r) => ({ ...r, [i]: true }))}
                  >
                    {sc.video.sources.map((x) => (
                      <source key={x.src} src={x.src} type={x.type} media={x.media} />
                    ))}
                  </video>
                ) : null}
              </div>
            </div>
          ))}
          {props ? <div className={s.heroProps}>{props}</div> : null}
        </div>
        <div className={s.heroScrim} aria-hidden="true" />
        <div className={s.heroWrap}>
          <div className={s.heroCopy}>
            <div className={s.heroTitles}>
              {titles.map((t, i) => (
                <div
                  key={i === 0 ? "h1" : `alt-${i}-${active === i ? cycle : 0}`}
                  className={s.heroTitle}
                  data-active={active === i ? "true" : "false"}
                  aria-hidden={i === 0 ? undefined : "true"}
                >
                  <HeroTitle as={i === 0 ? "h1" : "p"} id={i === 0 ? "hero-title" : undefined} text={t} />
                </div>
              ))}
            </div>
            <p className={s.heroLead}>{lead}</p>
            {actions}
          </div>
        </div>
        {reduce ? null : (
          <IconPill className={s.heroControl} onClick={() => setUserPaused((p) => !p)} aria-label={paused ? labels.play : labels.pause}>
            {paused ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
          </IconPill>
        )}
      </div>
    </Sheet>
  );
}
