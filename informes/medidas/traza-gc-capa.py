import json, sys, time, datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

SAL = Path(sys.argv[1]); SAL.mkdir(parents=True, exist_ok=True)
N = int(sys.argv[2])
ORIGEN = 'http://127.0.0.1:5198/scripts/medir-fotograma-salon.mjs'
JS = """async (capa) => {
  const m = await import('/scripts/medir-fotograma-salon.mjs')
  if (!capa) return await m.medir({ capa: false })
  const c = await import('/scripts/capa-momentos-medida.mjs')
  await c.preparar()
  return await m.medir({ capa: true, extras: c.extras })
}"""
CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'disabled-by-default-v8.gc']
orden = []
for i in range(1, N+1):
    orden += [(f'capa-{i}', True), (f'hoy-{i}', False)]
with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome', headless=False, args=['--window-size=520,900'])
    for nombre, capa in orden:
        ctx = nav.new_context(viewport={'width': 405, 'height': 720})
        pag = ctx.new_page(); pag.bring_to_front(); pag.goto(ORIGEN)
        nav.start_tracing(page=pag, categories=CATS)
        t0 = time.time()
        try:
            r = pag.evaluate(JS, capa)
        except Exception as e:
            r = {'error': str(e)[:300]}
        data = nav.stop_tracing()
        (SAL / f'{nombre}.trace.json').write_bytes(data)
        (SAL / f'{nombre}.json').write_text(json.dumps(r), encoding='utf-8')
        print(nombre, 'cpu', r.get('fotogramaCPU', {}).get('mediana'), r.get('fotogramaCPU', {}).get('p90'), 'traza', len(data)//1024, 'KB', flush=True)
        ctx.close(); time.sleep(2)
    nav.close()
