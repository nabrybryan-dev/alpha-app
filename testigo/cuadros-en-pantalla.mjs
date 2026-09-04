#!/usr/bin/env node
/**
 * DÓNDE CAE CADA CUADRO DE LA PARED, en píxeles y en la pantalla de verdad.
 *
 * El acta de `salon-visible.mjs` dice si una marca PINTA. Esto dice otra cosa que también
 * hacía falta y no estaba: **por dónde se sale**. Un cuadro colgado en el muro se coloca
 * por su centro (`translate(-50%,-50%)`) y su alto lo pone el texto que lleva dentro, así
 * que nadie sabe de antemano si el borde de arriba se va del lienzo — y desde fuera, un
 * cuadro medio cortado por arriba se ve igual de mal que uno mal colocado.
 *
 * De cada `[data-cuadro]` saca su rectángulo ya proyectado y **cuánto sobresale por cada
 * lado**. Positivo = se sale. Con eso se puede decidir una altura de pared con un número
 * en vez de con la vista.
 *
 *   npm run dev            (en otra terminal)
 *   node testigo/cuadros-en-pantalla.mjs --foto=informes/cuadros.png
 *
 * Opciones: `--ancho`/`--alto` (el viewport emulado, por defecto el iPhone de Bryan,
 * 390×844), `--url`, `--puerto`, `--chrome`, `--usuario`, `--foto`, `--conservar`.
 *
 * Se emula `prefers-reduced-motion: reduce` ANTES de navegar, igual que el testigo: no es
 * por el ruido —aquí no se resta nada— sino porque el salón entra con una transición y
 * medir a mitad de ella mide la animación, no la colocación.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { arrancarChrome, Devtools, esperar, objetivoDePagina, comoExpresion } from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// El iPhone de Bryan. El testigo mide en 414×736 porque ése era el suyo cuando se escribió;
// aquí se mide en el estrecho y alto, que es donde los cuadros lo tienen más difícil.
const ANCHO = 390
const ALTO = 844

const CANDIDATOS = ['u-valentina', 'u-mateo', 'u-sara']

function leerOpciones(argv) {
  const o = {
    url: 'http://localhost:5173/entrenar',
    puerto: 9223,
    chrome: '',
    ancho: ANCHO,
    alto: ALTO,
    usuario: '',
    foto: '',
    conservar: false,
    sinReducir: false,
    girar: 0,
    panel: false,
    ver: '',
    espera: 0,
    sinLetras: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, ...resto] = bruto.replace(/^--/, '').split('=')
    const valor = resto.join('=')
    if (nombre === 'url') o.url = valor
    else if (nombre === 'puerto') o.puerto = Number(valor)
    else if (nombre === 'chrome') o.chrome = valor
    else if (nombre === 'ancho') o.ancho = Number(valor)
    else if (nombre === 'alto') o.alto = Number(valor)
    else if (nombre === 'usuario') o.usuario = valor
    else if (nombre === 'foto') o.foto = valor
    else if (nombre === 'conservar') o.conservar = true
    else if (nombre === 'sin-reducir') o.sinReducir = true
    else if (nombre === 'girar') o.girar = Number(valor)
    else if (nombre === 'panel') o.panel = true
    else if (nombre === 'espera') o.espera = Number(valor)
    else if (nombre === 'sin-letras') o.sinLetras = true
    else if (nombre === 'ver') {
      o.panel = true
      o.ver = valor
    }
  }
  o.cola = o.usuario ? [o.usuario] : CANDIDATOS
  return o
}

/** Qué rama montó el salón. La de cardio no cuelga cuadros de ejercicio. */
const RAMA_EN_PAGINA = () => {
  const n = document.querySelector('[data-rama-salon]')
  return n ? n.getAttribute('data-rama-salon') : ''
}

/** Los rectángulos, y por dónde se sale cada uno. */
const MEDIR_EN_PAGINA = () => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const lienzo = document.querySelector('canvas')
  const cl = lienzo ? lienzo.getBoundingClientRect() : null
  const cuadros = [...document.querySelectorAll('[data-cuadro]')].map((n) => {
    const r = n.getBoundingClientRect()
    return {
      clave: n.getAttribute('data-cuadro'),
      x: Math.round(r.left),
      y: Math.round(r.top),
      ancho: Math.round(r.width),
      alto: Math.round(r.height),
      // Positivo = se sale por ese lado, en píxeles.
      sobraArriba: Math.round(-r.top),
      sobraAbajo: Math.round(r.bottom - vh),
      sobraIzquierda: Math.round(-r.left),
      sobraDerecha: Math.round(r.right - vw),
      cuerpoPx: Math.round(parseFloat(getComputedStyle(n).fontSize) * 10) / 10,
      // El alto que el cuadro PROMETE no pasar, sacado de `sitio.alto` ya en pixeles.
      // Si el alto real lo supera, la colocacion esta decidiendo con un numero falso.
      topePx: Number(n.getAttribute('data-alto-tope') || 0),
      texto: (n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    }
  })
  return {
    viewport: { ancho: vw, alto: vh },
    lienzo: cl ? { ancho: Math.round(cl.width), alto: Math.round(cl.height) } : null,
    cuadros,
  }
}

async function esperarCuadros(dt) {
  const limite = Date.now() + 20_000
  while (Date.now() < limite) {
    const n = await dt.evaluar('document.querySelectorAll("[data-cuadro]").length')
    if (n > 0) return n
    await esperar(300)
  }
  return 0
}

async function main() {
  const o = leerOpciones(process.argv)
  const { proceso } = await arrancarChrome(o)
  let dt = null
  try {
    const objetivo = await objetivoDePagina(o.puerto)
    dt = await Devtools.conectar(objetivo.webSocketDebuggerUrl)
    await dt.pedir('Page.enable')
    await dt.pedir('Runtime.enable')
    await dt.pedir('Emulation.setDeviceMetricsOverride', {
      width: o.ancho,
      height: o.alto,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: o.ancho,
      screenHeight: o.alto,
    })
    await dt.pedir('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    if (!o.sinReducir) {
      await dt.pedir('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      })
    }
    await dt.pedir('Page.bringToFront')

    let medido = ''
    for (const id of o.cola) {
      const raiz = new URL(o.url).origin
      const primera = new Promise((r) => dt.al('Page.loadEventFired', r))
      await dt.pedir('Page.navigate', { url: raiz })
      await Promise.race([primera, esperar(30_000)])
      await dt.evaluar(comoExpresion((u) => localStorage.setItem('alpha-usuario', u), id))
      const cargada = new Promise((r) => dt.al('Page.loadEventFired', r))
      await dt.pedir('Page.navigate', { url: o.url })
      await Promise.race([cargada, esperar(30_000)])
      medido = id
      const cuantos = await esperarCuadros(dt)
      if (cuantos > 0) break
      const rama = await dt.evaluar(comoExpresion(RAMA_EN_PAGINA))
      console.log(`   ${id} no cuelga cuadros (rama "${rama}"): se prueba el siguiente.`)
    }

    // El salón entra con una transición; se le deja terminar antes de leer rectángulos.
    await esperar(2500)
    await dt.pedir('Page.bringToFront')

    // GIRAR LA CÁMARA, arrastrando de verdad sobre el lienzo.
    //
    // Hace falta porque la mitad de lo que cuelga de las paredes NO se ve al entrar: la
    // cámara está a 150° del ángulo de entrada, «a continuación» a 180°. Sin poder girar,
    // esas piezas se rediseñan a ciegas — y una pieza que no se ha visto no está
    // verificada.
    //
    // El arrastre es el de verdad, no una llamada al motor: `Orbita` escucha
    // `pointermove` y hace `azimut -= deltaX * 0.42`, así que girar N grados son
    // `-N / 0.42` píxeles. En VERTICAL no se mueve ni un píxel, porque el mismo gesto
    // cambia la elevación y eso falsearía la medida.
    if (o.girar) {
      const totalPx = -o.girar / 0.42
      const pasos = Math.max(1, Math.ceil(Math.abs(totalPx) / 260))
      const y = Math.round(o.alto * 0.42)
      for (let i = 0; i < pasos; i++) {
        const dx = totalPx / pasos
        const x0 = Math.round(o.ancho / 2 - dx / 2)
        const x1 = Math.round(x0 + dx)
        await dt.pedir('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y, button: 'left', clickCount: 1, buttons: 1 })
        // En tramos: un salto único puede pasar por encima de la captura del puntero.
        for (let k = 1; k <= 8; k++) {
          await dt.pedir('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: Math.round(x0 + ((x1 - x0) * k) / 8),
            y,
            button: 'left',
            buttons: 1,
          })
        }
        await dt.pedir('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y, button: 'left', buttons: 0 })
        await esperar(120)
      }
      await esperar(700)
      console.log(`  cámara girada ${o.girar}° (${Math.round(totalPx)} px de arrastre en ${pasos} tramos)`)
    }

    // ABRIR EL PANEL DE ABAJO. Es la otra mitad de la pantalla y no se ve sin el gesto:
    // el tirador no tiene texto —su nombre va en `aria-label`— así que se busca por ahí,
    // que es como lo encuentra quien navega con lector.
    if (o.panel) {
      // Un `click()` sintético NO lo abre, y eso es correcto: el tirador alterna en
      // `pointerup` y solo si antes hubo un `pointerdown` —es la manija del arrastre—.
      // Así que se toca de verdad, con el ratón del protocolo, en el centro del tirador.
      const donde = await dt.evaluar(
        `(() => { const b = [...document.querySelectorAll('button[aria-label]')]` +
          `.find((n) => /Abrir el panel/i.test(n.getAttribute('aria-label') || '')); ` +
          `if (!b) return null; const r = b.getBoundingClientRect(); ` +
          `return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } })()`,
      )
      if (!donde) {
        console.log('   no encontré el tirador del panel')
      } else {
        await dt.pedir('Input.dispatchMouseEvent', { type: 'mousePressed', x: donde.x, y: donde.y, button: 'left', clickCount: 1, buttons: 1 })
        await esperar(60)
        await dt.pedir('Input.dispatchMouseEvent', { type: 'mouseReleased', x: donde.x, y: donde.y, button: 'left', buttons: 0 })
        await esperar(1000)
      }
    }

    // APAGAR LA CAPA DE LETRAS. Qué dice la SALA por sí sola, sin la interfaz encima.
    //
    // Nace de la corrección de Bryan del 2026-09-03: «los agregas como recortes de la app».
    // La sala ya escribe cifras en geometría —paneles de siete segmentos de 0,44 m—, y la
    // pregunta que no se podía contestar era si esas cifras se leen, porque el tablón del
    // DOM se pinta justo encima. Esto las deja solas.
    if (o.sinLetras) {
      await dt.evaluar(
        `(() => { const n = document.querySelector('[data-testigo="letras3D"]');` +
          ' if (n) n.style.visibility = "hidden"; return !!n })()',
      )
      console.log('  capa de letras apagada: se mide lo que dice la sala sola')
    }

    // ESPERAR ANTES DE MEDIR. El tablón del muro agrupa por TIEMPO: anuncia el ejercicio
    // 5,5 s y luego se retira dejando la prescripción de la serie. Sin poder esperar, el
    // testigo solo sabe retratar la primera de las dos capas — y la que se ve el 95 % del
    // tiempo es la otra.
    if (o.espera > 0) {
      await esperar(o.espera)
      console.log(`  esperados ${o.espera} ms antes de medir`)
    }

    // DESPLAZAR LA HOJA HASTA UN TRAMO. El panel abierto son trece recuadros en una
    // columna con scroll: la foto de arriba no dice NADA de los de abajo, y los bloques
    // de la Ruta viven todos del octavo para abajo. `--ver=nivel` lleva ese tramo al
    // borde de arriba de la hoja; sin esto, media hoja se sigue diseñando de memoria,
    // que es el error del reflector otra vez.
    if (o.ver) {
      const puesto = await dt.evaluar(
        '(() => { const n = document.querySelector(' +
          `'[data-recuadro="${o.ver}"]'` +
          '); if (!n) return null; n.scrollIntoView({ block: "start", behavior: "instant" }); ' +
          'return Math.round(n.getBoundingClientRect().top) })()',
      )
      if (puesto === null) console.log(`   no encontré el recuadro «${o.ver}»`)
      else console.log(`  hoja desplazada hasta «${o.ver}» (arriba en y=${puesto})`)
      await esperar(400)
    }

    const acta = await dt.evaluar(comoExpresion(MEDIR_EN_PAGINA))
    acta.usuario = medido

    if (o.foto) {
      const ruta = resolve(RAIZ, o.foto)
      const png = await dt.pedir('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
        fromSurface: true,
      })
      writeFileSync(ruta, Buffer.from(png.data, 'base64'))
      console.log(`  foto en ${ruta}`)
    }

    console.log(
      `\n  ${acta.viewport.ancho}×${acta.viewport.alto}  ·  asesorado ${acta.usuario}  ·  ` +
        `${acta.cuadros.length} cuadros\n`,
    )
    const col = (t, n) => String(t).padStart(n)
    console.log(
      '  cuadro        x     y   ancho  alto   tope   ↑sobra ↓sobra ←sobra →sobra  cuerpo',
    )
    for (const c of acta.cuadros) {
      const marca = c.sobraArriba > 0 || c.sobraAbajo > 0 ? ' ←SE SALE' : ''
      const pasado = c.topePx > 0 && c.alto > c.topePx ? ` ←PASA EL TOPE (+${c.alto - c.topePx} px)` : ''
      console.log(
        `  ${c.clave.padEnd(12)}${col(c.x, 4)}${col(c.y, 6)}${col(c.ancho, 7)}${col(c.alto, 6)}` +
          `${col(c.topePx, 7)}${col(c.sobraArriba, 8)}${col(c.sobraAbajo, 7)}${col(c.sobraIzquierda, 7)}` +
          `${col(c.sobraDerecha, 7)}${col(c.cuerpoPx, 8)}${marca}${pasado}`,
      )
    }
    console.log('')
    writeFileSync(join(RAIZ, 'informes', 'cuadros-en-pantalla.json'), JSON.stringify(acta, null, 2))
  } finally {
    if (dt) dt.cerrar()
    if (!o.conservar) proceso.kill()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
