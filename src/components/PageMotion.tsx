"use client";

import { useEffect } from "react";

/** Progressive enhancement: server-rendered content always starts visible. */
export function PageMotion() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    let observer: IntersectionObserver | undefined;
    const setup = () => {
      observer?.disconnect();
      elements.forEach((element) => element.classList.remove("reveal-waiting"));
      if (query.matches) return;
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.remove("reveal-waiting");
              observer?.unobserve(entry.target);
            }
          }),
        { threshold: 0.08 },
      );
      elements.forEach((element) => {
        if (element.getBoundingClientRect().top > window.innerHeight)
          element.classList.add("reveal-waiting");
        observer?.observe(element);
      });
    };
    setup();
    query.addEventListener("change", setup);
    return () => {
      observer?.disconnect();
      query.removeEventListener("change", setup);
      elements.forEach((element) => element.classList.remove("reveal-waiting"));
    };
  }, []);
  return null;
}
