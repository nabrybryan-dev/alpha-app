/**
 * Arma el `ContextoRegistro` a partir del microciclo tal como vive en la base
 * (`microciclos.datos`, JSON). Es puro: la Edge Function lee las filas con el JWT
 * de la persona y llama a esto; el teléfono puede hacer lo mismo con su copia
 * local. Estructuras mínimas a propósito, para no depender de los tipos de la app.
 *
 * Qué es «la sesión de hoy» (DISENO §1.2, en este orden):
 *  1. la de la ruta abierta / el ejercicio en pantalla,
 *  2. la que ya tiene `fecha` = hoy,
 *  3. la única cuyo `dia` ("MARTES") es el de hoy,
 *  4. la que está a medias.
 * Si nada decide, `null`: el emparejamiento mira todo el microciclo.
 */
import { diaDeLaSemana, fechaLocal, sumarDias } from './fecha.ts'
import { normalizarTexto } from './numeros.ts'
import { normalizarUnidadCarga } from './unidad.ts'
import type { ContextoRegistro, EjercicioCtx, SerieHecha, SeriePauta, SesionCtx } from './tipos.ts'

export interface EjercicioJson {
  id: string
  nombre: string
  sets: number
  rango?: string
  unidadCarga?: string | null
  cargaKg?: number
  repsDiana?: number
  seriesPrescritas?: SeriePauta[]
  series?: SerieHecha[]
}

export interface SesionJson {
  id: string
  nombre: string
  dia?: string
  fecha?: string
  ejercicios?: EjercicioJson[]
  bloquesCardio?: { id: string; titulo?: string; nombre?: string; duracionMin?: number }[]
  preparacion?: { id: string; titulo?: string; nombre?: string; hechoEn?: string }[]
}

export interface MicrocicloJson {
  id: string
  numero?: number
  cadenciaDias?: number
  fechaInicio?: string
  sesiones: SesionJson[]
}

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function sesionCtx(s: SesionJson): SesionCtx {
  return {
    id: s.id,
    nombre: s.nombre,
    ejercicios: (s.ejercicios ?? []).map(
      (e): EjercicioCtx => ({
        id: e.id,
        nombre: e.nombre,
        sesionId: s.id,
        sets: e.sets,
        unidad: normalizarUnidadCarga(e.unidadCarga ?? null),
        rango: e.rango,
        seriesPrescritas: e.seriesPrescritas,
        cargaKg: e.cargaKg,
        repsDiana: e.repsDiana,
        series: [...(e.series ?? [])].sort((a, b) => a.orden - b.orden),
      }),
    ),
    bloquesCardio: (s.bloquesCardio ?? []).map((b) => ({ id: b.id, nombre: b.titulo ?? b.nombre ?? b.id, duracionMin: b.duracionMin })),
    preparacion: (s.preparacion ?? []).map((p) => ({ id: p.id, nombre: p.titulo ?? p.nombre ?? p.id, hecha: !!p.hechoEn })),
  }
}

export function microcicloVencido(m: MicrocicloJson, hoy: string): boolean {
  if (!m.fechaInicio || !m.cadenciaDias) return false
  return hoy >= sumarDias(m.fechaInicio.slice(0, 10), m.cadenciaDias)
}

export function sesionDeHoy(sesiones: SesionCtx[], crudas: SesionJson[], hoy: string, pantallaEjercicioId: string | null): string | null {
  if (pantallaEjercicioId) {
    const s = sesiones.find((x) => x.ejercicios.some((e) => e.id === pantallaEjercicioId))
    if (s) return s.id
  }
  const porFecha = crudas.filter((s) => s.fecha === hoy)
  if (porFecha.length >= 1) return porFecha[0].id
  const nombreHoy = DIAS[diaDeLaSemana(hoy)]
  const porDia = crudas.filter((s) => s.dia && normalizarTexto(s.dia) === nombreHoy)
  if (porDia.length === 1) return porDia[0].id
  const aMedias = sesiones.filter((s) => {
    const hechas = s.ejercicios.filter((e) => e.series.length > 0)
    return hechas.length > 0 && s.ejercicios.some((e) => e.series.length < e.sets)
  })
  return aMedias.length === 1 ? aMedias[0].id : null
}

export interface EntradaContexto {
  ahora: string
  activo: MicrocicloJson | null
  anterior?: MicrocicloJson | null
  pantallaEjercicioId?: string | null
  ultimoTocado?: { ejercicioId: string; minutosAtras: number } | null
  pesoBarraKg?: number | null
  checkinHoy?: Record<string, unknown>
  hidratacionHoyMl?: number
  cronometroMin?: number | null
}

export function armarContexto(e: EntradaContexto): ContextoRegistro {
  const hoy = fechaLocal(e.ahora)
  const crudas = e.activo?.sesiones ?? []
  const sesiones = crudas.map(sesionCtx)
  const semanaAnterior: Record<string, SerieHecha[]> = {}
  for (const s of e.anterior?.sesiones ?? []) {
    for (const ej of s.ejercicios ?? []) if (ej.series?.length) semanaAnterior[ej.id] = [...ej.series].sort((a, b) => a.orden - b.orden)
  }
  return {
    ahora: e.ahora,
    microciclo: e.activo ? { id: e.activo.id, numero: e.activo.numero, vencido: microcicloVencido(e.activo, hoy) } : null,
    sesionHoyId: sesionDeHoy(sesiones, crudas, hoy, e.pantallaEjercicioId ?? null),
    sesiones,
    pantalla: { ejercicioId: e.pantallaEjercicioId ?? null },
    ultimoTocado: e.ultimoTocado ?? null,
    semanaAnterior,
    perfil: { pesoBarraKg: e.pesoBarraKg ?? null },
    checkinHoy: e.checkinHoy,
    hidratacionHoyMl: e.hidratacionHoyMl,
    cronometroMin: e.cronometroMin ?? null,
  }
}
