import type { PiezaDeLaApp } from '../../../app/catalogoDePiezas'
import {
  preguntarSentido, tarjetaDeOrganizacion,
  type BotonDeTarjeta, type CambioDeOrganizacion, type PasoDeOrganizar, type ResultadoDeAplicar, type Siguiente, type TarjetaDeOrganizacion,
} from '../../../app/tarjetaDeOrganizacion'
import { BOTON, RESULTADO, VENTANA_DESHACER_MS, botonDeshacerVarias } from '../../../domain/praxis/organizacion/textosTarjeta'
import { enfocarControles, limpiarControles, montar, refrescar } from './cabecera'
import type { ConexionPraxis } from './conexion'
import { h } from './dom'
import { trato } from './entorno'
import { decirCorto } from './frase'
import { S, emitir } from './sesion'

/**
 * La tarjeta de confirmación de «organizar la app hablando» en la pantalla de Praxis. Mismo molde que el deshacer de
 * registros (`deshacer.ts`): `tarjeta-registro`, `chip` y `btn-plata`; nada de CSS nuevo.
 *
 * Reglas (decisiones de Bryan, 11-nov): NADA cambia lo guardado sin el toque en el botón principal; la tarjeta espera sin
 * aplicar nunca sola (se va si la persona dice otra cosa o cambia de pantalla); dos toques mandan UN solo cambio; «Listo»
 * solo cuando el puerto contestó `aplicado`; el «Deshacer» dura `VENTANA_DESHACER_MS` y después solo por voz.
 */
export interface AyudasOrganizar {
  c: ConexionPraxis
  tok: number
  pensando: (si: boolean) => void
  /** Decir y anotar en el historial (el `dijo` de la conversación). */
  dijo: (texto: string, tok: number) => Promise<void>
}

const vigente = (tok: number): boolean => tok === S.tok && !S.quieta

const ruta = (p: PiezaDeLaApp): string => p.pantalla

function abrir(a: AyudasOrganizar, p: PiezaDeLaApp): void {
  limpiarControles()
  decirCorto('Te llevo ahí.')
  a.c.organizar?.navegar(ruta(p))
}

function claveDeAplicada(cambio: CambioDeOrganizacion): keyof typeof RESULTADO.aplicada {
  return cambio.tipo === 'pieza' ? cambio.accion : cambio.tipo
}

/** Tras aplicar: una línea con «Listo…» y el botón «Deshacer» durante unos segundos (decisión 2: 10-15 s). */
function pintarAplicada(a: AyudasOrganizar, cambio: CambioDeOrganizacion): void {
  decirCorto(RESULTADO.aplicada[claveDeAplicada(cambio)])
  const deshacer = a.c.organizar?.deshacerUltimo
  // Tras un «déjalo como estaba» no se ofrece otro Deshacer: no sería deshacerlo, sino ir un cambio más atrás.
  if (!deshacer || cambio.tipo === 'deshacer') { limpiarControles(); return }
  const estado = { ocupado: false }
  const cuantas = cambio.tipo === 'solo_lo_importante' ? cambio.piezas.length : 1
  const alDeshacer = async (): Promise<void> => {
    if (estado.ocupado) return
    estado.ocupado = true; refrescar()
    const r = await deshacer().catch((): ResultadoDeAplicar => 'no_se_pudo')
    if (!vigente(a.tok)) return
    limpiarControles()
    decirCorto(r === 'aplicado' ? RESULTADO.deshecha : r === 'choque' ? RESULTADO.choque(trato()) : RESULTADO.error)
  }
  const pintar = (): Node[] => [h('div', { class: 'tarjeta-registro', 'data-k': 'organizar-aplicada' },
    h('div', { class: 'pie-controles' },
      h('button', { type: 'button', class: 'chip', 'data-k': 'organizar-deshacer', disabled: estado.ocupado, onclick: () => void alDeshacer() }, estado.ocupado ? RESULTADO.aplicando : botonDeshacerVarias(cuantas))))]
  montar(pintar)
  setTimeout(() => { if (S.montar === pintar && !estado.ocupado) limpiarControles() }, VENTANA_DESHACER_MS)
}

function pintarError(a: AyudasOrganizar, cambio: CambioDeOrganizacion): void {
  decirCorto(RESULTADO.error)
  montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'organizar-error' },
    h('div', { class: 'pie-controles' },
      h('button', { type: 'button', class: 'btn-plata', 'data-k': 'organizar-reintentar', onclick: () => void aplicarCambio(a, cambio) }, BOTON.reintentar),
      h('button', { type: 'button', class: 'chip', 'data-k': 'organizar-cerrar', onclick: () => limpiarControles() }, BOTON.cerrar)))])
  enfocarControles()
}

async function aplicarCambio(a: AyudasOrganizar, cambio: CambioDeOrganizacion): Promise<void> {
  const puerto = a.c.organizar?.aplicar
  a.pensando(true)
  const r: ResultadoDeAplicar = puerto ? await puerto(cambio).catch((): ResultadoDeAplicar => 'no_se_pudo') : 'no_se_pudo'
  if (!vigente(a.tok)) return
  a.pensando(false)
  if (r === 'aplicado') { pintarAplicada(a, cambio); return }
  if (r === 'choque') { limpiarControles(); decirCorto(RESULTADO.choque(trato())); return }
  pintarError(a, cambio)
}

async function avisarCoach(a: AyudasOrganizar, pieza: PiezaDeLaApp | null): Promise<void> {
  const puerto = a.c.organizar?.avisarAlCoach
  if (!puerto) { limpiarControles(); decirCorto(RESULTADO.avisoNoDisponible); return }
  const ok = await puerto(pieza).catch(() => false)
  if (!vigente(a.tok)) return
  limpiarControles()
  decirCorto(ok ? RESULTADO.avisoDejado : RESULTADO.error)
}

/** Ejecuta lo que dice el botón tocado. Solo `aplicar` cambia lo guardado, y solo por el puerto. */
async function seguir(a: AyudasOrganizar, s: Siguiente): Promise<void> {
  switch (s.tipo) {
    case 'cerrar': limpiarControles(); if (s.frase) decirCorto(s.frase); return
    case 'abrir': abrir(a, s.pieza); return
    case 'frase': limpiarControles(); emitir({ tipo: 'texto', txt: s.txt, fuente: 'toque' }); return
    case 'decidir': await mostrarPasoDeOrganizar(a, tarjetaDeOrganizacion(s.decision, contexto(a))); return
    case 'sentido': {
      const o = a.c.organizar
      if (o) await mostrarPasoDeOrganizar(a, preguntarSentido(s.pieza, o.estado()))
      return
    }
    case 'avisar_coach': await avisarCoach(a, s.pieza); return
    case 'aplicar': await aplicarCambio(a, s.cambio); return
  }
}

function contexto(a: AyudasOrganizar) {
  const o = a.c.organizar!
  return { trato: trato(), perfil: o.perfil, estado: o.estado() }
}

function pintarTarjeta(a: AyudasOrganizar, t: TarjetaDeOrganizacion): void {
  const estado = { ocupado: false }
  const alTocar = async (b: BotonDeTarjeta): Promise<void> => {
    if (estado.ocupado) return // dos toques: UN solo cambio
    estado.ocupado = true; refrescar()
    await seguir(a, b.siguiente)
  }
  const etiqueta = (b: BotonDeTarjeta): string => (estado.ocupado && b.principal && b.siguiente.tipo === 'aplicar' ? RESULTADO.aplicando : b.etiqueta)
  montar(() => [h('div', { class: 'tarjeta-registro', 'data-k': 'organizar', role: 'group', 'aria-label': 'Confirmación de Praxis' },
    t.nota ? h('span', { class: 'marca-ejemplo tenue', 'data-k': 'organizar-nota' }, t.nota) : null,
    h('div', { class: 'pie-controles' },
      t.botones.map((b) => h('button', { type: 'button', class: b.principal ? 'btn-plata' : 'chip', 'data-k': b.clave, disabled: estado.ocupado, onclick: () => void alTocar(b) }, etiqueta(b)))))])
  enfocarControles()
}

/** Lo que Praxis dice y enseña ante una decisión de organizar. Nunca aplica nada solo. */
export async function mostrarPasoDeOrganizar(a: AyudasOrganizar, p: PasoDeOrganizar): Promise<void> {
  if (p.tipo === 'nada') return
  if (p.tipo === 'abrir') { await a.dijo('Te llevo ahí.', a.tok); a.c.organizar?.navegar(ruta(p.pieza)); return }
  limpiarControles()
  await a.dijo(p.tarjeta.texto, a.tok)
  if (!vigente(a.tok)) return
  pintarTarjeta(a, p.tarjeta)
}
