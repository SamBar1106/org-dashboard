import { useEffect, useState } from "react";

/** iPad portrait and landscape collapse the sidebar. A short desktop window keeps it. */
export function isCompactNav(width: number, height: number): boolean {
  return width < 1200 || (height >= 1000 && width <= 1400);
}

export function useCompactNav(): boolean {
  const [compact, setCompact] = useState(() => isCompactNav(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const read = () => setCompact(isCompactNav(window.innerWidth, window.innerHeight));
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return compact;
}

export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return hidden;
}

export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
