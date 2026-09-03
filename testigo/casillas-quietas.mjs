/**
 * CUÁNTAS CASILLAS SE QUEDAN QUIETAS, en las cuatro pantallas que no son el salón.
 *
 * Es el testigo del PENDIENTE 2 de `SEMANA-2.md`, cuyo §5 dice «cero casillas quietas … y
 * eso lo cuenta un script». Hasta hoy ese script no existía, así que la condición no se
 * podía escribir: «que se vea con movimiento» no es comprobable sin opinar.
 *
 * ## Qué es una casilla, y por qué NO se marcan a mano
 *
 * Bryan la definió el 2026-09-02: **un cuadro con líneas donde se decide segmentar
 * información**. Así que se buscan por su forma —borde o fondo propio, esquinas
 * redondeadas, y tamaño de cuadro y no de chip— y no por una marca `data-`.
 *
 * La diferencia no es de gusto. Aquí lo que se cuenta son AUSENCIAS: casillas que no se
 * mueven. Con marcas a mano, la que se te olvide marcar no aparece como pendiente —
 * olvidarse sale gratis y el contador da cero por la razón contraria. Buscándolas por su
 * forma, una casilla nueva entra en la cuenta sola.
 *
 * ## Qué es «quieta», y por qué hacen falta las dos lecturas
 *
 * También suya: **una casilla sin ningún tipo de interfaz o diseño en tres dimensiones que
 * le dé movimiento** — giros, desplazamientos, bloques que se desintegran, adornos
 * interactivos. Ese listón no se comprueba con una sola pregunta:
 *
 *   1. **LO DECLARADO.** ¿La casilla o algo suyo declara una transformación 3D
 *      (`matrix3d`, `perspective`, `rotateX/Y`, `preserve-3d`) o una animación o transición
 *      que toque `transform`? Es barato y determinista. Su punto flaco: un movimiento
 *      declarado que no mueve nada pasa.
 *   2. **LO PINTADO.** ¿Cambian sus píxeles al entrar en la pantalla? Se hace con la misma
 *      resta del testigo del salón, ruido de fondo descontado. Su punto flaco: una casilla
 *      que solo se mueve al tocarla no cambia nada al entrar.
 *
 * Cada una tapa el agujero de la otra, así que una casilla cuenta como VIVA si pasa
 * cualquiera de las dos, y como QUIETA solo si falla las dos. Es la lectura generosa a
 * propósito: lo que se está buscando es lo que no se mueve DE NINGUNA manera.
 *
 * Y una advertencia que vale la pena leer antes de creerse un cero: esto mide movimiento,
 * no que el movimiento sea BUENO. «Cero quietas» no dice que las cuatro pantallas tengan
 * el acabado del §5; dice que no queda ninguna sin nada. El veredicto de si eso se ve como
 * tiene que verse sigue siendo del ojo de Bryan.
 *
 * Uso:
 *   node testigo/casillas-quietas.mjs
 *   --url=http://localhost:5173      la raíz de la app (se le añade cada ruta)
 *   --rutas=/,/bienestar,...         qué pantallas se recorren
 *   --salida=informes/testigo-casillas.json
 *   --usuario=u-valentina            con qué asesorado se entra, en modo demo
 *   --minimo=2400                    área en px² a partir de la cual un cuadro es casilla
 *   --foto=carpeta/                  guarda un retrato de cada pantalla
 *   --prueba-ciega                   LA PRUEBA DE QUE SABE DECIR QUE NO: exige que la
 *                                    lectura de lo declarado encuentre al menos una
 *                                    quieta en una pantalla fabricada sin movimiento.
 *                                    Sale 1 si el testigo no sabe verla.
 *   --sin-informe                    mide e imprime, no escribe el acta
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  comoExpresion,
  contarAporte,
  Devtools,
  esperar,
  mascaraDeCambio,
  objetivoDePagina,
  unirRects,
} from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// El mismo viewport que el salón: 414 x 736, que es 9:16 exacto y un iPhone Plus real.
const ANCHO = 414
const ALTO = 736

/** Las cuatro del PENDIENTE 2. El salón no está: tiene su propio testigo. */
const RUTAS_POR_DEFECTO = ['/', '/bienestar', '/nutricion', '/progreso']

/**
 * El área mínima para que un cuadro cuente como casilla.
 *
 * Sin suelo, la cuenta se llena de chips, botones y etiquetas —todos tienen borde y
 * esquina redondeada— y entonces «cero quietas» pide animar en 3D un `RIR 2`. 2.400 px²
 * son unos 120 x 20, más grande que cualquier chip y más pequeño que cualquier tarjeta.
 */
const MINIMO_POR_DEFECTO = 2400

// ---------------------------------------------------------------- argumentos

function leerArgumentos(argv) {
  const opciones = {
    url: 'http://localhost:5173',
    rutas: RUTAS_POR_DEFECTO,
    puerto: 9222,
    chrome: undefined,
    usuario: 'u-valentina',
    minimo: MINIMO_POR_DEFECTO,
    salida: join(RAIZ, 'informes', 'testigo-casillas.json'),
    foto: undefined,
    pruebaCiega: false,
    sinInforme: false,
    ancho: ANCHO,
    alto: ALTO,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, valor] = bruto.replace(/^--/, '').split('=')
    if (nombre === 'url') opciones.url = valor
    else if (nombre === 'rutas') opciones.rutas = valor.split(',').filter(Boolean)
    else if (nombre === 'puerto') opciones.puerto = Number(valor)
    else if (nombre === 'chrome') opciones.chrome = valor
    else if (nombre === 'usuario') opciones.usuario = valor
    else if (nombre === 'minimo') opciones.minimo = Number(valor)
    else if (nombre === 'salida') opciones.salida = valor
    else if (nombre === 'foto') opciones.foto = valor
    else if (nombre === 'prueba-ciega') opciones.pruebaCiega = true
    else if (nombre === 'sin-informe') opciones.sinInforme = true
  }
  return opciones
}

// ------------------------------------------------------- lo que corre en la página

/**
 * Encuentra las casillas y lee, de cada una, si DECLARA movimiento en tres dimensiones.
 *
 * Devuelve un rectángulo por casilla para poder restar píxeles después, y el motivo por el
 * que se la dio por viva o por quieta — sin el motivo, un número no se puede discutir.
 */
const CASILLAS_EN_PAGINA = (minimo) => {
  const es3D = (t) => {
    if (!t || t === 'none') return false
    if (t.startsWith('matrix3d')) return true
    return /rotate[XY]|rotate3d|translateZ|perspective/.test(t)
  }

  const salida = []
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const e = getComputedStyle(el)
    if (e.display === 'none' || e.visibility === 'hidden' || Number(e.opacity) === 0) continue

    const r = el.getBoundingClientRect()
    if (r.width * r.height < minimo) continue
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue

    // UN CUADRO CON LÍNEAS: tiene esquina redondeada y, además, borde propio o fondo
    // propio. Las tres cosas juntas son lo que separa una casilla de un contenedor de
    // maquetación, que no segmenta nada — solo apila.
    const redondeado = parseFloat(e.borderRadius) > 0
    const conBorde = parseFloat(e.borderTopWidth) > 0 || parseFloat(e.borderBottomWidth) > 0
    const conFondo = e.backgroundColor !== 'rgba(0, 0, 0, 0)' && e.backgroundColor !== 'transparent'
    if (!redondeado || !(conBorde || conFondo)) continue

    // Una casilla dentro de otra casilla no se cuenta dos veces: manda la de fuera, que
    // es la que segmenta. Si no, una tarjeta con tres filas contaría por cuatro.
    if (salida.some((s) => s.el !== el && s.el.contains(el))) continue

    // SOLO CUENTA EL 3D, y esto costó una corrida entenderlo.
    //
    // La primera versión daba por viva cualquier casilla con `transition: transform`, y
    // salieron CERO quietas en las cuatro pantallas — pero no porque se muevan: la clase
    // `press` del sistema pone esa transición en casi todo, y es un achique al pulsar, en
    // dos dimensiones. Bryan pidió otra cosa con todas las letras: «interfaz o diseño en
    // TRES dimensiones que le dé movimiento», con giros, desplazamientos y bloques que se
    // desintegran. Un botón que se hunde 2 px al tocarlo no es eso.
    //
    // Así que lo que cuenta es la profundidad declarada: una matriz 3D, un `preserve-3d`
    // o una `perspective`. Lo demás se anota aparte, como contexto, y no vota.
    const motivos = []
    const contexto = []
    if (es3D(e.transform)) motivos.push('transform 3D propio')
    if (e.transformStyle === 'preserve-3d') motivos.push('preserve-3d')
    if (e.perspective !== 'none') motivos.push('perspective')
    if (e.animationName !== 'none') contexto.push('animación: ' + e.animationName)
    if (e.transitionProperty.includes('transform') || e.transitionProperty === 'all')
      contexto.push('transición de transform (2D)')

    // Y lo mismo mirando hacia dentro: la profundidad puede vivir en un hijo —un adorno,
    // una gráfica— y la casilla sigue teniendo diseño en tres dimensiones.
    for (const hijo of Array.from(el.querySelectorAll('*'))) {
      if (motivos.length > 3) break
      const h = getComputedStyle(hijo)
      if (es3D(h.transform)) motivos.push('hijo con transform 3D')
      else if (h.transformStyle === 'preserve-3d') motivos.push('hijo con preserve-3d')
      else if (h.perspective !== 'none') motivos.push('hijo con perspective')
      else if (h.animationName !== 'none' && contexto.length < 4)
        contexto.push('hijo animado: ' + h.animationName)
    }

    salida.push({
      el,
      etiqueta: (el.getAttribute('data-recuadro') || el.getAttribute('aria-label') || el.className || el.tagName)
        .toString()
        .slice(0, 44),
      rect: {
        x: Math.max(0, Math.floor(r.left)),
        y: Math.max(0, Math.floor(r.top)),
        w: Math.min(innerWidth, Math.ceil(r.right)) - Math.max(0, Math.floor(r.left)),
        h: Math.min(innerHeight, Math.ceil(r.bottom)) - Math.max(0, Math.floor(r.top)),
      },
      declara: motivos.slice(0, 4),
      contexto: contexto.slice(0, 4),
    })
  }
  return salida.map(({ el: _el, ...resto }) => resto)
}

/** Deja al asesorado elegido y vuelve a la raíz, como hace el testigo del salón. */
const ENTRAR_COMO = (usuario) => {
  localStorage.setItem('alpha-usuario', JSON.stringify(usuario))
  return localStorage.getItem('alpha-usuario')
}

/** Una pantalla fabricada SIN una sola casilla viva, para ver al testigo decir que no. */
const PANTALLA_CIEGA = () => {
  const hoja = document.createElement('style')
  hoja.textContent = '*{animation:none !important;transition:none !important;transform:none !important}'
  document.head.appendChild(hoja)
  const caja = document.createElement('div')
  // Se le pone CLASE y no solo `id`: la etiqueta con la que el testigo nombra una casilla
  // sale de `data-recuadro`, `aria-label` o `className`, así que un cebo sin clase salía
  // llamándose «DIV» y el veredicto no lo reconocía. El cebo tiene que ser encontrable
  // por el mismo camino por el que se encuentra cualquier casilla.
  caja.id = 'casilla-cebo'
  caja.className = 'casilla-cebo'
  caja.style.cssText =
    'position:fixed;left:20px;top:120px;width:300px;height:160px;border:1px solid #333;' +
    'border-radius:14px;background:#111;z-index:2147483647'
  document.body.appendChild(caja)
  return 1
}

// ------------------------------------------------------------------ medida

async function medirPantalla(dt, opciones, ruta) {
  await dt.pedir('Page.navigate', { url: opciones.url.replace(/\/$/, '') + ruta })
  await esperar(1600)
  if (opciones.pruebaCiega) await dt.evaluar(comoExpresion(PANTALLA_CIEGA))

  const casillas = await dt.evaluar(comoExpresion(CASILLAS_EN_PAGINA, opciones.minimo))

  // LO PINTADO, con la pantalla YA ASENTADA y sin recargarla.
  //
  // La primera versión recargaba y comparaba dos capturas de la entrada. Daba CERO
  // quietas en las cuatro pantallas, y no porque se movieran: al recargar cambia la
  // pantalla ENTERA, así que toda casilla «cambiaba píxeles» y la lectura generosa las
  // daba todas por vivas. Un contador que no puede dar otro resultado no cuenta nada.
  //
  // Asentada, lo que cambie entre dos capturas se mueve de verdad y solo. El churn se
  // descuenta igual, pero aquí ya no tapa nada: es el reloj y poco más.
  const a = await dt.captura()
  await esperar(220)
  const b = await dt.captura()
  const churn = mascaraDeCambio(a, b).mascara
  const entrada0 = await dt.captura()
  await esperar(950)
  const entrada1 = await dt.captura()

  const detalle = casillas.map((c) => {
    const { mascara, area } = unirRects([c.rect], ANCHO, ALTO)
    const pintado = area > 0 ? contarAporte(entrada0, entrada1, churn, mascara).dentro : 0
    // QUIETA ES LO QUE DIJO BRYAN, palabra por palabra: «una casilla que no tiene ningún
    // tipo de interfaz o diseño en tres dimensiones que le dé movimiento». O sea, lo que
    // manda es lo DECLARADO. Los píxeles no votan aquí: se leen aparte, porque son los
    // que destapan el caso contrario —declarar movimiento y no mover nada—, que pasaría
    // desapercibido si se sumaran los dos con un «o».
    // Viva por profundidad declarada, o por moverse de verdad con la pantalla asentada.
    // Lo segundo no sobra: una casilla puede mover su contenido en 3D desde un lienzo o
    // desde una animación que el muestreo de estilos no pilla a mitad de recorrido.
    const MUEVE = 40
    const viva = c.declara.length > 0 || pintado > MUEVE
    return {
      etiqueta: c.etiqueta,
      area,
      declara: c.declara,
      contexto: c.contexto,
      pixelesQueCambian: pintado,
      viva,
      // Y una casilla que dice moverse y no mueve un píxel con la pantalla quieta no es
      // una quieta, pero tampoco está bien: se dice, y quien lo lea decide.
      declaraSinMover: c.declara.length > 0 && pintado === 0,
      motivo: viva
        ? c.declara.length > 0
          ? c.declara.join(' · ')
          : `${pintado} px se mueven solos`
        : 'ningún diseño en tres dimensiones' + (c.contexto.length ? ` (solo ${c.contexto.join(', ')})` : ''),
    }
  })

  // El retrato, cuando se pide. Un contador dice cuántas casillas se mueven; no dice si
  // lo que hacen se ve bien. Después de tocar veintiséis a la vez, mirar no es opcional.
  if (opciones.foto) {
    const png = await dt.pedir('Page.captureScreenshot', { format: 'png' })
    const nombre = join(opciones.foto, `casillas${ruta.replace(/\//g, '-') || '-raiz'}.png`)
    writeFileSync(nombre, Buffer.from(png.data, 'base64'))
    console.log(`      foto en ${nombre}`)
  }

  return { ruta, casillas: detalle.length, quietas: detalle.filter((d) => !d.viva).length, detalle }
}

async function medir(opciones) {
  const { proceso } = await arrancarChrome(opciones)
  let dt = null
  let idObjetivo = null
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

    await dt.pedir('Page.navigate', { url: opciones.url })
    await esperar(1400)
    await dt.evaluar(comoExpresion(ENTRAR_COMO, opciones.usuario))

    const pantallas = []
    for (const ruta of opciones.rutas) pantallas.push(await medirPantalla(dt, opciones, ruta))
    return pantallas
  } finally {
    if (dt) dt.cerrar()
    if (idObjetivo) {
      await fetch(`http://127.0.0.1:${opciones.puerto}/json/close/${idObjetivo}`).catch(() => {})
      await esperar(500)
    }
    proceso.kill()
    if (process.platform === 'win32' && proceso.pid) {
      spawnSync('taskkill', ['/pid', String(proceso.pid), '/T', '/F'])
    }
  }
}


// ------------------------------------------------------------------ principal

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(
    opciones.pruebaCiega
      ? '\n  PRUEBA CIEGA: se apaga todo el movimiento y se cuela una casilla muerta.\n' +
          '  El testigo tiene que encontrarla. Si no la ve, no sirve para nada.\n'
      : `\n  midiendo ${opciones.rutas.length} pantallas en ${opciones.url}  (${ANCHO}x${ALTO})\n`,
  )

  const pantallas = await medir(opciones)

  let total = 0
  let quietas = 0
  for (const p of pantallas) {
    total += p.casillas
    quietas += p.quietas
    console.log(`  ${p.ruta.padEnd(14)} ${String(p.casillas).padStart(3)} casillas, ${String(p.quietas).padStart(3)} quietas`)
    for (const d of p.detalle.filter((x) => !x.viva)) {
      console.log(`      QUIETA  ${d.etiqueta.padEnd(44)} ${String(d.area).padStart(7)} px²  ${d.motivo}`)
    }
    for (const d of p.detalle.filter((x) => x.declaraSinMover)) {
      console.log(`      dice moverse y no mueve  ${d.etiqueta.padEnd(34)} ${d.declara.join(' · ')}`)
    }
  }
  console.log(`\n  TOTAL: ${total} casillas, ${quietas} quietas\n`)

  if (opciones.pruebaCiega) {
    const vioElCebo = pantallas.some((p) => p.detalle.some((d) => !d.viva && d.etiqueta.includes('cebo')))
    console.log(
      vioElCebo
        ? '  El testigo encontró la casilla muerta. Sabe decir que no.\n'
        : '  NO la encontró. Este testigo no vale: daría cero quietas siempre.\n',
    )
    // LA CIEGA DEJA ACTA PROPIA, y no es burocracia: sin ella, comprobar que este testigo
    // sabe decir que no obligaría a levantar un Chrome cada vez que alguien pregunta si la
    // meta está cumplida. Con acta, la comprobación se hace leyendo un archivo — y el
    // archivo caduca igual que el otro, así que no vale una ciega de hace tres semanas.
    if (!opciones.sinInforme) {
      const ruta = opciones.salida.replace(/\.json$/, '-ciega.json')
      writeFileSync(
        ruta,
        `${JSON.stringify({ cuando: new Date().toISOString(), vioElCebo, casillas: pantallas[0]?.casillas ?? 0 }, null, 2)}
`,
        'utf8',
      )
      console.log(`  acta de la ciega en ${ruta}
`)
    }
    process.exitCode = vioElCebo ? 0 : 1
    return
  }

  const acta = {
    cuando: new Date().toISOString(),
    viewport: { ancho: ANCHO, alto: ALTO },
    usuario: opciones.usuario,
    minimoDeCasilla: opciones.minimo,
    total,
    quietas,
    pantallas: pantallas.map((p) => ({
      ruta: p.ruta,
      casillas: p.casillas,
      quietas: p.quietas,
      // Solo las quietas al detalle: el acta es la lista de lo que falta, no un censo.
      lasQuietas: p.detalle.filter((d) => !d.viva).map((d) => ({ etiqueta: d.etiqueta, area: d.area })),
    })),
  }
  if (!opciones.sinInforme) {
    writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
    console.log(`  acta escrita en ${opciones.salida}\n`)
  } else {
    console.log(JSON.stringify(acta, null, 2))
  }
  process.exitCode = quietas === 0 ? 0 : 1
}

principal().catch((e) => {
  console.error(`\n  el testigo se paró: ${e.message}`)
  process.exitCode = 2
})
