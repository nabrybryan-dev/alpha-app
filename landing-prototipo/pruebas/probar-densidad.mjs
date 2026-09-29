// Comprueba el 404 y que la densidad baja cuando los fps caen (se simula un cuadro caro).
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/ASUS/dev/avater-appkit/package.json');
const { chromium } = require('playwright');
const nav = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await nav.newPage({ viewport: { width: 1440, height: 900 } });
const fallos = []; p.on('response', (r) => r.status() >= 400 && fallos.push(r.status() + ' ' + r.url()));
await p.goto('http://127.0.0.1:8769/');
await p.waitForFunction(() => document.getElementById('cargando')?.hidden === true, null, { timeout: 60000 });
await p.waitForTimeout(3000);
const antes = await p.evaluate(() => window.__rendimiento);
await p.evaluate(() => { const q = () => { const t = performance.now(); while (performance.now() - t < 26); requestAnimationFrame(q); }; requestAnimationFrame(q); });
await p.waitForTimeout(8000);
const lento = await p.evaluate(() => window.__rendimiento);
console.log(JSON.stringify({ fallos, antes, con_cuadro_caro: lento }));
await nav.close();
