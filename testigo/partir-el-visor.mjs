#!/usr/bin/env node
/**
 * TESTIGO DE QUE PARTIR EL VISOR EN MÓDULOS NO LE CAMBIÓ EL COMPORTAMIENTO A NADIE.
 *
 * La rama `capa/interfaz` parte el visor del salón en módulos y carga el atlas por
 * pieza. Un refactor de ese tamaño promete una cosa: que nada de lo que se ve cambie. Lo
 * único que puede comprobar esa promesa es mirar los mismos píxeles en las dos ramas y
 * restar — no leer el código y opinar si «parece» igual.
 *
 * Así que este testigo hace algo que ningún otro testigo de este repo hacía hasta hoy:
 * levanta DOS copias completas de la app —una por rama, cada una en su propio
 * `git worktree` desechable— y les hace exactamente la misma sesión de gestos a las dos,
 * capturando en los mismos cuatro momentos. Si `capa/interfaz` cumplió su promesa, restar
 * una captura de la otra da cero píxeles distintos en los cuatro. Si no da cero, este
 * script no decide si eso es grave: lo mide, guarda la máscara y las dos capturas, y las
 * nombra en el JSON para que alguien las mire.
 *
 * =============================================================================
 * CÓMO SE CORRE
 * =============================================================================
 *
 *   node testigo/partir-el-visor.mjs
 *
 * No hace falta tener nada arrancado antes: el propio script hace `git fetch`, crea los
 * dos worktrees, instala sus dependencias, arranca su propio Vite (uno detrás de otro, en
 * el mismo puerto: las dos ramas nunca corren a la vez) y su propio Chrome, y limpia todo
 * al terminar.
 *
 * Opciones:
 *   --ref-base=origin/main              qué rama es «antes»
 *   --ref-nueva=origin/capa/interfaz    qué rama es «después»
 *   --puerto=5182                       puerto del Vite de cada checkout (uno cada vez)
 *   --depuracion=9352                   puerto de depuración de Chrome
 *   --chrome="C:/ruta/chrome.exe"       binario, si no está donde se busca
 *   --candidatos=u-valentina            usuarios de demo que se prueban, en orden, hasta
 *                                       encontrar uno con sujeto Y con dos o más ejercicios
 *   --salida=informes/testigo-partir-el-visor.json
 *   --fotos=informes/partir-el-visor    dónde quedan las capturas y las máscaras
 *   --limite-listo=45000                cuánto se espera, sondeando, a que el salón monte
 *                                       algo tras navegar — ver la nota de más abajo sobre
 *                                       por qué la primera vez de cada checkout es lenta
 *   --asiento=900                       milisegundos de margen FIJO, además del sondeo de
 *                                       arriba, para que la cámara y las animaciones
 *                                       asienten antes de congelar y capturar
 *   --conservar-worktrees               no borra los dos checkouts al terminar (para mirarlos)
 *   --sin-informe                       mide e imprime, no escribe el acta
 *   --prueba-ciega                      LA PRUEBA DE QUE ESTE TESTIGO SABE DECIR QUE NO:
 *                                       compara `--ref-base` CONSIGO MISMA (ignora
 *                                       `--ref-nueva`) y le pinta un cebo enorme e
 *                                       imposible de no ver solo al checkout «nueva»,
 *                                       justo antes de cada una de las cuatro capturas.
 *                                       Si el testigo no sabe ver ese cebo —los cuatro
 *                                       `pixelesCambiados` en cero, que es exactamente lo
 *                                       que este mismo script da cuando SÍ son iguales—
 *                                       no vale para nada: daría cero siempre. Sale 0 si
 *                                       lo vio en las cuatro, 1 si no.
 *
 * =============================================================================
 * QUÉ SE TOCA, Y EN QUÉ ORDEN — cuatro escenarios, cada uno con su propia navegación
 * =============================================================================
 *
 * Cada escenario navega DESDE CERO a `/entrenar» (nunca se encadena un gesto sobre el
 * resultado del anterior): así un escenario no hereda un estado que el anterior dejó a
 * medias, y los cuatro se pueden comparar entre ramas sin preguntarse qué pasó antes.
 *
 *   1. `patronA` — la sala tal cual carga, con el primer ejercicio de la sesión.
 *   2. `patronB` — se toca el segundo punto de `PuntosDeEjercicio` (la tira de puntos) y
 *      se captura con el ejercicio ya cambiado. Cambiar de ejercicio ya NO es un gesto
 *      sobre el cuerpo desde el 2026-09-06 (`PuntosDeEjercicio.tsx`), así que se toca la
 *      tira, no la sala.
 *   3 y 4. `capaIntermedia` y `capaProfunda` — el mismo toque sostenido sobre el cuerpo
 *      (`Input.dispatchTouchEvent`, sin soltar), capturado en dos momentos: a los 900 ms
 *      debería ir por la segunda capa y a los 1800 ms por la última, contando desde que
 *      `hundirEnElCuerpo.ts` dice que hace falta esperar 320 ms para el primer escalón y
 *      450 ms por cada uno de los siguientes. Un solo dedo bajado y sostenido: soltar y
 *      volver a bajar cambiaría desde qué capa se cuenta, y entonces las dos capturas ya
 *      no dirían lo mismo en las dos ramas si el tiempo de asiento no fuera IDÉNTICO.
 *
 * Antes de los dos últimos hace falta saber DÓNDE está el cuerpo en la pantalla —lo
 * calcula la cámara del visor en cada fotograma y no se puede leer desde fuera—, así que
 * hay una navegación previa, desechable, que prueba una rejilla de puntos y se queda con
 * el primero que hace aparecer `data-hundiendo` en `[data-testigo="sujeto"]`. Esa
 * navegación de calibrado no deja ninguna captura: solo encuentra el punto y se descarta.
 *
 * =============================================================================
 * POR QUÉ LA PRIMERA NAVEGACIÓN DE CADA CHECKOUT SE ESPERA SONDEANDO, NO CON UN NÚMERO FIJO
 * =============================================================================
 *
 * Este repo compila con `esbuild-wasm` y `@rollup/wasm-node` en vez de sus versiones
 * nativas —el WDAC de la máquina bloquea binarios nativos de npm, ver `CLAUDE.md` §1—, y
 * el wasm es bastante más lento pre-empaquetando dependencias. En un checkout con
 * `node_modules` recién instalado, Vite no ha hecho ese pre-empaquetado todavía: lo hace
 * en la PRIMERA petición de verdad, y ahí un número fijo de milisegundos es una apuesta —
 * la primera vez que se escribió este script, 2.200 ms bastaban en el worktree ya usado
 * de la sesión y NO bastaron en un worktree recién creado por este mismo script, que dio
 * `ok:false` con la sala todavía sin sujeto. Por eso `entrarComo` no espera un número:
 * sondea `[data-testigo="sujeto"]` o `[data-hueco="sinPatron"]` cada 400 ms hasta que
 * aparezca uno de los dos (con `--limite-listo` de plazo), y SOLO ENTONCES espera el
 * margen fijo y corto de `--asiento` para que la cámara asiente. Las navegaciones
 * siguientes, con el pre-empaquetado ya en caché, resuelven el sondeo casi al primer
 * intento.
 *
 * =============================================================================
 * POR QUÉ SE EMULA «PREFERS-REDUCED-MOTION», SE CONGELA Y SE TAPA EL RELOJ
 * =============================================================================
 *
 * Dos ramas corriendo en dos procesos de Chrome separados, arrancados en momentos reales
 * distintos, nunca van a tener el mismo reloj de pared en el mismo milisegundo exacto — y
 * el salón trae uno (`SalonEntrenar.tsx`, el modo «sesión» cuenta desde que se abre). Eso
 * no es una diferencia de comportamiento: es ruido de este arnés, no del código.
 *
 * Hay una segunda fuente de ruido, más grande, y la primera corrida de este script contra
 * `origin/main` comparado consigo mismo la destapó: `VisorPatron.tsx` reproduce la
 * repetición SOLA —`reproduciendo`, avanzando `fase` con el reloj desde 0— y dos Chrome
 * arrancados por separado jamás capturan la misma fase de esa animación. Sin corregirlo,
 * una rama daba 224.382 píxeles distintos contra SÍ MISMA. Por eso, antes de navegar, se
 * emula `prefers-reduced-motion: reduce` (`Emulation.setEmulatedMedia`, la misma que ya
 * usa `salon-visible.mjs`): en el visor eso deja `reproduciendo` en falso y la fase
 * clavada en 0, así que el sujeto queda estático en vez de a mitad de un gesto que nadie
 * pidió.
 *
 * Y por si algo más se mueve solo, justo antes de cada captura se congelan además las
 * animaciones y transiciones CSS (`CONGELAR_EN_PAGINA`, de `comun.mjs`) y se oculta —con
 * `visibility:hidden`, sin mover nada de sitio— cualquier nodo cuyo texto propio sea un
 * reloj (`MM:SS`). Con las tres cosas puestas, lo que quede distinto entre las dos ramas
 * es del visor, no del arnés.
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  bajarDedo,
  codificarPngGris,
  codificarPngRgb,
  comoExpresion,
  CONGELAR_EN_PAGINA,
  Devtools,
  esperar,
  mascaraDeCambio,
  objetivoDePagina,
  soltarDedo,
  tocar,
} from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 390×844 @2: el tamaño que pide el encargo — un iPhone 12/13/14 en vertical, capturado
// al doble de densidad. No es el 414×736 de los otros testigos del salón a propósito:
// aquí lo que importa es comparar dos ramas ENTRE SÍ, no un tamaño en concreto.
const ANCHO = 390
const ALTO = 844
const ESCALA = 2

// Ecos de `hundirEnElCuerpo.ts` (ESPERA=320, ESCALON_MS=450, capa tope=4). No se importan
// —este script no carga TypeScript— así que si esos números cambian ahí, estos dos hay
// que reconsiderarlos aquí. Los dos pasan de los 800 ms que pide el encargo.
const CAPA_INTERMEDIA_MS = 900 // ⌊(900-320)/450⌋+1 = 2 escalones desde la piel
const CAPA_PROFUNDA_MS = 1800 // ⌊(1800-320)/450⌋+1 = 4 escalones: el tope, el hueso

// Rejilla para encontrar el cuerpo en pantalla, en fracción de ancho/alto. En cruz y
// centrada: un sujeto de pie en un encuadre vertical cae cerca del medio casi siempre.
const PUNTOS_CANDIDATOS = [
  [0.5, 0.46],
  [0.5, 0.56],
  [0.5, 0.36],
  [0.4, 0.5],
  [0.6, 0.5],
  [0.5, 0.66],
  [0.5, 0.26],
]

const ESCENARIOS = [
  { clave: 'patronA', titulo: 'Patrón A — el ejercicio con el que abre la sesión' },
  { clave: 'patronB', titulo: 'Patrón B — tras tocar el segundo punto de la tira de ejercicios' },
  { clave: 'capaIntermedia', titulo: `Capa intermedia — a los ${CAPA_INTERMEDIA_MS} ms de toque sostenido` },
  { clave: 'capaProfunda', titulo: `Capa profunda — a los ${CAPA_PROFUNDA_MS} ms de toque sostenido` },
]

// ---------------------------------------------------------------- argumentos

function leerArgumentos(argv) {
  const opciones = {
    refBase: 'origin/main',
    refNueva: 'origin/capa/interfaz',
    puerto: 5182,
    depuracion: 9352,
    chrome: undefined,
    candidatos: ['u-valentina'],
    salida: join(RAIZ, 'informes', 'testigo-partir-el-visor.json'),
    fotos: join(RAIZ, 'informes', 'partir-el-visor'),
    limiteListo: 45_000,
    asiento: 900,
    conservarWorktrees: false,
    sinInforme: false,
    pruebaCiega: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, valor] = bruto.replace(/^--/, '').split('=')
    if (nombre === 'ref-base') opciones.refBase = valor
    else if (nombre === 'ref-nueva') opciones.refNueva = valor
    else if (nombre === 'puerto') opciones.puerto = Number(valor)
    else if (nombre === 'depuracion') opciones.depuracion = Number(valor)
    else if (nombre === 'chrome') opciones.chrome = valor
    else if (nombre === 'candidatos') opciones.candidatos = valor.split(',').filter(Boolean)
    else if (nombre === 'salida') opciones.salida = valor
    else if (nombre === 'fotos') opciones.fotos = valor
    else if (nombre === 'limite-listo') opciones.limiteListo = Number(valor)
    else if (nombre === 'asiento') opciones.asiento = Number(valor)
    else if (nombre === 'conservar-worktrees') opciones.conservarWorktrees = true
    else if (nombre === 'sin-informe') opciones.sinInforme = true
    else if (nombre === 'prueba-ciega') opciones.pruebaCiega = true
  }
  // La ciega compara una rama CONSIGO MISMA y le pinta un cebo encima solo al lado
  // «nueva»: no necesita una segunda rama de verdad, así que se fuerza aquí y no hace
  // falta acordarse de pasar `--ref-nueva` igual que `--ref-base` para probarla.
  if (opciones.pruebaCiega) opciones.refNueva = opciones.refBase
  return opciones
}

// -------------------------------------------------------------- git worktree

function ejecutar(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} falló (${r.status}):\n${r.stderr || r.stdout || '(sin salida)'}`)
  }
  return (r.stdout || '').trim()
}

function crearWorktree(ref, destino) {
  ejecutar('git', ['worktree', 'add', '--detach', destino, ref], { cwd: RAIZ })
  return ejecutar('git', ['rev-parse', 'HEAD'], { cwd: destino })
}

function borrarWorktree(destino) {
  spawnSync('git', ['worktree', 'remove', '--force', destino], { cwd: RAIZ, stdio: 'ignore' })
  spawnSync('git', ['worktree', 'prune'], { cwd: RAIZ, stdio: 'ignore' })
  // Por si `worktree remove` no llegó a borrar el directorio (worktree ya roto a medias).
  try {
    rmSync(destino, { recursive: true, force: true })
  } catch {
    /* ya no está, o no se pudo — no es motivo para tirar el resultado de la medida */
  }
}

function instalarDependencias(cwd) {
  const r = spawnSync('npm', ['install'], { cwd, stdio: 'pipe', encoding: 'utf8', shell: true })
  if (r.status !== 0) {
    throw new Error(`npm install falló en ${cwd}:\n${r.stderr || r.stdout}`)
  }
}

// ------------------------------------------------------------------- vite

async function arrancarVite(cwd, puerto, envDir) {
  const codigo =
    `import { createServer } from 'vite'; ` +
    `const s = await createServer({ envDir: ${JSON.stringify(envDir)}, server: { port: ${puerto}, host: '127.0.0.1' } }); ` +
    `await s.listen();`
  const proceso = spawn(process.execPath, ['--input-type=module', '-e', codigo], { cwd, stdio: 'ignore' })
  const limite = Date.now() + 45_000
  while (Date.now() < limite) {
    if (proceso.exitCode !== null) throw new Error(`vite se cerró solo (código ${proceso.exitCode}) en ${cwd}`)
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/`)
      if (r.ok) return proceso
    } catch {
      /* aún no abre el puerto */
    }
    await esperar(300)
  }
  proceso.kill()
  throw new Error(`vite no respondió en el puerto ${puerto} en 45 s (${cwd})`)
}

function detenerProceso(proceso) {
  if (!proceso || proceso.exitCode !== null) return
  proceso.kill()
  if (process.platform === 'win32' && proceso.pid) {
    spawnSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
  }
}

// ------------------------------------------------------- lo que corre en la página

/** Igual que hace `SessionProvider.tsx:276`: la clave es el id crudo, sin `JSON.stringify`. */
const ENTRAR_COMO = (usuario) => {
  localStorage.setItem('alpha-usuario', usuario)
  return localStorage.getItem('alpha-usuario')
}

/** ¿Este usuario, hoy, tiene sujeto Y dos o más ejercicios para tocar en la tira? */
const HAY_TIRA_Y_SUJETO = () => {
  const sujeto = !!document.querySelector('[data-testigo="sujeto"]')
  const puntos = document.querySelectorAll('[data-puntos="ejercicios"] button').length
  return { ok: sujeto && puntos >= 2, sujeto, puntos }
}

/** El centro del segundo punto de la tira, en coordenadas de viewport. */
const RECT_SEGUNDO_PUNTO = () => {
  const botones = document.querySelectorAll('[data-puntos="ejercicios"] button')
  if (botones.length < 2) return null
  const r = botones[1].getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/** ¿Sigue vivo el gesto de hundirse? Lo marca `SalonEntrenar.tsx` con `data-hundiendo`. */
const HUNDIENDO_ACTIVO = () => document.querySelector('[data-testigo="sujeto"]')?.hasAttribute('data-hundiendo') ?? false

/** ¿Ya montó React ALGO dentro de `#root`? Vale para cualquier ruta, incluida la raíz. */
const APP_MONTADA = () => (document.getElementById('root')?.children.length ?? 0) > 0

/**
 * ¿Ya montó ALGO el salón? Con sujeto (`data-testigo="sujeto"`) o sin él, cuando el día
 * es de cardio (`data-hueco="sinPatron"`) — cualquiera de los dos dice que React ya
 * renderizó la pantalla de `/entrenar` y que Vite ya sirvió y evaluó el módulo entero, que
 * es precisamente lo que la primera navegación de un checkout recién instalado no
 * garantiza en ningún número fijo de milisegundos (ver la nota grande de arriba).
 */
const SALON_MONTADO = () => !!document.querySelector('[data-testigo="sujeto"], [data-hueco="sinPatron"]')

/**
 * Tapa cualquier reloj de pared antes de una captura — ver la nota grande de arriba.
 * Es deliberadamente ciego a de QUÉ es el reloj: busca la FORMA `MM:SS` en el texto
 * propio de un nodo hoja, no una clase ni un `data-*`, porque lo que hay que neutralizar
 * es cualquier cosa que cuente segundos, la conozca este script o no.
 */
const OCULTAR_RELOJES_EN_PAGINA = () => {
  const RELOJ = /^\d{1,2}:\d{2}$/
  let n = 0
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length > 0) continue
    const texto = (el.textContent || '').trim()
    if (RELOJ.test(texto)) {
      el.style.visibility = 'hidden'
      n++
    }
  }
  return n
}

/**
 * EL CEBO DE `--prueba-ciega`: un rectángulo enorme, opaco y de un color que no existe en
 * ningún token de este repo, cubriendo un tercio del alto de la pantalla. No hace falta
 * que se parezca a nada del salón — al contrario: cuanto más ajeno, más imposible es que
 * `mascaraDeCambio` lo confunda con ruido de antialiasing. Si esto no aparece como
 * `pixelesCambiados > 0` en las cuatro capturas, el testigo no está midiendo nada.
 */
const PINTAR_CEBO_VISIBLE = () => {
  const cebo = document.createElement('div')
  cebo.id = 'cebo-de-partir-el-visor'
  cebo.style.cssText =
    'position:fixed;left:0;top:30%;width:100%;height:34%;background:#ff00ff;' +
    'z-index:2147483647;pointer-events:none'
  document.body.appendChild(cebo)
  return true
}

/**
 * Sondea `fnPagina()` en la página hasta que devuelva verdadero o se acabe `limiteMs`.
 * Devuelve si llegó a verse verdadero — no lanza: un sondeo que no cumplió es un dato
 * («el salón tardó más de X»), no un motivo para tirar toda la medida sin dejar rastro.
 */
async function esperarQue(dt, fnPagina, limiteMs, pasoMs = 400) {
  const t0 = Date.now()
  while (Date.now() - t0 < limiteMs) {
    if (await dt.evaluar(comoExpresion(fnPagina))) return true
    await esperar(pasoMs)
  }
  return false
}

// ------------------------------------------------------------------ medida

/** Cuenta píxeles distintos y la caja que los contiene — la «máscara» que pide el encargo. */
function resumenDeMascara(mascara, ancho, alto) {
  let cuenta = 0
  let x0 = ancho,
    y0 = alto,
    x1 = -1,
    y1 = -1
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (!mascara[y * ancho + x]) continue
      cuenta++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { cuenta, caja: cuenta > 0 ? { x0, y0, x1, y1 } : null }
}

async function medirCheckout(opciones, etiqueta, cwd, envDir) {
  console.log(`\n  [${etiqueta}] npm install en ${cwd} ...`)
  instalarDependencias(cwd)

  console.log(`  [${etiqueta}] arrancando vite en :${opciones.puerto} ...`)
  const viteProc = await arrancarVite(cwd, opciones.puerto, envDir)

  console.log(`  [${etiqueta}] arrancando Chrome en :${opciones.depuracion} ...`)
  const { proceso: chromeProc } = await arrancarChrome({
    chrome: opciones.chrome,
    puerto: opciones.depuracion,
    ancho: ANCHO,
    alto: ALTO,
  })

  let dt = null
  let idObjetivo = null
  const capturas = {}
  let puntoCuerpo = null
  let usuarioUsado = null
  const avisos = []
  const raiz = `http://127.0.0.1:${opciones.puerto}`

  try {
    const objetivo = await objetivoDePagina(opciones.depuracion)
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
    // SIN ESTO, LA PRIMERA CORRIDA DE VERIFICACIÓN (`origin/main` contra sí mismo, para
    // probar que el arnés sabe decir «cero» antes de fiarse de él) dio 224.382 píxeles
    // distintos en `patronA` — LA MISMA rama contra sí misma. La causa: `VisorPatron.tsx`
    // reproduce la repetición sola (`reproduciendo`, arranca en `fase=0` y avanza con el
    // reloj) salvo que el sistema pida menos movimiento, y dos Chrome arrancados por
    // separado nunca capturan la MISMA fase de esa animación. `salon-visible.mjs` ya había
    // resuelto exactamente esto para congelar lo que se mueve por lienzo: se emula
    // `prefers-reduced-motion: reduce`, que en `VisorPatron.tsx` deja `reproduciendo` en
    // falso y la fase clavada en 0.
    await dt.pedir('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await dt.pedir('Page.bringToFront')

    // Con `--prueba-ciega` (y solo en el checkout «nueva»), pinta el cebo justo antes de
    // capturar y nunca antes: si se pintara al principio de `entrarComo`, un
    // `Page.navigate` posterior lo borraría con el resto del DOM.
    const capturar = async () => {
      if (opciones.pruebaCiega && etiqueta === 'nueva') await dt.evaluar(comoExpresion(PINTAR_CEBO_VISIBLE))
      return dt.captura()
    }

    const entrarComo = async (usuario) => {
      await dt.pedir('Page.navigate', { url: raiz })
      await esperarQue(dt, APP_MONTADA, opciones.limiteListo) // aquí es donde puede vivir el pre-empaquetado frío de Vite
      await dt.evaluar(comoExpresion(ENTRAR_COMO, usuario))
      await dt.pedir('Page.navigate', { url: `${raiz}/entrenar` })
      const listo = await esperarQue(dt, SALON_MONTADO, opciones.limiteListo)
      if (!listo) avisos.push(`el salón no montó sujeto ni "sinPatron" en ${opciones.limiteListo} ms tras entrar como "${usuario}"`)
      await esperar(opciones.asiento)
      await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
      await dt.evaluar(comoExpresion(OCULTAR_RELOJES_EN_PAGINA))
    }

    // ---- 0. resolver con qué usuario hay sujeto y dos ejercicios ----
    for (const candidato of opciones.candidatos) {
      await entrarComo(candidato)
      const hay = await dt.evaluar(comoExpresion(HAY_TIRA_Y_SUJETO))
      if (hay.ok) {
        usuarioUsado = candidato
        break
      }
      avisos.push(`usuario "${candidato}" descartado (sujeto=${hay.sujeto}, puntos=${hay.puntos})`)
    }
    if (!usuarioUsado) {
      throw new Error(`ningún candidato (${opciones.candidatos.join(', ')}) mostró sujeto + tira de ejercicios`)
    }

    // ---- 1. patrón A ----
    await entrarComo(usuarioUsado)
    capturas.patronA = await capturar()

    // ---- 2. patrón B: tocar el segundo punto de la tira ----
    await entrarComo(usuarioUsado)
    const rectPunto = await dt.evaluar(comoExpresion(RECT_SEGUNDO_PUNTO))
    if (!rectPunto) throw new Error('no encontré un segundo punto en la tira de ejercicios tras entrar')
    await tocar(dt, rectPunto.x, rectPunto.y)
    await esperar(900) // que asiente la animación de cambio de ejercicio
    await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
    await dt.evaluar(comoExpresion(OCULTAR_RELOJES_EN_PAGINA))
    capturas.patronB = await capturar()

    // ---- 3. calibrado desechable: ¿dónde está el cuerpo hoy? ----
    await entrarComo(usuarioUsado)
    for (const [fx, fy] of PUNTOS_CANDIDATOS) {
      const x = Math.round(ANCHO * fx)
      const y = Math.round(ALTO * fy)
      await bajarDedo(dt, x, y)
      await esperar(320 + 220) // ESPERA de hundirEnElCuerpo.ts + margen
      const activo = await dt.evaluar(comoExpresion(HUNDIENDO_ACTIVO))
      await soltarDedo(dt)
      if (activo) {
        puntoCuerpo = { x, y }
        break
      }
      await esperar(150)
    }
    if (!puntoCuerpo) {
      throw new Error('ningún punto de la rejilla disparó data-hundiendo: no encontré el cuerpo en pantalla')
    }

    // ---- 4. capaIntermedia y capaProfunda: un solo toque sostenido, dos capturas ----
    await entrarComo(usuarioUsado)
    await bajarDedo(dt, puntoCuerpo.x, puntoCuerpo.y)
    const t0 = Date.now()
    await esperar(Math.max(0, CAPA_INTERMEDIA_MS - (Date.now() - t0)))
    await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
    await dt.evaluar(comoExpresion(OCULTAR_RELOJES_EN_PAGINA))
    capturas.capaIntermedia = await capturar()
    await esperar(Math.max(0, CAPA_PROFUNDA_MS - (Date.now() - t0)))
    await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
    await dt.evaluar(comoExpresion(OCULTAR_RELOJES_EN_PAGINA))
    capturas.capaProfunda = await capturar()
    await soltarDedo(dt)
  } finally {
    if (dt) dt.cerrar()
    if (idObjetivo) {
      await fetch(`http://127.0.0.1:${opciones.depuracion}/json/close/${idObjetivo}`).catch(() => {})
      await esperar(400)
    }
    detenerProceso(chromeProc)
    await esperar(500)
    detenerProceso(viteProc)
    await esperar(300)
  }

  return { capturas, puntoCuerpo, usuarioUsado, avisos }
}

// ------------------------------------------------------------------ principal

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(`\n  partir-el-visor: ${opciones.refBase}  vs  ${opciones.refNueva}\n`)

  ejecutar('git', ['fetch', 'origin'], { cwd: RAIZ })

  const scratch = mkdtempSync(join(tmpdir(), 'partir-el-visor-'))
  const dirBase = join(scratch, 'base')
  const dirNueva = join(scratch, 'nueva')
  const envDirVacio = join(scratch, 'env-vacio')
  mkdirSync(envDirVacio, { recursive: true })

  console.log(`  creando worktree de ${opciones.refBase} en ${dirBase} ...`)
  const commitBase = crearWorktree(opciones.refBase, dirBase)
  console.log(`  creando worktree de ${opciones.refNueva} en ${dirNueva} ...`)
  const commitNueva = crearWorktree(opciones.refNueva, dirNueva)

  let resultadoBase
  let resultadoNueva
  try {
    resultadoBase = await medirCheckout(opciones, 'base', dirBase, envDirVacio)
    resultadoNueva = await medirCheckout(opciones, 'nueva', dirNueva, envDirVacio)
  } finally {
    if (opciones.conservarWorktrees) {
      console.log(`\n  se conservan los worktrees:\n    ${dirBase}\n    ${dirNueva}`)
    } else {
      borrarWorktree(dirBase)
      borrarWorktree(dirNueva)
      try {
        rmSync(scratch, { recursive: true, force: true })
      } catch {
        /* no es motivo para tirar la medida */
      }
    }
  }

  // ---------------------------------------------------------- comparar y guardar

  if (!existsSync(opciones.fotos)) mkdirSync(opciones.fotos, { recursive: true })

  const escenarios = []
  let todoCero = true
  for (const { clave, titulo } of ESCENARIOS) {
    const a = resultadoBase.capturas[clave]
    const b = resultadoNueva.capturas[clave]

    const rutaBase = join(opciones.fotos, `${clave}-base.png`)
    const rutaNueva = join(opciones.fotos, `${clave}-nueva.png`)
    writeFileSync(rutaBase, codificarPngRgb(a.ancho, a.alto, a.rgb))
    writeFileSync(rutaNueva, codificarPngRgb(b.ancho, b.alto, b.rgb))

    let pixelesCambiados = 0
    let caja = null
    let rutaMascara = null
    let notaTamano = null
    if (a.ancho !== b.ancho || a.alto !== b.alto) {
      // Las dos ramas dieron capturas de tamaño distinto: eso YA es un cambio de
      // comportamiento (o un fallo del arnés) y se cuenta como el peor caso posible.
      pixelesCambiados = Math.max(a.ancho * a.alto, b.ancho * b.alto)
      notaTamano = `tamaños distintos: base ${a.ancho}x${a.alto}, nueva ${b.ancho}x${b.alto}`
      console.warn(`  [aviso] ${clave}: ${notaTamano}`)
    } else {
      const { mascara, cuenta } = mascaraDeCambio(a, b)
      pixelesCambiados = cuenta
      if (cuenta > 0) {
        const resumen = resumenDeMascara(mascara, a.ancho, a.alto)
        caja = resumen.caja
        rutaMascara = join(opciones.fotos, `${clave}-mascara.png`)
        const gris = Buffer.from(mascara.map((v) => (v ? 255 : 0)))
        writeFileSync(rutaMascara, codificarPngGris(a.ancho, a.alto, gris))
      }
    }

    if (pixelesCambiados !== 0) todoCero = false
    console.log(
      `  ${clave.padEnd(16)} pixelesCambiados=${String(pixelesCambiados).padStart(6)}` +
        (caja ? `  caja=(${caja.x0},${caja.y0})-(${caja.x1},${caja.y1})` : ''),
    )

    escenarios.push({
      clave,
      titulo,
      pixelesCambiados,
      totalPixeles: a.ancho * a.alto,
      cajaCambio: caja,
      capturaBase: rutaBase,
      capturaNueva: rutaNueva,
      mascara: rutaMascara,
      notaTamano,
    })
  }

  // En la ciega el veredicto es al revés: SANO es que las cuatro capturas del cebo
  // salgan distintas de cero — si salieran en cero el testigo sería el que da siempre
  // «cero» pase lo que pase, y un testigo que no puede fallar no prueba nada.
  const vioElCebo = opciones.pruebaCiega && escenarios.every((e) => e.pixelesCambiados > 0)

  const acta = {
    cuando: new Date().toISOString(),
    refBase: opciones.refBase,
    refNueva: opciones.refNueva,
    commitBase,
    commitNueva,
    viewport: { ancho: ANCHO, alto: ALTO, escala: ESCALA },
    usuarioBase: resultadoBase.usuarioUsado,
    usuarioNueva: resultadoNueva.usuarioUsado,
    puntoCuerpoBase: resultadoBase.puntoCuerpo,
    puntoCuerpoNueva: resultadoNueva.puntoCuerpo,
    avisosBase: resultadoBase.avisos,
    avisosNueva: resultadoNueva.avisos,
    escenarios,
    todoCero,
    ...(opciones.pruebaCiega ? { pruebaCiega: true, vioElCebo } : {}),
  }

  if (opciones.pruebaCiega) {
    console.log(
      `\n  PRUEBA CIEGA: ${vioElCebo ? 'el testigo vio el cebo en las cuatro capturas. Sabe decir que no.' : 'NO vio el cebo en las cuatro. Este testigo no vale: daría cero siempre.'}\n`,
    )
  } else {
    console.log(`\n  TOTAL: ${todoCero ? 'los cuatro escenarios dan 0 píxeles distintos' : 'hay escenarios con píxeles distintos — ver arriba y las máscaras'}\n`)
  }

  if (!opciones.sinInforme) {
    writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
    console.log(`  acta escrita en ${opciones.salida}\n`)
  } else {
    console.log(JSON.stringify(acta, null, 2))
  }

  process.exitCode = opciones.pruebaCiega ? (vioElCebo ? 0 : 1) : todoCero ? 0 : 1
}

principal().catch((e) => {
  console.error(`\n  el testigo se paró: ${e.stack || e.message}`)
  process.exitCode = 2
})
