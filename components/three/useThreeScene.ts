'use client';

import { useEffect } from 'react';

type Init = (THREE: unknown, env: { reduce: boolean; raf: (cb: FrameRequestCallback) => number; listen: typeof addEventListener }) => void;

// Loads three.js on the client, runs a ported scene, and stops its loops and listeners on unmount.
export function useThreeScene(load: () => Promise<Init>) {
  useEffect(() => {
    let dead = false;
    const listeners: [string, EventListenerOrEventListenerObject][] = [];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const raf = (cb: FrameRequestCallback) => (dead ? 0 : requestAnimationFrame(cb));
    const listen = ((type: string, fn: EventListenerOrEventListenerObject) => {
      listeners.push([type, fn]);
      window.addEventListener(type, fn);
    }) as typeof addEventListener;

    Promise.all([import('three'), load()]).then(([THREE, init]) => {
      if (!dead) init(THREE, { reduce, raf, listen });
    });

    return () => {
      dead = true;
      listeners.forEach(([t, f]) => window.removeEventListener(t, f));
    };
  }, [load]);
}
