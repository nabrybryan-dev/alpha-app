#!/usr/bin/env node
/**
 * TESTIGO DE QUE AGUANTAR EL MANDO RECORRE LA REPETICIÓN, Y NO TOCA LA PARED.
 *
 * `docs/specs/2026-09-08-tiempo-de-la-repeticion.md` (rama `capa/interfaz`, ya fusionada
 * aquí) describe el gesto exacto: bajar el dedo sobre el disco del mando, aguantar sin
 * salir de la zona muerta (`ZONA_MUERTA`, 16 px) más de `ESPERA_DEL_RECORRIDO` (420 ms), y
 * a partir de ahí el disco deja de tirar del reloj y se convierte en el mando de la
 * repetición: recorrerlo en horizontal —180 px, `RECORRIDO_COMPLETO`— pasea al sujeto por
 * su gesto, quieto mientras el dedo no se mueve.
 *
 * Este testigo no llama a `repeticionPausada()` ni a `faseDelMando()` — esas son la
 * verdad que ya comprueba `tiempoDeLaRepeticion.test.tsx`, con temporizadores falsos y sin
 * WebGL. Aquí se prueba lo que ese test NO PUEDE probar: que el dedo de verdad, sobre un
 * Chrome de verdad, MUEVE LO QUE SE VE, y que el reloj de la pared no se entera.
 *
 * =============================================================================
 * CÓMO SE CORRE
 * =============================================================================
 *
 *   1. Deja un Vite corriendo:   npm run dev            (o el de esta rama, :5182)
 *   2. node testigo/tiempo-de-la-repeticion.mjs
 *
 * Opciones:
 *   --url=http://127.0.0.1:5182         raíz de la app
 *   --puerto=9352                       puerto de depuración de Chrome
 *   --chrome="C:/ruta/chrome.exe"       binario, si no está donde se busca
 *   --candidatos=u-valentina            usuarios de demo, en orden, hasta encontrar sujeto
 *   --salida=informes/testigo-tiempo.json
 *   --reintentos=3                      cuántas veces se repite el gesto entero si el
 *                                       reloj de la pared cambia de texto por su cuenta
 *                                       (ver la nota de abajo)
 *   --sin-informe                       mide e imprime, no escribe el acta
 *
 * =============================================================================
 * EL GESTO, PASO A PASO
 * =============================================================================
 *
 * 1. Se lee el reloj de la pared (su RÓTULO, no la cifra — ver la nota de más abajo) y se
 *    espera a que el hueco del muro suelte el anuncio de carga y muestre el reloj de
 *    verdad, ANTES de tocar nada. No se aísla el sujeto tapando el resto del salón —se
 *    probó, y tapar el disco del mando con `visibility:hidden` le impide recibir el
 *    toque, que es lo contrario de lo que hace falta—: la resta se hace sobre la pantalla
 *    entera, y el sujeto entierra en píxeles cualquier ruido de alrededor sin necesidad
 *    de esconder nada (ver la nota de «un intento» en el código).
 * 3. `touchStart` en el centro del disco (`button[aria-label^="Mando del reloj de la
 *    pared"]`) y una espera de 550 ms — por encima de los 420 de `ESPERA_DEL_RECORRIDO`,
 *    para no depender de que el redondeo caiga del lado bueno.
 * 4. Diez `touchMove` de 18 px cada uno (180 px en total: `RECORRIDO_COMPLETO` entero),
 *    capturando después de cada uno. Antes del primero se captura también el estado recién
 *    agarrado, así que son 11 fotos y DIEZ restas entre consecutivas.
 * 5. `touchEnd`, y se vuelve a leer el reloj de la pared.
 *
 * =============================================================================
 * QUÉ SE LEE COMO «EL RELOJ DE LA PARED», Y POR QUÉ NO SON LOS DÍGITOS QUE TICAN
 * =============================================================================
 *
 * El salón entra siempre en modo «sesión» —nadie ha tirado del mando todavía—, y en ese
 * modo la pared NO monta `CuentaAtrasDelMuro` (la cuenta atrás de descanso/excéntrico):
 * monta el MISMO `CronometroSesion` de la pantalla de sesión, con su cifra `HH:MM:SS`
 * subiendo un segundo entero cada segundo real, SOLO. Leer esa cifra al pie de la letra
 * como «el texto del reloj» falla siempre que la prueba tarde un segundo de reloj —y esta
 * tarda: la espera obligatoria de 550 ms más diez pasos de dedo con su fotograma de por
 * medio suman casi dos segundos reales—, y fallaría por una razón que no tiene nada que
 * ver con el gesto: el tiempo, que pasa igual si no se toca nada.
 *
 * Lo que el encargo de verdad quiere saber —y lo que comprueba
 * `tiempoDeLaRepeticion.test.tsx` en su segunda prueba, con temporizadores falsos donde
 * esto no es un problema— es que recorrer la demostración NO cambia lo que la pared está
 * contando: que no arranca un descanso, que no salta a «Excéntrico». Eso lo dice el
 * RÓTULO de encima de la cifra («Sesión», «Descanso» o «Excéntrico»), que es discreto —no
 * tica— y solo cambia si el modo cambia. Así que la comprobación de «idéntico antes y
 * después» se hace sobre el RÓTULO (`ROTULO_DEL_RELOJ`), y la cifra que sí tica se guarda
 * aparte, en el acta, como dato de contexto — puede diferir por el simple paso del tiempo,
 * y eso queda dicho, no escondido.
 *
 * Con eso resuelto, `--reintentos` sigue existiendo para la otra cosa que sí puede fallar
 * por mala suerte: que el hueco del muro tarde en soltar el anuncio de carga y pasar a
 * mostrar el reloj (`RELOJ_LISTO`) dentro del plazo de sondeo.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
} from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ANCHO = 414
const ALTO = 736

// Ecos de rumboDelJoystick.ts, leídos del spec (no se importa TypeScript aquí).
const ESPERA_DEL_RECORRIDO = 420
const RECORRIDO_COMPLETO = 180
const ESPERA_USADA = 550 // > 420, con margen
const PASOS = 10
const PASO_PX = RECORRIDO_COMPLETO / PASOS // 18 px — diez pasos cubren el recorrido entero

// ---------------------------------------------------------------- argumentos

function leerArgumentos(argv) {
  const opciones = {
    url: 'http://127.0.0.1:5182',
    puerto: 9352,
    chrome: undefined,
    candidatos: ['u-valentina'],
    salida: join(RAIZ, 'informes', 'testigo-tiempo.json'),
    reintentos: 3,
    sinInforme: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, valor] = bruto.replace(/^--/, '').split('=')
    if (nombre === 'url') opciones.url = valor.replace(/\/$/, '')
    else if (nombre === 'puerto') opciones.puerto = Number(valor)
    else if (nombre === 'chrome') opciones.chrome = valor
    else if (nombre === 'candidatos') opciones.candidatos = valor.split(',').filter(Boolean)
    else if (nombre === 'salida') opciones.salida = valor
    else if (nombre === 'reintentos') opciones.reintentos = Number(valor)
    else if (nombre === 'sin-informe') opciones.sinInforme = true
  }
  return opciones
}

// ------------------------------------------------------- lo que corre en la página

const ENTRAR_COMO = (usuario) => {
  localStorage.setItem('alpha-usuario', usuario)
}

const SALON_MONTADO = () => !!document.querySelector('[data-testigo="sujeto"], [data-hueco="sinPatron"]')

const HAY_SUJETO_Y_MANDO = () => ({
  sujeto: !!document.querySelector('[data-testigo="sujeto"]'),
  mando: !!document.querySelector('button[aria-label^="Mando del reloj de la pared"]'),
})

/**
 * ¿YA SE RETIRÓ EL ANUNCIO DEL EJERCICIO? Mientras el tablón lo anuncia,
 * `HuecoDeDatos.tsx` enseña la CARGA en vez del reloj (`data-hueco-muro="carga"`, nunca
 * `"reloj"`) — es el mismo hueco, por turnos, y el turno del reloj es el que hace falta
 * para leer «antes» de tocar el mando. Sin esperar a esto, `TEXTO_DEL_RELOJ` daba `null`
 * siempre: no es que el selector estuviera mal, es que ese botón todavía no existía.
 */
const RELOJ_LISTO = () => document.querySelector('[data-hueco-muro="reloj"]') !== null

async function esperarQue(dt, fnPagina, limiteMs, pasoMs = 300) {
  const t0 = Date.now()
  while (Date.now() - t0 < limiteMs) {
    if (await dt.evaluar(comoExpresion(fnPagina))) return true
    await esperar(pasoMs)
  }
  return false
}

/** El centro del disco del mando, en coordenadas de viewport. */
const RECT_DEL_MANDO = () => {
  const boton = document.querySelector('button[aria-label^="Mando del reloj de la pared"]')
  if (!boton) return null
  const r = boton.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/**
 * El texto vivo del reloj de la pared.
 *
 * En modo «sesión» —el que trae el salón al entrar, y el único que este testigo puede
 * probar sin antes tirar de verdad del mando (que es un gesto que esta tarea no hace: el
 * encargo es solo el toque sostenido)— la pared no monta `CuentaAtrasDelMuro`, monta el
 * MISMO `CronometroSesion` que corre en la pantalla de sesión (`HuecoDeDatos.tsx`: «si
 * modo==='sesion', RotuloCronometro; si no, CuentaAtrasDelMuro»). Se busca por su
 * `aria-label` — «Pausar cronómetro» o «Reanudar cronómetro»`, según esté corriendo o no—
 * porque la clase que lo viste en la pared (`muro-reloj`) la aplica una variante arbitraria
 * de Tailwind (`[&_button]:muro-reloj`) que pone el ESTILO sobre el botón por selector de
 * hoja de estilos, y no añade ese nombre a `classList` en el DOM — buscarla como clase
 * literal no encuentra nada, y fue el primer intento de este testigo.
 */
const TEXTO_DEL_RELOJ = () =>
  document.querySelector('button[aria-label="Pausar cronómetro"], button[aria-label="Reanudar cronómetro"]')
    ?.textContent ?? null

/**
 * EL RÓTULO DEL RELOJ — «Sesión», «Descanso» o «Excéntrico». A diferencia de
 * `TEXTO_DEL_RELOJ` (la cifra, que tica sola) este texto es discreto: solo cambia si el
 * modo cambia, y es lo que de verdad hace falta comparar «antes y después» (ver la nota
 * grande de arriba). Sube desde el botón del cronómetro hasta encontrar el `.muro-rotulo`
 * más cercano — no uno global con `document.querySelector('.muro-rotulo')`, que esa clase
 * también la lleva «Carga a usar» y cualquier otro rótulo del muro.
 */
const ROTULO_DEL_RELOJ = () => {
  const boton = document.querySelector('button[aria-label="Pausar cronómetro"], button[aria-label="Reanudar cronómetro"]')
  if (!boton) return null
  let nodo = boton.parentElement
  for (let i = 0; i < 5 && nodo; i++) {
    const rotulo = nodo.querySelector('.muro-rotulo')
    if (rotulo) return (rotulo.textContent ?? '').trim() || null
    nodo = nodo.parentElement
  }
  return null
}

// ------------------------------------------------------------------ un intento
//
// NO SE AÍSLA EL SUJETO tapando el resto con `visibility:hidden` —a diferencia de
// `partir-el-visor.mjs` y del medidor de `capa/interfaz`, que sí lo hacen—, y no por
// descuido: se probó, y tapar el resto del salón deja al disco del mando con
// `visibility:hidden` (es hermano del sujeto, no su hijo), y un toque sobre un nodo así
// no llega a su manejador — el «después» del reloj salía `null` porque el hueco del muro
// se reiniciaba a mitad de gesto, no porque el mando hiciera nada raro. Diferenciar el
// sujeto de un disco de 52×52 y un par de cifras no hace falta: sus 150.000-200.000
// píxeles de cambio por paso entierran cualquier ruido de alrededor sin necesidad de
// taparlo, y la resta completa de la pantalla es la que de verdad ve lo que ve un dedo.

/** Un intento completo del gesto. Devuelve el resultado; no decide si reintentar. */
async function unIntento(dt, opciones, usuario) {
  const raiz = opciones.url

  await dt.pedir('Page.navigate', { url: raiz })
  await esperar(700)
  await dt.evaluar(comoExpresion(ENTRAR_COMO, usuario))
  await dt.pedir('Page.navigate', { url: `${raiz}/entrenar` })
  await esperar(2200)

  const montado = await dt.evaluar(comoExpresion(SALON_MONTADO))
  if (!montado) throw new Error(`el salón no montó (sujeto o sinPatron) para "${usuario}"`)

  const hay = await dt.evaluar(comoExpresion(HAY_SUJETO_Y_MANDO))
  if (!hay.sujeto || !hay.mando) return { ok: false, motivo: `sin sujeto o sin mando (${JSON.stringify(hay)})` }

  // El anuncio del ejercicio tapa el reloj con la carga durante unos segundos al entrar
  // (ver `RELOJ_LISTO`); sin esto `TEXTO_DEL_RELOJ` mide contra un botón que no existe.
  const relojListo = await esperarQue(dt, RELOJ_LISTO, 15_000)
  if (!relojListo) return { ok: false, motivo: 'el hueco del reloj no se retiró de "carga" en 15 s' }

  await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))

  const rect = await dt.evaluar(comoExpresion(RECT_DEL_MANDO))
  if (!rect) return { ok: false, motivo: 'no encontré el disco del mando' }

  const rotuloAntes = await dt.evaluar(comoExpresion(ROTULO_DEL_RELOJ))
  const cifraAntes = await dt.evaluar(comoExpresion(TEXTO_DEL_RELOJ))
  if (rotuloAntes === null) return { ok: false, motivo: 'el hueco dice "reloj" pero no encontré su rótulo ni su cronómetro' }

  // ---- agarrar: bajar y aguantar por encima de ESPERA_DEL_RECORRIDO ----
  await bajarDedo(dt, rect.x, rect.y)
  await esperar(ESPERA_USADA)

  const capturas = []
  capturas.push(await dt.captura()) // el estado recién agarrado, antes de mover un píxel

  // ---- recorrer: diez pasos de 18 px, con toque SOSTENIDO (touchMove, no soltar) ----
  for (let paso = 1; paso <= PASOS; paso++) {
    const x = rect.x + Math.round(paso * PASO_PX)
    await dt.pedir('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: rect.y }] })
    await esperar(80) // que el fotograma siguiente ya haya subido la pose nueva
    capturas.push(await dt.captura())
  }

  await soltarDedo(dt)
  const rotuloDespues = await dt.evaluar(comoExpresion(ROTULO_DEL_RELOJ))
  const cifraDespues = await dt.evaluar(comoExpresion(TEXTO_DEL_RELOJ))

  return { ok: true, rotuloAntes, rotuloDespues, cifraAntes, cifraDespues, capturas }
}

// ------------------------------------------------------------------ principal

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(`\n  tiempo-de-la-repeticion: ${opciones.url}/entrenar\n`)

  const carpetaFotos = join(RAIZ, 'informes', 'tiempo-de-la-repeticion')
  const { proceso } = await arrancarChrome({ chrome: opciones.chrome, puerto: opciones.puerto, ancho: ANCHO, alto: ALTO })
  let dt = null
  let idObjetivo = null
  let resultado = null
  let usuarioUsado = null
  const intentos = []

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

    // ---- resolver usuario (una vez, se reutiliza en los reintentos) ----
    for (const candidato of opciones.candidatos) {
      await dt.pedir('Page.navigate', { url: opciones.url })
      await esperar(700)
      await dt.evaluar(comoExpresion(ENTRAR_COMO, candidato))
      await dt.pedir('Page.navigate', { url: `${opciones.url}/entrenar` })
      await esperar(2200)
      const hay = await dt.evaluar(comoExpresion(HAY_SUJETO_Y_MANDO))
      if (hay.sujeto && hay.mando) {
        usuarioUsado = candidato
        break
      }
    }
    if (!usuarioUsado) throw new Error(`ningún candidato (${opciones.candidatos.join(', ')}) mostró sujeto + mando`)

    for (let intento = 1; intento <= opciones.reintentos; intento++) {
      const r = await unIntento(dt, opciones, usuarioUsado)
      if (!r.ok) {
        intentos.push({ intento, ok: false, motivo: r.motivo })
        continue
      }
      const rotuloEstable = r.rotuloAntes === r.rotuloDespues
      intentos.push({
        intento,
        ok: true,
        rotuloEstable,
        rotuloAntes: r.rotuloAntes,
        rotuloDespues: r.rotuloDespues,
        cifraAntes: r.cifraAntes,
        cifraDespues: r.cifraDespues,
      })
      if (rotuloEstable) {
        resultado = r
        break
      }
      console.log(`  [intento ${intento}] el rótulo del reloj cambió («${r.rotuloAntes}» → «${r.rotuloDespues}»), reintentando ...`)
    }
  } finally {
    if (dt) dt.cerrar()
    if (idObjetivo) {
      await fetch(`http://127.0.0.1:${opciones.puerto}/json/close/${idObjetivo}`).catch(() => {})
      await esperar(400)
    }
    proceso.kill()
  }

  if (!resultado) {
    const acta = {
      cuando: new Date().toISOString(),
      ok: false,
      motivo: 'el reloj de la pared no se mantuvo estable en ningún intento',
      intentos,
    }
    console.error(`\n  el testigo no pudo confirmar un reloj estable en ${opciones.reintentos} intentos\n`)
    if (!opciones.sinInforme) writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
    process.exitCode = 1
    return
  }

  // ---------------------------------------------------------- restar consecutivas
  if (!existsSync(carpetaFotos)) mkdirSync(carpetaFotos, { recursive: true })

  const mascaras = []
  for (let i = 1; i < resultado.capturas.length; i++) {
    const a = resultado.capturas[i - 1]
    const b = resultado.capturas[i]
    const { mascara, cuenta } = mascaraDeCambio(a, b)
    const rutaMascara = join(carpetaFotos, `paso-${String(i).padStart(2, '0')}-mascara.png`)
    const gris = Buffer.from(mascara.map((v) => (v ? 255 : 0)))
    writeFileSync(rutaMascara, codificarPngGris(a.ancho, a.alto, gris))
    mascaras.push({ paso: i, pixelesCambiados: cuenta, mascara: rutaMascara })
    console.log(`  paso ${String(i).padStart(2, '0')}  pixelesCambiados=${String(cuenta).padStart(6)}`)
  }

  // Dos capturas de evidencia: la primera (recién agarrado) y la última (fondo del recorrido).
  const rutaInicio = join(carpetaFotos, 'agarrado.png')
  const rutaFin = join(carpetaFotos, 'fondo-del-recorrido.png')
  const primera = resultado.capturas[0]
  const ultima = resultado.capturas[resultado.capturas.length - 1]
  writeFileSync(rutaInicio, codificarPngRgb(primera.ancho, primera.alto, primera.rgb))
  writeFileSync(rutaFin, codificarPngRgb(ultima.ancho, ultima.alto, ultima.rgb))

  const todasDistintasDeCero = mascaras.every((m) => m.pixelesCambiados > 0)

  const acta = {
    cuando: new Date().toISOString(),
    ok: true,
    usuario: usuarioUsado,
    intentos,
    esperaUsadaMs: ESPERA_USADA,
    pasos: PASOS,
    pxPorPaso: PASO_PX,
    // El texto del reloj de la pared, comparado antes y después — pero por el RÓTULO
    // («Sesión»/«Descanso»/«Excéntrico»), no por la cifra que tica sola cada segundo real.
    // Ver la nota grande de arriba: comparar la cifra al pie de la letra fallaría casi
    // siempre, y no por nada que el gesto haya hecho.
    relojAntes: resultado.rotuloAntes,
    relojDespues: resultado.rotuloDespues,
    relojIdentico: resultado.rotuloAntes === resultado.rotuloDespues,
    // La cifra viva, solo como contexto: puede diferir por el simple paso del tiempo.
    cifraDelCronometroAntes: resultado.cifraAntes,
    cifraDelCronometroDespues: resultado.cifraDespues,
    mascaras,
    todasDistintasDeCero,
    capturaAgarrado: rutaInicio,
    capturaFondoDelRecorrido: rutaFin,
  }

  console.log(
    `\n  TOTAL: reloj ${acta.relojIdentico ? 'idéntico' : 'DISTINTO'} (antes="${acta.relojAntes}" después="${acta.relojDespues}", cifra ${acta.cifraDelCronometroAntes}→${acta.cifraDelCronometroDespues}) · ` +
      `${mascaras.filter((m) => m.pixelesCambiados > 0).length}/${mascaras.length} pasos con cambio en el sujeto\n`,
  )

  if (!opciones.sinInforme) {
    writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
    console.log(`  acta escrita en ${opciones.salida}\n`)
  } else {
    console.log(JSON.stringify(acta, null, 2))
  }

  process.exitCode = acta.relojIdentico && todasDistintasDeCero ? 0 : 1
}

principal().catch((e) => {
  console.error(`\n  el testigo se paró: ${e.stack || e.message}`)
  process.exitCode = 2
})
