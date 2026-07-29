/* Field Terminal FX — glyph rain background + typewriter terminal effects.
   Pure decoration: never touches game state or socket logic. */
(function () {
  const AMBER = '240,180,41';
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#*+=-_/\\<>[]{}|:.·▮▯';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Canvas glyph rain ---------- */
  function startRain(canvas) {
    const ctx = canvas.getContext('2d');
    let cols = [], size = 16, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.ceil(w / size);
      cols = Array.from({ length: n }, (_, i) => ({
        y: Math.random() * h,
        speed: 26 + Math.random() * 70,
        len: 6 + ((Math.random() * 16) | 0),
        chars: Array.from({ length: 26 }, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]),
        bright: Math.random() < 0.22,
        x: i * size + 3
      }));
    }

    let last = performance.now(), churn = 0;
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.font = size - 3 + "px 'Share Tech Mono', monospace";
      ctx.textBaseline = 'top';

      churn += dt;
      const swap = churn > 0.09;
      if (swap) churn = 0;

      for (const c of cols) {
        c.y += c.speed * dt;
        if (c.y - c.len * size > h) {
          c.y = -Math.random() * h * 0.5;
          c.speed = 26 + Math.random() * 70;
          c.bright = Math.random() < 0.22;
        }
        if (swap) c.chars[(Math.random() * c.chars.length) | 0] = GLYPHS[(Math.random() * GLYPHS.length) | 0];

        for (let k = 0; k < c.len; k++) {
          const y = c.y - k * size;
          if (y < -size || y > h) continue;
          const fade = 1 - k / c.len;
          const a = (c.bright ? 0.5 : 0.26) * fade * fade;
          ctx.fillStyle = 'rgba(' + AMBER + ',' + a.toFixed(3) + ')';
          ctx.fillText(c.chars[(k + ((c.y / size) | 0)) % c.chars.length], c.x, y);
        }
        // head glyph, slightly hotter
        if (c.y < h && c.y > -size) {
          ctx.fillStyle = 'rgba(255,222,150,' + (c.bright ? 0.62 : 0.34) + ')';
          ctx.fillText(c.chars[((c.y / size) | 0) % c.chars.length], c.x, c.y);
        }
      }
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (reduce) {
      // one static pass, no motion
      ctx.font = size - 3 + "px 'Share Tech Mono', monospace";
      ctx.textBaseline = 'top';
      for (const c of cols) {
        ctx.fillStyle = 'rgba(' + AMBER + ',0.14)';
        ctx.fillText(c.chars[0], c.x, c.y);
      }
      return;
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 2. Typewriter ---------- */
  function typeInto(el, text, cps, done) {
    if (reduce) { el.textContent = text; done && done(); return; }
    el.textContent = '';
    let i = 0, acc = 0, last = performance.now();
    (function step(now) {
      acc += (now - last) / 1000;
      last = now;
      const target = Math.min(text.length, Math.floor(acc * cps));
      if (target > i) { i = target; el.textContent = text.slice(0, i); }
      if (i < text.length) requestAnimationFrame(step);
      else done && done();
    })(last);
  }

  /* ---------- 3. Boot log stream ---------- */
  const BOOT = [
    'link established · 24ms · secure p2p',
    'loading module registry ......... ok',
    'wire harness schematics ......... ok',
    'keypad glyph table .............. ok',
    'simon protocol timings .......... ok',
    'defusal manual rev 2.4 ......... ok',
    'awaiting operator callsign'
  ];

  function runBootLog(el) {
    let n = 0;
    function next() {
      const line = document.createElement('div');
      line.className = 'boot-line';
      el.appendChild(line);
      while (el.children.length > 4) el.removeChild(el.firstChild);
      const text = '> ' + BOOT[n % BOOT.length];
      typeInto(line, text, 42, () => {
        n++;
        setTimeout(next, n % BOOT.length === 0 ? 2600 : 520);
      });
    }
    next();
  }

  /* ---------- boot ---------- */
  function init() {
    document.querySelectorAll('canvas[data-glyph-rain]').forEach(startRain);

    const pre = document.querySelector('[data-typewriter]');
    if (pre) {
      const text = pre.getAttribute('data-typewriter');
      typeInto(pre, text, 90);
    }

    const log = document.getElementById('boot-log');
    if (log) runBootLog(log);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
