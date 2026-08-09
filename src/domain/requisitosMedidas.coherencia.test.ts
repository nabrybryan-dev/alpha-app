/**
 * El candado tiene que tener llave.
 *
 * `PuertaDeMedidas` bloquea el plan de entrenamiento hasta que la persona cargue
 * ciertos perímetros. Si alguno de esos perímetros no se puede cargar desde el
 * formulario de bienestar, la persona queda encerrada fuera de su entrenamiento
 * sin ninguna forma de salir — y desde la app no hay manera de darse cuenta,
 * porque las dos listas viven en archivos distintos.
 *
 * Este test las ata. Si mañana alguien exige `Cuello` en `medidasRequeridas` sin
 * añadirlo al formulario, se entera aquí y no en producción.
 */
import { describe, expect, it } from 'vitest'
import { PERIMETROS } from '../features/bienestar/MedidasCard'
import { PERIMETROS_BASE } from './requisitosMedidas'

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const cargables = new Set(PERIMETROS.map(normalizar))

describe('coherencia entre lo que se exige y lo que se puede cargar', () => {
  it('todo perímetro base se puede cargar desde el formulario', () => {
    for (const exigido of PERIMETROS_BASE) {
      expect(cargables.has(normalizar(exigido))).toBe(true)
    }
  })

  it('el glúteo se puede medir: hay bloques enteros que dependen de él', () => {
    expect(cargables.has('gluteo')).toBe(true)
  })

  it('los perímetros que el coach exige por objetivo son todos cargables', () => {
    // Los que se usan hoy en `perfiles.datos.medidasRequeridas`.
    const usadosPorElCoach = ['Glúteo', 'Abdomen', 'Muslo', 'Cadera', 'Brazo']
    for (const exigido of usadosPorElCoach) {
      expect(cargables.has(normalizar(exigido))).toBe(true)
    }
  })
})
