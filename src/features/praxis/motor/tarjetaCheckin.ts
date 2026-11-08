import { confirmarTarjeta, type Confirmado, type Eleccion, type FilaTarjeta, type TarjetaCheckin } from '../../../domain/praxis/registro/tarjetaCheckin'
import type { Anotacion } from '../../../domain/praxis/registro/anotaciones'
import type { CampoCheckin } from '../../../domain/praxis/registro/mensajeLargo'
import { enfocarControles, montar, refrescar } from './cabecera'
import { h } from './dom'

/**
 * La tarjeta del check-in en la pantalla de Praxis (paso 2 del diseño de los conectores). Mismo estilo que la de
 * deshacer (`tarjeta-registro`, `chip`, `btn-plata`).
 *
 * Regla madre: NADA se anota sin el toque de la persona. Lo que Praxis marcó se ve marcado, pero solo cuenta lo que se
 * toca; «No anotar» deja la fila fuera. Detrás de `CONECTORES_EN_TARJETA` (apagada): nadie la monta todavía, y
 * `alConfirmar` recibe lo confirmado sin guardarlo (el guardado por el libro es el paso 4).
 */
const NO_ANOTAR = 'No anotar'
export const BOTON_ANOTAR = 'Anotar lo que marqué'

/** Estado de una tarjeta abierta: lo que la persona ha tocado. */
export interface EstadoTarjeta {
  elecciones: Map<CampoCheckin, Eleccion>
  /** Posiciones de `TarjetaCheckin.anotaciones` que la persona tocó para su cuaderno. */
  anotaciones: Set<number>
}

/** Cómo se lee cada anotación en la tarjeta. */
function rotuloDeAnotacion(a: Anotacion): string {
  return a.tipo === 'recuperacion_zona' ? `Cuaderno: ¿cómo se recupera ${a.zona ?? 'esa zona'}?` : `Cuaderno: cómo te cayó la comida (${a.momento ?? 'otro'})`
}

export const BOTON_CUADERNO = 'Anotar en mi cuaderno'

function chipsDeFila(f: FilaTarjeta, estado: EstadoTarjeta, alCambiar: () => void): HTMLElement[] {
  const elegido = estado.elecciones.get(f.campo)
  const valorElegido = elegido && 'valor' in elegido ? elegido.valor : null
  const opciones = f.candidatos.length > 0 ? f.candidatos : f.opciones.length > 0 ? f.opciones : f.marcado !== null ? [f.marcado] : []
  const tocar = (e: Eleccion) => () => { estado.elecciones.set(f.campo, e); alCambiar() }
  return [
    ...opciones.map((o) => h('button', {
      type: 'button', class: 'chip', 'data-k': `ck-${f.campo}-${o}`,
      'aria-pressed': String(valorElegido === o),
      // Lo que Praxis propone se distingue, pero no cuenta como elegido.
      'data-propuesto': f.marcado === o && elegido === undefined ? 'si' : null,
      onclick: tocar({ campo: f.campo, valor: o }),
    }, String(o))),
    h('button', {
      type: 'button', class: 'chip', 'data-k': `ck-${f.campo}-no`,
      'aria-pressed': String(elegido !== undefined && 'noAnotar' in elegido), onclick: tocar({ campo: f.campo, noAnotar: true }),
    }, NO_ANOTAR),
  ]
}

/** El árbol de la tarjeta. Aparte de `montar` para poder probarlo sin la escena entera. */
export function nodoTarjetaCheckin(t: TarjetaCheckin, estado: EstadoTarjeta, alCambiar: () => void, alAnotar: () => void): HTMLElement {
  const filas = t.filas.map((f) => h('div', { class: 'fila-checkin', 'data-k': `ck-${f.campo}` },
    h('span', { class: 'rotulo' }, f.rotulo),
    f.cita ? h('span', { class: 'cita' }, `«${f.cita}»`) : null,
    f.origen === 'dudosa' ? h('span', { class: 'marca-ejemplo' }, 'Elige uno') : null,
    h('div', { class: 'pie-controles' }, chipsDeFila(f, estado, alCambiar))))
  const cuaderno = t.anotaciones.map((a, i) => h('div', { class: 'fila-checkin', 'data-k': `ck-cuaderno-${i}` },
    h('span', { class: 'rotulo' }, rotuloDeAnotacion(a)),
    h('span', { class: 'cita' }, `«${a.cita}»`),
    h('div', { class: 'pie-controles' },
      h('button', {
        type: 'button', class: 'chip', 'data-k': `ck-cuaderno-${i}-si`, 'aria-pressed': String(estado.anotaciones.has(i)),
        onclick: () => { if (estado.anotaciones.has(i)) estado.anotaciones.delete(i); else estado.anotaciones.add(i); alCambiar() },
      }, BOTON_CUADERNO))))
  return h('div', { class: 'tarjeta-registro', 'data-k': 'checkin-conectado' },
    h('span', { class: 'marca-ejemplo' }, 'Nada se anota hasta que toques tu opción'),
    filas,
    cuaderno,
    h('div', { class: 'pie-controles' },
      h('button', { type: 'button', class: 'btn-plata', 'data-k': 'ck-anotar', disabled: estado.elecciones.size === 0 && estado.anotaciones.size === 0, onclick: alAnotar }, BOTON_ANOTAR)))
}

/** Monta la tarjeta en los controles de Praxis. `alConfirmar` recibe lo que la persona tocó; aquí no se guarda nada. */
export function mostrarTarjetaCheckin(
  t: TarjetaCheckin, yaHoy: readonly CampoCheckin[], alConfirmar: (c: Confirmado, elecciones: Eleccion[], anotaciones: Anotacion[]) => void,
): void {
  const estado: EstadoTarjeta = { elecciones: new Map(), anotaciones: new Set() }
  const alAnotar = () => {
    if (estado.elecciones.size === 0 && estado.anotaciones.size === 0) return
    const elecciones = [...estado.elecciones.values()]
    const cuaderno = [...estado.anotaciones].sort((a, b) => a - b).flatMap((i) => (t.anotaciones[i] ? [t.anotaciones[i]] : []))
    alConfirmar(confirmarTarjeta(t, elecciones, yaHoy), elecciones, cuaderno)
  }
  montar(() => [nodoTarjetaCheckin(t, estado, refrescar, alAnotar)])
  enfocarControles()
}
