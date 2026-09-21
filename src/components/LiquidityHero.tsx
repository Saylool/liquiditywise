"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { InterfaceCopy } from "../lib/i18n/interface";
import { ArrowIcon } from "./BrandMark";

const STATIC_GATES = [
  "(max-width: 720px)",
  "(orientation: portrait) and (max-width: 1024px)",
  "(orientation: portrait) and (pointer: coarse)",
  "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
  "(prefers-reduced-motion: reduce)",
];

export function LiquidityHero({
  copy,
  videoEnabled = false,
}: {
  copy: InterfaceCopy;
  videoEnabled?: boolean;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const video = videoRef.current;
    if (!root || !video || !videoEnabled) return;
    const media = STATIC_GATES.map((query) => matchMedia(query));
    let frame = 0;
    let shown = 0;
    let target = 0;
    let lastTime = 0;
    let pending: number | null = null;
    let busy = false;
    let active = false;
    let visible = true;
    let disposed = false;
    let loaded = false;
    let failed = false;
    let objectUrl: string | undefined;
    let controller: AbortController | undefined;
    let lastProgress = -1;
    let lastChapter = false;

    const seek = (time: number) => {
      if (!Number.isFinite(video.duration) || video.readyState < 2) return;
      const next = Math.min(time, Math.max(0, video.duration - 0.04));
      if (busy || video.seeking) {
        pending = next;
        return;
      }
      if (Math.abs(video.currentTime - next) < 0.025) return;
      busy = true;
      video.currentTime = next;
    };
    const onSeek = () => {
      busy = false;
      if (pending !== null) {
        const next = pending;
        pending = null;
        seek(next);
      }
    };
    const tick = (now: number) => {
      frame = 0;
      if (!active || !visible || document.hidden) {
        lastTime = 0;
        return;
      }
      const dt = Math.min(80, now - (lastTime || now - 16.667));
      lastTime = now;
      shown += (target - shown) * (1 - Math.pow(0.84, dt / 16.667));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      if (Math.abs(shown - lastProgress) > 0.001) {
        root.style.setProperty("--journey", shown.toFixed(3));
        lastProgress = shown;
      }
      const settled = shown >= 0.52;
      if (settled !== lastChapter) {
        root.classList.toggle("hero-settled", settled);
        lastChapter = settled;
      }
      seek(shown * video.duration);
      if (shown !== target) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };
    const update = () => {
      const rect = root.getBoundingClientRect();
      target = Math.max(
        0,
        Math.min(
          1,
          -rect.top / Math.max(1, root.offsetHeight - window.innerHeight),
        ),
      );
      if (!frame && active && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    const fail = () => {
      failed = true;
      active = false;
      busy = false;
      pending = null;
      cancelAnimationFrame(frame);
      frame = 0;
      root.classList.remove("hero-scrub", "video-ready", "hero-settled");
      root.style.removeProperty("--journey");
    };
    const load = async () => {
      if (loaded || controller || failed) return;
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const response = await fetch("/images/liquidity-scrub.mp4", {
          signal: controller.signal,
          priority: "low",
        });
        if (!response.ok) throw new Error("Hero unavailable");
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
        loaded = true;
      } catch {
        if (!disposed) fail();
      } finally {
        clearTimeout(timer);
      }
    };
    const ready = () => {
      if (!active) return;
      root.classList.add("video-ready");
      update();
      seek(target * video.duration);
    };
    const mode = () => {
      active = !failed && !media.some((query) => query.matches);
      root.classList.toggle("hero-scrub", active);
      if (active) {
        void load();
        if (loaded && video.readyState >= 2) ready();
        update();
      } else {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        root.classList.remove("video-ready", "hero-settled");
        root.style.removeProperty("--journey");
        shown = 0;
        lastProgress = -1;
        lastChapter = false;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) update();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      }
    });
    observer.observe(root);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("canplay", ready);
    video.addEventListener("error", fail);
    media.forEach((query) => query.addEventListener("change", mode));
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    mode();
    return () => {
      disposed = true;
      controller?.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.forEach((query) => query.removeEventListener("change", mode));
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", fail);
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      root.classList.remove("hero-scrub", "video-ready", "hero-settled");
      root.style.removeProperty("--journey");
    };
  }, [videoEnabled]);

  return (
    <section ref={rootRef} className="liquidity-hero">
      <div className="hero-stage">
        <div
          className="hero-art"
          aria-hidden="true"
          style={{ position: "absolute" }}
        >
          <Image
            src="/images/liquidity-hero.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
          <video
            ref={videoRef}
            muted
            playsInline
            preload="none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
        <div className="hero-shade" />
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span />
            {copy.eyebrow}
          </p>
          <h1>
            {copy.headline}
            <br />
            <span>{copy.headlineAccent}</span>
          </h1>
          <p className="hero-intro">{copy.intro}</p>
          <div className="hero-actions">
            <a href="#explore" className="button-primary">
              {copy.pools}
              <ArrowIcon />
            </a>
            <a href="#method" className="hero-secondary">
              {copy.how}
              <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="hero-proof">
            <span>
              <svg
                width="14"
                height="17"
                viewBox="0 0 14 20"
                aria-hidden="true"
              >
                <path
                  d="m7 0 7 10-7 4-7-4Zm0 15 7-4-7 9-7-9Z"
                  fill="currentColor"
                />
              </svg>
              {copy.chain}
            </span>
            <span>Uniswap v3 + v4</span>
          </div>
        </div>
        <div className="hero-bottom">
          <span className="hero-index">01 / 03</span>
          <span>{copy.readOnly}</span>
          <a href="#explore" className="scroll-cue" aria-label={copy.pools}>
            ↓
          </a>
        </div>
        <div className="hero-endline" aria-hidden="true">
          <span>{copy.closingTitle}</span>
        </div>
      </div>
    </section>
  );
}
