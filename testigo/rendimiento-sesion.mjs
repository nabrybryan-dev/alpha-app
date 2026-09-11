#!/usr/bin/env node
/**
 * TESTIGO DE UNA SESIÓN DE VERDAD CON `?medir=1` PUESTO.
 *
 * `src/lib/rendimiento.ts` (rama `capa/interfaz`, ya fusionada aquí) monta un medidor que
 * solo existe con la bandera `?medir=1` en la URL: cuenta fps, tiempo de fotograma
 * (p50/p95), fotogramas lentos, memoria observable, cambios de ejercicio, capas del eje W
 * visitadas y vueltas desde segundo plano. Este testigo hace una sesión emulada de tres
 * minutos —cambia de ejercicio, atraviesa el cuerpo, vuelve de segundo plano— y al final
 * lee el informe TAL COMO LO DEVUELVE LA APP, sin adivinarlo.
 *
 * =============================================================================
 * CÓMO SE LEE EL INFORME SIN TOCAR EL PORTAPAPELES DEL SISTEMA
 * =============================================================================
 *
 * El botón «Copiar informe» llama a `navigator.clipboard.writeText(...)` y, SOLO SI esa
 * promesa se rechaza, abre un `<textarea>` dentro del propio recuadro con el JSON exacto
 * ya seleccionado (`mostrarParaCopiarAMano`, en `rendimiento.ts`). En vez de pedirle
 * permiso de portapapeles a Chrome —que además no es fiable bajo automatización—, este
 * testigo SOBRESCRIBE `navigator.clipboard.writeText` para que rechace siempre, y lee el
 * `<textarea>` que aparece. Es el mismo camino que ya tiene la app para cuando el
 * navegador no deja copiar; aquí simplemente se fuerza a propósito.
 *
 * =============================================================================
 * LOS SIETE CAMPOS DEL ENCARGO, CONTRA LAS CLAVES REALES DEL INFORME
 * =============================================================================
 *
 * El encargo pide `fpsMedio, p50Ms, p95Ms, fotogramasLentos, cambiosDeEjercicio, capas,
 * vueltasDeFondo`. El informe que de verdad devuelve `CuentaDeRendimiento.informe()` usa
 * otros nombres —comprobado leyendo `src/lib/rendimiento.ts` y corriendo esto de verdad—:
 *
 *   fps · fotograma.p50 · fotograma.p95 · lentos · memoriaMb · cambiosDeEjercicio ·
 *   capasVisitadas · vueltasDeSegundoPlano · muestras · segundos
 *
 * Ninguno de los dos lados está mal: son dos vocabularios que se fijaron por separado, uno
 * en el encargo antes de que este código existiera y otro en el código de `capa/interfaz`.
 * Este testigo trae los DOS: `resumen` con las claves exactas que pide el encargo (mapeadas
 * una a una desde el informe real) y `informeOriginal` con el informe tal cual lo copió la
 * app, para que quien lo lea vea también el vocabulario de origen y no se quede solo con la
 * traducción.
 *
 * =============================================================================
 * CÓMO SE CORRE
 * =============================================================================
 *
 *   1. Deja un Vite corriendo:   npm run dev            (o el de esta rama, :5182)
 *   2. node testigo/rendimiento-sesion.mjs
 *
 * Opciones:
 *   --url=http://127.0.0.1:5182
 *   --puerto=9352
 *   --chrome="C:/ruta/chrome.exe"
 *   --candidatos=u-valentina
 *   --duracion=180000                   milisegundos de sesión emulada (3 min por defecto)
 *   --salida=informes/testigo-rendimiento.json
 *   --sin-informe
 *
 * La sesión, dentro de `--duracion`: tres cambios de ejercicio (tira de puntos), dos
 * inmersiones del eje W a profundidades distintas (toque sostenido sobre el cuerpo,
 * `capas/hundirEnElCuerpo.ts`) y una vuelta desde segundo plano. El encargo sugiere
 * `Emulation.setFocusEmulationEnabled` o `Page.setWebLifecycleState`; las dos se probaron
 * de verdad y las dos fallan de un modo distinto (una no dispara `visibilitychange`, la
 * otra deja de atender toques después) — ver la nota junto a `IRSE_A_SEGUNDO_PLANO` en el
 * código para el resultado exacto de cada prueba y por qué se usa en su lugar un
 * `visibilitychange` disparado a mano, que es la señal que la app de verdad escucha.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  bajarDedo,
  comoExpresion,
  Devtools,
  esperar,
  objetivoDePagina,
  soltarDedo,
  tocar,
} from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANCHO = 414
const ALTO = 736

// ---------------------------------------------------------------- argumentos

function leerArgumentos(argv) {
  const opciones = {
    url: 'http://127.0.0.1:5182',
    puerto: 9352,
    chrome: undefined,
    candidatos: ['u-valentina'],
    duracion: 180_000,
    salida: join(RAIZ, 'informes', 'testigo-rendimiento.json'),
    sinInforme: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, valor] = bruto.replace(/^--/, '').split('=')
    if (nombre === 'url') opciones.url = valor.replace(/\/$/, '')
    else if (nombre === 'puerto') opciones.puerto = Number(valor)
    else if (nombre === 'chrome') opciones.chrome = valor
    else if (nombre === 'candidatos') opciones.candidatos = valor.split(',').filter(Boolean)
    else if (nombre === 'duracion') opciones.duracion = Number(valor)
    else if (nombre === 'salida') opciones.salida = valor
    else if (nombre === 'sin-informe') opciones.sinInforme = true
  }
  return opciones
}

// ------------------------------------------------------- lo que corre en la página

const ENTRAR_COMO = (usuario) => {
  localStorage.setItem('alpha-usuario', usuario)
}

const SALON_MONTADO = () => !!document.querySelector('[data-testigo="sujeto"], [data-hueco="sinPatron"]')

const HAY_SUJETO_Y_PUNTOS = () => ({
  sujeto: !!document.querySelector('[data-testigo="sujeto"]'),
  puntos: document.querySelectorAll('[data-puntos="ejercicios"] button').length,
  medidor: !!document.querySelector('[data-medidor="rendimiento"]'),
})

/**
 * El rectángulo del punto SIGUIENTE al que está activo ahora mismo (`aria-current`),
 * dando la vuelta al llegar al final.
 *
 * La primera versión de este testigo tocaba índices fijos (1, 2, 0) suponiendo que la
 * sesión siempre abre en el ejercicio 0, y no es así: la primera corrida real pidió tres
 * cambios y el medidor solo contó DOS. `cambioDeEjercicio()` en `rendimiento.ts` compara
 * contra el ÚLTIMO ejercicio visto, no contra una lista de todos —así que si la sesión ya
 * abría en el índice 1, tocar el punto 1 no cambiaba nada y ese primer toque salía gratis—.
 * Partir siempre del punto siguiente al activo garantiza un cambio de verdad, sea cual sea
 * el ejercicio con el que abra la sesión.
 */
const RECT_DEL_SIGUIENTE_PUNTO = () => {
  const botones = Array.from(document.querySelectorAll('[data-puntos="ejercicios"] button'))
  if (botones.length < 2) return null
  const actual = botones.findIndex((b) => b.getAttribute('aria-current') === 'true')
  const siguiente = botones[(Math.max(0, actual) + 1) % botones.length]
  const r = siguiente.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/** Un punto en mitad de la pantalla: cae sobre el cuerpo en casi cualquier encuadre. */
const CENTRO_DE_PANTALLA = () => ({ x: Math.round(innerWidth / 2), y: Math.round(innerHeight * 0.45) })

/** Fuerza el camino de «no se pudo copiar»: siempre rechaza, así el testigo lee el textarea. */
const FORZAR_TEXTAREA = () => {
  if (navigator.clipboard) navigator.clipboard.writeText = () => Promise.reject(new Error('forzado por el testigo'))
  return true
}

/**
 * LA VUELTA DESDE SEGUNDO PLANO, a mano.
 *
 * El encargo ofrece dos vías de CDP y las dos se probaron primero, de verdad, antes de
 * llegar aquí:
 *
 *   - `Page.setWebLifecycleState({state:'frozen'})` y de vuelta a `'active'` deja el
 *     renderer sin atender `Input.dispatchTouchEvent`: el primer toque después colgó 60 s
 *     (el tope de `Devtools.pedir` en `comun.mjs`), incluso pasado el tiempo de sobra.
 *   - `Emulation.setFocusEmulationEnabled(false)` y de vuelta a `true` no colgó nada, pero
 *     tampoco disparó `visibilitychange`: la sesión entera terminó con
 *     `vueltasDeSegundoPlano: 0`. Es una emulación de FOCO de teclado/ratón
 *     (`:focus-visible`, `document.hasFocus()`), no de la Page Visibility API.
 *
 * `alCambiarVisibilidad` en `rendimiento.ts` no sabe de dónde viene el evento: escucha
 * `visibilitychange` en `document` y mira `document.visibilityState`. Así que esto
 * sobrescribe el getter de `visibilityState` en la propia instancia de `document` —que
 * hace sombra al de `Document.prototype`, sin tocarlo— y dispara el evento a mano. No es
 * una vuelta de verdad del sistema operativo, pero es exactamente la señal que la app
 * recibiría de una, y es la única de las tres formas probadas que de verdad mueve la
 * aguja sin romper nada después.
 */
const IRSE_A_SEGUNDO_PLANO = () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  return true
}
const VOLVER_A_PRIMER_PLANO = () => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
  return true
}

const RECT_DEL_BOTON_COPIAR = () => {
  const nodo = document.querySelector('[data-medidor="rendimiento"]')
  const boton = nodo ? Array.from(nodo.querySelectorAll('button')).find((b) => b.textContent?.includes('Copiar informe')) : null
  if (!boton) return null
  const r = boton.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/**
 * Lo mismo que `RECT_DEL_BOTON_COPIAR`, pero en booleano y AUTOCONTENIDA.
 *
 * `comoExpresion` manda el CÓDIGO FUENTE de la función a la página (`fn.toString()`), no
 * una closure — así que una función que solo NOMBRA a `RECT_DEL_BOTON_COPIAR` desde fuera
 * llega al navegador con esa referencia colgando y revienta con
 * `ReferenceError: RECT_DEL_BOTON_COPIAR is not defined`. Cualquier función que se pase a
 * `esperarQue` tiene que valerse sola.
 */
const HAY_BOTON_COPIAR = () => {
  const nodo = document.querySelector('[data-medidor="rendimiento"]')
  return !!(nodo && Array.from(nodo.querySelectorAll('button')).some((b) => b.textContent?.includes('Copiar informe')))
}

const LEER_TEXTAREA = () => document.querySelector('[data-medidor="rendimiento"] textarea')?.value ?? null
const HAY_TEXTAREA_DE_REPUESTO = () => document.querySelector('[data-medidor="rendimiento"] textarea') !== null

async function esperarQue(dt, fnPagina, limiteMs, pasoMs = 300) {
  const t0 = Date.now()
  while (Date.now() - t0 < limiteMs) {
    if (await dt.evaluar(comoExpresion(fnPagina))) return true
    await esperar(pasoMs)
  }
  return false
}

// ------------------------------------------------------------------ principal

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(`\n  rendimiento-sesion: ${opciones.url}/entrenar?medir=1  ·  ${Math.round(opciones.duracion / 1000)} s\n`)

  const { proceso } = await arrancarChrome({ chrome: opciones.chrome, puerto: opciones.puerto, ancho: ANCHO, alto: ALTO })
  let dt = null
  let idObjetivo = null
  let usuarioUsado = null
  const bitacora = []
  // Se le pone hora de verdad en cuanto arranca la sesión (`reloj.inicio`, más abajo);
  // antes de eso, cualquier `anotar` cuenta desde que arrancó el propio proceso.
  const reloj = { inicio: Date.now() }
  const anotar = (msg) => {
    const seg = Math.round((Date.now() - reloj.inicio) / 1000)
    bitacora.push(`[${seg}s] ${msg}`)
    console.log(`  [${seg}s] ${msg}`)
  }

  try {
    const objetivo = await objetivoDePagina(opciones.puerto)
    idObjetivo = objetivo.id
    dt = await Devtools.conectar(objetivo.webSocketDebuggerUrl)
    await dt.pedir('Page.enable')
    await dt.pedir('Runtime.enable')
    await dt.pedir('Emulation.setDeviceMetricsOverride', {
      width: ANCHO,
      height: ALTO,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: ANCHO,
      screenHeight: ALTO,
    })
    await dt.pedir('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    await dt.pedir('Page.bringToFront')

    // ---- resolver usuario con sujeto ----
    for (const candidato of opciones.candidatos) {
      await dt.pedir('Page.navigate', { url: opciones.url })
      await esperar(700)
      await dt.evaluar(comoExpresion(ENTRAR_COMO, candidato))
      await dt.pedir('Page.navigate', { url: `${opciones.url}/entrenar?medir=1` })
      await esperarQue(dt, SALON_MONTADO, 20_000)
      const hay = await dt.evaluar(comoExpresion(HAY_SUJETO_Y_PUNTOS))
      if (hay.sujeto && hay.medidor) {
        usuarioUsado = candidato
        break
      }
    }
    if (!usuarioUsado) throw new Error(`ningún candidato (${opciones.candidatos.join(', ')}) mostró sujeto + medidor`)

    await dt.evaluar(comoExpresion(FORZAR_TEXTAREA))
    const t0 = Date.now()
    reloj.inicio = t0
    anotar(`sesión arrancada con "${usuarioUsado}" — ${Math.round(opciones.duracion / 1000)} s por delante`)

    // ------------------------------------------------- el guion de la sesión
    // Cada paso espera hasta SU marca desde t0 —no un delta, para que el guion entero
    // encaje aunque un paso individual tarde un poco más o menos— y la marca es una
    // FRACCIÓN de `--duracion`, no un milisegundo fijo: con los 180 s por defecto caen
    // exactamente en 8/35/70/100/130/160 s, y con `--duracion` más corta (para probar el
    // mecanismo sin esperar tres minutos de verdad) el guion entero se encoge con ella.
    const esperarHasta = async (fraccion) => {
      const objetivo = fraccion * opciones.duracion
      const falta = objetivo - (Date.now() - t0)
      if (falta > 0) await esperar(falta)
    }

    // 1er cambio de ejercicio, pronto — hay que dejar ver la sala tal como carga primero.
    await esperarHasta(8_000 / 180_000)
    const p1 = await dt.evaluar(comoExpresion(RECT_DEL_SIGUIENTE_PUNTO))
    if (p1) {
      await tocar(dt, p1.x, p1.y)
      anotar('cambio de ejercicio 1/3 (punto 1)')
    } else {
      anotar('aviso: no encontré un segundo punto para el cambio 1/3')
    }

    // 1ª inmersión: hold corto → una capa desde la piel.
    await esperarHasta(35_000 / 180_000)
    const centro1 = await dt.evaluar(comoExpresion(CENTRO_DE_PANTALLA))
    await bajarDedo(dt, centro1.x, centro1.y)
    await esperar(900)
    await soltarDedo(dt)
    anotar('inmersión 1/2 (~900 ms de toque sostenido)')

    // 2º cambio de ejercicio.
    await esperarHasta(70_000 / 180_000)
    const p2 = await dt.evaluar(comoExpresion(RECT_DEL_SIGUIENTE_PUNTO))
    if (p2) {
      await tocar(dt, p2.x, p2.y)
      anotar('cambio de ejercicio 2/3 (punto 2)')
    } else {
      anotar('aviso: no encontré un tercer punto para el cambio 2/3')
    }

    // Vuelta desde segundo plano — ver la nota grande junto a `IRSE_A_SEGUNDO_PLANO` sobre
    // por qué no es ninguna de las dos vías de CDP que ofrece el encargo: las dos se
    // probaron primero, y ninguna hacía lo que promete sin romper otra cosa.
    await esperarHasta(100_000 / 180_000)
    await dt.evaluar(comoExpresion(IRSE_A_SEGUNDO_PLANO))
    await esperar(2_000)
    await dt.evaluar(comoExpresion(VOLVER_A_PRIMER_PLANO))
    anotar('vuelta desde segundo plano (visibilitychange: hidden → visible)')

    // 2ª inmersión: hold más largo desde donde quedó (persiste entre toques) → otra capa.
    await esperarHasta(130_000 / 180_000)
    const centro2 = await dt.evaluar(comoExpresion(CENTRO_DE_PANTALLA))
    await bajarDedo(dt, centro2.x, centro2.y)
    await esperar(900)
    await soltarDedo(dt)
    anotar('inmersión 2/2 (~900 ms más de toque sostenido, sigue desde donde quedó)')

    // 3er cambio de ejercicio.
    await esperarHasta(160_000 / 180_000)
    const p0 = await dt.evaluar(comoExpresion(RECT_DEL_SIGUIENTE_PUNTO))
    if (p0) {
      await tocar(dt, p0.x, p0.y)
      anotar('cambio de ejercicio 3/3 (punto 0)')
    } else {
      anotar('aviso: no encontré el primer punto para el cambio 3/3')
    }

    await esperarHasta(1)
    anotar(`sesión completada: ${Math.round((Date.now() - t0) / 1000)} s reales`)

    // ------------------------------------------------- leer el informe
    const rectBoton = await esperarQue(dt, HAY_BOTON_COPIAR, 5_000)
    if (!rectBoton) throw new Error('no encontré el botón «Copiar informe»')
    const rectCopiar = await dt.evaluar(comoExpresion(RECT_DEL_BOTON_COPIAR))
    await tocar(dt, rectCopiar.x, rectCopiar.y)
    const listo = await esperarQue(dt, HAY_TEXTAREA_DE_REPUESTO, 5_000)
    if (!listo) throw new Error('el botón «Copiar informe» no abrió el textarea de repuesto')
    const crudo = await dt.evaluar(comoExpresion(LEER_TEXTAREA))
    if (!crudo) throw new Error('el textarea de «Copiar informe» está vacío')

    let informeOriginal
    try {
      informeOriginal = JSON.parse(crudo)
    } catch (e) {
      throw new Error(`el textarea no trae JSON válido: ${e.message}\n${crudo.slice(0, 500)}`)
    }

    // ------------------------------------------------- mapear a las claves del encargo
    const resumen = {
      fpsMedio: informeOriginal.fps,
      p50Ms: informeOriginal.fotograma?.p50,
      p95Ms: informeOriginal.fotograma?.p95,
      fotogramasLentos: informeOriginal.lentos,
      cambiosDeEjercicio: informeOriginal.cambiosDeEjercicio,
      capas: informeOriginal.capasVisitadas,
      vueltasDeFondo: informeOriginal.vueltasDeSegundoPlano,
    }
    const camposDelEncargo = ['fpsMedio', 'p50Ms', 'p95Ms', 'fotogramasLentos', 'cambiosDeEjercicio', 'capas', 'vueltasDeFondo']
    const camposPresentes = camposDelEncargo.filter((c) => resumen[c] !== undefined)

    const acta = {
      cuando: new Date().toISOString(),
      usuario: usuarioUsado,
      duracionPedidaMs: opciones.duracion,
      bitacora,
      // Las claves EXACTAS que pide el encargo, mapeadas desde el informe real —ver la
      // nota grande de arriba sobre por qué no coinciden con el vocabulario de `capa/interfaz`.
      resumen,
      camposDelEncargoPresentes: camposPresentes,
      todosLosCamposDelEncargoPresentes: camposPresentes.length === camposDelEncargo.length,
      // El informe tal cual lo copió la app, sin traducir. Incluye `memoriaMb` (puede ser
      // `null` fuera de Chromium: no lo pide el encargo, pero es lo que hay).
      informeOriginal,
    }

    console.log(
      `\n  TOTAL: fps=${resumen.fpsMedio} p50=${resumen.p50Ms}ms p95=${resumen.p95Ms}ms lentos=${resumen.fotogramasLentos} ` +
        `cambios=${resumen.cambiosDeEjercicio} capas=[${(resumen.capas || []).join(',')}] fondo=${resumen.vueltasDeFondo}\n` +
        `  campos del encargo presentes: ${camposPresentes.length}/7\n`,
    )

    if (!existsSync(dirname(opciones.salida))) mkdirSync(dirname(opciones.salida), { recursive: true })
    if (!opciones.sinInforme) {
      writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
      console.log(`  acta escrita en ${opciones.salida}\n`)
    } else {
      console.log(JSON.stringify(acta, null, 2))
    }

    process.exitCode = acta.todosLosCamposDelEncargoPresentes ? 0 : 1
  } finally {
    if (dt) dt.cerrar()
    if (idObjetivo) {
      await fetch(`http://127.0.0.1:${opciones.puerto}/json/close/${idObjetivo}`).catch(() => {})
      await esperar(400)
    }
    proceso.kill()
  }
}

principal().catch((e) => {
  console.error(`\n  el testigo se paró: ${e.stack || e.message}`)
  process.exitCode = 2
})
