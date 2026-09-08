/**
 * EL MEDIDOR DE RENDIMIENTO: cuánto le cuesta al teléfono mover esta app.
 *
 * Se monta SOLO con `?medir=1` en la URL. Sin la bandera este archivo no crea un nodo, no
 * escucha un evento y no pide un fotograma: la app de un asesorado no puede pagar ni un
 * `requestAnimationFrame` por un instrumento que nadie va a leer.
 *
 * ## Por qué esto y no las herramientas del navegador
 *
 * Porque el teléfono de Bryan no está enchufado a un portátil cuando el salón se ve a
 * tirones. Lo que hace falta es un número que se pueda leer y PEGAR en un informe desde el
 * propio móvil, y para eso el instrumento tiene que vivir dentro de la app. El botón
 * «Copiar informe» es la mitad del invento: sin él, medir en un móvil es leer cifras en voz
 * alta.
 *
 * ## Qué se mide, y por qué justo esto
 *
 * - **fps y p50/p95 del tiempo de fotograma.** La media miente: 58 fps de media con un
 *   fotograma de 300 ms cada dos segundos se ve como un tirón, no como fluidez. El p95 es
 *   el que dice cómo se ve de verdad.
 * - **Fotogramas lentos (> 33 ms).** Dos fotogramas de 60 fps. Por encima de ahí el ojo ya
 *   no ve movimiento continuo, ve saltos.
 * - **Memoria observable.** `performance.memory` solo existe en Chromium y solo da el
 *   montón de JS, así que no es «la memoria del teléfono»: es una pista de si algo crece
 *   sin parar. En el resto de navegadores sale `null`, que es lo honesto — no cero.
 * - **Cambios de ejercicio y capas visitadas.** Sin esto un informe no se puede releer:
 *   30 fps mirando un cuerpo quieto y 30 fps tras atravesar cuatro capas y cambiar seis
 *   veces de ejercicio son dos medidas distintas.
 * - **Vueltas desde segundo plano.** Es donde aparecen los fallos raros: el navegador
 *   congela los temporizadores con la app detrás y al volver hay que recuperarse. Cuántas
 *   veces se volvió es el contexto de un p95 malo.
 */

/** A partir de aquí un fotograma se cuenta como lento: dos de sesenta por segundo. */
export const UMBRAL_LENTO = 33

/** Cuántos tiempos de fotograma se guardan. A 60 fps son los dos últimos minutos. */
const TOPE_DE_MUESTRAS = 7200

export interface InformeDeRendimiento {
  /** Fotogramas por segundo, de la mediana del tiempo de fotograma. */
  fps: number
  /** Tiempo de fotograma en milisegundos. */
  fotograma: { p50: number; p95: number }
  /** Cuántos fotogramas pasaron de `UMBRAL_LENTO`. */
  lentos: number
  /** Montón de JS en MB donde el navegador lo cuenta, y `null` donde no. */
  memoriaMb: number | null
  /** Cuántas veces se cambió de ejercicio mientras se medía. */
  cambiosDeEjercicio: number
  /** Qué escalones del eje W se llegaron a ver, en orden de primera visita. */
  capasVisitadas: number[]
  /** Cuántas veces volvió la app desde segundo plano. */
  vueltasDeSegundoPlano: number
  /** Cuántos fotogramas entraron en la cuenta y cuánto duró la medida. */
  muestras: number
  segundos: number
}

/**
 * EL PERCENTIL POR RANGO MÁS CERCANO, sin interpolar.
 *
 * Con 3.000 muestras la diferencia con el método interpolado es la tercera cifra
 * decimal, y a cambio el número que sale es SIEMPRE un fotograma que ocurrió de verdad.
 * Un p95 interpolado de 41,3 ms cuando nadie tardó 41,3 invita a discutir el método en
 * vez de el tirón.
 */
export function percentil(muestras: readonly number[], p: number): number {
  if (muestras.length === 0) return 0
  const orden = [...muestras].sort((a, b) => a - b)
  const rango = Math.ceil((p / 100) * orden.length)
  return orden[Math.min(orden.length - 1, Math.max(0, rango - 1))]
}

/** Las tres cifras que salen de una lista de tiempos de fotograma. */
export function resumenDeFotogramas(tiempos: readonly number[]): {
  fps: number
  p50: number
  p95: number
  lentos: number
} {
  const p50 = percentil(tiempos, 50)
  const p95 = percentil(tiempos, 95)
  return {
    // Los fps salen de la MEDIANA y no del total partido por el tiempo: así son los fps
    // que se ven la mitad del rato, y un parón de un segundo no los hunde.
    fps: p50 > 0 ? Math.round(1000 / p50) : 0,
    p50,
    p95,
    lentos: tiempos.filter((t) => t > UMBRAL_LENTO).length,
  }
}

/** El montón de JS en MB, donde el navegador lo cuenta. `null` donde no. */
export function memoriaObservableMb(): number | null {
  const p = performance as Performance & { memory?: { usedJSHeapSize?: number } }
  const bytes = p.memory?.usedJSHeapSize
  return typeof bytes === 'number' ? Math.round((bytes / 1048576) * 10) / 10 : null
}

/**
 * LO QUE SE VA ANOTANDO, sin navegador de por medio.
 *
 * Todo lo que decide una cifra vive aquí y se puede probar con números inventados. Lo que
 * hace falta un navegador para saber —cuándo hay un fotograma, cuándo vuelve la app— lo
 * pone `montarMedidor`, que solo llama a estos métodos.
 */
export class CuentaDeRendimiento {
  private tiempos: number[] = []
  private cambios = 0
  private capas: number[] = []
  private vueltas = 0
  private desde = 0

  constructor(ahora = 0) {
    this.desde = ahora
  }

  fotograma(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return
    // Se descartan los saltos monstruosos: al volver de segundo plano el navegador
    // entrega un fotograma de varios segundos que no midió a nadie dibujando nada.
    if (ms > 5000) return
    this.tiempos.push(ms)
    if (this.tiempos.length > TOPE_DE_MUESTRAS) this.tiempos.shift()
  }

  cambioDeEjercicio(): void {
    this.cambios++
  }

  capaVisitada(w: number): void {
    if (!Number.isFinite(w)) return
    if (!this.capas.includes(w)) this.capas.push(w)
  }

  vueltaDeSegundoPlano(): void {
    this.vueltas++
  }

  informe(ahora = 0): InformeDeRendimiento {
    const { fps, p50, p95, lentos } = resumenDeFotogramas(this.tiempos)
    return {
      fps,
      fotograma: { p50: Math.round(p50 * 10) / 10, p95: Math.round(p95 * 10) / 10 },
      lentos,
      memoriaMb: memoriaObservableMb(),
      cambiosDeEjercicio: this.cambios,
      capasVisitadas: [...this.capas],
      vueltasDeSegundoPlano: this.vueltas,
      muestras: this.tiempos.length,
      segundos: Math.round(Math.max(0, ahora - this.desde) / 100) / 10,
    }
  }
}

/** Si la URL pide medir. Se lee la cadena entera para poder probarlo sin navegador. */
export function pideMedir(busqueda: string): boolean {
  try {
    return new URLSearchParams(busqueda).get('medir') === '1'
  } catch {
    return false
  }
}

export interface MedidorMontado {
  /** El nodo que se ve en pantalla. */
  nodo: HTMLElement
  /** Lo anotado hasta ahora. */
  informe: () => InformeDeRendimiento
  /** Lo quita todo: el nodo, el bucle y los oyentes. */
  desmontar: () => void
}

/**
 * MONTA EL MEDIDOR, SI LA URL LO PIDE. Si no, devuelve `null` y no hace absolutamente
 * nada: ni nodo, ni oyentes, ni un solo `requestAnimationFrame`.
 *
 * No usa React a propósito. Un panel que se repinta con el estado de la app mediría la
 * app CON el medidor dentro, que es medirse a sí mismo; y el bucle de fotogramas tiene que
 * poder correr sin provocar un solo render.
 */
export function montarMedidor(
  opciones: { busqueda?: string; raiz?: HTMLElement } = {},
): MedidorMontado | null {
  if (typeof document === 'undefined') return null
  const busqueda = opciones.busqueda ?? (typeof location === 'undefined' ? '' : location.search)
  if (!pideMedir(busqueda)) return null

  const cuenta = new CuentaDeRendimiento(performance.now())
  const raiz = opciones.raiz ?? document.body

  const nodo = document.createElement('div')
  nodo.dataset.medidor = 'rendimiento'
  nodo.setAttribute('role', 'status')
  nodo.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:rgba(6,8,11,.86);' +
    'color:#e8e8ea;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);' +
    'max-width:62vw;pointer-events:auto'
  const cifras = document.createElement('pre')
  cifras.style.cssText = 'margin:0 0 6px;white-space:pre-wrap'
  const boton = document.createElement('button')
  boton.type = 'button'
  boton.textContent = 'Copiar informe'
  boton.style.cssText =
    'font:inherit;color:inherit;background:rgba(255,255,255,.1);border:1px solid ' +
    'rgba(255,255,255,.2);border-radius:8px;padding:4px 8px'
  nodo.append(cifras, boton)
  raiz.appendChild(nodo)

  const pintar = () => {
    const i = cuenta.informe(performance.now())
    cifras.textContent =
      `${i.fps} fps · p50 ${i.fotograma.p50} ms · p95 ${i.fotograma.p95} ms\n` +
      `lentos ${i.lentos} · memoria ${i.memoriaMb ?? '—'} MB\n` +
      `ejercicios ${i.cambiosDeEjercicio} · capas ${i.capasVisitadas.join('') || '—'} · fondo ${i.vueltasDeSegundoPlano}`
  }

  boton.addEventListener('click', () => {
    const texto = `${JSON.stringify(cuenta.informe(performance.now()), null, 2)}\n`
    const copiado = navigator.clipboard?.writeText(texto)
    if (copiado) {
      copiado.then(
        () => {
          boton.textContent = 'Copiado ✓'
        },
        () => mostrarParaCopiarAMano(nodo, texto),
      )
    } else {
      // Sin portapapeles —o sin permiso— el informe se enseña para copiarlo a mano. Un
      // botón que no hace nada y no dice nada es peor que no tener botón.
      mostrarParaCopiarAMano(nodo, texto)
    }
  })

  let anterior = performance.now()
  let cuadro = 0
  const bucle = () => {
    const ahora = performance.now()
    cuenta.fotograma(ahora - anterior)
    anterior = ahora
    pintar()
    cuadro = requestAnimationFrame(bucle)
  }
  cuadro = requestAnimationFrame(bucle)

  const alCambiarVisibilidad = () => {
    if (document.visibilityState === 'visible') {
      cuenta.vueltaDeSegundoPlano()
      // El primer fotograma tras volver mide el rato que la app estuvo detrás, no un
      // dibujo: se reancla el reloj para no contarlo.
      anterior = performance.now()
    }
  }
  document.addEventListener('visibilitychange', alCambiarVisibilidad)

  // QUÉ MIRA PARA SABER QUE ALGO CAMBIÓ. No se le pide nada a la app: se mira el DOM que
  // la app ya publica —`data-w` para la capa y el rótulo del lienzo para el ejercicio—.
  // Así el medidor no tiene que enchufarse a ninguna pantalla y no puede desincronizarse
  // de ella.
  let ultimoPatron = ''
  const observador = new MutationObserver(() => {
    const salon = document.querySelector('[data-salon="entrenar"]')
    const w = salon?.getAttribute('data-w')
    if (w !== null && w !== undefined) cuenta.capaVisitada(Number(w))
    const patron = document.querySelector('[data-salon="entrenar"] canvas')?.getAttribute('aria-label') ?? ''
    if (patron && ultimoPatron && patron !== ultimoPatron) cuenta.cambioDeEjercicio()
    if (patron) ultimoPatron = patron
  })
  observador.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-w', 'aria-label'],
  })

  pintar()
  return {
    nodo,
    informe: () => cuenta.informe(performance.now()),
    desmontar: () => {
      cancelAnimationFrame(cuadro)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      observador.disconnect()
      nodo.remove()
    },
  }
}

function mostrarParaCopiarAMano(nodo: HTMLElement, texto: string): void {
  const area = document.createElement('textarea')
  area.value = texto
  area.readOnly = true
  area.style.cssText = 'width:100%;height:96px;margin-top:6px;font:inherit'
  nodo.appendChild(area)
  area.select()
}
