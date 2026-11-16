'use client';

import { useThreeScene } from '@/components/three/useThreeScene';

const load = () => import('@/components/three/scenes').then((m) => m.initLadder);

// Isometric rating staircase (WebGL, from the template). Needs the #ladderWrap wrapper from ScaleSection.
export default function LadderCanvas() {
  useThreeScene(load);
  return <canvas id="ladder3d" role="img" aria-label="Isometric staircase of rating grades from AAA down to D, coloured by band" />;
}
