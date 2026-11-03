import json, subprocess, sys, time, random, statistics as st, datetime
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
def ps(cmd):
    return subprocess.run(['powershell','-NoProfile','-Command',cmd],capture_output=True,text=True).stdout.strip()
def carga():
    o = ps('(Get-CimInstance Win32_Processor).LoadPercentage'); return int(o) if o.isdigit() else -1
def subir_prioridad(nav_pids_antes):
    # solo los chrome.exe nacidos DESPUES de lanzar el nuestro y con perfil de Playwright en la linea de comandos
    ps("Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ? { $_.CommandLine -match 'playwright' } | % { try { (Get-Process -Id $_.ProcessId).PriorityClass = 'High' } catch {} }")
def prioridades():
    return ps("(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | ? { $_.CommandLine -match 'playwright' } | % { (Get-Process -Id $_.ProcessId).PriorityClass } | Sort -Unique) -join ','")

orden = []
for i in range(1, N+1):
    orden += [(f'capa-{i}', True), (f'hoy-{i}', False)]
log = []
with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome', headless=False, args=['--window-size=520,900'])
    for nombre, capa in orden:
        ctx = nav.new_context(viewport={'width': 405, 'height': 720})
        pag = ctx.new_page(); pag.bring_to_front(); pag.goto(ORIGEN)
        subir_prioridad(None)
        pr = prioridades(); c0 = carga(); hora = datetime.datetime.now().strftime('%H:%M:%S')
        try:
            r = pag.evaluate(JS, capa)
            r.update(cargaCPUantes=c0, hora=hora, prioridadChrome=pr)
            (SAL / f'{nombre}.json').write_text(json.dumps(r), encoding='utf-8')
            print(nombre, hora, 'prio', pr, 'oculta', r['pasosConPestanaOculta'], 'foto', r['fotogramas'], 'vert', r['verticesDeLaCapa'],
                  'cpu', r['fotogramaCPU']['mediana'], 'carga', c0, flush=True)
        except Exception as e:
            print(nombre, 'ERR', str(e)[:300], flush=True)
        ctx.close(); time.sleep(2)
    nav.close()
