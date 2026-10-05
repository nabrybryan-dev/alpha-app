import { describe, expect, it } from 'vitest'
import {
  ORDEN_TIPOS,
  TIPOS_HALLAZGO,
  agruparPorTipo,
  comentariosSinRespuesta,
  faltaParaComentar,
  type ComentarioHallazgo,
  type HallazgoMercadeo,
} from './hallazgosMercadeo'

const com = (id: string, autor: ComentarioHallazgo['autor'], enRespuestaA: string | null = null): ComentarioHallazgo => ({
  id, hallazgoId: 'h1', autor, texto: `Texto ${id}`, enRespuestaA, creadoEn: '2026-09-30T10:00:00Z',
})
const hall = (tipo: HallazgoMercadeo['tipo'], comentarios: ComentarioHallazgo[] = []): HallazgoMercadeo => ({
  id: `h-${tipo}`, codigo: 'H-01', tipo, titulo: `Hallazgo ${tipo}`, resumen: 'Resumen de prueba', fuenteNombre: null,
  fuenteUrl: null, fuenteFecha: null, estado: 'nuevo', comentarios,
})

describe('agruparPorTipo', () => {
  it('va de lo macro a lo micro y no esconde un tipo sin hallazgos', () => {
    const grupos = agruparPorTipo([hall('hook'), hall('tendencia')])
    expect(grupos.map((g) => g.tipo)).toEqual([...ORDEN_TIPOS])
    expect(grupos.find((g) => g.tipo === 'loop')?.hallazgos).toEqual([])
    expect(grupos.find((g) => g.tipo === 'hook')?.hallazgos).toHaveLength(1)
  })
  it('cubre exactamente los cinco tipos de la base', () => {
    expect([...ORDEN_TIPOS].sort()).toEqual([...TIPOS_HALLAZGO].sort())
  })
})

describe('comentariosSinRespuesta', () => {
  it('un comentario que el agente contestó deja de estar pendiente', () => {
    const h = hall('hook', [com('a', 'manuela'), com('b', 'bryan'), com('r', 'agente', 'a')])
    expect(comentariosSinRespuesta(h).map((c) => c.id)).toEqual(['b'])
  })
  it('un comentario del agente sin respuesta a nadie no cuenta como pendiente de nadie', () => {
    expect(comentariosSinRespuesta(hall('hook', [com('r', 'agente')]))).toEqual([])
  })
})

describe('faltaParaComentar', () => {
  it('vacío, demasiado largo, con correo o con teléfono no se envía', () => {
    expect(faltaParaComentar('   ')).toMatch(/Escribe/)
    expect(faltaParaComentar('a'.repeat(1001))).toMatch(/pasa de/)
    expect(faltaParaComentar('escríbele a alguien@ejemplo.test')).toMatch(/@/)
    expect(faltaParaComentar('llámala al 300 123 4567')).toMatch(/teléfono/)
  })
  it('un comentario normal pasa', () => {
    expect(faltaParaComentar('Lo probaría con una cifra en el primer segundo.')).toBeNull()
  })
})
