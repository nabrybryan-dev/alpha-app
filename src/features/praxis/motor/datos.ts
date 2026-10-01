/**
 * Datos de EJEMPLO de Praxis. Nadie real: ni la persona, ni las fechas, ni las cifras.
 *
 * Mientras Praxis no lea el check-in de verdad, esto es todo lo que la pantalla enseña, y
 * por eso solo la ve el staff (`domain/praxis/acceso.ts`).
 */
import { LINEAS_DE_AYUDA, type LineaDeAyuda } from '../../../domain/praxis/riesgo'

export type Nivel = 'MALA' | 'REGULAR' | 'BUENA'
export type Cantidad = 'POCO' | 'REGULAR' | 'MUCHO'

export interface DatosDia {
  horasSueno?: number
  horaAcostarse?: string
  horaLevantarse?: string
  calidadSueno?: Nivel
  cansancio?: Cantidad
  entreno?: string
  rendimiento?: Nivel
  motivacion?: Cantidad
  dolor?: number
  dolorDonde?: string
  hambreEscala?: number
  alimentacion?: Nivel
  estres?: Cantidad
  pasos?: number
  comentarios?: string
}
export type Campo = keyof DatosDia
export type Valor = string | number

/** Escribe un campo por su nombre. Es el único sitio donde se salta el tipo de cada campo. */
export function fijarDato(d: DatosDia, campo: Campo, valor: Valor): void {
  ;(d as Record<Campo, Valor | undefined>)[campo] = valor
}

export interface DiaSemana { fecha: string; rot: string; dia: string; d: DatosDia | null; idea?: string; hoy?: boolean }
/** Un día del mes: `d` nulo es un día sin registro. */
export interface DiaMes { fecha: string; d: DatosDia | null; hoy?: boolean }

/**
 * De dónde sale lo que la escena enseña. Hay dos fuentes y no se mezclan:
 *
 *   - la de EJEMPLO (abajo), la de la maqueta aprobada. Solo la usan las pruebas de la
 *     escena guiada; la ruta /praxis ya no la monta;
 *   - la REAL, que arma `fuenteReal.ts` con lo que Praxis ve de la persona con sesión
 *     (lista blanca del dominio). Es la que monta `PraxisPage`.
 *
 * Son `let` a propósito: el montaje las cambia con `fijarFuente` y los módulos que las
 * importan leen siempre el valor vigente.
 */
export interface FuentePraxis {
  ejemplo: boolean
  usuario: string
  hoy: { fecha: string; dia: string; corto: string }
  /** Siete días; el último es hoy. */
  semana: DiaSemana[]
  /** Los días anteriores a la semana que también se enseñan. `null` = los inventa el ejemplo. */
  antes: DiaMes[] | null
  ideaAyer: string | null
  /** Firmas anteriores a hoy que se conocen. */
  firmasPrevias: number
  ultimoPeso: number | null
  /** El rango de la semana: «23 – 29 SEP». */
  rango: string
}

const HOY_EJEMPLO = { fecha: '2026-09-29', dia: 'martes', corto: 'MAR 29 SEP' }
const IDEA_EJEMPLO = 'dejar el celular cargando en la cocina'

export let EJEMPLO = true
export let USUARIO = 'ejemplo-01'
export let HOY: FuentePraxis['hoy'] = HOY_EJEMPLO
export let IDEA_AYER = IDEA_EJEMPLO
export let FIRMAS_PREVIAS = 32
/** Último peso del perfil de ejemplo: solo se guarda si se confirma. */
export let ULTIMO_PESO = 64.2
export let ANTES: DiaMes[] | null = null
export let RANGO = '23 – 29 SEP'

function semanaDeEjemplo(): DiaSemana[] {
  return [
    { fecha: '2026-09-23', rot: 'MIÉ 23', dia: 'miércoles', d: { horasSueno: 7.5, horaAcostarse: '23:30', horaLevantarse: '07:00', calidadSueno: 'BUENA', cansancio: 'POCO', entreno: 'UPPER A', rendimiento: 'BUENA', motivacion: 'MUCHO', dolor: 0, hambreEscala: 4, alimentacion: 'BUENA', estres: 'POCO', pasos: 11000 } },
    { fecha: '2026-09-24', rot: 'JUE 24', dia: 'jueves', d: { horasSueno: 7, horaAcostarse: '23:40', horaLevantarse: '06:40', calidadSueno: 'REGULAR', cansancio: 'REGULAR', entreno: 'Descansé', rendimiento: 'REGULAR', motivacion: 'REGULAR', dolor: 0, hambreEscala: 5, alimentacion: 'REGULAR', estres: 'REGULAR', pasos: 8000, comentarios: 'reunión larga' } },
    { fecha: '2026-09-25', rot: 'VIE 25', dia: 'viernes', d: { horasSueno: 6.5, horaAcostarse: '00:10', horaLevantarse: '06:40', calidadSueno: 'BUENA', cansancio: 'REGULAR', entreno: 'LEG B', rendimiento: 'BUENA', motivacion: 'MUCHO', dolor: 2, dolorDonde: 'rodilla izquierda', hambreEscala: 7, alimentacion: 'BUENA', estres: 'REGULAR', pasos: 12500 } },
    { fecha: '2026-09-26', rot: 'SÁB 26', dia: 'sábado', d: null },
    { fecha: '2026-09-27', rot: 'DOM 27', dia: 'domingo', d: { horasSueno: 8.5, horaAcostarse: '00:30', horaLevantarse: '09:00', calidadSueno: 'BUENA', cansancio: 'POCO', entreno: 'Descansé', rendimiento: 'REGULAR', motivacion: 'REGULAR', dolor: 0, hambreEscala: 3, alimentacion: 'REGULAR', estres: 'POCO', pasos: 6500, comentarios: 'almuerzo familiar' } },
    { fecha: '2026-09-28', rot: 'LUN 28', dia: 'lunes', d: { horasSueno: 5.5, horaAcostarse: '23:50', horaLevantarse: '05:30', calidadSueno: 'MALA', cansancio: 'MUCHO', entreno: 'UPPER B', rendimiento: 'REGULAR', motivacion: 'POCO', dolor: 0, hambreEscala: 6, alimentacion: 'BUENA', estres: 'MUCHO', pasos: 7000, comentarios: 'semana pesada' }, idea: IDEA_EJEMPLO },
    { fecha: HOY_EJEMPLO.fecha, rot: 'MAR 29', dia: 'martes', d: null, hoy: true },
  ]
}

export function fuenteDeEjemplo(): FuentePraxis {
  return { ejemplo: true, usuario: 'ejemplo-01', hoy: HOY_EJEMPLO, semana: semanaDeEjemplo(), antes: null, ideaAyer: IDEA_EJEMPLO, firmasPrevias: 32, ultimoPeso: 64.2, rango: '23 – 29 SEP' }
}

/** La semana que se enseña. En el ejemplo, el lunes (índice 5) cambia con el escenario, así que se rehace en cada montaje. */
export const SEMANA: DiaSemana[] = semanaDeEjemplo()

/** Cambia la fuente de la escena. Se llama una vez por montaje, antes de pintar nada. */
export function fijarFuente(f: FuentePraxis): void {
  EJEMPLO = f.ejemplo; USUARIO = f.usuario; HOY = f.hoy; ANTES = f.antes; RANGO = f.rango
  IDEA_AYER = f.ideaAyer ?? ''; FIRMAS_PREVIAS = f.firmasPrevias; ULTIMO_PESO = f.ultimoPeso ?? 0
  SEMANA.splice(0, SEMANA.length, ...f.semana)
}
/** «Ayer»: el penúltimo día de la semana. Con datos reales puede no haber registro. */
export function ayer(): DatosDia | null { return SEMANA[5]?.d ?? null }

type Tabla = Record<string, Record<string, string>>

/** Lo que la persona lee: frases suyas, no los valores de la base de datos (esos siguen siendo MALA / REGULAR / BUENA). */
export const TXT: Tabla = {
  sue: { MALA: 'dormí mal', REGULAR: 'sueño regular', BUENA: 'dormí bien' },
  ren: { MALA: 'me fue mal', REGULAR: 'me fue regular', BUENA: 'me fue bien' },
  com: { MALA: 'comí mal', REGULAR: 'comí regular', BUENA: 'comí bien' },
  can: { POCO: 'poco cansancio', REGULAR: 'cansancio regular', MUCHO: 'mucho cansancio' },
  gan: { POCO: 'pocas ganas', REGULAR: 'ganas normales', MUCHO: 'muchas ganas' },
  est: { POCO: 'estrés bajo', REGULAR: 'estrés medio', MUCHO: 'estrés alto' },
}
/** Lo que dicen los botones. */
export const ETQ: Tabla = {
  calidadSueno: { MALA: 'Dormí mal', REGULAR: 'Regular', BUENA: 'Dormí bien' },
  cansancio: { POCO: 'Poco', REGULAR: 'Regular', MUCHO: 'Mucho' },
  rendimiento: { MALA: 'Me fue mal', REGULAR: 'Regular', BUENA: 'Me fue bien' },
  motivacion: { POCO: 'Pocas', REGULAR: 'Normales', MUCHO: 'Muchas' },
  alimentacion: { MALA: 'Comí mal', REGULAR: 'Regular', BUENA: 'Comí bien' },
  estres: { POCO: 'Bajo', REGULAR: 'Medio', MUCHO: 'Alto' },
}
/** Lo que dicen las notas del pentagrama. */
export const NOTA_TXT: Tabla = {
  calidadSueno: { MALA: 'DORMÍ MAL', REGULAR: 'SUEÑO REGULAR', BUENA: 'DORMÍ BIEN' },
  cansancio: { POCO: 'POCO CANSANCIO', REGULAR: 'CANSANCIO REGULAR', MUCHO: 'MUCHO CANSANCIO' },
  motivacion: { POCO: 'POCAS GANAS', REGULAR: 'GANAS NORMALES', MUCHO: 'MUCHAS GANAS' },
  rendimiento: { MALA: 'ME FUE MAL', REGULAR: 'ME FUE REGULAR', BUENA: 'ME FUE BIEN' },
  alimentacion: { MALA: 'COMÍ MAL', REGULAR: 'COMÍ REGULAR', BUENA: 'COMÍ BIEN' },
  estres: { POCO: 'ESTRÉS BAJO', REGULAR: 'ESTRÉS MEDIO', MUCHO: 'ESTRÉS ALTO' },
}

export const OBLIG: Campo[] = ['calidadSueno', 'cansancio', 'rendimiento', 'motivacion', 'dolor', 'hambreEscala', 'alimentacion', 'estres']
export type Linea = 'sueno' | 'energia' | 'cuerpo' | 'comida' | 'mente'
export const ORDEN: Record<Linea, Campo[]> = { sueno: ['horaAcostarse', 'horaLevantarse', 'horasSueno', 'calidadSueno'], energia: ['cansancio', 'motivacion'], cuerpo: ['entreno', 'rendimiento', 'dolor', 'pasos'], comida: ['hambreEscala', 'alimentacion'], mente: ['estres', 'comentarios'] }
export const LINEAS = Object.keys(ORDEN) as Linea[]
export const NOMBRE: Record<string, string> = { calidadSueno: 'el sueño', cansancio: 'el cansancio', rendimiento: 'el entreno', motivacion: 'las ganas', dolor: 'el cuerpo', dolorDonde: 'dónde duele', hambreEscala: 'el hambre', alimentacion: 'la comida', estres: 'el estrés' }
export const ESCALA3: Record<string, string[]> = {
  calidadSueno: ['MALA', 'REGULAR', 'BUENA'], rendimiento: ['MALA', 'REGULAR', 'BUENA'], alimentacion: ['MALA', 'REGULAR', 'BUENA'],
  cansancio: ['POCO', 'REGULAR', 'MUCHO'], motivacion: ['POCO', 'REGULAR', 'MUCHO'], estres: ['POCO', 'REGULAR', 'MUCHO'],
}

/**
 * Las líneas de ayuda de la Quieta viven en el dominio (`domain/praxis/riesgo.ts`), con la
 * prueba de que solo salen los cuatro números verificados. Los textos los debe revisar un
 * profesional de salud mental antes de abrir Praxis a asesorados.
 */
export type TipoRiesgo = LineaDeAyuda
export const LIN_QUIETA = LINEAS_DE_AYUDA
