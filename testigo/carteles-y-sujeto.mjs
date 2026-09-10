#!/usr/bin/env node
/**
 * ¿CUÁNTO TAPAN LOS CARTELES DE LAS ESTACIONES AL SUJETO?
 *
 * El criterio 3 del kit —«ningún rótulo, cifra ni panel … se dibuja encima del sujeto o de
 * otro texto»— no lo puede comprobar ningún test de este repo: en jsdom no hay maquetación,
 * así que los cuatro carteles y el cuerpo caen todos en 0×0 y cualquier solape sale a cero.
 * Hace falta un navegador de verdad, y esto es ese navegador.
 *
 * ## Se mide la TINTA, no la caja
 *
 * El rectángulo de un cartel es casi todo transparente —una etiqueta, una cifra y un pie—,
 * así que contar su `getBoundingClientRect` contra la silueta daría un número inflado que
 * no se parece a lo que se ve. Por cada posición de cámara se toman TRES capturas:
 *
 *   P  sin carteles, con sujeto   → la sala y el cuerpo
 *   Q  sin carteles, sin sujeto   → la sala sola (`data-sin=sujeto` en el lienzo)
 *   R  con carteles, con sujeto   → lo que ve el asesorado
 *
 * `P−Q` son los píxeles que pinta el CUERPO. `P−R` dentro de esa máscara son los píxeles
 * del cuerpo que el cartel se ha comido. Todo lo demás —fondo, sala, hierro— no cuenta.
 *
 * ## Se mide con el movimiento reducido, y eso es el PEOR caso a propósito
 *
 * Con `prefers-reduced-motion` las cuatro cifras se quedan puestas para siempre
 * (`tokens.css`: una animación que termina en `opacity: 0` dejaría la prescripción
 * invisible). Es un estado real de una persona real, y es cuando más se tapa.
 *
 * ## Lo medido
 *
 * 2026-09-10, antes de `sitioDelCartel.ts`: entre **9 % y 37 %** de la tinta del cuerpo
 * tapada, en las trece posiciones, mediana 25 %. Después: **0 % en la mitad y ≤1,6 % en el
 * resto**, que son bordes suavizados.
 *
 * Uso:  npm run dev   (en otra consola)
 *       node testigo/carteles-y-sujeto.mjs [--url=…] [--puerto=9333] [--fotos=N]
 *
 * `--fotos=N` escribe, de los pasos 0..N, la pantalla con carteles, sin ellos, y una
 * tercera con la tinta tapada EN VERDE. La foto manda sobre el número.
 */

import { existsSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const comun = await import(new URL('./comun.mjs', import.meta.url).href)
const {
  arrancarChrome,
  objetivoDePagina,
  Devtools,
  esperar,
  comoExpresion,
  CONGELAR_EN_PAGINA,
  mascaraDeCambio,
  codificarPngRgb,
  bajarDedo,
  moverDedo,
  soltarDedo,
} = comun

const ANCHO = 390
const ALTO = 844

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=')
    return [k, v.join('=') || 'si']
  }),
)
const URL_APP = args.get('url') ?? 'http://localhost:5173/entrenar'
const PUERTO = Number(args.get('puerto') ?? 9333)
const CANDIDATOS = (args.get('candidatos') ?? 'u-valentina,u-mateo,u-bryan,').split(',')

const RAMA_EN_PAGINA = () =>
  document.querySelector('[data-hueco="sinPatron"]') ? 'sinSujeto' : 'conSujeto'

const APAGAR_ESTACIONES = (apagar) => {
  let hoja = document.getElementById('medida-carteles')
  if (!hoja) {
    hoja = document.createElement('style')
    hoja.id = 'medida-carteles'
    document.head.appendChild(hoja)
  }
  hoja.textContent = apagar ? '[data-hueco="estaciones"]{display:none !important}' : ''
  return true
}

const APAGAR_SUJETO = (apagar) => {
  const lienzo = document.querySelector('[data-testigo="sujeto"] canvas, canvas[data-partes]')
  if (!lienzo) return 'sin lienzo'
  if (apagar) lienzo.dataset.sin = 'sujeto'
  else delete lienzo.dataset.sin
  return lienzo.dataset.sin ?? '(nada)'
}

const LEER_ESCENA = () => {
  const raiz = document.querySelector('[data-salon="entrenar"]')
  const [azimut, elevacion, distancia] = (raiz?.dataset.camara ?? '').split('|')
  const carteles = Array.from(document.querySelectorAll('[data-estacion]')).map((n) => {
    const cartel = n.querySelector('.estacion-cartel')
    const r = (cartel ?? n).getBoundingClientRect()
    return {
      clave: n.dataset.estacion,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      opacidad: Number(getComputedStyle(cartel ?? n).opacity),
    }
  })
  return { azimut: Number(azimut), elevacion: Number(elevacion), distancia: Number(distancia), carteles }
}

async function capturar(dt) {
  await esperar(280)
  return await dt.captura()
}

/** Máscara de los píxeles donde `a` y `b` difieren. */
function mascara(a, b) {
  return mascaraDeCambio(a, b)
}

async function main() {
  const { proceso, perfil } = await arrancarChrome({ puerto: PUERTO, ancho: ANCHO, alto: ALTO })
  let dt = null
  try {
    const objetivo = await objetivoDePagina(PUERTO)
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

    const entrar = async (id) => {
      if (id) {
        const raiz = new URL(URL_APP).origin
        const primera = new Promise((r) => dt.al('Page.loadEventFired', r))
        await dt.pedir('Page.navigate', { url: raiz })
        await Promise.race([primera, esperar(30000)])
        await dt.evaluar(comoExpresion((u) => localStorage.setItem('alpha-usuario', u), id))
      }
      const cargada = new Promise((r) => dt.al('Page.loadEventFired', r))
      await dt.pedir('Page.navigate', { url: URL_APP })
      await Promise.race([cargada, esperar(30000)])
      await esperar(3500)
      return await dt.evaluar(comoExpresion(RAMA_EN_PAGINA))
    }

    let usuario = ''
    for (const id of CANDIDATOS) {
      const rama = await entrar(id)
      usuario = id || '(el que elige la app)'
      console.log(`   ${usuario}: rama ${rama}`)
      if (rama === 'conSujeto') break
    }

    await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
    await esperar(600)

    const filas = []
    // Se orbita a tirones desde un punto FUERA del cuerpo (la franja de arriba), que es
    // donde un dedo mueve la cámara en las dos direcciones.
    for (let paso = 0; paso < 13; paso++) {
      if (paso > 0) {
        await bajarDedo(dt, 60, 150)
        for (let k = 1; k <= 6; k++) await moverDedo(dt, 60 + k * 10, 150)
        await soltarDedo(dt)
        await esperar(500)
      }
      const escena = await dt.evaluar(comoExpresion(LEER_ESCENA))

      await dt.evaluar(comoExpresion(APAGAR_ESTACIONES, true))
      const P = await capturar(dt)
      await dt.evaluar(comoExpresion(APAGAR_SUJETO, true))
      await esperar(500)
      const Q = await capturar(dt)
      await dt.evaluar(comoExpresion(APAGAR_SUJETO, false))
      await esperar(500)
      await dt.evaluar(comoExpresion(APAGAR_ESTACIONES, false))
      const R = await capturar(dt)

      const cuerpo = mascara(P, Q) // tinta del cuerpo
      const cambio = mascara(P, R) // lo que los carteles pintan encima
      let tapados = 0
      for (let i = 0; i < cuerpo.mascara.length; i++) {
        if (cuerpo.mascara[i] && cambio.mascara[i]) tapados++
      }
      const pct = cuerpo.cuenta > 0 ? (100 * tapados) / cuerpo.cuenta : 0
      if (args.has('fotos') && paso <= Number(args.get('fotos'))) {
        // La foto manda sobre el número: se pinta EN VERDE la tinta del cuerpo que el
        // cartel se come, sobre la pantalla tal y como la ve el asesorado.
        const tinta = Buffer.from(R.rgb)
        for (let i = 0; i < cuerpo.mascara.length; i++) {
          if (cuerpo.mascara[i] && cambio.mascara[i]) {
            tinta[i * 3] = 0
            tinta[i * 3 + 1] = 255
            tinta[i * 3 + 2] = 90
          }
        }
        writeFileSync(join(RAIZ, 'informes', `sala-${paso}-con.png`), codificarPngRgb(R.ancho, R.alto, R.rgb))
        writeFileSync(join(RAIZ, 'informes', `sala-${paso}-sin.png`), codificarPngRgb(P.ancho, P.alto, P.rgb))
        writeFileSync(join(RAIZ, 'informes', `sala-${paso}-tapado.png`), codificarPngRgb(R.ancho, R.alto, tinta))
      }
      filas.push({
        azimut: escena.azimut,
        cuerpoPx: cuerpo.cuenta,
        tapadosPx: tapados,
        pct: Number(pct.toFixed(2)),
        carteles: escena.carteles,
      })
      console.log(
        `azimut ${String(escena.azimut).padStart(6)}°  cuerpo ${String(cuerpo.cuenta).padStart(6)} px  ` +
          `tapado ${String(tapados).padStart(5)} px  = ${pct.toFixed(2)} %`,
      )
    }

    const salida = join(RAIZ, 'informes', 'carteles-sobre-el-sujeto.json')
    writeFileSync(salida, JSON.stringify({ usuario, url: URL_APP, filas }, null, 2))
    console.log(`\nacta en ${salida}`)
  } finally {
    if (dt) dt.cerrar()
    if (!args.has('conservar')) proceso.kill()
    void perfil
    void existsSync
  }
}

await main()
