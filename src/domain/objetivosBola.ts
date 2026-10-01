/**
 * Objetivos de la bola de nieve: meta contra lo real (pedido de Bryan, 30-sep).
 *
 * Las METAS son decisiones escritas de Bryan y cada una cita su fuente (documento y sección); no
 * se calculan aquí. Lo REAL no está en ninguna tabla de la app: lo trae, si existe, una fila de la
 * sección «influencers» del tablero (migración 0102) con id `bola-<clave>` (acuerdo con quien carga
 * el tablero, igual que el prefijo de la investigación). Sin esa fila, lo real es FALTA en gris:
 * nunca un cero ni una cifra supuesta.
 *
 * Fuentes: bola-de-nieve/PLAN-ESTRATEGICO-90-DIAS.md, OPERACION.md, FALTA-BRYAN.md y
 * tablero/datos/finanzas.json. Si una meta cambia allí, se cambia aquí y su prueba lo cuenta.
 *
 * Fuente y fecha de cada meta (resumen; el detalle va en `fuente` y `fecha` de cada una, y la
 * prueba avisa si a alguna le falta):
 *   contactos/semana, clientes por creador, plan de 4 palancas, C y D ... plan v1, 28-sep-2026
 *   regla de oferta, A (bajas) y B (precio) ................... FALTA-BRYAN.md, 29-sep-2026
 *   techo de pérdida ........................................... FALTA-BRYAN.md / OPERACION.md §1, 27-sep-2026
 *   incorporaciones al mes ..................................... pedido de Bryan, 30-sep-2026
 *   días entre incorporaciones, activos, micropruebas a la vez . OPERACION.md §4, sin fecha en la fuente
 *
 * Sin React, sin red.
 */
import { textoCifra, type FilaDetalle, type SeccionLeida } from './adminTablero'

export type GrupoObjetivo = 'piloto' | 'palancas'

export interface ObjetivoBola {
  /** Clave de la fila del tablero: `bola-<clave>`. */
  clave: string
  grupo: GrupoObjetivo
  nombre: string
  meta: string
  /** Dónde está escrita la meta. Una cifra sin fuente no entra. */
  fuente: string
  /** Cuándo se decidió o se escribió (fecha de la fuente). Si la fuente no trae fecha, lo dice. */
  fecha: string
  /** Una advertencia que debe verse junto a la meta (p. ej. que depende de algo sin medir). */
  nota?: string
}

export const OBJETIVOS_BOLA: readonly ObjetivoBola[] = [
  {
    clave: 'contactos-semana',
    grupo: 'piloto',
    nombre: 'Contactos por semana',
    meta: '30',
    fuente: 'PLAN-ESTRATEGICO-90-DIAS.md §4, semana 1 («arrancan los 30 contactos semanales»)',
    fecha: '28-sep-2026 (plan v1)',
  },
  {
    clave: 'clientes-por-creador',
    grupo: 'piloto',
    nombre: 'Clientes por creador en su microprueba',
    meta: '3',
    fuente: 'OPERACION.md §1 («Regla de la microprueba (palanca D)»); PLAN-ESTRATEGICO-90-DIAS.md §2, fila D',
    fecha: '28-sep-2026 (plan v1); OPERACION.md sin fecha propia',
  },
  {
    clave: 'regla-de-oferta',
    grupo: 'piloto',
    nombre: 'Cuándo se cambia la oferta',
    meta: 'Con 1 creador se prueba un 2.º con la misma oferta; solo con N ≥ 2 se cambia',
    fuente: 'OPERACION.md §1; FALTA-BRYAN.md, G-D (decidido 29-sep)',
    fecha: '29-sep-2026',
  },
  {
    clave: 'dias-entre-incorporaciones',
    grupo: 'piloto',
    nombre: 'Días entre incorporaciones',
    meta: '≥ 14 días',
    fuente: 'OPERACION.md §4 («al menos 2 semanas entre una y la siguiente»)',
    fecha: 'sin fecha en la fuente (OPERACION.md, documento preparado)',
  },
  {
    clave: 'incorporaciones-mes',
    grupo: 'piloto',
    nombre: 'Incorporaciones al mes',
    meta: 'máx. 2',
    fuente: 'Pedido de Bryan, 30-sep; OPERACION.md §4 no lo trae literal (allí: máx. 1 por semana y ≥ 2 semanas entre una y otra)',
    fecha: '30-sep-2026',
  },
  {
    clave: 'creadores-activos',
    grupo: 'piloto',
    nombre: 'Creadores en ciclo activo',
    meta: 'máx. 5',
    fuente: 'OPERACION.md §4',
    fecha: 'sin fecha en la fuente (OPERACION.md, documento preparado)',
  },
  {
    clave: 'micropruebas-a-la-vez',
    grupo: 'piloto',
    nombre: 'Micropruebas a la vez',
    meta: 'máx. 2',
    fuente: 'OPERACION.md §4',
    fecha: 'sin fecha en la fuente (OPERACION.md, documento preparado)',
  },
  {
    clave: 'techo-de-perdida',
    grupo: 'piloto',
    nombre: 'Techo de pérdida del piloto',
    meta: '3.000.000 COP',
    fuente: 'OPERACION.md §1 («Pérdida máxima total del piloto»); FALTA-BRYAN.md (27-sep)',
    fecha: '27-sep-2026',
  },
  {
    clave: 'plan-4-palancas-12m',
    grupo: 'palancas',
    nombre: 'Plan de cuatro palancas a 12 meses',
    meta: '+18,9 M COP (18.864.431)',
    fuente: 'PLAN-ESTRATEGICO-90-DIAS.md §1; tablero/datos/finanzas.json (nota del plan de cuatro palancas)',
    fecha: '28-sep-2026 (plan v1)',
    nota: 'Depende de la palanca D, que todavía no está medida (0 micropruebas): es una meta del modelo, no un resultado.',
  },
  {
    clave: 'palanca-a-bajas',
    grupo: 'palancas',
    nombre: 'A · Bajas de la base',
    meta: '≤ 5 % al mes',
    fuente: 'FALTA-BRYAN.md, H-25 (decidido 29-sep); PLAN-ESTRATEGICO-90-DIAS.md §2, fila A',
    fecha: '29-sep-2026',
  },
  {
    clave: 'palanca-b-precio',
    grupo: 'palancas',
    nombre: 'B · Subir a 225.000 al renovar',
    meta: 'De a 4; pausa si se van 2 de 4',
    fuente: 'FALTA-BRYAN.md, G-B (decidido 29-sep); PLAN-ESTRATEGICO-90-DIAS.md §2, fila B',
    fecha: '29-sep-2026',
  },
  {
    clave: 'palanca-c-ia',
    grupo: 'palancas',
    nombre: 'C · MANU paga su parte de la IA',
    meta: '279.014 COP al mes',
    fuente: 'PLAN-ESTRATEGICO-90-DIAS.md §2, fila C; tablero/datos/finanzas.json (plan_palancas, ahorro_cop_mes)',
    fecha: '28-sep-2026 (plan v1)',
    nota: 'Es un supuesto hasta que MANU pague.',
  },
  {
    clave: 'palanca-d-microprueba',
    grupo: 'palancas',
    nombre: 'D · Microprueba de creadores',
    meta: '3 clientes por creador, con techo de 3.000.000 COP',
    fuente: 'PLAN-ESTRATEGICO-90-DIAS.md §2, fila D',
    fecha: '28-sep-2026 (plan v1)',
  },
]

export const NOMBRE_GRUPO_OBJETIVO: Record<GrupoObjetivo, string> = {
  piloto: 'Reglas y metas del piloto',
  palancas: 'Plan de cuatro palancas',
}

export interface ObjetivoConReal {
  objetivo: ObjetivoBola
  /** `null` = FALTA: ninguna fila del tablero trae lo real. */
  real: string | null
  /** De dónde salió lo real, o `null` si falta. */
  fuenteReal: string | null
}

const idFila = (clave: string) => `bola-${clave}`

/**
 * Cruza cada meta con su fila real de la sección «influencers», si hay. Una cifra vacía o «FALTA…»
 * sigue siendo FALTA. `seccion` puede ser `undefined`, sin corte o inválida: todo queda FALTA.
 */
export function objetivosConReal(seccion: SeccionLeida | undefined): ObjetivoConReal[] {
  const filas: readonly FilaDetalle[] = seccion?.estado === 'ok' ? seccion.datos.filas : []
  return OBJETIVOS_BOLA.map((objetivo) => {
    const fila = filas.find((f) => f.id === idFila(objetivo.clave))
    const c = fila ? textoCifra(fila.cifra) : null
    if (!fila || !c || c.falta) return { objetivo, real: null, fuenteReal: null }
    const archivo = fila.fuente.archivo.trim()
    return { objetivo, real: c.texto, fuenteReal: archivo === '' ? null : `${archivo}${fila.fuente.corte.trim() ? ` · ${fila.fuente.corte.trim()}` : ''}` }
  })
}
