'use client';

import { useThreeScene } from './three/useThreeScene';

const load = () => import('./three/scenes').then((m) => m.initHero);

// Brass balance scale on a marble pedestal (WebGL, from the template). Needs the #stage wrapper from Hero.
export default function HeroScale() {
  useThreeScene(load);
  return (
    <canvas
      id="hero3d"
      role="img"
      aria-label="Brass balance scale on a marble pedestal, one pan holding a gold coin, the other a porcelain speech bubble"
    />
  );
}
