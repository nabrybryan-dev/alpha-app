#!/usr/bin/env node
/**
 * ¿SE ESCRIBE UNA CIFRA ENCIMA DE OTRA, O ENCIMA DEL MURO?
 *
 * La otra mitad del criterio 3 del kit. `carteles-y-sujeto.mjs` comprueba que ningún
 * cartel se dibuje sobre el SUJETO; este comprueba lo otro que el mismo criterio prohíbe
 * con las mismas palabras: que no se dibuje sobre OTRO TEXTO. Y el otro texto son las tres
 * cifras hermanas y el tablón del muro.
 *
 * Hace falta un navegador por lo de siempre: en jsdom no hay maquetación y los cuatro
 * carteles caen en 0×0, así que cualquier solape sale a cero y el guardián nace verde.
 *
 * ## Aquí se mide la CAJA, y a propósito
 *
 * Su hermano mide tinta porque comparaba un cartel casi transparente contra una silueta.
 * Aquí las dos cosas que chocan son cajas de texto, y dos cajas de texto cruzadas ya son
 * ilegibles aunque sus trazos no coincidan píxel a píxel: «REPETICIONES» sobre «DESCANSO»
 * no se lee ni cuando las letras caen en los huecos de las otras.
 *
 * ## Solo cuentan las cifras que SE VEN
 *
 * Desde el 2026-09-11 la cifra entra, se lee y se retira, y lo que queda plantado es el
 * poste. La caja de una cifra retirada no le estorba a nadie: se descartan por
 * `data-retirada` y por opacidad. Y para poder recorrer las trece posiciones de cámara sin
 * correr contra el reloj, la ventana de lectura se mantiene abierta a mano
 * (`MANTENER_LA_LECTURA`): son las cuatro puestas a la vez, que es el peor caso y es el
 * que hay que aguantar.
 *
 * ## Lo medido
 *
 * 2026-09-11, antes de `desviosDeLosCarteles`: en las seis muestras tomadas a lo largo de
 * la ventana de lectura SIEMPRE había al menos una pareja pisándose, y en cuatro de las
 * seis una cifra quedaba ENTERA dentro de otra (100 % de la menor). Con `--sin-esquivar`
 * —o sea, sin apartarse de nadie— se rozaban como mucho un 17-25 %: el amontonamiento lo
 * causaba el propio arreglo de no tapar al sujeto, con cada cartel huyendo por su cuenta
 * al mismo hueco libre.
 *
 * Uso:  npm run dev   (en otra consola)
 *       node testigo/cifras-que-se-pisan.mjs [--url=…] [--puerto=9333] [--sin-esquivar]
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const {
  arrancarChrome,
  objetivoDePagina,
  Devtools,
  esperar,
  comoExpresion,
  bajarDedo,
  moverDedo,
  soltarDedo,
} = await import(new URL('./comun.mjs', import.meta.url).href)

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

/** La ventana de lectura, abierta a mano para poder recorrer la vuelta entera. */
const MANTENER_LA_LECTURA = () => {
  const hoja = document.createElement('style')
  hoja.id = 'medida-lectura-abierta'
  // El `:not(...)` no sobra: sin él, el `!important` de esta hoja también destaparía las
  // cifras que el reparto decidió callar por no tener hueco limpio, y el instrumento
  // mediría un solape que la app no enseña. Un medidor que apaga la regla que va a medir
  // no mide nada.
  hoja.textContent =
    '.estacion-cifra[data-retirada]:not([data-sin-sitio]){visibility:visible !important}'
  document.head.appendChild(hoja)
  return true
}

const CLAVAR_DESVIOS = () => {
  const hoja = document.createElement('style')
  hoja.id = 'medida-sin-esquivar'
  hoja.textContent = '.estacion-cartel{--desvio-x:0px !important;--desvio-y:0px !important}'
  document.head.appendChild(hoja)
  return true
}

const LEER_LO_ESCRITO = () => {
  const raiz = document.querySelector('[data-salon="entrenar"]')
  const [azimut] = (raiz?.dataset.camara ?? '').split('|')
  const seVe = (n) => {
    const cifra = n.querySelector('.estacion-cifra')
    if (!cifra) return false
    const e = getComputedStyle(cifra)
    return e.visibility !== 'hidden' && Number(getComputedStyle(n).opacity) > 0.2
  }
  const caja = (n) => {
    const r = n.getBoundingClientRect()
    return { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, area: r.width * r.height }
  }
  const cifras = Array.from(document.querySelectorAll('.estacion-cartel'))
    .filter(seVe)
    .map((n) => ({ clave: n.dataset.cartel, ...caja(n) }))

  const corte = (a, b) =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

  const parejas = []
  for (let i = 0; i < cifras.length; i++) {
    for (let j = i + 1; j < cifras.length; j++) {
      const s = corte(cifras[i], cifras[j])
      if (s > 0) {
        parejas.push({
          a: cifras[i].clave,
          b: cifras[j].clave,
          pctDelMenor: Math.round((100 * s) / Math.min(cifras[i].area, cifras[j].area)),
        })
      }
    }
  }

  const muro = document.querySelector('[data-tablon]')
  const sobreElMuro = []
  if (muro) {
    const r = muro.getBoundingClientRect()
    const caja2 = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom }
    for (const c of cifras) {
      const pct = Math.round((100 * corte(c, caja2)) / c.area)
      if (pct > 0) sobreElMuro.push({ clave: c.clave, pct })
    }
  }

  return { azimut: Number(azimut), cuantas: cifras.length, parejas, sobreElMuro }
}

async function main() {
  const { proceso } = await arrancarChrome({ puerto: PUERTO, ancho: ANCHO, alto: ALTO })
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
    await dt.pedir('Page.bringToFront')

    const entrar = async (id) => {
      if (id) {
        const primera = new Promise((r) => dt.al('Page.loadEventFired', r))
        await dt.pedir('Page.navigate', { url: new URL(URL_APP).origin })
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

    await dt.evaluar(comoExpresion(MANTENER_LA_LECTURA))
    if (args.has('sin-esquivar')) {
      await dt.evaluar(comoExpresion(CLAVAR_DESVIOS))
      console.log('   los carteles NO se apartan: se está midiendo el antes.')
    }
    await esperar(800)

    const filas = []
    // Se orbita a tirones desde un punto FUERA del cuerpo (la franja de arriba), que es
    // donde un dedo mueve la cámara. Mismo recorrido que su hermano, para que las dos
    // medidas hablen de las mismas trece posiciones.
    for (let paso = 0; paso < 13; paso++) {
      if (paso > 0) {
        await bajarDedo(dt, 60, 150)
        for (let k = 1; k <= 6; k++) await moverDedo(dt, 60 + k * 10, 150)
        await soltarDedo(dt)
        await esperar(500)
      }
      await esperar(280)
      const f = await dt.evaluar(comoExpresion(LEER_LO_ESCRITO))
      const peor = f.parejas.length ? Math.max(...f.parejas.map((p) => p.pctDelMenor)) : 0
      const muro = f.sobreElMuro.length ? Math.max(...f.sobreElMuro.map((m) => m.pct)) : 0
      filas.push({ ...f, peor, peorSobreElMuro: muro })
      console.log(
        `azimut ${String(f.azimut).padStart(6)}°  ${f.cuantas} cifras  ` +
          `${String(f.parejas.length).padStart(2)} parejas se pisan  peor ${String(peor).padStart(3)} %  ` +
          `sobre el muro ${String(muro).padStart(3)} %`,
      )
    }

    const peorDeTodo = Math.max(0, ...filas.map((f) => f.peor))
    const peorMuro = Math.max(0, ...filas.map((f) => f.peorSobreElMuro))
    const conSolape = filas.filter((f) => f.parejas.length).length
    console.log(
      `\nPEOR pareja: ${peorDeTodo} %   PEOR sobre el muro: ${peorMuro} %   ` +
        `posiciones con alguna pareja: ${conSolape} de ${filas.length}`,
    )
    const salida = join(
      RAIZ,
      'informes',
      args.has('sin-esquivar') ? 'cifras-antes.json' : 'cifras-que-se-pisan.json',
    )
    writeFileSync(salida, JSON.stringify({ usuario, url: URL_APP, peorDeTodo, peorMuro, filas }, null, 2))
    console.log(`acta en ${salida}`)
  } finally {
    if (dt) dt.cerrar()
    if (!args.has('conservar')) proceso.kill()
  }
}

await main()
