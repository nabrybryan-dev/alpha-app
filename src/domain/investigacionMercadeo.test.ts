import { describe, expect, it } from 'vitest'
import type { FilaDetalle, SeccionLeida } from './adminTablero'
import { hallazgoDeFila, temaDeFila, tarjetasDeInvestigacion } from './investigacionMercadeo'

const fila = (id: string, extra: Partial<FilaDetalle> = {}): FilaDetalle => ({
  id,
  titulo: 'Los videos cortos con corte antes de un segundo retienen más',
  cifra: '',
  semaforo: 'gris',
  dueno: 'agente:mercadeo',
  detalle: '',
  queHacer: '',
  fuente: { archivo: 'mercadeo/videos-30sep.md', corte: '2026-09-30', huella: 'abc' },
  ...extra,
})
const seccion = (filas: FilaDetalle[]): SeccionLeida => ({
  seccion: 'mercadeo',
  estado: 'ok',
  corte: '2026-09-30',
  fuente: null,
  huella: null,
  datos: { tarjeta: { titulo: 'M', semaforo: 'gris', frase: '', cifra: '', cifraEtiqueta: '' }, filas, grafico: null },
})

describe('temaDeFila', () => {
  it('reconoce el tema por el prefijo del id', () => {
    expect(temaDeFila('ganchos-01')).toBe('ganchos')
    expect(temaDeFila('Tendencias-x')).toBe('tendencias')
    expect(temaDeFila('otra-cosa')).toBeNull()
    expect(temaDeFila('ganchosfalsos')).toBeNull()
  })
})

describe('tarjetasDeInvestigacion', () => {
  it('siempre son cuatro, de lo macro a lo concreto', () => {
    expect(tarjetasDeInvestigacion({ seccion: undefined }).map((t) => t.tema)).toEqual(['tendencias', 'videos', 'ganchos', 'disenos'])
  })

  it('sin fuente (sin filas del tema) sale FALTA y dice quién lo trae', () => {
    const t = tarjetasDeInvestigacion({ seccion: seccion([fila('videos-1')]) })
    const ganchos = t.find((x) => x.tema === 'ganchos')
    expect(ganchos).toMatchObject({ estado: 'falta' })
    expect(ganchos && ganchos.estado === 'falta' && ganchos.quien).toMatch(/Bryan/)
    expect(t.find((x) => x.tema === 'videos')?.estado).toBe('con_datos')
  })

  it('una sección sin corte deja los cuatro temas en FALTA', () => {
    const t = tarjetasDeInvestigacion({ seccion: { seccion: 'mercadeo', estado: 'sin_corte' } })
    expect(t.every((x) => x.estado === 'falta')).toBe(true)
  })

  it('un error de lectura se ve distinto de sin datos', () => {
    const fallo = tarjetasDeInvestigacion({ error: 'red caída' })[0]
    const vacio = tarjetasDeInvestigacion({ seccion: undefined })[0]
    expect(fallo.estado).toBe('fallo_de_lectura')
    expect(vacio.estado).toBe('falta')
    expect(fallo.estado).not.toBe(vacio.estado)
  })

  it('sin permiso o sin tabla es «pendiente de activar», no FALTA ni fallo', () => {
    expect(tarjetasDeInvestigacion('pendiente').every((x) => x.estado === 'pendiente_de_activar')).toBe(true)
  })

  it('datos que la app no entiende no se pintan a medias', () => {
    const t = tarjetasDeInvestigacion({ seccion: { seccion: 'mercadeo', estado: 'invalida', corte: '2026-09-30', motivo: 'faltan las filas' } })
    expect(t[0]).toMatchObject({ estado: 'dato_no_valido', motivo: 'faltan las filas' })
  })

  it('una fila sin frase no se vuelve hallazgo', () => {
    expect(hallazgoDeFila(fila('videos-2', { titulo: '  ' }))).toBeNull()
    const t = tarjetasDeInvestigacion({ seccion: seccion([fila('videos-2', { titulo: '' })]) })
    expect(t.find((x) => x.tema === 'videos')?.estado).toBe('falta')
  })
})

describe('hallazgoDeFila', () => {
  it('lleva frase, fuente, fecha y dueño; el estado no se inventa', () => {
    expect(hallazgoDeFila(fila('videos-1'))).toEqual({
      id: 'videos-1',
      frase: 'Los videos cortos con corte antes de un segundo retienen más',
      fuente: 'mercadeo/videos-30sep.md',
      fecha: '2026-09-30',
      estado: null,
      dueno: 'agente mercadeo',
    })
  })

  it('sin archivo o sin corte quedan en null, no en texto inventado', () => {
    const h = hallazgoDeFila(fila('videos-1', { fuente: { archivo: '', corte: '', huella: '' } }))
    expect(h?.fuente).toBeNull()
    expect(h?.fecha).toBeNull()
  })
})
