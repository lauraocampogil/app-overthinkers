/*
 * GetGo mascot for the web: the same generator as the app (src/components/Mascota.tsx).
 * One seed → one mascot: colours, shape, eyes and rhythm. Usage: <div data-seed="laura"></div>.
 */
(function () {
  const HUES = [258, 272, 292, 318, 238, 222];
  const VB = 200, C = 100, R = 58;

  function hsl(h, s, l) {
    const hh = ((h % 360) + 360) % 360;
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const f = (n) => {
      const k = (n + hh / 30) % 12;
      const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function rng(seed) {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function traits(seed, hueOverride) {
    const r = rng(seed || 'getgo');
    const pick = (xs) => xs[Math.floor(r() * xs.length)];
    const base = pick(HUES) + (r() - 0.5) * 28;
    const hue = hueOverride ?? base;
    return {
      palette: {
        core: hsl(hue, 55, 40), mid: hsl(hue, 70, 58), edge: hsl(hue, 85, 76),
        rim: hsl(hue + 18, 95, 92), a: hsl(hue - 45, 90, 66), b: hsl(hue + 65, 95, 74),
      },
      lobes: pick([5, 6, 6, 7]),
      wobble: 0.032 + r() * 0.02,
      twist: r() * Math.PI * 2,
      eyeGap: 9 + r() * 4,
      eyeW: 11 + r() * 2.5,
      eyeH: 18 + r() * 4,
      speed: 8000 + Math.round(r() * 5000),
      blinkEvery: 2800 + Math.round(r() * 2400),
    };
  }

  function blob(t, lobes, wobble, twist, scale) {
    const n = 30, xs = [], ys = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + wobble * Math.sin(lobes * a + t + twist) + wobble * 0.35 * Math.sin((lobes - 2) * a - 2 * t);
      xs.push(C + Math.cos(a) * R * scale * k);
      ys.push(C + Math.sin(a) * R * scale * k);
    }
    let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
    for (let i = 0; i < n; i++) {
      const p0 = (i - 1 + n) % n, p2 = (i + 1) % n, p3 = (i + 2) % n;
      d += ` C${(xs[i] + (xs[p2] - xs[p0]) / 6).toFixed(1)} ${(ys[i] + (ys[p2] - ys[p0]) / 6).toFixed(1)} ${(xs[p2] - (xs[p3] - xs[i]) / 6).toFixed(1)} ${(ys[p2] - (ys[p3] - ys[i]) / 6).toFixed(1)} ${xs[p2].toFixed(1)} ${ys[p2].toFixed(1)}`;
    }
    return d + ' Z';
  }

  let uid = 0;
  const live = new Set();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function render(el) {
    const seed = el.dataset.seed || 'getgo';
    const hue = el.dataset.hue ? Number(el.dataset.hue) : undefined;
    const tr = traits(seed, hue);
    const p = tr.palette;
    const id = `gm${uid++}`;
    const eyes = el.dataset.mood === 'feliz'
      ? `<g class="eyes"><path d="M${100 - tr.eyeGap / 2 - tr.eyeW * 1.6} 104 q${tr.eyeW * 0.8} -12 ${tr.eyeW * 1.6} 0" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M${100 + tr.eyeGap / 2} 104 q${tr.eyeW * 0.8} -12 ${tr.eyeW * 1.6} 0" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/></g>`
      : `<g class="eyes"><rect x="${100 - tr.eyeGap / 2 - tr.eyeW}" y="${100 - tr.eyeH / 2}" width="${tr.eyeW}" height="${tr.eyeH}" rx="${tr.eyeW / 2}" fill="url(#${id}e)"/><rect x="${100 + tr.eyeGap / 2}" y="${100 - tr.eyeH / 2}" width="${tr.eyeW}" height="${tr.eyeH}" rx="${tr.eyeW / 2}" fill="url(#${id}e)"/></g>`;
    el.innerHTML = `<svg viewBox="28 28 144 144" width="100%" height="100%" role="img" aria-label="Mascota de GetGo" style="overflow:visible">
      <defs>
        <radialGradient id="${id}h" cx="50%" cy="50%" r="50%"><stop offset="0.55" stop-color="${p.mid}" stop-opacity="0.22"/><stop offset="1" stop-color="${p.mid}" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}b" cx="52%" cy="56%" r="54%"><stop offset="0" stop-color="${p.core}"/><stop offset="0.5" stop-color="${p.mid}"/><stop offset="0.82" stop-color="${p.edge}"/><stop offset="0.98" stop-color="${p.rim}"/></radialGradient>
        <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}" stop-opacity="0.75"/><stop offset="0.38" stop-color="${p.a}" stop-opacity="0"/><stop offset="0.7" stop-color="${p.b}" stop-opacity="0"/><stop offset="1" stop-color="${p.b}" stop-opacity="0.55"/></linearGradient>
        <linearGradient id="${id}c" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.b}" stop-opacity="0.5"/><stop offset="0.35" stop-color="${p.b}" stop-opacity="0"/><stop offset="0.75" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0.35"/></linearGradient>
        <radialGradient id="${id}s" cx="36%" cy="28%" r="30%"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}e" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#EEEAFB"/></linearGradient>
      </defs>
      <g class="float">
        <path class="halo" fill="url(#${id}h)"/>
        <path class="b" fill="url(#${id}b)"/><path class="b" fill="url(#${id}a)"/><path class="b" fill="url(#${id}c)"/><path class="b" fill="url(#${id}s)"/>
        ${eyes}
      </g></svg>`;
    const m = {
      el, tr,
      halo: el.querySelector('.halo'),
      bodies: el.querySelectorAll('.b'),
      float: el.querySelector('.float'),
      eyes: el.querySelector('.eyes'),
      start: performance.now() - Math.random() * 4000,
      visible: true,
    };
    draw(m, m.start + 1);
    live.add(m);
    return m;
  }

  function draw(m, now) {
    const el = now - m.start;
    const t = ((el % m.tr.speed) / m.tr.speed) * Math.PI * 2;
    m.halo.setAttribute('d', blob(t * 0.7, m.tr.lobes, m.tr.wobble * 0.8, m.tr.twist + 1, 1.34));
    const d = blob(t, m.tr.lobes, m.tr.wobble, m.tr.twist, 1);
    m.bodies.forEach((b) => b.setAttribute('d', d));
    const bob = Math.sin((el / 2600) * Math.PI) * 4;
    m.float.setAttribute('transform', `translate(0 ${bob.toFixed(2)})`);
    // Blink twice every few seconds, and glance left / right now and then.
    const cycle = el % (m.tr.blinkEvery + 600);
    const blink = cycle > m.tr.blinkEvery && (cycle < m.tr.blinkEvery + 90 || (cycle > m.tr.blinkEvery + 300 && cycle < m.tr.blinkEvery + 380)) ? 0.1 : 1;
    const lookT = (el % 6000) / 6000;
    const look = lookT < 0.3 ? 0 : lookT < 0.45 ? 4 : lookT < 0.7 ? -4 : 0;
    m.eyes.setAttribute('transform', `translate(${look} ${100 * (1 - blink)}) scale(1 ${blink})`);
  }

  function frame(now) {
    live.forEach((m) => {
      if (!m.el.isConnected) live.delete(m);
      else if (m.visible) draw(m, now);
    });
    requestAnimationFrame(frame);
  }

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => entries.forEach((e) => live.forEach((m) => { if (m.el === e.target) m.visible = e.isIntersecting; })))
    : null;

  window.GetGoMascot = {
    traits,
    mount(el) {
      live.forEach((m) => { if (m.el === el) live.delete(m); });
      const m = render(el);
      if (io) io.observe(el);
      return m.tr.palette;
    },
  };
  document.querySelectorAll('[data-seed]').forEach((el) => window.GetGoMascot.mount(el));
  if (!reduced) requestAnimationFrame(frame);
})();
