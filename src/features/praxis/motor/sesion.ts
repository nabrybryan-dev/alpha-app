import { EJEMPLO, IDEA_AYER, OBLIG, SEMANA, ayer, type Campo, type DatosDia, type TipoRiesgo } from './datos'
import { $ } from './dom'
import { borrarClave, guardar, leer, tu } from './entorno'
import { num } from './movimiento'
import { Onda } from './onda'
import { Voz } from './voz'

/**
 * La sesión del check-in de ejemplo y lo que la rodea: el escenario de la demostración, los
 * permisos y el día ya hecho. Todo vive en este navegador (`localStorage`, claves
 * `praxis.*`): nada sale del aparato y nada toca la base.
 */
export type Fuente = 'toque' | 'texto' | 'voz'
/**
 * `ejercicioId` y `eco` solo los pone el toque de una opción de «¿cuál fue?»: el ejercicio
 * elegido viaja al registrador y lo que se pinta como mensaje de la persona es la opción.
 */
export interface Evento { tipo: string; campo?: Campo; txt?: string; fuente?: Fuente; v?: string | boolean; ejercicioId?: string; eco?: string }
export interface Duda { opciones: string[]; cita: string }
export interface Senal { tipo: string; frase: string }
export interface Idea { area: string; texto?: string; pequena: string | null; probar?: boolean; bryan?: boolean; fija?: boolean }
export interface Registro { tabla: string; id: string; usuario_id: string; fecha: string; datos: Record<string, unknown> }
export interface Hecho { datos: DatosDia; idea: string | null; registro?: Registro; dia: string; riesgo?: TipoRiesgo }
export interface Escenario { franja: string; idea: string; dolorAyer: string; estresAyer: string; peso: string }
export type Permisos = Record<string, boolean | string>
type Montador = () => Node | null | false | (Node | null | false)[]

/**
 * El turno vigente. Es un contador ÚNICO para todas las sesiones, no uno por sesión: si cada
 * sesión empezara en 0, un bucle viejo que siguiera esperando (una frase a medias, una
 * llamada a la red) vería en la sesión NUEVA el mismo número que tenía y seguiría corriendo
 * sobre la pantalla de otro montaje, con la conexión del anterior. Pasó en las pruebas de la
 * pantalla conectada: la pregunta en espera de una persona salía por la conexión de la otra.
 */
let turnoGlobal = 0

export function nuevaSesion() {
  return {
    tok: ++turnoGlobal, datos: {} as DatosDia, fuentes: {} as Record<string, Fuente>, citas: {} as Record<string, string>, ref: {} as Record<string, string>,
    dudas: {} as Record<string, Duda>, hechos: [] as string[], saltos: [] as string[], t0: 0, pausa: 0, pausaDesde: 0,
    hilo: null as string | null, hiloPequena: null as boolean | null, nota: null as boolean | string | null, presentarPendiente: false, saludoPendiente: false,
    listo: false, enFirma: false, quieta: null as { tipo: TipoRiesgo; cita: string | null; demo: boolean } | null,
    cola: [] as Evento[], resolver: null as ((e: Evento) => void) | null, rechazar: null as ((e: Error) => void) | null,
    montar: null as Montador | null, senales: [] as Senal[], mostrarHoras: false, cortar: false, cortarFn: null as (() => void) | null,
    cuidado: null as { txt: string; fuente: Fuente } | null, aplanar: false, pendienteHoras: false, mostrarDial: false, otraZona: false, otroEntreno: false, respiraOfrecida: false,
    espejoHecho: false, idea: null as Idea | null, ideaTexto: null as string | null, confianza: null as string | null, turno: null as string | null,
    pesoSi: null as boolean | null, peso: null as number | null, reflejo: '',
    tSilencio: 0, muestras: [] as string[], editando: null as Campo | null, respirando: false, registro: undefined as Registro | undefined, rapidoCampos: [] as Campo[],
  }
}
export type Sesion = ReturnType<typeof nuevaSesion>

export let S: Sesion = nuevaSesion()
export function renovarSesion(): Sesion { S = nuevaSesion(); return S }

const ESCENARIO_BASE: Escenario = { franja: 'manana', idea: 'si', dolorAyer: 'no', estresAyer: 'mucho', peso: 'si' }
export const E: Escenario = { ...ESCENARIO_BASE }
export const Dia = {
  /** {datos, idea, dia} del ejemplo de hoy, solo en este navegador; caduca al cambiar de día. */
  hecho: null as Hecho | null,
  /** null = todavía no decidió. */
  permisos: null as Permisos | null,
  avisoCaduco: null as string | null,
}
export function fijarHecho(h: Hecho | null): void { Dia.hecho = h; if (h) guardar('hecho', h); else borrarClave('hecho') }

export function hoyReal(): string { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }

/** Lee de este navegador lo que quedó de la última vez. Se llama en cada montaje. */
export function cargarEstado(): void {
  Object.assign(E, ESCENARIO_BASE, leer<Partial<Escenario>>('escenario', {}))
  Dia.permisos = leer<Permisos | null>('permisos', null)
  Dia.avisoCaduco = null
  Dia.hecho = leer<Hecho | null>('hecho', null)
  if (Dia.hecho && Dia.hecho.dia !== hoyReal()) { Dia.hecho = null; borrarClave('hecho'); Dia.avisoCaduco = tu('Tu check-in de ayer se borró de este teléfono.', 'Su check-in de ayer se borró de este teléfono.') }
  renovarSesion()
  const b = leer<(Partial<Sesion> & { dia?: string }) | null>('borrador', null)
  if (b && b.dia !== hoyReal()) { borrarClave('borrador'); Dia.avisoCaduco = tu('Tu borrador de ayer se borró.', 'Su borrador de ayer se borró.'); return }
  if (b && b.datos) Object.assign(S, { datos: b.datos, fuentes: b.fuentes || {}, citas: b.citas || {}, ref: b.ref || {}, hechos: b.hechos || [], saltos: b.saltos || [], senales: b.senales || [], hilo: b.hilo || null, nota: b.nota == null ? null : b.nota })
}
export function guardarBorrador(): void {
  if (S.listo || S.quieta) return
  guardar('borrador', { dia: hoyReal(), datos: S.datos, fuentes: S.fuentes, citas: S.citas, ref: S.ref, hechos: S.hechos, saltos: S.saltos, senales: S.senales, hilo: S.hilo, nota: S.nota })
}
/** El lunes de la partitura sale del escenario: si ayer dolió la rodilla, el lunes lo dice. */
export function aplicarEscenario(): void {
  const d = ayer()
  if (!d || !EJEMPLO) return // el escenario solo mueve el lunes del ejemplo
  d.dolor = E.dolorAyer === 'si' ? 6 : 0
  if (E.dolorAyer === 'si') d.dolorDonde = 'rodilla izquierda'; else delete d.dolorDonde
  d.estres = E.estresAyer === 'mucho' ? 'MUCHO' : 'REGULAR'
  if (E.idea === 'si') SEMANA[5].idea = IDEA_AYER; else delete SEMANA[5].idea
}

export function segundos(): number { const extra = S.pausaDesde ? performance.now() - S.pausaDesde : 0; return (performance.now() - S.t0 - S.pausa - extra) / 1000 }
export function refDe(c: string): string {
  const man = E.franja === 'manana'
  if (['horasSueno', 'horaAcostarse', 'horaLevantarse', 'calidadSueno'].includes(c)) return 'anoche'
  if (['entreno', 'rendimiento', 'alimentacion', 'pasos', 'hambreEscala'].includes(c)) return man ? 'ayer' : 'hoy'
  return 'hoy'
}
export function faltantes(d: DatosDia): Campo[] { const f = OBLIG.filter((c) => d[c] == null); if (num(d.dolor) > 0 && !d.dolorDonde) f.push('dolorDonde'); return f }
export function hayDatos(): boolean { return Object.keys(S.datos).length > 0 }

export function rotulo(c: string): string {
  const R: Record<string, string> = { calidadSueno: 'Calidad del sueño', cansancio: 'Cansancio', rendimiento: tu('Cómo te fue', 'Cómo le fue'), motivacion: 'Ganas', dolor: 'Dolor', dolorDonde: '¿Dónde?', hambreEscala: 'Hambre', alimentacion: 'Alimentación', estres: 'Estrés', entreno: 'Entreno', horasSueno: 'Horas de sueño', horaAcostarse: 'Horario de la noche', horaLevantarse: 'Horario de la noche', pasos: 'Pasos', comentarios: 'Comentarios' }
  return R[c]
}

/* ——— El flujo: una promesa por respuesta; cerrar o cambiar de modo cancela ——— */
export class Cancelado extends Error {}
export function vigilar(tok: number): void { if (tok !== S.tok) throw new Cancelado() }
export function emitir(evt: Evento): void {
  clearTimeout(S.tSilencio)
  if (S.resolver) { const r = S.resolver; S.resolver = null; S.rechazar = null; r(evt) } else S.cola.push(evt)
}
export function esperaCon(tok: number, ms: number | null): Promise<Evento> {
  vigilar(tok)
  const primero = S.cola.shift()
  if (primero) return Promise.resolve(primero)
  return new Promise((res, rej) => {
    let t = 0
    const f = (v: Evento) => { clearTimeout(t); res(v) }
    if (ms != null) t = window.setTimeout(() => { if (S.resolver === f) { S.resolver = null; S.rechazar = null } res({ tipo: 'tiempo' }) }, ms)
    S.resolver = f; S.rechazar = (e) => { clearTimeout(t); rej(e) }
  })
}
export function cancelar(): void {
  S.tok = ++turnoGlobal; Voz.callar(); Onda.callar()
  clearTimeout(S.tSilencio)
  if (S.rechazar) { const r = S.rechazar; S.resolver = null; S.rechazar = null; r(new Cancelado()) }
  S.cola = []
}
export function armarSilencio(tok: number): void {
  clearTimeout(S.tSilencio)
  S.tSilencio = window.setTimeout(() => {
    if (tok !== S.tok || $('#sala').hidden) return
    $('#ayuda').textContent = tu('Sin afán. Puedes tocar una opción.', 'Sin afán. Puede tocar una opción.'); Onda.estado('reposo')
  }, 8000)
}
/** Praxis se calla si la persona responde o toca la frase: completa el texto de una vez. */
export function cortarDecir(): void { if (S.cortarFn) S.cortarFn() }
