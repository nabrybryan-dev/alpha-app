import { FRASE_NO_QUITE, fraseDeResultado, type PropuestaDeshacerPantalla, type ResultadoDeshacer } from '../../../domain/praxis/deshacer/pantalla'
import { enfocarControles, limpiarControles, montar, refrescar } from './cabecera'
import type { ConexionPraxis } from './conexion'
import { h } from './dom'
import { trato } from './entorno'
import { decir, decirCorto } from './frase'
import { S } from './sesion'

/**
 * «Deshacer» en la pantalla de Praxis. Mismo estilo que la tarjeta de guardar (`tarjeta-registro`, `chip`, `btn-plata`).
 *
 * La regla: NADA se quita sin el toque en «Sí, quitar». «No, dejarlo» y «Ninguno» no llaman a nada. Mientras la función
 * contesta, los botones quedan bloqueados: dos toques mandan UNA sola petición.
 */
type Confirmar = Extract<PropuestaDeshacerPantalla, { accion: 'confirmar_deshacer' }>
type Preguntar = Extract<PropuestaDeshacerPantalla, { accion: 'preguntar' }>

export interface AyudasDeshacer {
  c: ConexionPraxis
  mensajeId: string
  tok: number
  pensando: (si: boolean) => void
}

/** Sigue siendo el mismo turno y la sala está abierta (la persona no se fue ni pidió otra cosa mientras esperaba). */
const vigente = (tok: number): boolean => tok === S.tok && !S.quieta

function terminar(r: ResultadoDeshacer): void {
  limpiarControles()
  decirCorto(fraseDeResultado(r, trato()))
}

function pintarConfirmacion(a: AyudasDeshacer, p: Confirmar): void {
  const estado = { ocupado: false }
  const alQuitar = async (): Promise<void> => {
    if (estado.ocupado) return // un toque: el segundo no manda otra vez
    estado.ocupado = true; refrescar()
    a.pensando(true)
    const r: ResultadoDeshacer = a.c.deshacer ? await a.c.deshacer.confirmar({ tarjeta: p.tarjeta, mensajeId: a.mensajeId }) : 'no_se_pudo'
    if (!vigente(a.tok)) return
    a.pensando(false)
    terminar(r)
  }
  const alDejar = (): void => {
    if (estado.ocupado) return
    limpiarControles(); decirCorto(FRASE_NO_QUITE)
  }
  montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'deshacer' },
    h('span', { class: 'marca-ejemplo' }, 'Nada se quita hasta que toques el botón'),
    h('div', { class: 'pie-controles' },
      h('button', { type: 'button', class: 'chip', 'data-k': 'deshacer-no', disabled: estado.ocupado, onclick: alDejar }, p.botonNo),
      h('button', { type: 'button', class: 'btn-plata', 'data-k': 'deshacer-si', disabled: estado.ocupado, onclick: () => void alQuitar() }, estado.ocupado ? 'Quitando…' : p.botonSi)))])
  enfocarControles()
}

function pintarCandidatos(a: AyudasDeshacer, p: Preguntar): void {
  const estado = { ocupado: false }
  const alElegir = async (registroId: string): Promise<void> => {
    if (estado.ocupado) return
    estado.ocupado = true; refrescar()
    a.pensando(true)
    const r = a.c.deshacer ? await a.c.deshacer.elegir(registroId) : { ok: false as const }
    if (!vigente(a.tok)) return
    a.pensando(false)
    if (!r.ok) { terminar('no_se_pudo'); return }
    await decir(r.propuesta.texto, a.tok)
    pintarConfirmacion(a, r.propuesta)
  }
  const alNinguno = (): void => {
    if (estado.ocupado) return
    limpiarControles(); decirCorto(FRASE_NO_QUITE)
  }
  montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'deshacer-candidatos' },
    h('div', { class: 'pie-controles' },
      p.opciones.map((o) => h('button', { type: 'button', class: 'chip', 'data-k': 'deshacer-candidato', disabled: estado.ocupado, onclick: () => void alElegir(o.registroId) }, o.etiqueta)),
      h('button', { type: 'button', class: 'chip', 'data-k': 'deshacer-ninguno', disabled: estado.ocupado, onclick: alNinguno }, p.botonNinguno)))])
  enfocarControles()
}

/** Lo que Praxis dice y enseña ante la propuesta de deshacer. La orden nunca ejecuta. */
export async function mostrarDeshacer(a: AyudasDeshacer, p: PropuestaDeshacerPantalla): Promise<void> {
  await decir(p.texto, a.tok)
  if (p.accion === 'confirmar_deshacer') pintarConfirmacion(a, p)
  else if (p.accion === 'preguntar') pintarCandidatos(a, p)
}
