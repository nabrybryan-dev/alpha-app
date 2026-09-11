#!/usr/bin/env node
/**
 * LA MISMA RESTA QUE EL TESTIGO, PERO EN UN SOLO ÁRBOL — para separar lo que cambia el
 * código de lo que cambia el arnés.
 *
 * `testigo/partir-el-visor.mjs` (capa de pruebas) da ~1.265 píxeles distintos entre
 * `origin/main` y esta rama, y cierra con `todoCero: false`. Ese testigo levanta DOS
 * checkouts, cada uno con su `npm install` y su Vite, y mide el primero antes que el
 * segundo. Eso son tres diferencias a la vez: el código, el checkout y el turno.
 *
 * Este medidor quita dos de las tres. Un solo worktree, un solo `node_modules`, la misma
 * máquina, y entre las dos capturas SOLO cambia el código:
 *
 *   1. captura con el árbol como está (la rama),
 *   2. `git checkout origin/main -- src`,
 *   3. captura otra vez,
 *   4. devuelve `src` a donde estaba y resta.
 *
 * Vite se levanta y se mata en cada corrida y Chrome también, así que ninguna de las dos
 * hereda módulos ni memoria de la otra.
 *
 * ## La espera que el testigo no hace, y por qué está aquí
 *
 * Las tipografías salen de `fonts.googleapis.com` con `display=swap` (`index.html`): el
 * texto se pinta primero con la de reserva y se cambia cuando llega la buena. Sin esperar
 * a `document.fonts.ready`, dos corridas separadas capturan estados de esa carrera
 * distintos: la primera vez que se corrió esta medida sin la espera, la MISMA rama contra
 * sí misma dio 2.083 píxeles, y con una sola línea revertida dio 76.785 —el título entero
 * cambiaba de anchura—. Con la espera puesta, la misma comparación da cero.
 *
 * ## Cómo se corre
 *
 *   node informes/partir-el-visor-arbol-unico.mjs
 *   node informes/partir-el-visor-arbol-unico.mjs --cebo    ← ver abajo
 *
 * Opciones:
 *   --rutas=src              qué se revierte a `origin/main` entre las dos capturas
 *   --puerto=5199            puerto del Vite de cada corrida
 *   --depuracion=9401        primer puerto de depuración de Chrome (usa ese y el siguiente)
 *   --usuario=u-valentina    usuario del seed con el que se entra
 *   --chrome="C:/…/chrome.exe"
 *   --cebo                   LA PRUEBA DE QUE ESTA MEDIDA SABE DECIR QUE NO: además de
 *                            revertir, le añade a `src/styles/tokens.css` una regla
 *                            imposible de no ver (`nav{outline:4px solid magenta}`) antes
 *                            de la segunda captura. Si con el cebo puesto sigue dando
 *                            cero, la medida no está midiendo y su cero no vale nada.
 *                            Medido el 2026-09-08: sin cebo 0, con cebo 88.044.
 *
 * Sale 0 si la resta da cero (o si el cebo se vio), 1 si no.
 */

import { appendFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  comoExpresion,
  CONGELAR_EN_PAGINA,
  Devtools,
  esperar,
  mascaraDeCambio,
  objetivoDePagina,
} from '../testigo/comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// El mismo 390×844 @2 del testigo de la capa de pruebas: para poder comparar los dos
// números sin traducir de un tamaño a otro.
const ANCHO = 390
const ALTO = 844
const ESCALA = 2

function leerArgumentos(argv) {
  const o = {
    rutas: ['src'],
    puerto: 5199,
    depuracion: 9401,
    usuario: 'u-valentina',
    chrome: undefined,
    cebo: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, valor] = bruto.replace(/^--/, '').split('=')
    if (nombre === 'rutas') o.rutas = valor.split(',').filter(Boolean)
    else if (nombre === 'puerto') o.puerto = Number(valor)
    else if (nombre === 'depuracion') o.depuracion = Number(valor)
    else if (nombre === 'usuario') o.usuario = valor
    else if (nombre === 'chrome') o.chrome = valor
    else if (nombre === 'cebo') o.cebo = true
  }
  return o
}

// ------------------------------------------------------- lo que corre en la página

const ENTRAR_COMO = (usuario) => {
  localStorage.setItem('alpha-usuario', usuario)
  return localStorage.getItem('alpha-usuario')
}
const APP_MONTADA = () => (document.getElementById('root')?.children.length ?? 0) > 0
const SALON_MONTADO = () => !!document.querySelector('[data-testigo="sujeto"], [data-hueco="sinPatron"]')
const OCULTAR_RELOJES = () => {
  const RELOJ = /^\d{1,2}:\d{2}$/
  let n = 0
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0) continue
    if (RELOJ.test((el.textContent || '').trim())) {
      el.style.visibility = 'hidden'
      n++
    }
  }
  return n
}

// ------------------------------------------------------------------ procesos

function git(...args) {
  const r = spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} falló:\n${r.stderr || r.stdout}`)
}

/**
 * Vite con un `envDir` que no existe: sin `.env` la app entra en modo demo y el salón lo
 * pinta el seed, que es lo único que se puede comparar entre dos corridas.
 */
async function arrancarVite(puerto) {
  const codigo =
    `import { createServer } from 'vite'; ` +
    `const s = await createServer({ envDir: ${JSON.stringify(join(RAIZ, 'no-hay-env'))}, ` +
    `server: { port: ${puerto}, host: '127.0.0.1' } }); await s.listen();`
  const proceso = spawn(process.execPath, ['--input-type=module', '-e', codigo], { cwd: RAIZ, stdio: 'ignore' })
  const limite = Date.now() + 60_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`vite se cerró solo (${proceso.exitCode})`)
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/`)
      if (r.ok) return proceso
    } catch {
      /* aún no abre */
    }
    await esperar(300)
  }
  proceso.kill()
  throw new Error(`vite no respondió en :${puerto}`)
}

function detener(proceso) {
  if (!proceso || proceso.exitCode !== null) return
  proceso.kill()
  if (process.platform === 'win32' && proceso.pid) {
    spawnSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

async function esperarQue(dt, fnPagina, limiteMs, pasoMs = 400) {
  const t0 = Date.now()
  while (Date.now() - t0 < limiteMs) {
    if (await dt.evaluar(comoExpresion(fnPagina))) return true
    await esperar(pasoMs)
  }
  return false
}

// ------------------------------------------------------------------- corrida

async function corrida(opciones, puertoDepuracion) {
  const vite = await arrancarVite(opciones.puerto)
  const { proceso: chrome } = await arrancarChrome({
    chrome: opciones.chrome,
    puerto: puertoDepuracion,
    ancho: ANCHO,
    alto: ALTO,
  })
  let dt = null
  let idObjetivo = null
  try {
    const objetivo = await objetivoDePagina(puertoDepuracion)
    idObjetivo = objetivo.id
    dt = await Devtools.conectar(objetivo.webSocketDebuggerUrl)
    await dt.pedir('Page.enable')
    await dt.pedir('Runtime.enable')
    await dt.pedir('Emulation.setDeviceMetricsOverride', {
      width: ANCHO,
      height: ALTO,
      deviceScaleFactor: ESCALA,
      mobile: true,
      screenWidth: ANCHO,
      screenHeight: ALTO,
    })
    await dt.pedir('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    // Sin esto el sujeto se mueve solo y cambia entero de una captura a otra.
    await dt.pedir('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await dt.pedir('Page.bringToFront')

    const raiz = `http://127.0.0.1:${opciones.puerto}`
    await dt.pedir('Page.navigate', { url: raiz })
    await esperarQue(dt, APP_MONTADA, 45_000)
    await dt.evaluar(comoExpresion(ENTRAR_COMO, opciones.usuario))
    await dt.pedir('Page.navigate', { url: `${raiz}/entrenar` })
    const listo = await esperarQue(dt, SALON_MONTADO, 45_000)
    if (!listo) throw new Error('el salón no montó en 45 s')
    // La espera que separa el código del arnés — ver la nota grande de arriba.
    await dt.evaluar('document.fonts.ready.then(() => document.fonts.status)')
    await esperar(900)
    await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
    await dt.evaluar(comoExpresion(OCULTAR_RELOJES))
    return await dt.captura()
  } finally {
    if (dt) dt.cerrar()
    if (idObjetivo) {
      await fetch(`http://127.0.0.1:${puertoDepuracion}/json/close/${idObjetivo}`).catch(() => {})
      await esperar(400)
    }
    detener(chrome)
    await esperar(500)
    detener(vite)
    await esperar(300)
  }
}

// ---------------------------------------------------------------- principal

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(`\n  árbol único: la rama  vs  origin/main en ${opciones.rutas.join(' ')}\n`)

  console.log('  [rama] capturando ...')
  const rama = await corrida(opciones, opciones.depuracion)

  console.log(`  revirtiendo ${opciones.rutas.join(' ')} a origin/main ...`)
  git('checkout', 'origin/main', '--', ...opciones.rutas)
  if (opciones.cebo) {
    appendFileSync(
      join(RAIZ, 'src/styles/tokens.css'),
      '\nnav { outline: 4px solid magenta !important; }\n',
    )
    console.log('  CEBO puesto en src/styles/tokens.css')
  }

  let base
  try {
    console.log('  [main] capturando ...')
    base = await corrida(opciones, opciones.depuracion + 1)
  } finally {
    git('checkout', 'HEAD', '--', ...opciones.rutas)
    git('checkout', 'HEAD', '--', 'src/styles/tokens.css')
    git('reset', '--quiet', 'HEAD', '--', ...opciones.rutas, 'src/styles/tokens.css')
  }

  const { cuenta } = mascaraDeCambio(rama, base)
  const total = rama.ancho * rama.alto
  console.log(`\n  píxeles distintos: ${cuenta} de ${total}`)
  if (opciones.cebo) {
    console.log(cuenta > 0 ? '  el cebo se vio: la medida sabe decir que no' : '  EL CEBO NO SE VIO: esta medida no mide')
    return cuenta > 0 ? 0 : 1
  }
  console.log(cuenta === 0 ? '  la resta da cero' : '  hay píxeles distintos')
  return cuenta === 0 ? 0 : 1
}

principal().then(
  (codigo) => process.exit(codigo),
  (error) => {
    console.error(`\n  falló: ${error.message}`)
    process.exit(1)
  },
)
