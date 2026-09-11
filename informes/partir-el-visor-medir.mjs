#!/usr/bin/env node
/**
 * LAS CUATRO FOTOS DEL VISOR, para probar que partirlo no movió un píxel.
 *
 * `partir-el-visor` no cambia nada de lo que se ve: saca cuatro trozos de
 * `VisorPatron.tsx` y `motor.ts` a sus propios archivos. Eso no lo puede firmar un test
 * —en jsdom no hay WebGL, así que un lienzo sin pintar mide igual que uno pintado—, así
 * que se firma restando dos capturas de un Chrome de verdad: una con el código de
 * `origin/main` y otra con el código partido.
 *
 * Se sacan CUATRO vistas: dos ejercicios (dos patrones distintos, por los puntos de
 * abajo) por dos capas del eje W (la 0, piel, y la 4, hueso). Un solo cuadro podría salir
 * idéntico por casualidad —el sujeto quieto en la fase 0—; cuatro cubren dos mallas
 * distintas y dos juegos de piezas encendidas.
 *
 * ## Lo que se fotografía es EL LIENZO, y por qué
 *
 * Antes de disparar se ocultan con `visibility` todos los nodos que no cuelgan de
 * `[data-testigo="sujeto"]`. No es maquillaje: el salón lleva encima un reloj de sesión
 * que cambia de segundo, y entre dos corridas separadas por minutos ese reloj marca otra
 * hora. Sin esconderlo, la resta nunca daría cero por una razón que no tiene nada que ver
 * con lo que se mide — el reloj no lo dibuja el visor. Lo que queda en la foto es
 * exactamente lo que el visor pinta.
 *
 * El movimiento se para emulando `prefers-reduced-motion: reduce`, como hace
 * `testigo/salon-visible.mjs`: el visor lo respeta y deja el modelo quieto en su
 * fotograma. Con el gesto corriendo, todos los píxeles del cuerpo cambian solos.
 *
 * ## Cómo se corre
 *
 *   1. Levanta la app en demo (sin .env, para que entre el seed):
 *      node --input-type=module -e "import {createServer} from 'vite'; const s = await createServer({ envDir: 'vacio-tmp', server: { port: 5181, host: '127.0.0.1' } }); await s.listen()"
 *   2. node informes/partir-el-visor-medir.mjs --etiqueta=antes    (con origin/main puesto)
 *   3. node informes/partir-el-visor-medir.mjs --etiqueta=despues  (con la rama puesta)
 *   4. node informes/partir-el-visor-medir.mjs --comparar
 *
 * Opciones: --url, --puerto, --usuario, --etiqueta, --comparar, --chrome.
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  comoExpresion,
  Devtools,
  decodificarPng,
  esperar,
  mascaraDeCambio,
  objetivoDePagina,
} from '../testigo/comun.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ANCHO = 414
const ALTO = 736

function leerArgumentos(argv) {
  const o = {
    url: 'http://127.0.0.1:5181/entrenar',
    puerto: 9351,
    chrome: '',
    usuario: 'u-valentina',
    etiqueta: 'despues',
    comparar: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, ...resto] = bruto.replace(/^--/, '').split('=')
    const valor = resto.join('=')
    if (nombre === 'url') o.url = valor
    else if (nombre === 'puerto') o.puerto = Number(valor)
    else if (nombre === 'chrome') o.chrome = valor
    else if (nombre === 'usuario') o.usuario = valor
    else if (nombre === 'etiqueta') o.etiqueta = valor
    else if (nombre === 'comparar') o.comparar = true
    else throw new Error(`opción que no conozco: ${bruto}`)
  }
  return o
}

/** Deja visible solo el lienzo del sujeto. Ver la cabecera. */
const SOLO_EL_LIENZO = () => {
  const hoja = document.createElement('style')
  hoja.id = 'solo-el-lienzo'
  hoja.textContent =
    'body *{visibility:hidden !important}' +
    '[data-testigo="sujeto"],[data-testigo="sujeto"] *{visibility:visible !important}'
  document.head.appendChild(hoja)
  return !!document.querySelector('[data-testigo="sujeto"] canvas')
}

const CAPA_W = () => {
  const s = document.querySelector('[data-salon="entrenar"]')
  const v = s && s.getAttribute('data-w')
  return v === null || v === undefined ? -1 : Number(v)
}

const CENTRO_DEL_LIENZO = () => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
}

/** Pasa al ejercicio `i` por los puntos de abajo, que es por donde pasa un dedo. */
const IR_AL_EJERCICIO = (i) => {
  const botones = Array.from(document.querySelectorAll('[data-puntos="ejercicios"] button'))
  if (!botones[i]) return { ok: false, cuantos: botones.length }
  botones[i].click()
  return { ok: true, cuantos: botones.length }
}

const QUE_EJERCICIO = () => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  return {
    patron: c ? c.getAttribute('aria-label') || '' : '',
    partes: c ? c.dataset.partes || '' : '',
    w: (() => {
      const s = document.querySelector('[data-salon="entrenar"]')
      return s ? s.getAttribute('data-w') : null
    })(),
  }
}

const SONDEO = () => ({
  salon: !!document.querySelector('[data-salon="entrenar"]'),
  marcas: document.querySelectorAll('[data-testigo]').length,
})

async function esperarAlSalon(dt) {
  const limite = Date.now() + 45_000
  let ultimo = null
  while (Date.now() < limite) {
    ultimo = await dt.evaluar(comoExpresion(SONDEO))
    if (ultimo.salon && ultimo.marcas > 0) return ultimo
    await esperar(500)
  }
  return ultimo
}

const raton = (dt, tipo, x, y) =>
  dt.pedir('Input.dispatchMouseEvent', { type: tipo, x, y, button: 'left', clickCount: 1, buttons: tipo === 'mouseReleased' ? 0 : 1 })

/**
 * HUNDIR EL DEDO HASTA EL HUESO. Aguantar sobre el cuerpo atraviesa una capa cada
 * `ESCALON_MS` tras una `ESPERA` de 320 ms (`capas/hundirEnElCuerpo.ts`): 320 + 3×450 =
 * 1.670 ms para llegar al 4, y se para solo al fondo. Se aguantan 2,4 s.
 */
async function hundirHastaElHueso(dt, centro) {
  await raton(dt, 'mousePressed', centro.x, centro.y)
  await esperar(2400)
  await raton(dt, 'mouseReleased', centro.x, centro.y)
  await esperar(1400)
}

/**
 * VOLVER A LA PIEL. Hacia abajo se sale, y un arrastre completo son 72 px
 * (`capas/gestoVertical.ts`), con el origen mudándose en cada escalón: cinco tirones de
 * 80 px devuelven las cuatro capas con uno de sobra.
 */
async function salirALaPiel(dt, centro) {
  await raton(dt, 'mousePressed', centro.x, centro.y)
  for (let i = 1; i <= 5; i++) {
    await raton(dt, 'mouseMoved', centro.x, centro.y + i * 80)
    await esperar(120)
  }
  await raton(dt, 'mouseReleased', centro.x, centro.y + 400)
  await esperar(1400)
}

async function fotografiar(dt, nombre, opciones) {
  const r = await dt.pedir('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const ruta = join(RAIZ, 'informes', `partir-el-visor-${opciones.etiqueta}-${nombre}.png`)
  writeFileSync(ruta, Buffer.from(r.data, 'base64'))
  const dato = await dt.evaluar(comoExpresion(QUE_EJERCICIO))
  console.log(`  ${nombre}: ${ruta.split(/[\\/]/).pop()} — ${dato.patron} · w=${dato.w}`)
  return ruta
}

async function tomarLasCuatro(opciones) {
  const { proceso } = await arrancarChrome({ ...opciones, ancho: ANCHO, alto: ALTO })
  let dt = null
  try {
    const objetivo = await objetivoDePagina(opciones.puerto)
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
    await dt.pedir('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    await dt.pedir('Page.bringToFront')

    const raiz = new URL(opciones.url).origin
    const primera = new Promise((r) => dt.al('Page.loadEventFired', r))
    await dt.pedir('Page.navigate', { url: raiz })
    await Promise.race([primera, esperar(30_000)])
    await dt.evaluar(comoExpresion((u) => localStorage.setItem('alpha-usuario', u), opciones.usuario))
    const cargada = new Promise((r) => dt.al('Page.loadEventFired', r))
    await dt.pedir('Page.navigate', { url: opciones.url })
    await Promise.race([cargada, esperar(30_000)])
    const sondeo = await esperarAlSalon(dt)
    if (!sondeo || !sondeo.salon) throw new Error('el salón no llegó a montarse')
    // Que la sala de Blender esté descargada y subida, y que la cámara termine su viaje.
    await esperar(6000)
    await dt.pedir('Page.bringToFront')
    const conLienzo = await dt.evaluar(comoExpresion(SOLO_EL_LIENZO))
    if (!conLienzo) throw new Error('no encuentro el lienzo del sujeto')
    await esperar(800)
    const centro = await dt.evaluar(comoExpresion(CENTRO_DEL_LIENZO))
    if (!centro) throw new Error('no encuentro el centro del lienzo')

    const fotos = []
    for (const ejercicio of [0, 1]) {
      if (ejercicio > 0) {
        const paso = await dt.evaluar(comoExpresion(IR_AL_EJERCICIO, ejercicio))
        console.log(`  cambio de ejercicio: ${JSON.stringify(paso)}`)
        await esperar(3000)
      }
      let puesta = await dt.evaluar(comoExpresion(CAPA_W))
      if (puesta !== 0) console.log(`  ojo: se esperaba w=0 y hay w=${puesta}`)
      fotos.push(await fotografiar(dt, `p${ejercicio + 1}-w0`, opciones))
      await hundirHastaElHueso(dt, centro)
      puesta = await dt.evaluar(comoExpresion(CAPA_W))
      if (puesta !== 4) console.log(`  ojo: se pidió w=4 y hay w=${puesta}`)
      fotos.push(await fotografiar(dt, `p${ejercicio + 1}-w4`, opciones))
      await salirALaPiel(dt, centro)
    }
    return fotos
  } finally {
    if (dt) dt.cerrar()
    try {
      proceso.kill()
    } catch {
      /* ya estaba muerto */
    }
  }
}

function comparar() {
  const dir = join(RAIZ, 'informes')
  const nombres = readdirSync(dir)
    .filter((f) => /^partir-el-visor-antes-.*\.png$/.test(f))
    .map((f) => f.replace('partir-el-visor-antes-', '').replace('.png', ''))
  if (!nombres.length) throw new Error('no hay capturas «antes» que comparar')
  const filas = []
  for (const nombre of nombres) {
    const a = join(dir, `partir-el-visor-antes-${nombre}.png`)
    const b = join(dir, `partir-el-visor-despues-${nombre}.png`)
    if (!existsSync(b)) throw new Error(`falta la captura «después» de ${nombre}`)
    const ia = decodificarPng(readFileSync(a))
    const ib = decodificarPng(readFileSync(b))
    if (ia.ancho !== ib.ancho || ia.alto !== ib.alto) {
      throw new Error(`${nombre}: las dos capturas no miden lo mismo`)
    }
    const { cuenta } = mascaraDeCambio(ia, ib)
    filas.push({ vista: nombre, pixeles: ia.ancho * ia.alto, cambiados: cuenta })
    console.log(`  ${nombre}: ${cuenta} px cambiados de ${ia.ancho * ia.alto}`)
  }
  const total = filas.reduce((s, f) => s + f.cambiados, 0)
  writeFileSync(
    join(dir, 'partir-el-visor-mascara.json'),
    `${JSON.stringify({ fecha: new Date().toISOString(), filas, total }, null, 2)}\n`,
    'utf8',
  )
  console.log(`  total: ${total} px`)
  if (total !== 0) process.exitCode = 1
}

const opciones = leerArgumentos(process.argv)
if (opciones.comparar) {
  comparar()
} else {
  console.log(`Fotos «${opciones.etiqueta}» contra ${opciones.url}`)
  await tomarLasCuatro(opciones)
}
