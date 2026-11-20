"use client";
import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from 'react';

// Pointer-driven scrolling, with no timers or movement left running after exit.
export function useEdgeScroll(row: RefObject<HTMLElement | null>) {
  const frame = useRef<number | null>(null), velocity = useRef(0), lastTime = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; velocity.current = 0; lastTime.current = null;
  }, []);
  const move = useCallback((event: PointerEvent<HTMLElement>) => {
    const element = row.current;
    if (!element || event.pointerType !== 'mouse' || event.buttons || document.hidden) { stop(); return; }
    const rect = element.getBoundingClientRect(), x = event.clientX - rect.left;
    const zone = Math.min(64, element.clientWidth / 4);
    if (!zone || x < 0 || x > element.clientWidth) { stop(); return; }
    const penetration = x < zone ? -(1 - x / zone) : x > element.clientWidth - zone ? 1 - (element.clientWidth - x) / zone : 0;
    if (!penetration) { stop(); return; }
    // Keep the first step above a physical pixel on browsers that round scroll offsets.
    velocity.current = Math.sign(penetration) * (80 + Math.abs(penetration) * 280);
    if (frame.current !== null) return;
    const tick = (time: number) => {
      const current = row.current;
      if (!current || document.hidden || !velocity.current) { stop(); return; }
      const elapsed = lastTime.current === null ? 16 : Math.min(32, time - lastTime.current);
      lastTime.current = time;
      const previous = current.scrollLeft;
      current.scrollLeft = Math.max(0, Math.min(current.scrollWidth - current.clientWidth, previous + velocity.current * elapsed / 1000));
      if (Math.abs(current.scrollLeft - previous) < 0.01) { stop(); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [row, stop]);
  useEffect(() => {
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    return () => { stop(); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); };
  }, [stop]);
  return { move, stop };
}
