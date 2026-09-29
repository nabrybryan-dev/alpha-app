// Mide fps con la gráfica real (Chrome headless + D3D11). Uso: node pruebas/medir-fps.mjs
// Necesita playwright; aquí se toma el de ../avater-appkit/node_modules.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/ASUS/dev/avater-appkit/package.json');
const { chromium } = require('playwright');
const casos = [
  { n: 'alpha escritorio 1440x900', url: '', w: 1440, h: 900 },
  { n: 'zanatomy escritorio 1440x900', url: '#zanatomy', w: 1440, h: 900 },
  { n: 'alpha celular 390x844 (dpr 3)', url: '', w: 390, h: 844, movil: true },
];
const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const c of casos) {
  const ctx = await nav.newContext({ viewport: { width: c.w, height: c.h }, deviceScaleFactor: c.movil ? 3 : 1, isMobile: !!c.movil, hasTouch: !!c.movil });
  const p = await ctx.newPage(); const errores = [];
  p.on('pageerror', (e) => errores.push(e.message)); p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  const t0 = Date.now();
  await p.goto('http://127.0.0.1:8769/' + c.url);
  await p.waitForFunction(() => document.getElementById('cargando')?.hidden === true, null, { timeout: 60000 });
  const carga = Date.now() - t0;
  await p.waitForTimeout(12000); // deja que la densidad se asiente
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 5000) requestAnimationFrame(f); else r(n * 1000 / (performance.now() - t)); }; requestAnimationFrame(f); }));
  const info = await p.evaluate(() => ({ r: window.__rendimiento, gpu: (() => { const g = document.createElement('canvas').getContext('webgl'); const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; })(), piezas: performance.getEntriesByType('resource').filter((e) => /piezas\//.test(e.name)).map((e) => e.name.split('/').pop()) }));
  console.log(JSON.stringify({ caso: c.n, carga_ms: carga, fps: Math.round(fps), ...info, errores }));
  await ctx.close();
}
await nav.close();
