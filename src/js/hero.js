/**
 * Fundo animado do hero: campo de fluxo de partículas em Canvas 2D.
 *
 * Cada partícula segue um campo vetorial que muda lentamente com o tempo e
 * deixa um rastro; o cursor cria um redemoinho que empurra as partículas.
 * A animação pausa fora da viewport e com a aba oculta. Com
 * prefers-reduced-motion, desenha um único quadro estático.
 */
const WHITE = 'rgba(255, 255, 255, 0.42)';
const ACCENT = 'rgba(139, 92, 246, 0.9)';
const FADE = 'rgba(0, 0, 0, 0.08)';
const POINTER_RADIUS = 190;

export function initHero(canvas, { reducedMotion }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const hero = canvas.closest('[data-hero]') || canvas.parentElement;

  let width = 0;
  let height = 0;
  let particles = [];
  let frame = 0;
  let time = Math.random() * 100;
  let inView = true;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, strength: 0, target: 0 };

  // Soma de senos: barato, suave e sem dependências de bibliotecas de ruído.
  const angleAt = (x, y, t) => {
    const s = 0.0018;
    return (
      (Math.sin(x * s + t * 0.55) + Math.cos(y * s * 1.35 - t * 0.4) + Math.sin((x + y) * s * 0.6 + t * 0.2)) *
      Math.PI *
      0.55
    );
  };

  const spawn = (p = {}) => {
    p.x = Math.random() * width;
    p.y = Math.random() * height;
    p.px = p.x;
    p.py = p.y;
    p.life = 80 + Math.random() * 260;
    p.speed = 0.5 + Math.random() * 1.5;
    p.accent = Math.random() < 0.16;
    return p;
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const density = width < 700 ? 1500 : 1100;
    const count = Math.min(1500, Math.round((width * height) / density));
    particles = Array.from({ length: count }, () => spawn());

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    if (reducedMotion.matches) drawStatic();
  }

  function step() {
    time += 0.006;
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    pointer.strength += (pointer.target - pointer.strength) * 0.06;

    ctx.fillStyle = FADE;
    ctx.fillRect(0, 0, width, height);

    const white = new Path2D();
    const accent = new Path2D();
    const r2 = POINTER_RADIUS * POINTER_RADIUS;

    for (const p of particles) {
      const angle = angleAt(p.x, p.y, time);
      let vx = Math.cos(angle) * p.speed;
      let vy = Math.sin(angle) * p.speed;

      if (pointer.strength > 0.01) {
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) || 1;
          const force = (1 - d / POINTER_RADIUS) * pointer.strength;
          // Repulsão radial + componente tangencial = redemoinho.
          vx += ((dx / d) * 2.6 - (dy / d) * 3.2) * force;
          vy += ((dy / d) * 2.6 + (dx / d) * 3.2) * force;
        }
      }

      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy;
      p.life -= 1;

      if (p.life < 0 || p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        spawn(p);
        continue;
      }
      const path = p.accent ? accent : white;
      path.moveTo(p.px, p.py);
      path.lineTo(p.x, p.y);
    }

    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = WHITE;
    ctx.stroke(white);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = ACCENT;
    ctx.stroke(accent);
  }

  // Quadro único para quem prefere menos movimento: linhas de fluxo estáticas.
  function drawStatic() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    const white = new Path2D();
    const accent = new Path2D();
    const lines = Math.min(500, particles.length);
    for (let i = 0; i < lines; i++) {
      const p = particles[i];
      const path = p.accent ? accent : white;
      let { x, y } = p;
      path.moveTo(x, y);
      for (let s = 0; s < 36; s++) {
        const a = angleAt(x, y, time);
        x += Math.cos(a) * 3;
        y += Math.sin(a) * 3;
        path.lineTo(x, y);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.stroke(white);
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.55)';
    ctx.stroke(accent);
  }

  const loop = () => {
    step();
    frame = requestAnimationFrame(loop);
  };

  const shouldRun = () => inView && !document.hidden && !reducedMotion.matches;

  function sync() {
    if (shouldRun()) {
      if (!frame) frame = requestAnimationFrame(loop);
    } else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  // Interação com o cursor (e com o dedo, durante o arraste).
  hero.addEventListener(
    'pointermove',
    (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = event.clientX - rect.left;
      pointer.ty = event.clientY - rect.top;
      if (pointer.target === 0) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      pointer.target = 1;
    },
    { passive: true }
  );
  hero.addEventListener('pointerleave', () => {
    pointer.target = 0;
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches) drawStatic();
    sync();
  });

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
  else window.addEventListener('resize', onResize);

  resize();
  sync();
}
