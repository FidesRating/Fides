// @ts-nocheck
// Helpers shared by the ported template scenes (see scenes.ts).
export function makeHelpers(THREE) {
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  function rng(seed) {
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }
  function watchVisible(el, cb) {
    new IntersectionObserver((es) => cb(es[0].isIntersecting), { threshold: 0 }).observe(el);
  }
  return { canvasTex, rng, watchVisible };
}
