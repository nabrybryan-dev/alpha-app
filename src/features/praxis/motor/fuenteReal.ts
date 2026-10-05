import { fechaMenos, type CheckinVisto, type LoQuePraxisVe } from '../../../domain/praxis/plan/listaBlanca'
import type { DatosDia, DiaMes, DiaSemana, FuentePraxis } from './datos'

/**
 * La fuente REAL de la escena: los días de la persona con sesión.
 *
 * Entra lo que Praxis ve —que ya pasó por la lista blanca del dominio— y sale la forma que
 * la escena sabe pintar: la semana (siete días que acaban hoy) y los siete anteriores. Los
 * catorce días son los que la lista blanca deja leer; por eso aquí no hay «mes».
 *
 * Un día sin check-in es `null` (un hueco oscuro en la órbita). Lo que la base no tiene
 * —la idea de ayer, el último peso— queda en `null`: no se rellena con nada.
 */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

function partes(fecha: string): { dia: string; corto: string; num: number; mes: string } {
  const d = new Date(`${fecha}T12:00:00Z`)
  return { dia: DIAS[d.getUTCDay()], corto: CORTOS[d.getUTCDay()], num: d.getUTCDate(), mes: MESES[d.getUTCMonth()] }
}

/** El check-in sin su fecha: lo que la escena llama «los datos del día». */
function datosDe(c: CheckinVisto | undefined): DatosDia | null {
  if (!c) return null
  const { fecha: _fecha, ...resto } = c
  void _fecha
  return resto
}

export function fuenteReal(ve: LoQuePraxisVe, usuarioId: string, hoy: string): FuentePraxis {
  const porFecha = new Map(ve.checkins.map((c) => [c.fecha, c]))
  const semana: DiaSemana[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = fechaMenos(hoy, 6 - i), p = partes(fecha)
    return { fecha, rot: `${p.corto} ${p.num}`, dia: p.dia, d: datosDe(porFecha.get(fecha)), ...(i === 6 ? { hoy: true } : {}) }
  })
  const antes: DiaMes[] = Array.from({ length: 7 }, (_, i) => {
    const fecha = fechaMenos(hoy, 13 - i)
    return { fecha, d: datosDe(porFecha.get(fecha)) }
  })
  const h = partes(hoy), ini = partes(semana[0].fecha)
  return {
    ejemplo: false,
    usuario: usuarioId,
    hoy: { fecha: hoy, dia: h.dia, corto: `${h.corto} ${h.num} ${h.mes}` },
    semana,
    antes,
    ideaAyer: null,
    firmasPrevias: [...antes, ...semana.slice(0, 6)].filter((d) => d.d).length,
    ultimoPeso: null,
    rango: ini.mes === h.mes ? `${ini.num} – ${h.num} ${h.mes}` : `${ini.num} ${ini.mes} – ${h.num} ${h.mes}`,
  }
}
