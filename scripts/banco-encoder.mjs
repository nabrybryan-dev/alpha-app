/**
 * Banco de medida del encoder — el sustituto de la batería que no está aquí.
 *
 *     node scripts/banco-encoder.mjs
 *     node scripts/banco-encoder.mjs --detalle
 *
 * `nucleo/ORIGEN.md` dice la verdad: los tres `.js` del núcleo los validan 56
 * casos que viven en `herramientas/encoder-camara`, otro repo. En esta máquina
 * ese repo no está, así que el único guardián que queda es el de las huellas —
 * y ese solo sabe decir «alguien tocó la copia». No sabe si mide bien.
 *
 * Este banco no intenta ser aquella batería: **no puede**, porque aquella
 * compara contra vídeos reales con verdad medida a mano. Lo que hace es lo otro
 * que sí se puede hacer sin salir de casa — fabricar movimiento del que se
 * conoce la respuesta exacta, pasarlo por la tubería entera y mirar cuánto se
 * desvía. Un error de código sale aquí; un error de gimnasio, no.
 *
 * Va aparte de vitest a propósito: se corre con `node` a secas, sin instalar
 * nada, que es la situación en la que este archivo hace falta.
 */

import {
  analizarSerie,
  detectarDianaCuatro,
  pixelesQueCasan,
  pruebaDeGravedad,
  rgbAHsv,
  separarMarcadores,
  centroideEnVentana,
  G_ESTANDAR,
} from '../src/features/entrenar/encoder/nucleo/analisis.js'
import {
  detectarDisco,
  identificarEstructura,
} from '../src/features/entrenar/encoder/nucleo/disco.js'

const DETALLE = process.argv.includes('--detalle')

// ─────────────────────────────────────────────────────────────────────────────
// Azar reproducible
// ─────────────────────────────────────────────────────────────────────────────

/** Congruencial lineal. Reproducible a propósito: un banco que da un número
 *  distinto en cada pasada no sirve para decidir si un cambio mejoró algo. */
function azarCon(semilla) {
  let s = semilla >>> 0
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648 - 0.5
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Movimiento fabricado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Una serie con la velocidad de cada repetición decidida de antemano.
 *
 * Los fotogramas NO son equiespaciados —ese es el error clásico que arruina
 * estas mediciones— y se pueden tirar algunos, que es lo que pasa de verdad
 * cuando el marcador se pierde a media subida.
 */
function serieFabricada({
  nReps = 6,
  vInicial = 0.6,
  pvObjetivo = 30,
  fps = 60,
  ruidoPx = 0.5,
  sentido = 'subir',
  perdidaPct = 0,
  jitter = 0.3,
  romM = 0.5,
  semilla = 12345,
} = {}) {
  const sepMm = 400
  const sepPx = 160 // ⇒ 2,5 mm por píxel
  const mpp = sepMm / 1000 / sepPx
  const azar = azarCon(semilla)
  const muestras = []
  const vEsperadas = []
  let t = 0

  for (let r = 0; r < nReps; r++) {
    const v = vInicial * (1 - (pvObjetivo / 100) * (r / Math.max(1, nReps - 1)))
    vEsperadas.push(v)
    const tramos = [
      { dur: 1.2, desde: romM, hasta: 0 }, // excéntrica
      { dur: 0.15, desde: 0, hasta: 0 }, // pausa abajo
      { dur: romM / v, desde: 0, hasta: romM }, // concéntrica a velocidad v
      { dur: 0.2, desde: romM, hasta: romM }, // pausa arriba
    ]
    for (const tr of tramos) {
      const pasos = Math.max(1, Math.round(tr.dur * fps))
      const t0 = t
      for (let k = 0; k < pasos; k++) {
        // La altura sale del INSTANTE REAL del fotograma, no de su número de
        // orden. Sacarla del número de orden fue el primer fallo de este banco:
        // con fotogramas que llegan con ±15 % de jitter, la duración real de la
        // concéntrica no es la nominal, así que la velocidad de verdad no era
        // la que el banco daba por verdad — y el banco acusaba al núcleo de un
        // sesgo de casi 4 puntos de %PV que se había inventado él. Con la
        // altura atada al reloj, el movimiento va a `v` exactos por segundo
        // pase lo que pase con los fotogramas.
        t += (1 / fps) * (1 + jitter * azar())
        const u = tr.dur > 0 ? Math.min(1, Math.max(0, (t - t0) / tr.dur)) : 1
        const altura = tr.desde + (tr.hasta - tr.desde) * u
        // En «subir» la concéntrica sube y la y de imagen baja; en «bajar»
        // (jalón, remo) es al revés. El signo lo pone quien llama al núcleo, y
        // por eso hay que fabricar los dos: un signo mal puesto no revienta,
        // devuelve cero repeticiones o una velocidad negativa creíble.
        const yPx = sentido === 'subir' ? 400 - altura / mpp : 100 + altura / mpp
        if (perdidaPct > 0 && azar() + 0.5 < perdidaPct / 100) {
          muestras.push({ t, y: NaN })
          continue
        }
        muestras.push({
          t,
          x: 320 + azar() * ruidoPx,
          y: yPx + azar() * ruidoPx,
          sepPx: sepPx + azar() * ruidoPx,
          anguloGrados: azar() * 2,
        })
      }
    }
  }
  return { muestras, sepMm, sentido, esperado: { nReps, vEsperadas, vInicial, pvObjetivo } }
}

/** Una caída libre con la gravedad que se le diga. La verdad de balde. */
function caidaFabricada({
  g = G_ESTANDAR,
  fps = 60,
  ruidoPx = 0.3,
  segundos = 0.7,
  sepMm = 400,
  sepPx = 160,
  semilla = 999,
} = {}) {
  const azar = azarCon(semilla)
  const mpp = sepMm / 1000 / sepPx
  const muestras = []
  let t = 0
  const n = Math.round(segundos * fps)
  for (let k = 0; k < n; k++) {
    t += (1 / fps) * (1 + 0.2 * azar())
    const caidaM = 0.5 * g * t * t
    muestras.push({
      t,
      x: 320 + azar() * ruidoPx,
      y: 60 + caidaM / mpp + azar() * ruidoPx,
      sepPx: sepPx + azar() * ruidoPx,
      anguloGrados: azar() * 1.5,
    })
  }
  return { muestras, sepMm, g }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Imagen fabricada
// ─────────────────────────────────────────────────────────────────────────────

/** Un lienzo RGBA como el que entrega `getImageData`. */
function lienzo(ancho, alto, [r, g, b] = [40, 42, 46]) {
  const datos = new Uint8ClampedArray(ancho * alto * 4)
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = r
    datos[i + 1] = g
    datos[i + 2] = b
    datos[i + 3] = 255
  }
  return { datos, ancho, alto }
}

function pintarCirculo(img, cx, cy, radio, [r, g, b], escalaY = 1) {
  const { datos, ancho, alto } = img
  const rr = radio * radio
  for (let y = Math.max(0, Math.floor(cy - radio / escalaY)); y <= Math.min(alto - 1, Math.ceil(cy + radio / escalaY)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radio)); x <= Math.min(ancho - 1, Math.ceil(cx + radio)); x++) {
      const dx = x - cx
      const dy = (y - cy) * escalaY
      if (dx * dx + dy * dy > rr) continue
      const i = (y * ancho + x) * 4
      datos[i] = r
      datos[i + 1] = g
      datos[i + 2] = b
    }
  }
}

/** Ruido de sensor. Sin él la imagen fabricada es más limpia que cualquier
 *  gimnasio y el banco aprueba cosas que en el gimnasio no aprobarían. */
function granular(img, amplitud, semilla = 7) {
  const azar = azarCon(semilla)
  const { datos } = img
  for (let i = 0; i < datos.length; i += 4) {
    const d = azar() * 2 * amplitud
    datos[i] = Math.max(0, Math.min(255, datos[i] + d))
    datos[i + 1] = Math.max(0, Math.min(255, datos[i + 1] + d))
    datos[i + 2] = Math.max(0, Math.min(255, datos[i + 2] + d))
  }
}

const MAGENTA = [220, 30, 190]

// ─────────────────────────────────────────────────────────────────────────────
// 3 · El acta
// ─────────────────────────────────────────────────────────────────────────────

const actas = []
let bloqueActual = ''

const bloque = (nombre) => {
  bloqueActual = nombre
  console.log(`\n\x1b[1m${nombre}\x1b[0m`)
}

/** Un caso: qué se esperaba, qué salió, y si entra en la tolerancia. */
function caso(etiqueta, ok, medido, tolerancia) {
  actas.push({ bloque: bloqueActual, etiqueta, ok })
  const marca = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'
  const cola = medido === undefined ? '' : `  ${medido}${tolerancia ? `   (${tolerancia})` : ''}`
  if (!ok || DETALLE) console.log(`  ${marca} ${etiqueta}${cola}`)
}

const cerca = (a, b, tol) => Number.isFinite(a) && Math.abs(a - b) <= tol

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Velocidad: la rejilla
// ─────────────────────────────────────────────────────────────────────────────

bloque('Velocidad y %PV sobre movimiento con respuesta conocida')

/* La tolerancia no es una opinión: el contrato de la fase 2 pide ≤ 0,050 m/s de
 * error en v₁ y ≤ 5 puntos de %PV. Aquí se aprieta a la mitad porque estos
 * datos no tienen los errores del gimnasio —ni encuadre, ni luz, ni escorzo—:
 * lo único que puede fallar es la aritmética, y la aritmética no tiene derecho
 * a gastarse el presupuesto entero del error. */
const TOL_V1 = 0.025
const TOL_PV = 2.5

for (const fps of [60, 120]) {
  for (const pv of [0, 10, 20, 30, 40]) {
    for (const vInicial of [0.3, 0.6, 1.0]) {
      const { muestras, sepMm } = serieFabricada({ fps, pvObjetivo: pv, vInicial, nReps: 6 })
      const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
      const vUltimaEsperada = vInicial * (1 - pv / 100)
      const et = `fps ${fps} · v₁ ${vInicial} · %PV ${pv}`
      if (!r.ok) {
        caso(et, false, `no segmentó: ${r.detalle ?? r.motivo}`)
        continue
      }
      const okReps = r.reps.length === 6
      const okV1 = cerca(r.vPrimera, vInicial, TOL_V1)
      const okVn = cerca(r.vUltima, vUltimaEsperada, TOL_V1)
      const okPv = cerca(r.pvPct, pv, TOL_PV)
      caso(
        et,
        okReps && okV1 && okVn && okPv,
        `reps ${r.reps.length}/6 · v₁ ${r.vPrimera.toFixed(3)} (${(r.vPrimera - vInicial >= 0 ? '+' : '')}${(r.vPrimera - vInicial).toFixed(3)}) · ` +
          `vₙ ${r.vUltima.toFixed(3)} · %PV ${r.pvPct.toFixed(1)} (${(r.pvPct - pv >= 0 ? '+' : '')}${(r.pvPct - pv).toFixed(1)} pts)`,
        `±${TOL_V1} m/s, ±${TOL_PV} pts`,
      )
    }
  }
}

/* El sentido «bajar» —jalón, remo— es el mismo código con el signo cambiado, y
 * por eso nadie lo mira. Un signo mal puesto no revienta: devuelve cero
 * repeticiones, o una velocidad negativa que parece un dato. */
for (const pv of [0, 20, 40]) {
  const { muestras, sepMm } = serieFabricada({ pvObjetivo: pv, sentido: 'bajar', nReps: 5 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'bajar' })
  caso(
    `sentido bajar · %PV ${pv}`,
    r.ok && r.reps.length === 5 && cerca(r.vPrimera, 0.6, TOL_V1) && cerca(r.pvPct, pv, TOL_PV),
    r.ok ? `reps ${r.reps.length}/5 · v₁ ${r.vPrimera.toFixed(3)} · %PV ${r.pvPct.toFixed(1)}` : 'no segmentó',
    `±${TOL_V1} m/s, ±${TOL_PV} pts`,
  )
}

/* Repeticiones lentas de verdad. Con 0,15 m/s la concéntrica dura 3,3 s y la
 * ventana de la derivada abarca una fracción minúscula del recorrido: es el
 * extremo opuesto al que se suele probar. */
for (const v of [0.15, 0.2, 2.0]) {
  const { muestras, sepMm } = serieFabricada({ vInicial: v, pvObjetivo: 20, nReps: 4 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  caso(
    `velocidad extrema · v₁ ${v} m/s`,
    r.ok && r.reps.length === 4 && cerca(r.vPrimera, v, Math.max(TOL_V1, v * 0.05)),
    r.ok ? `reps ${r.reps.length}/4 · v₁ ${r.vPrimera.toFixed(3)}` : 'no segmentó',
    `±${Math.max(TOL_V1, v * 0.05).toFixed(3)}`,
  )
}

/* Recorridos cortos. Un press de banca con parada tiene 35 cm; un empuje de
 * cadera, 20. La histéresis de segmentación trabaja en fracciones del recorrido,
 * así que un recorrido corto con el mismo ruido en píxeles es un caso distinto. */
for (const rom of [0.2, 0.35]) {
  const { muestras, sepMm } = serieFabricada({ romM: rom, pvObjetivo: 25, nReps: 5 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  caso(
    `recorrido corto · ${rom * 100} cm`,
    r.ok && r.reps.length === 5 && cerca(r.pvPct, 25, TOL_PV),
    r.ok ? `reps ${r.reps.length}/5 · %PV ${r.pvPct.toFixed(1)}` : 'no segmentó',
    `±${TOL_PV} pts`,
  )
}

bloque('Lo que estropea la señal')

/* Ruido de centroide. Medio píxel es lo normal con el marcador bien iluminado;
 * dos píxeles es el marcador pequeño y lejos. */
for (const ruido of [0, 1, 2, 4]) {
  const { muestras, sepMm } = serieFabricada({ ruidoPx: ruido, pvObjetivo: 30 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  caso(
    `ruido de centroide · ${ruido} px`,
    r.ok && r.reps.length === 6 && cerca(r.pvPct, 30, 5),
    r.ok ? `%PV ${r.pvPct.toFixed(1)} · reps ${r.reps.length}/6` : 'no segmentó',
    '±5 pts (el contrato entero)',
  )
}

/* Fotogramas perdidos. La puerta de calidad los mira con `deteccion`, pero lo
 * que importa es si el número sobrevive: perder el 10 % de los fotogramas no
 * puede mover el %PV cinco puntos, porque cinco puntos son la muerte de la rama. */
for (const perdida of [5, 10, 20]) {
  const { muestras, sepMm } = serieFabricada({ perdidaPct: perdida, pvObjetivo: 30 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  caso(
    `fotogramas perdidos · ${perdida} %`,
    r.ok && cerca(r.pvPct, 30, 5) && r.deteccion < 1,
    r.ok ? `%PV ${r.pvPct.toFixed(1)} · detección ${(r.deteccion * 100).toFixed(0)} %` : 'no segmentó',
    '±5 pts',
  )
}

/* 30 fps tiene que salir MAL y quedar marcado. Es el hallazgo de la campaña del
 * 19 de agosto —a 30 fps el %PV se va 5 puntos— y el motivo de que la puerta
 * pida 50. Si algún día esto empieza a aprobar, es que la puerta se aflojó. */
{
  const { muestras, sepMm } = serieFabricada({ fps: 30, pvObjetivo: 30 })
  const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  const marcado = r.ok && r.calidad.motivos.includes('pocos_fps')
  caso(
    '30 fps queda marcado por la puerta',
    marcado,
    r.ok ? `calidad ${r.calidad.nivel} · motivos ${r.calidad.motivos.join('+') || '—'}` : 'no segmentó',
    'debe incluir pocos_fps',
  )
}

/* Sin escala el %PV sigue valiendo: es un cociente entre dos velocidades
 * medidas con la misma regla equivocada. Es la tesis del §4 del plan, y si
 * dejara de cumplirse habría que reescribir media herramienta. */
{
  const { muestras } = serieFabricada({ pvObjetivo: 30 })
  const sinSep = muestras.map(({ t, x, y }) => ({ t, x, y }))
  const r = analizarSerie(sinSep, { sentido: 'subir' })
  caso(
    'sin escala el %PV se conserva',
    r.ok && r.unidad === 'px/s' && cerca(r.pvPct, 30, TOL_PV),
    r.ok ? `unidad ${r.unidad} · %PV ${r.pvPct.toFixed(1)}` : 'no segmentó',
    `±${TOL_PV} pts`,
  )
}

/* Una serie que no es una serie. Nada de esto puede devolver `ok: true`: un
 * número inventado con cara de dato es peor que un fallo. */
{
  const quietas = Array.from({ length: 120 }, (_, k) => ({ t: k / 60, x: 320, y: 300, sepPx: 160 }))
  const r1 = analizarSerie(quietas, { sepMm: 400, sentido: 'subir' })
  caso('barra quieta no inventa repeticiones', !r1.ok || r1.reps.length === 0, r1.ok ? `${r1.reps.length} reps` : r1.motivo)

  const pocas = Array.from({ length: 6 }, (_, k) => ({ t: k / 60, x: 320, y: 300 - k, sepPx: 160 }))
  const r2 = analizarSerie(pocas, { sepMm: 400, sentido: 'subir' })
  caso('seis fotogramas no son una serie', !r2.ok, r2.ok ? 'devolvió ok' : r2.motivo)

  const todasNaN = Array.from({ length: 60 }, (_, k) => ({ t: k / 60, y: NaN }))
  const r3 = analizarSerie(todasNaN, { sepMm: 400, sentido: 'subir' })
  caso('marcador nunca visto no devuelve número', !r3.ok, r3.ok ? 'devolvió ok' : r3.motivo)
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Gravedad
// ─────────────────────────────────────────────────────────────────────────────

bloque('Prueba de gravedad — la verdad de balde')

for (const fps of [60, 120]) {
  for (const ruido of [0.3, 1]) {
    const { muestras, sepMm } = caidaFabricada({ fps, ruidoPx: ruido })
    const r = pruebaDeGravedad(muestras, sepMm, { gRef: G_ESTANDAR })
    caso(
      `caída a ${fps} fps con ruido ${ruido} px`,
      r.ok && Math.abs(r.errorPct) <= 2,
      r.ok ? `a ${r.aceleracion.toFixed(3)} m/s² · error ${r.errorPct.toFixed(2)} % · ${r.veredicto}` : r.motivo,
      '≤ 2 %',
    )
  }
}

/* La gravedad de los Andes. Si la referencia se pasa mal, el error entra con el
 * mismo signo en todas las tomas y se come una sexta parte del presupuesto. */
{
  const gAndes = 9.775
  const { muestras, sepMm } = caidaFabricada({ g: gAndes })
  const contra981 = pruebaDeGravedad(muestras, sepMm, { gRef: G_ESTANDAR })
  const contraAndes = pruebaDeGravedad(muestras, sepMm, { gRef: gAndes })
  caso(
    'la g local cambia el veredicto, no el ruido',
    contra981.ok &&
      contraAndes.ok &&
      Math.abs(contraAndes.errorPct) < Math.abs(contra981.errorPct),
    contra981.ok && contraAndes.ok
      ? `contra 9,807: ${contra981.errorPct.toFixed(2)} % · contra 9,775: ${contraAndes.errorPct.toFixed(2)} %`
      : 'no midió',
  )
}

/* Una caída que no es una caída: velocidad constante. La parábola ajusta igual
 * —con c ≈ 0— y el error tiene que salir por las nubes, no cerca de cero. */
{
  const azar = azarCon(4242)
  const muestras = Array.from({ length: 42 }, (_, k) => ({
    t: (k / 60) * (1 + 0.2 * azar()),
    x: 320,
    y: 60 + k * 3,
    sepPx: 160,
  }))
  const r = pruebaDeGravedad(muestras, 400, { gRef: G_ESTANDAR })
  caso(
    'velocidad constante no aprueba como caída',
    !r.ok || r.veredicto === 'ROJO' || Math.abs(r.errorPct) > 10,
    r.ok ? `a ${r.aceleracion.toFixed(2)} · error ${r.errorPct.toFixed(1)} % · ${r.veredicto}` : r.motivo,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Imagen: del píxel al marcador
// ─────────────────────────────────────────────────────────────────────────────

bloque('Detección de color sobre imagen fabricada')

const objetivo = rgbAHsv(...MAGENTA)

{
  const img = lienzo(640, 360)
  pintarCirculo(img, 200, 180, 7, MAGENTA)
  pintarCirculo(img, 440, 180, 7, MAGENTA)
  granular(img, 4)
  const nube = pixelesQueCasan(img.datos, img.ancho, img.alto, objetivo, { paso: 1 })
  const par = separarMarcadores(nube)
  caso(
    'dos marcas separadas dan dos centroides',
    par !== undefined && cerca(par.a.x, 200, 1.5) && cerca(par.b.x, 440, 1.5) && cerca(par.sepPx, 240, 2),
    par ? `a(${par.a.x.toFixed(1)}, ${par.a.y.toFixed(1)}) b(${par.b.x.toFixed(1)}, ${par.b.y.toFixed(1)}) sep ${par.sepPx.toFixed(1)} px` : 'no separó',
    '±1,5 px de centro, ±2 px de separación',
  )
}

{
  // La barra inclinada 20°: partir la nube por x mezclaría las dos marcas justo
  // en las repeticiones que más importan, que son las que se hacen torcidas.
  const img = lienzo(640, 360)
  const dx = 120 * Math.cos((20 * Math.PI) / 180)
  const dy = 120 * Math.sin((20 * Math.PI) / 180)
  pintarCirculo(img, 320 - dx, 180 - dy, 7, MAGENTA)
  pintarCirculo(img, 320 + dx, 180 + dy, 7, MAGENTA)
  granular(img, 4)
  const nube = pixelesQueCasan(img.datos, img.ancho, img.alto, objetivo, { paso: 1 })
  const par = separarMarcadores(nube)
  caso(
    'barra a 20° no mezcla las dos marcas',
    par !== undefined && cerca(par.sepPx, 240, 3) && cerca(Math.abs(par.anguloGrados), 20, 2),
    par ? `sep ${par.sepPx.toFixed(1)} px · ángulo ${par.anguloGrados.toFixed(1)}°` : 'no separó',
    '±3 px, ±2°',
  )
}

{
  // Un intruso del mismo color en el encuadre: una camiseta, un disco pintado.
  // La nube global se los come a los dos y devuelve un centroide a mitad de
  // camino — un punto donde no hay nada. `centroideEnVentana` existe para esto.
  const img = lienzo(640, 360)
  pintarCirculo(img, 200, 180, 7, MAGENTA)
  pintarCirculo(img, 440, 180, 7, MAGENTA)
  pintarCirculo(img, 560, 60, 22, MAGENTA) // el intruso, y es más grande
  granular(img, 4)
  const nube = pixelesQueCasan(img.datos, img.ancho, img.alto, objetivo, { paso: 1 })
  const par = separarMarcadores(nube)
  const engañado = !par || !cerca(par.a.x, 200, 4) || !cerca(par.b.x, 440, 4)
  caso(
    'la nube global SE DEJA engañar por un intruso del mismo color',
    engañado,
    par ? `a(${par.a.x.toFixed(0)}, ${par.a.y.toFixed(0)}) b(${par.b.x.toFixed(0)}, ${par.b.y.toFixed(0)}) — la verdad es a(200,180) b(440,180)` : 'no separó',
    'esto DEBE fallar: documenta por qué hace falta la ventana',
  )
  const a = centroideEnVentana(img.datos, img.ancho, img.alto, objetivo, { x: 200, y: 180 }, 40)
  const b = centroideEnVentana(img.datos, img.ancho, img.alto, objetivo, { x: 440, y: 180 }, 40)
  caso(
    'la ventana alrededor de lo anterior no se deja engañar',
    a !== undefined && b !== undefined && cerca(a.x, 200, 1.5) && cerca(b.x, 440, 1.5),
    a && b ? `a(${a.x.toFixed(1)}, ${a.y.toFixed(1)}) b(${b.x.toFixed(1)}, ${b.y.toFixed(1)})` : 'no encontró',
    '±1,5 px',
  )
}

{
  // Marcador pastel: saturación por debajo del mínimo que trae el filtro. No
  // encuentra NADA, y en pantalla eso se lee como «la cámara va mal».
  const PASTEL = [225, 175, 215]
  const img = lienzo(640, 360, [230, 230, 232])
  pintarCirculo(img, 200, 180, 8, PASTEL)
  pintarCirculo(img, 440, 180, 8, PASTEL)
  const obj = rgbAHsv(...PASTEL)
  const conDefecto = pixelesQueCasan(img.datos, img.ancho, img.alto, obj, { paso: 1 })
  const conAjuste = pixelesQueCasan(img.datos, img.ancho, img.alto, obj, {
    paso: 1,
    minSat: Math.min(0.35, obj.s * 0.6),
    minVal: Math.min(0.25, obj.v * 0.6),
  })
  caso(
    'un marcador poco saturado se pierde con los mínimos fijos',
    conDefecto.n === 0 && conAjuste.n > 100,
    `saturación de la marca ${(obj.s * 100).toFixed(0)} % · píxeles con mínimos fijos ${conDefecto.n}, con mínimos del color ${conAjuste.n}`,
    'documenta por qué los mínimos deben salir del color fijado',
  )
}

{
  // Cuatro marcas: la diana mide el escorzo, que es lo que dos marcas no pueden.
  // Una inclinación de θ comprime un eje por cos θ.
  const anchoMm = 300
  const altoMm = 200
  for (const inc of [0, 20, 35]) {
    const img = lienzo(640, 360)
    const escalaPx = 1.2 // px por mm
    const cos = Math.cos((inc * Math.PI) / 180)
    const hw = (anchoMm / 2) * escalaPx
    const hh = (altoMm / 2) * escalaPx * cos
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pintarCirculo(img, 320 + sx * hw, 180 + sy * hh, 6, MAGENTA)
    }
    granular(img, 4)
    const nube = pixelesQueCasan(img.datos, img.ancho, img.alto, objetivo, { paso: 1 })
    const d = detectarDianaCuatro(nube, anchoMm, altoMm)
    const escalaEsperada = escalaPx * 1000 // px por metro
    caso(
      `diana de cuatro marcas a ${inc}° de escorzo`,
      d !== undefined && cerca(d.inclinacionGrados, inc, 4) && cerca(d.escalaPxM, escalaEsperada, escalaEsperada * 0.03),
      d ? `inclinación ${d.inclinacionGrados.toFixed(1)}° · escala ${d.escalaPxM.toFixed(0)} px/m (verdad ${escalaEsperada})` : 'no detectó',
      '±4°, ±3 % de escala',
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 · Imagen: el disco
// ─────────────────────────────────────────────────────────────────────────────

bloque('Detección del disco')

function escenaDisco({ x = 320, y = 180, r = 60, escalaY = 1, fondo = [150, 152, 156], disco = [30, 30, 32], decorado = true } = {}) {
  const img = lienzo(640, 360, fondo)
  if (decorado) {
    // Decorado: una pared más clara arriba y una banda oscura abajo. Bordes
    // fuertes que NO son el disco, que es lo que había en el gimnasio.
    for (let py = 0; py < 90; py++) {
      for (let px = 0; px < 640; px++) {
        const i = (py * 640 + px) * 4
        img.datos[i] = 200
        img.datos[i + 1] = 202
        img.datos[i + 2] = 205
      }
    }
    for (let py = 320; py < 360; py++) {
      for (let px = 0; px < 640; px++) {
        const i = (py * 640 + px) * 4
        img.datos[i] = 70
        img.datos[i + 1] = 70
        img.datos[i + 2] = 72
      }
    }
  }
  pintarCirculo(img, x, y, r, disco, escalaY)
  pintarCirculo(img, x, y, Math.max(4, r * 0.18), [120, 122, 126], escalaY) // el buje
  granular(img, 3)
  return img
}

{
  for (const r of [40, 60, 90]) {
    const img = escenaDisco({ r })
    const e = identificarEstructura(img.datos, img.ancho, img.alto, { x: 320, y: 180 }, { radioMax: 160 })
    caso(
      `disco de ${r} px de radio se identifica`,
      e.tipo === 'disco' && cerca(e.ajuste.r, r, 3),
      e.tipo === 'disco' ? `r ${e.ajuste.r.toFixed(1)} px · contorno ${(e.cobertura * 100).toFixed(0)} % · cámara ${e.anguloCamara.toFixed(0)}°` : `${e.tipo}: ${e.motivo}`,
      '±3 px',
    )
  }
}

{
  // El disco de canto: la cámara mira desde un lado y el círculo es una elipse.
  // `anguloCamara` sale de la relación de ejes, y ese es el aviso de moverse.
  const inc = 30
  const img = escenaDisco({ r: 70, escalaY: 1 / Math.cos((inc * Math.PI) / 180) })
  const e = identificarEstructura(img.datos, img.ancho, img.alto, { x: 320, y: 180 }, { radioMax: 160 })
  caso(
    'la cámara torcida se detecta por la elipse',
    e.tipo !== 'disco' || e.anguloCamara > 10,
    e.tipo === 'disco' ? `ángulo de cámara ${e.anguloCamara.toFixed(0)}° (verdad ${inc}°)` : `${e.tipo}: ${e.motivo}`,
    '> 10° obliga a moverse',
  )
}

{
  // Seguimiento fotograma a fotograma. La reja de plausibilidad tiene que dejar
  // pasar el movimiento real y parar el salto imposible.
  const r = 60
  let prev = { x: 320, y: 260 }
  let vistos = 0
  const total = 30
  for (let k = 0; k < total; k++) {
    const y = 260 - k * 6 // 6 px por fotograma: una barra rápida a 60 fps
    const img = escenaDisco({ x: 320, y, r })
    const d = detectarDisco(img.datos, img.ancho, img.alto, prev, r, { radioMax: r * 1.35 })
    if (d.ok && cerca(d.y, y, 3)) {
      vistos++
      prev = { x: d.x, y: d.y }
    }
  }
  caso(
    'seguimiento de un disco que se mueve 6 px por fotograma',
    vistos >= total * 0.9,
    `${vistos} de ${total} fotogramas`,
    '≥ 90 %',
  )
}

{
  // El salto imposible: el disco «aparece» a 200 px de donde estaba. A 60 fps
  // eso serían 12 m/s. Guardarlo sería guardar un error de detección como si
  // fuera movimiento.
  const r = 60
  const img = escenaDisco({ x: 320, y: 180, r })
  const d = detectarDisco(img.datos, img.ancho, img.alto, { x: 120, y: 180 }, r, { radioMax: r * 1.35 })
  caso(
    'un salto de 200 px se rechaza en vez de guardarse',
    !d.ok,
    d.ok ? `aceptó (${d.x.toFixed(0)}, ${d.y.toFixed(0)})` : `rechazado: ${d.motivo}`,
  )
}

{
  // La predicción con velocidad frente a la posición anterior a secas. Cuando
  // caen fotogramas, la barra recorre más de lo que la reja de 40 px admite: la
  // posición anterior queda corta y el seguimiento se pierde en la parte rápida
  // de la repetición, que es exactamente la que decide el %PV.
  const r = 60
  const salto = 46 // dos fotogramas perdidos a 23 px cada uno
  let ultimo = { x: 320, y: 300 }
  let anterior = { x: 320, y: 300 + salto }
  let conPosicion = 0
  let conPrediccion = 0
  const total = 8
  for (let k = 1; k <= total; k++) {
    const y = 300 - k * salto
    const img = escenaDisco({ x: 320, y, r })
    const dPos = detectarDisco(img.datos, img.ancho, img.alto, ultimo, r, { radioMax: r * 1.35 })
    if (dPos.ok) conPosicion++
    const predicho = { x: 2 * ultimo.x - anterior.x, y: 2 * ultimo.y - anterior.y }
    const dPred = detectarDisco(img.datos, img.ancho, img.alto, predicho, r, { radioMax: r * 1.35 })
    if (dPred.ok) conPrediccion++
    anterior = ultimo
    ultimo = { x: 320, y }
  }
  caso(
    'la predicción con velocidad salva los fotogramas que la posición anterior pierde',
    conPrediccion > conPosicion,
    `con posición anterior ${conPosicion}/${total} · con predicción ${conPrediccion}/${total}`,
    'documenta por qué la app debe extrapolar',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 8 · La cadena entera: imagen → seguimiento → serie
// ─────────────────────────────────────────────────────────────────────────────

/* Hasta aquí se ha probado el núcleo con datos ya digeridos. Esto es lo otro:
 * fabricar los FOTOGRAMAS de una serie completa y pasarlos por la misma tubería
 * que corre en el teléfono, política de app incluida.
 *
 * Es lo que faltaba. El núcleo puede estar perfecto y la medida salir mal, y
 * salía mal justo aquí: en dónde se mira y con qué umbrales. */

bloque('La cadena entera, fotograma a fotograma')

const SEP_MM = 600
const SEP_PX = 240
const MPP = SEP_MM / 1000 / SEP_PX // 2,5 mm por píxel
const ROM_PX = 0.5 / MPP // medio metro

/** La altura de la barra en píxeles, en el instante t de una serie. */
function alturaEn(t, { nReps, v, romPx = ROM_PX }) {
  const dur = [1.2, 0.15, romPx * MPP / v, 0.2]
  const ciclo = dur.reduce((a, b) => a + b, 0)
  const r = Math.floor(t / ciclo)
  if (r >= nReps) return { y: 300, fin: true }
  let u = t - r * ciclo
  if (u < dur[0]) return { y: 300 - romPx * (1 - u / dur[0]), fin: false }
  u -= dur[0]
  if (u < dur[1]) return { y: 300, fin: false }
  u -= dur[1]
  if (u < dur[2]) return { y: 300 - romPx * (u / dur[2]), fin: false }
  return { y: 300 - romPx, fin: false }
}

function escenaSerie({ y, intruso, pastel = false }) {
  const marca = pastel ? [225, 175, 215] : MAGENTA
  const img = lienzo(640, 360, pastel ? [225, 226, 228] : [40, 42, 46])
  pintarCirculo(img, 320 - SEP_PX / 2, y, 7, marca)
  pintarCirculo(img, 320 + SEP_PX / 2, y, 7, marca)
  // El intruso: algo del mismo color que no es la barra y no se mueve. Un
  // disco pintado apoyado en la pared, una camiseta, el logo del gimnasio.
  if (intruso) pintarCirculo(img, 560, 70, 24, marca)
  granular(img, 4)
  return img
}

/**
 * Corre una serie entera bajo una de las dos políticas.
 *
 *   'entero'  — lo que hacía `useCaptura` antes: nube del fotograma completo,
 *               umbrales fijos, sin memoria de dónde estaba la referencia.
 *   'ventana' — `seguimiento.ts`.
 */
async function reproducir({ politica, intruso = false, pastel = false, nReps = 3, v = 0.6, fps = 60, perdidaPct = 0, semilla = 31337 }) {
  const { nuevoSeguimiento } = await import(
    '../src/features/entrenar/encoder/seguimiento.ts'
  )
  const ajustes = { referencia: 'marcadores', dianaMm: [300, 200], tolTono: 22 }
  const azar = azarCon(semilla)
  const seg = politica === 'ventana' ? nuevoSeguimiento() : null
  let objetivoColor = null
  const muestras = []
  let t = 0
  // Se cronometra SOLO la detección. Meter dentro el pintado de la escena —que
  // rellena 900 KB por fotograma— fue el segundo fallo de este banco: tapaba la
  // diferencia entre las dos políticas y las dejaba empatadas a 6 ms.
  let nanos = 0n

  for (let k = 0; k < 6000; k++) {
    const { y, fin } = alturaEn(t, { nReps, v })
    if (fin) break
    const img = escenaSerie({ y, intruso, pastel })
    if (k === 0) {
      // Fijar la referencia tocando la marca de la izquierda.
      if (seg) seg.fijarColor(img.datos, img.ancho, img.alto, 320 - SEP_PX / 2, Math.round(y), ajustes)
      else objetivoColor = rgbAHsv(...(pastel ? [225, 175, 215] : MAGENTA))
    }

    let det
    const antes = process.hrtime.bigint()
    if (seg) {
      det = seg.paso(img.datos, img.ancho, img.alto, ajustes).det
    } else {
      const nube = pixelesQueCasan(img.datos, img.ancho, img.alto, objetivoColor, { paso: 2 })
      det = separarMarcadores(nube)
    }
    nanos += process.hrtime.bigint() - antes
    // Fotogramas que el aparato no entrega. La política tiene que sobrevivir a
    // esto: es donde la predicción con velocidad se gana el sueldo.
    const tirado = perdidaPct > 0 && azar() + 0.5 < perdidaPct / 100
    muestras.push(det && !tirado ? { t, ...det } : { t, y: NaN })
    t += (1 / fps) * (1 + 0.3 * azar())
  }

  const ms = Number(nanos) / 1e6
  const r = analizarSerie(muestras, { sepMm: SEP_MM, sentido: 'subir' })
  return { r, ms, fotogramas: muestras.length, msPorFotograma: ms / muestras.length }
}

{
  // 1 · Escena limpia: la ventana no puede empeorar lo que ya funcionaba.
  const entero = await reproducir({ politica: 'entero' })
  const ventana = await reproducir({ politica: 'ventana' })
  const bien = (x) => x.r.ok && cerca(x.r.vPrimera, 0.6, 0.03) && x.r.reps.length === 3
  caso(
    'escena limpia · la ventana no pierde precisión',
    bien(entero) && bien(ventana),
    `entero: v₁ ${entero.r.ok ? entero.r.vPrimera.toFixed(3) : '—'} · ventana: v₁ ${ventana.r.ok ? ventana.r.vPrimera.toFixed(3) : '—'}`,
    '±0,03 m/s las dos',
  )
  caso(
    'escena limpia · la ventana cuesta menos por fotograma',
    ventana.msPorFotograma < entero.msPorFotograma,
    `entero ${entero.msPorFotograma.toFixed(2)} ms/fotograma · ventana ${ventana.msPorFotograma.toFixed(2)} ms/fotograma ` +
      `(×${(entero.msPorFotograma / ventana.msPorFotograma).toFixed(1)})`,
    'y los ms por fotograma son fps, y los fps son la puerta de calidad',
  )
}

{
  // 2 · Con un intruso del mismo color en el encuadre. Es EL caso: el de antes
  // no fallaba, medía mal y guardaba el número.
  const entero = await reproducir({ politica: 'entero', intruso: true })
  const ventana = await reproducir({ politica: 'ventana', intruso: true })
  const errorEntero = entero.r.ok ? Math.abs(entero.r.vPrimera - 0.6) : Infinity
  const errorVentana = ventana.r.ok ? Math.abs(ventana.r.vPrimera - 0.6) : Infinity
  caso(
    'intruso del mismo color · el fotograma entero mide mal SIN avisar',
    errorEntero > 0.05 || !entero.r.ok,
    entero.r.ok
      ? `v₁ ${entero.r.vPrimera.toFixed(3)} (verdad 0,600) · reps ${entero.r.reps.length}/3 · calidad ${entero.r.calidad.nivel}`
      : `no midió: ${entero.r.detalle ?? entero.r.motivo}`,
    'el contrato admite 0,050 m/s',
  )
  caso(
    'intruso del mismo color · con ventana la medida se sostiene',
    ventana.r.ok && errorVentana <= 0.03 && ventana.r.reps.length === 3,
    ventana.r.ok
      ? `v₁ ${ventana.r.vPrimera.toFixed(3)} · reps ${ventana.r.reps.length}/3 · %PV ${ventana.r.pvPct.toFixed(1)}`
      : `no midió: ${ventana.r.detalle ?? ventana.r.motivo}`,
    '±0,03 m/s',
  )
}

{
  // 3 · Marcador pálido. Antes: cero píxeles, cero fotogramas, «no veo la
  // marca» — y la marca estaba ahí, en el centro de la imagen.
  const entero = await reproducir({ politica: 'entero', pastel: true })
  const ventana = await reproducir({ politica: 'ventana', pastel: true })
  caso(
    'marcador pálido · con umbrales fijos no se ve NADA',
    !entero.r.ok || entero.r.deteccion < 0.1,
    entero.r.ok ? `detección ${(entero.r.deteccion * 100).toFixed(0)} %` : `no midió: ${entero.r.detalle ?? entero.r.motivo}`,
  )
  caso(
    'marcador pálido · con los umbrales del color se mide',
    ventana.r.ok && ventana.r.deteccion > 0.9 && cerca(ventana.r.vPrimera, 0.6, 0.03),
    ventana.r.ok
      ? `detección ${(ventana.r.deteccion * 100).toFixed(0)} % · v₁ ${ventana.r.vPrimera.toFixed(3)}`
      : `no midió: ${ventana.r.detalle ?? ventana.r.motivo}`,
    '±0,03 m/s',
  )
}

{
  // 4 · Fotogramas que se caen. La ventana tiene que abrirse y reenganchar en
  // vez de quedarse mirando donde la barra ya no está.
  const ventana = await reproducir({ politica: 'ventana', perdidaPct: 15, intruso: true })
  caso(
    'con el 15 % de fotogramas caídos la ventana reengancha',
    ventana.r.ok && ventana.r.reps.length === 3 && cerca(ventana.r.vPrimera, 0.6, 0.04),
    ventana.r.ok
      ? `detección ${(ventana.r.deteccion * 100).toFixed(0)} % · reps ${ventana.r.reps.length}/3 · v₁ ${ventana.r.vPrimera.toFixed(3)}`
      : `no midió: ${ventana.r.detalle ?? ventana.r.motivo}`,
    '±0,04 m/s',
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 9 · Cierre
// ─────────────────────────────────────────────────────────────────────────────

const fallos = actas.filter((a) => !a.ok)
console.log('')
console.log('─'.repeat(72))
console.log(`${actas.length} casos · ${actas.length - fallos.length} en verde · ${fallos.length} en rojo`)
if (fallos.length) {
  console.log('')
  for (const f of fallos) console.log(`  \x1b[31m✗\x1b[0m ${f.bloque} → ${f.etiqueta}`)
}
console.log('')
process.exit(fallos.length ? 1 : 0)
