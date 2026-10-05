/**
 * Antes → después de la cartera: el microciclo activo frente al anterior,
 * para la pestaña «Revisión de la semana» de la consola del coach.
 *
 * Puro y de solo lectura: no toca la base, no muta lo que recibe. Se
 * compara por `dia` (el campo de `Sesion`) y por el nombre normalizado del
 * ejercicio dentro de cada día — la misma identidad que usa el resto del
 * dominio para hablar de "el mismo ejercicio" entre dos microciclos.
 */
import { diaDeSesion } from '../calendario'
import type { EjercicioPrescrito, Microciclo, Sesion } from '../types'

export const DIAS_SEMANA = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO',
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

export type EstadoDiaComparado = 'igual' | 'nueva' | 'perdida' | 'vacio'

export interface SesionResumen {
  id: string
  nombre: string
}

export interface DiaComparado {
  dia: DiaSemana
  antes?: SesionResumen
  despues?: SesionResumen
  estado: EstadoDiaComparado
}

export interface CambioCarga {
  nombre: string
  cargaAntesKg: number
  cargaDespuesKg: number
  direccion: 'sube' | 'baja'
}

export interface DiffMicrociclo {
  dias: DiaComparado[]
  ejerciciosAnadidos: string[]
  ejerciciosRetirados: string[]
  cargas: CambioCarga[]
}

function normalizar(nombre: string): string {
  return nombre.trim().toLowerCase()
}

function sinTildes(texto: string): string {
  return texto.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Las sesiones de un microciclo por HUECO: su día si lo tiene (en `dia` o en el nombre,
 * «… (LUNES)», con o sin tilde — `diaDeSesion`), y si no, `#1`, `#2`… por orden.
 *
 * Hasta el 26-sep se buscaba solo `s.dia === 'MIERCOLES'`: una sesión con `dia`
 * «MIÉRCOLES» (la forma del resto del dominio) o sin `dia` (las D1…Dn, cadencias de 8
 * días) no aparecía nunca, y la revisión pintaba la semana vacía y «sin cambios de carga»
 * sobre semanas que sí los tenían.
 */
function huecos(microciclo: Microciclo | undefined): Map<string, Sesion> {
  const mapa = new Map<string, Sesion>()
  let sinDia = 0
  for (const sesion of [...(microciclo?.sesiones ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))) {
    const dia = diaDeSesion(sesion)
    const clave = dia ? sinTildes(dia) : undefined
    if (clave && !mapa.has(clave)) mapa.set(clave, sesion)
    else mapa.set(`#${++sinDia}`, sesion)
  }
  return mapa
}

function porNombre(sesion: Sesion | undefined): Map<string, EjercicioPrescrito> {
  return new Map((sesion?.ejercicios ?? []).map((e) => [normalizar(e.nombre), e]))
}

/**
 * Compara dos microciclos de la MISMA persona: el que se cierra (`anterior`)
 * contra el que entra (`actual`). Cualquiera de los dos puede faltar —sin
 * anterior, todo lo que haya en `actual` sale como "nueva"; sin actual, todo
 * lo de `anterior` sale como "perdida"— y el resultado sigue siendo honesto,
 * nunca un error.
 */
export function compararMicrociclos(
  anterior: Microciclo | undefined,
  actual: Microciclo | undefined,
): DiffMicrociclo {
  const hAntes = huecos(anterior)
  const hDespues = huecos(actual)
  const dias: DiaComparado[] = DIAS_SEMANA.map((dia) => {
    const sAntes = hAntes.get(dia)
    const sDespues = hDespues.get(dia)
    let estado: EstadoDiaComparado
    if (!sAntes && !sDespues) estado = 'vacio'
    else if (sAntes && !sDespues) estado = 'perdida'
    else if (!sAntes && sDespues) estado = 'nueva'
    else estado = 'igual'
    return {
      dia,
      antes: sAntes ? { id: sAntes.id, nombre: sAntes.nombre } : undefined,
      despues: sDespues ? { id: sDespues.id, nombre: sDespues.nombre } : undefined,
      estado,
    }
  })

  const ejerciciosAnadidos: string[] = []
  const ejerciciosRetirados: string[] = []
  const cargas: CambioCarga[] = []

  const claves = [...new Set([...hAntes.keys(), ...hDespues.keys()])]
  for (const hueco of claves) {
    const antesPorNombre = porNombre(hAntes.get(hueco))
    const despuesPorNombre = porNombre(hDespues.get(hueco))

    for (const [clave, ejercicio] of despuesPorNombre) {
      if (!antesPorNombre.has(clave)) ejerciciosAnadidos.push(ejercicio.nombre)
    }
    for (const [clave, ejercicio] of antesPorNombre) {
      if (!despuesPorNombre.has(clave)) ejerciciosRetirados.push(ejercicio.nombre)
    }
    for (const [clave, ejercicioAntes] of antesPorNombre) {
      const ejercicioDespues = despuesPorNombre.get(clave)
      if (!ejercicioDespues) continue
      if (ejercicioAntes.cargaKg === undefined || ejercicioDespues.cargaKg === undefined) continue
      if (ejercicioAntes.cargaKg === ejercicioDespues.cargaKg) continue
      cargas.push({
        nombre: ejercicioDespues.nombre,
        cargaAntesKg: ejercicioAntes.cargaKg,
        cargaDespuesKg: ejercicioDespues.cargaKg,
        direccion: ejercicioDespues.cargaKg > ejercicioAntes.cargaKg ? 'sube' : 'baja',
      })
    }
  }

  return { dias, ejerciciosAnadidos, ejerciciosRetirados, cargas }
}
