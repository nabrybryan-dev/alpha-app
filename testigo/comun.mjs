/**
 * LO QUE SIRVE PARA MEDIR CUALQUIER PANTALLA, y no solo el salón.
 *
 * Salió de `testigo/salon-visible.mjs` el 2026-09-02, tal cual, sin cambiarle una línea:
 * abrir un Chrome de verdad, hablarle por su protocolo, decodificar el PNG de una captura
 * y restar dos capturas descontando lo que se mueve solo. Nada de aquí sabe qué es una
 * sala, un sujeto ni una casilla.
 *
 * Se extrajo al escribir el segundo testigo —el de las cuatro pantallas con movimiento—
 * porque la alternativa era copiar trescientas líneas, y dos copias de un medidor se
 * separan al primer ajuste: entonces dos pantallas medidas «igual» dejan de ser
 * comparables sin que nadie se entere.
 *
 * ## Lo que hay que saber para usarlo
 *
 * - **No es headless.** Se abre una ventana de verdad y se trae al frente, porque
 *   `document.visibilityState` solo vale `visible` con la pestaña delante: medir detrás no
 *   da un número malo, da uno falso que parece bueno.
 * - **`contarAporte` descuenta el churn**, la máscara de píxeles que cambian solos. Sin
 *   ella, un reloj corriendo basta para que cualquier cosa parezca visible.
 * - **El congelador para animaciones CSS, no bucles de `requestAnimationFrame`.** Lo que
 *   se mueva por lienzo hay que pararlo aparte —el salón lo hace emulando
 *   `prefers-reduced-motion`— o todos sus píxeles se van al churn y dejan de medirse.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import zlib from 'node:zlib'

// Cuánto tiene que cambiar un píxel para contarlo. El PNG es sin pérdida, así que el
// ruido de compresión no existe; 8 sobre 765 solo descarta el redondeo del antialiasing
// sobre bordes de texto.
export const UMBRAL_CAMBIO = 8
// Un píxel cuenta como "no negro" si su canal más alto pasa de aquí. El listón va bajo:
// se busca si hay algo pintado, no si está iluminado.
export const UMBRAL_NO_NEGRO = 10

export function buscarChrome(preferido) {
  const candidatos = [
    preferido,
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ].filter(Boolean)
  for (const ruta of candidatos) if (existsSync(ruta)) return ruta
  throw new Error(
    'no encuentro Chrome. Pásalo con --chrome="C:/ruta/chrome.exe" o en CHROME_PATH.',
  )
}

export function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function arrancarChrome(opciones) {
  const binario = buscarChrome(opciones.chrome)
  // Perfil aparte y desechable, y DISTINTO POR LANZAMIENTO — no por pid.
  //
  // Hasta el 2026-09-08 el nombre era `testigo-salon-${process.pid}`, y un mismo proceso
  // Node que arranca Chrome dos veces seguidas (como hace `partir-el-visor.mjs`, una vez
  // por rama) le daba a las DOS el mismo directorio: el primer Chrome lo estrenaba frío
  // y el segundo lo heredaba con la caché de disco ya tibia —fuentes de Google
  // (`index.html:28`, `display=swap`) entre otras cosas—. Eso hacía que "la misma rama
  // contra sí misma" no diera cero: `partir-el-visor.mjs --ref-base=origin/main
  // --ref-nueva=origin/main` medía 1278/1253/1276/1265 píxeles de diferencia que eran del
  // ARNÉS, no del código —la rampa de antialiasing de un texto que en un lado ya tenía la
  // tipografía cargada y en el otro no—. `mkdtempSync` da un directorio nuevo y con
  // nombre único en cada llamada, así que dos Chrome del mismo proceso ya no comparten
  // caché entre sí.
  const perfil = mkdtempSync(join(tmpdir(), 'testigo-salon-'))
  const proceso = spawn(
    binario,
    [
      `--remote-debugging-port=${opciones.puerto}`,
      `--user-data-dir=${perfil}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,MediaRouter',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      // La ventana algo mayor que el viewport emulado: cabe el cromo del navegador
      // sin que el 414x736 se recorte.
      `--window-size=${(opciones.ancho ?? 414) + 16},${(opciones.alto ?? 736) + 120}`,
      '--window-position=0,0',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  )

  const limite = Date.now() + 30_000
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://127.0.0.1:${opciones.puerto}/json/version`)
      if (r.ok) return { proceso, perfil }
    } catch {
      /* Chrome aún no abrió el puerto; se reintenta. */
    }
    await esperar(200)
  }
  proceso.kill()
  throw new Error(`Chrome no abrió el puerto ${opciones.puerto} en 30 s`)
}

export async function objetivoDePagina(puerto) {
  const limite = Date.now() + 15_000
  while (Date.now() < limite) {
    const lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()
    const pagina = lista.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (pagina) return pagina
    await esperar(200)
  }
  throw new Error('Chrome no expuso ninguna pestaña')
}

// ------------------------------------------------------- protocolo DevTools

export class Devtools {
  constructor(ws) {
    this.ws = ws
    this.contador = 0
    this.enEspera = new Map()
    this.oyentes = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id !== undefined) {
        const enCurso = this.enEspera.get(msg.id)
        if (!enCurso) return
        this.enEspera.delete(msg.id)
        if (msg.error) enCurso.rechazar(new Error(`${msg.error.message} (${msg.error.code})`))
        else enCurso.resolver(msg.result)
      } else {
        for (const f of this.oyentes.get(msg.method) ?? []) f(msg.params)
      }
    })
  }

  static async conectar(url) {
    const ws = new WebSocket(url)
    await new Promise((resolver, rechazar) => {
      ws.addEventListener('open', resolver, { once: true })
      ws.addEventListener('error', () => rechazar(new Error('no pude abrir el WebSocket')), {
        once: true,
      })
    })
    return new Devtools(ws)
  }

  pedir(orden, params = {}) {
    const id = ++this.contador
    return new Promise((resolver, rechazar) => {
      this.enEspera.set(id, { resolver, rechazar })
      this.ws.send(JSON.stringify({ id, method: orden, params }))
      setTimeout(() => {
        if (this.enEspera.delete(id)) rechazar(new Error(`${orden} no respondió en 60 s`))
      }, 60_000)
    })
  }

  al(evento, fn) {
    const lista = this.oyentes.get(evento) ?? []
    lista.push(fn)
    this.oyentes.set(evento, lista)
  }

  /** Evalúa una función de la página y devuelve su valor ya deserializado. */
  async evaluar(fuente) {
    const r = await this.pedir('Runtime.evaluate', {
      expression: fuente,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) {
      throw new Error(
        `la página lanzó: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`,
      )
    }
    return r.result.value
  }

  async captura() {
    // LAS FUENTES DE GOOGLE LLEGAN TARDE, A PROPÓSITO (`index.html:28`,
    // `display=swap`): la primera pintura sale con la tipografía de sistema y cambia
    // sola en cuanto el `@font-face` termina de cargar. Sin esperar aquí, dos capturas
    // de la MISMA página en dos momentos de caché distintos —un perfil recién estrenado
    // contra uno con las fuentes ya en disco— pueden salir con el texto en fuentes
    // distintas: antialiasing y métricas de más, no un cambio de verdad. Es la causa que
    // dejaba `testigo/partir-el-visor.mjs --ref-base=origin/main --ref-nueva=origin/main`
    // —MISMO código a los dos lados— sin dar cero. Un frame extra después, porque
    // `fonts.ready` resuelve antes de que ese fotograma llegue a pintarse.
    //
    // LO QUE ESTO NO ARREGLA: si la petición de la fuente FALLA de verdad —no que tarde,
    // que falle— (una red que se corta a medio TLS, típico en un perfil recién estrenado
    // sin caché de DNS ni de conexión), `fonts.ready` también se resuelve: una
    // carga fallida es un estado tan «asentado» como una que cargó bien, y el navegador no
    // reintenta solo. Medido el 2026-09-08 con `--control` (misma rama a los dos lados):
    // tres corridas de cuatro salieron con las CUATRO capturas en 0 px, y una salió con la
    // PRIMERA captura del checkout —justo la que sigue al arranque más frío de Chrome— en
    // ~105.000 px, siempre la tipografía de sistema contra la de marca, nunca la escena
    // 3D. Es una falla de red de esta máquina, no del arnés ni del código: no hay
    // reintento aquí porque un reintento con umbral inventado sería tan arbitrario como no
    // esperar nada.
    await this.evaluar(
      'document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => r(true))))',
    )
    const r = await this.pedir('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    })
    return decodificarPng(Buffer.from(r.data, 'base64'))
  }

  cerrar() {
    try {
      this.ws.close()
    } catch {
      /* ya estaba cerrado */
    }
  }
}

// --------------------------------------------------------------- PNG a RGB

/**
 * Decodifica un PNG de 8 bits sin entrelazar a un Buffer RGB plano.
 * Se hace a mano porque el encargo prohíbe dependencias que haya que instalar y
 * `zlib` ya viene con Node; lo único que falta es deshacer los filtros por línea.
 */

export function decodificarPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('la captura no es un PNG')
  let p = 8
  let ancho = 0
  let alto = 0
  let profundidad = 0
  let tipoColor = 0
  const trozos = []
  while (p + 8 <= buf.length) {
    const largo = buf.readUInt32BE(p)
    const etiqueta = buf.toString('ascii', p + 4, p + 8)
    const datos = buf.subarray(p + 8, p + 8 + largo)
    if (etiqueta === 'IHDR') {
      ancho = datos.readUInt32BE(0)
      alto = datos.readUInt32BE(4)
      profundidad = datos[8]
      tipoColor = datos[9]
      if (datos[12] !== 0) throw new Error('PNG entrelazado, no lo sé leer')
    } else if (etiqueta === 'IDAT') trozos.push(datos)
    else if (etiqueta === 'IEND') break
    p += 12 + largo
  }
  if (profundidad !== 8) throw new Error(`profundidad de bit ${profundidad}, esperaba 8`)
  const canales = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipoColor]
  if (!canales) throw new Error(`tipo de color ${tipoColor}, no lo sé leer`)

  const crudo = zlib.inflateSync(Buffer.concat(trozos))
  const paso = ancho * canales
  const rgb = Buffer.alloc(ancho * alto * 3)
  let anterior = Buffer.alloc(paso)
  let q = 0
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[q++]
    const linea = Buffer.from(crudo.subarray(q, q + paso))
    q += paso
    for (let i = 0; i < paso; i++) {
      const a = i >= canales ? linea[i - canales] : 0
      const b = anterior[i]
      const c = i >= canales ? anterior[i - canales] : 0
      let v = linea[i]
      if (filtro === 1) v += a
      else if (filtro === 2) v += b
      else if (filtro === 3) v += (a + b) >> 1
      else if (filtro === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      linea[i] = v & 255
    }
    for (let x = 0; x < ancho; x++) {
      const s = x * canales
      const d = (y * ancho + x) * 3
      if (canales >= 3) {
        rgb[d] = linea[s]
        rgb[d + 1] = linea[s + 1]
        rgb[d + 2] = linea[s + 2]
      } else {
        rgb[d] = linea[s]
        rgb[d + 1] = linea[s]
        rgb[d + 2] = linea[s]
      }
    }
    anterior = linea
  }
  return { ancho, alto, rgb }
}

/** Máscara de los píxeles que difieren entre dos capturas del mismo tamaño. */

export function mascaraDeCambio(a, b) {
  const n = a.ancho * a.alto
  const mascara = new Uint8Array(n)
  let cuenta = 0
  for (let i = 0; i < n; i++) {
    const d = i * 3
    const delta =
      Math.abs(a.rgb[d] - b.rgb[d]) +
      Math.abs(a.rgb[d + 1] - b.rgb[d + 1]) +
      Math.abs(a.rgb[d + 2] - b.rgb[d + 2])
    if (delta > UMBRAL_CAMBIO) {
      mascara[i] = 1
      cuenta++
    }
  }
  return { mascara, cuenta }
}

// -------------------------------------------------- lo que corre EN LA PÁGINA

/**
 * Se serializa tal cual y se evalúa dentro de la página. Devuelve, EN UNA SOLA
 * llamada, el `visibilityState` y las geometrías: si se leyeran por separado, el
 * número podría venir de un instante en que la pestaña estaba delante y el estado
 * de otro en que ya no.
 */

export const CONGELAR_EN_PAGINA = () => {
  const hoja = document.createElement('style')
  hoja.id = 'testigo-congelador'
  hoja.textContent =
    '*,*::before,*::after{animation-play-state:paused !important;transition:none !important}'
  document.head.appendChild(hoja)
  return document.getAnimations ? document.getAnimations().length : -1
}

export function comoExpresion(fn, ...args) {
  return `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`
}

// ------------------------------------------------------------------ medida

export function unirRects(rects, ancho, alto) {
  const mascara = new Uint8Array(ancho * alto)
  let area = 0
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      const fila = y * ancho
      for (let x = r.x; x < r.x + r.w; x++) {
        if (!mascara[fila + x]) {
          mascara[fila + x] = 1
          area++
        }
      }
    }
  }
  return { mascara, area }
}

export function contarNoNegros(captura, mascara) {
  let cuenta = 0
  let maximo = 0
  for (let i = 0; i < mascara.length; i++) {
    if (!mascara[i]) continue
    const d = i * 3
    const l = Math.max(captura.rgb[d], captura.rgb[d + 1], captura.rgb[d + 2])
    if (l > UMBRAL_NO_NEGRO) cuenta++
    if (l > maximo) maximo = l
  }
  return { cuenta, maximo }
}

export function contarAporte(antes, despues, churn, dentroDe) {
  const n = antes.ancho * antes.alto
  let total = 0
  let dentro = 0
  for (let i = 0; i < n; i++) {
    if (churn[i]) continue
    const d = i * 3
    const delta =
      Math.abs(antes.rgb[d] - despues.rgb[d]) +
      Math.abs(antes.rgb[d + 1] - despues.rgb[d + 1]) +
      Math.abs(antes.rgb[d + 2] - despues.rgb[d + 2])
    if (delta > UMBRAL_CAMBIO) {
      total++
      if (dentroDe[i]) dentro++
    }
  }
  return { total, dentro }
}

// ------------------------------------------------------------------ toques

/**
 * Salió de `testigo/partir-el-visor.mjs` el 2026-09-07 por la misma razón que sacó todo
 * lo de arriba de `salon-visible.mjs`: dos testigos que necesitan tocar la pantalla de
 * verdad —no con `.click()` en la página, que prueba el DOM y no el dedo— no pueden cada
 * uno inventarse su propio `Input.dispatchTouchEvent`.
 *
 * Van por el protocolo de toque, no de ratón: `pointerType` es lo que decide, en el
 * salón, si un contacto cuenta como el primer dedo o el segundo (`dedos.current += 1`
 * solo con `e.pointerType === 'touch'`), y un `mousePressed` de DevTools nunca pone ese
 * valor.
 */

/** Un toque limpio: baja y sube el dedo en el mismo punto, sin arrastre de por medio. */
export async function tocar(dt, x, y) {
  await dt.pedir('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await dt.pedir('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/** Baja el dedo y lo deja apoyado en `(x, y)`. Quien llama decide cuánto sostenerlo. */
export async function bajarDedo(dt, x, y) {
  await dt.pedir('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
}

/** Levanta el dedo que quedó apoyado tras `bajarDedo`. */
export async function soltarDedo(dt) {
  await dt.pedir('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * Mueve el dedo que quedó apoyado tras `bajarDedo` a `(x, y)`, SIN soltarlo.
 *
 * Salió de `testigo/tiempo-de-la-repeticion.mjs` el 2026-09-08 por la misma razón que las
 * tres de arriba: ese testigo ya mandaba `touchMove` diez veces seguidas para recorrer el
 * mando, y `testigo/salon-visible.mjs` necesitó exactamente lo mismo para arrastrar hacia
 * abajo y salir del eje W después de hundirse — dos copias de la misma línea se separan al
 * primer ajuste, igual que ya se explicó arriba para `tocar`.
 */
export async function moverDedo(dt, x, y) {
  await dt.pedir('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
}

// ------------------------------------------------------------- gris a PNG

/**
 * Tabla y CRC32 de la especificación PNG — cada trozo (`IHDR`, `IDAT`, `IEND`) lleva el
 * suyo, y sin él Chrome y cualquier visor de imágenes rechazan el archivo entero.
 */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function trozoPng(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length, 0)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo), 0)
  return Buffer.concat([largo, cuerpo, crc])
}

/**
 * Lo común a codificar cualquier PNG sin pérdida de `canales` bytes por píxel: arma las
 * filas con su byte de filtro «ninguno» delante —no hace falta ganar nada comprimiendo
 * distinto para lo que esto sirve, que es poder abrir el archivo, no que pese poco— y las
 * envuelve en los tres trozos que un PNG necesita para ser un PNG.
 */
function codificarPng(ancho, alto, canales, tipoColor, datos) {
  const paso = ancho * canales
  const crudo = Buffer.alloc((paso + 1) * alto)
  for (let y = 0; y < alto; y++) {
    crudo[y * (paso + 1)] = 0 // filtro «ninguno»
    for (let x = 0; x < paso; x++) crudo[y * (paso + 1) + 1 + x] = datos[y * paso + x]
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // profundidad de bit
  ihdr[9] = tipoColor
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const idat = zlib.deflateSync(crudo)
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([firma, trozoPng('IHDR', ihdr), trozoPng('IDAT', idat), trozoPng('IEND', Buffer.alloc(0))])
}

/**
 * Codifica un mapa de un byte por píxel (0-255, escala de grises) a un PNG de verdad —
 * para una máscara de cambio (blanco donde algo cambió, negro donde no) que se pueda
 * abrir y mirar directamente, en vez de quedarse solo como un número en un JSON.
 */
export function codificarPngGris(ancho, alto, gris) {
  return codificarPng(ancho, alto, 1, 0, gris)
}

/**
 * Codifica un buffer RGB plano (el mismo formato que devuelve `decodificarPng`) a un PNG
 * de verdad. Sirve para volver a guardar en disco una captura que ya se decodificó para
 * medir, sin tener que pedirle a Chrome una segunda captura solo para tener el archivo.
 */
export function codificarPngRgb(ancho, alto, rgb) {
  return codificarPng(ancho, alto, 3, 2, rgb)
}
