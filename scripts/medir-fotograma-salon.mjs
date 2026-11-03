/**
 * MIDE EL PRESUPUESTO DE FOTOGRAMA DEL SALÓN, para la sentadilla con barra, con el método de
 * `informes/presupuesto-de-fotograma.md`: módulos reales del repositorio, importados desde una
 * página de Chrome servida por Vite, mediana de muchas repeticiones con calentamiento
 * descartado, y `document.visibilityState` leído en la misma llamada que devuelve el número.
 *
 * Se carga desde la consola de una pestaña VISIBLE de `http://localhost:<puerto>/`:
 *
 *   const m = await import('/scripts/medir-fotograma-salon.mjs')
 *   await m.medir({ capa: false })   // el salón tal como está
 *   await m.medir({ capa: true })    // con la capa del momento articular encendida
 *
 * Reproduce las partes que `VisorPatron.construir()` pone en CADA fotograma (bahía, plomada,
 * fuerzas, suelo, sala, trípode, hierro, huesos, músculos, guías). Lo estático (las piezas de la
 * sala de Blender) va por `subirEstaticas()` y no pasa por `subir()`: no se sube aquí, y se dice
 * en el informe. No toca ningún archivo de `src/`.
 */

import { comprobarElCuadreDeLaTanda, comprobarQueLaCapaAporto, liberarContextoWebGL } from './medir-fotograma-guarda.mjs'

const REP = 80
const CALENTAR = 15

function estadistica(xs) {
  const v = [...xs].sort((a, b) => a - b)
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  const r = (x) => Math.round(x * 100) / 100
  return { min: r(v[0]), p10: r(q(0.1)), mediana: r(q(0.5)), p90: r(q(0.9)), max: r(v[v.length - 1]), n: v.length }
}

async function cargar() {
  const [catalogo, escena, esqueleto, malla, algebra, laboratorio, sala, suelo, tripode, impl, dibImpl, oclusion, brazos, palancas, fuerzas, musculos, motorMod, defCorp, encuadre, juego] =
    await Promise.all([
      import('/src/domain/patrones/catalogo.ts'),
      import('/src/domain/patrones/escena.ts'),
      import('/src/domain/patrones/esqueleto.ts'),
      import('/src/domain/patrones/malla.ts'),
      import('/src/domain/patrones/algebra.ts'),
      import('/src/domain/escenario/laboratorio.ts'),
      import('/src/features/entrenar/escena/sala.ts'),
      import('/src/features/entrenar/escena/suelo.ts'),
      import('/src/features/entrenar/escena/tripode.ts'),
      import('/src/features/entrenar/escena/implementos.ts'),
      import('/src/features/entrenar/escena/dibujarImplementos.ts'),
      import('/src/features/entrenar/escena/oclusionDelAparato.ts'),
      import('/src/domain/biomecanica/brazosDeMomento.ts'),
      import('/src/domain/biomecanica/palancas.ts'),
      import('/src/domain/patrones/fuerzas.ts'),
      import('/src/domain/patrones/musculos.ts'),
      import('/src/features/entrenar/visor/motor.ts'),
      import('/src/features/entrenar/visor/definicionCorporal.ts'),
      import('/src/features/entrenar/escena/encuadreDelSalon.ts'),
      import('/src/domain/patrones/juegoDeHuesos.ts'),
    ])
  return { catalogo, escena, esqueleto, malla, algebra, laboratorio, sala, suelo, tripode, impl, dibImpl, oclusion, brazos, palancas, fuerzas, musculos, motorMod, defCorp, encuadre, juego }
}

export async function medir({ capa = false, extras = null } = {}) {
  const visible = []
  const vis = () => visible.push(document.visibilityState)
  vis()
  const M = await cargar()
  const patron = M.catalogo.patronDeCategoria('SENTADILLA', 'Sentadilla con barra')
  if (!patron) throw new Error('sin patrón de sentadilla')

  document.body.innerHTML = ''
  const lienzo = document.createElement('canvas')
  lienzo.style.cssText = 'width:405px;height:720px;position:fixed;left:0;top:0'
  document.body.appendChild(lienzo)
  const motor = new M.motorMod.Motor(lienzo)
  const orbita = new M.motorMod.Orbita(lienzo, () => {})
  const en = M.encuadre.encuadreDelSalon(patron)
  orbita.azimut = patron.camara.azimut
  orbita.elevacion = M.sala.elevacionDelSalon(patron.camara.elevacion)
  orbita.distancia = en.distancia
  orbita.centro = [...en.centro]

  const sexo = M.juego.SEXO_POR_DEFECTO
  const definicion = M.defCorp.esqueletoDe(sexo)
  const { huesos, reposo } = M.defCorp.precalculado(sexo)
  const mallaMusculo = new M.malla.Malla(16384)
  const cacheEstatica = new M.malla.Malla()
  M.laboratorio.construirLaboratorio(cacheEstatica, { soloMarcasDeMedida: false })
  const mSuelo = new M.malla.Malla(128)
  M.suelo.construirSuelo(mSuelo, M.sala.SALA.radio)
  const mSala = new M.malla.Malla()
  M.sala.construirSala(mSala, undefined, patron.camara.azimut, {})
  const mTripode = new M.malla.Malla()
  M.tripode.construirTripode(mTripode, {
    anguloGrados: M.sala.SALA.estacion.anguloGrados,
    distancia: M.sala.SALA.estacion.distancia,
    altura: M.sala.SALA.estacion.altura,
  })
  const escenaHierro = M.impl.implementosDeEscena(patron.categoria, 'Sentadilla con barra')
  const { hierro, aparato } = M.oclusion.partirImplementos(escenaHierro)
  const traza = M.escena.trazaDelPatron(patron, definicion)
  const plan = M.palancas.planDeMedida(patron.categoria, 'Sentadilla con barra')

  const conRaiz = (esq) => {
    const m = [...esq.matrices]
    m[M.esqueleto.INDICE_RAIZ] = esq.raiz
    return m
  }

  /** Lo mismo que `construir()` del visor, para una fase dada. Devuelve las partes. */
  // Acumulado de toda la tanda (no del ultimo fotograma): la capa solo dibuja cerca de la pose del calculo.
  let verticesDeLaCapa = 0
  let fotogramas = 0 // llamadas a partesEn: la guarda cuadra los vertices contra este numero
  const partesEn = (fase, tiempos) => {
    fotogramas++
    let t0 = performance.now()
    const esq = M.escena.esqueletoEnFase(patron, fase, 1, fase * 3, undefined, definicion)
    if (tiempos) tiempos.esqueleto.push(performance.now() - t0)
    const partes = [cacheEstatica, M.escena.lineaDePeso(esq)]
    if (plan) for (const m of M.fuerzas.mallasDeFuerzas(M.brazos.brazosDeMomento(esq, plan), orbita.ojo())) if (m.vertices > 0) partes.push(m)
    partes.push(mSuelo, mSala, mTripode)
    const mHierro = new M.malla.Malla()
    M.dibImpl.construirImplementos(mHierro, hierro, esq)
    if (mHierro.vertices > 0) partes.push(mHierro)
    if (aparato.piezas.length) {
      const mAparato = new M.malla.Malla()
      M.dibImpl.construirImplementos(mAparato, aparato, esq)
      if (mAparato.vertices > 0) partes.push(mAparato)
    }
    partes.push(huesos)
    t0 = performance.now()
    partes.push(M.musculos.construirMusculos(esq, patron.activacion, reposo, mallaMusculo))
    if (tiempos) tiempos.musculos.push(performance.now() - t0)
    partes.push(M.escena.guias(traza, fase, orbita.centro, false))
    if (capa && extras) {
      for (const m of extras(esq, fase, M)) if (m && m.vertices > 0) { partes.push(m); verticesDeLaCapa += m.vertices }
    }
    return { partes, esq }
  }

  const pintar = (matrices) => {
    const aspecto = motor.ajustarTamano()
    motor.dibujar(matrices, orbita.vista(), M.algebra.M4.perspectiva(M.escena.CAMPO_VISUAL, aspecto, 0.05, 40), orbita.ojo(), true)
  }

  const tiempos = { esqueleto: [], musculos: [] }
  const subirT = []
  const dibujarT = []
  let vertices = 0
  // calentamiento + medida de las partes, fase barrida de 0 a 1 como en la repetición
  for (let i = 0; i < CALENTAR + REP; i++) {
    const fase = 0.5 + 0.5 * Math.sin(i / 7)
    const { partes, esq } = partesEn(fase, i >= CALENTAR ? tiempos : null)
    let t0 = performance.now()
    motor.subir(partes)
    const ds = performance.now() - t0
    t0 = performance.now()
    pintar(conRaiz(esq))
    const dd = performance.now() - t0
    if (i >= CALENTAR) {
      subirT.push(ds)
      dibujarT.push(dd)
    }
    vertices = partes.reduce((a, m) => a + m.vertices, 0)
  }
  vis()

  // fotograma entero en requestAnimationFrame: construir + subir + dibujar, en una devolución de llamada
  const entero = []
  const enteroGpu = []
  const gl = motor.gl
  await new Promise((resolver) => {
    let n = 0
    const paso = () => {
      const fase = 0.5 + 0.5 * Math.sin(n / 7)
      const t0 = performance.now()
      const { partes, esq } = partesEn(fase, null)
      motor.subir(partes)
      pintar(conRaiz(esq))
      const cpu = performance.now() - t0
      gl.finish()
      const conGpu = performance.now() - t0
      if (n >= CALENTAR) {
        entero.push(cpu)
        enteroGpu.push(conGpu)
      }
      vis()
      n++
      if (n < CALENTAR + REP) requestAnimationFrame(paso)
      else resolver()
    }
    requestAnimationFrame(paso)
  })

  // Se suelta el contexto ANTES de las guardas: si una falla, el contexto no se queda abierto.
  liberarContextoWebGL(gl)
  comprobarQueLaCapaAporto(capa, verticesDeLaCapa)
  comprobarElCuadreDeLaTanda(capa, verticesDeLaCapa, fotogramas)
  const salida = {
    cuando: new Date().toISOString(),
    capa,
    navegador: navigator.userAgent,
    lienzo: `${lienzo.width}x${lienzo.height}`,
    visibilidad: [...new Set(visible)],
    pasosConPestanaOculta: visible.filter((v) => v !== 'visible').length,
    vertices,
    verticesDeLaCapa,
    fotogramas,
    subir: estadistica(subirT),
    dibujar: estadistica(dibujarT),
    construirMusculos: estadistica(tiempos.musculos),
    esqueletoEnFase: estadistica(tiempos.esqueleto),
    fotogramaCPU: estadistica(entero),
    fotogramaConGlFinish: estadistica(enteroGpu),
  }
  window.__medida = salida
  return salida
}
