import { describe, expect, it } from 'vitest'
import { ultimoCortePorSeccion, type FilaAdminTablero } from './adminTablero'
import { OBJETIVOS_BOLA, objetivosConReal, type ObjetivoBola } from './objetivosBola'

const fuente = { archivo: 'guardian.json', corte: '2026-09-28', huella: 'h' }
const influencers = (filas: { id: string; cifra: string }[]): FilaAdminTablero => ({
  id: 'i', seccion: 'influencers', corte: '2026-09-28', fuente: null, huella: null,
  datos: {
    tarjeta: { titulo: 'I', semaforo: 'gris', frase: '', cifra: '', cifra_etiqueta: '' },
    filas: filas.map((f) => ({ ...f, titulo: `Fila ${f.id}`, semaforo: 'gris', dueno: 'bryan', detalle: '', que_hacer: '', fuente })),
    grafico: null,
  },
})
const seccion = (f: FilaAdminTablero) => ultimoCortePorSeccion([f]).find((s) => s.seccion === 'influencers')

const FUENTE_RECONOCIBLE = /\.(md|json|csv)(\s|\)|;|,|$)|pedido de bryan/i
const FECHA_RECONOCIBLE = /^(\d{1,2}-[a-z]{3}-\d{4}|sin fecha en la fuente)/i
/** Las metas a las que les falta fuente (documento o pedido de Bryan) o fecha. Vacío = todas bien. */
const metasSinFuente = (metas: readonly ObjetivoBola[]) =>
  metas.filter((o) => !FUENTE_RECONOCIBLE.test(o.fuente) || !FECHA_RECONOCIBLE.test(o.fecha.trim())).map((o) => o.clave)

describe('OBJETIVOS_BOLA', () => {
  it('trae las metas que pidió Bryan, cada una con su fuente y sin claves repetidas', () => {
    const metas = Object.fromEntries(OBJETIVOS_BOLA.map((o) => [o.clave, o.meta]))
    expect(metas['contactos-semana']).toBe('30')
    expect(metas['clientes-por-creador']).toBe('3')
    expect(metas['dias-entre-incorporaciones']).toBe('≥ 14 días')
    expect(metas['incorporaciones-mes']).toBe('máx. 2')
    expect(metas['creadores-activos']).toBe('máx. 5')
    expect(metas['micropruebas-a-la-vez']).toBe('máx. 2')
    expect(metas['techo-de-perdida']).toBe('3.000.000 COP')
    expect(metas['plan-4-palancas-12m']).toContain('18.864.431')
    expect(metas['palanca-a-bajas']).toBe('≤ 5 % al mes')
    expect(metas['palanca-c-ia']).toBe('279.014 COP al mes')
    expect(new Set(OBJETIVOS_BOLA.map((o) => o.clave)).size).toBe(OBJETIVOS_BOLA.length)
    for (const o of OBJETIVOS_BOLA) expect(o.fuente.trim(), o.clave).not.toBe('')
  })

  it('avisa si a alguna meta le falta la fuente o la fecha', () => {
    expect(metasSinFuente(OBJETIVOS_BOLA), 'metas sin fuente o sin fecha').toEqual([])
    const base = OBJETIVOS_BOLA[0]
    expect(metasSinFuente([{ ...base, clave: 'x', fuente: 'lo dijo alguien' }])).toEqual(['x'])
    expect(metasSinFuente([{ ...base, clave: 'y', fecha: '' }])).toEqual(['y'])
    expect(metasSinFuente([{ ...base, clave: 'z', fecha: 'sin fecha en la fuente (OPERACION.md)' }])).toEqual([])
  })

  it('lo que no sale literal de un documento lo dice en su fuente', () => {
    expect(OBJETIVOS_BOLA.find((o) => o.clave === 'incorporaciones-mes')?.fuente).toMatch(/no lo trae literal/)
  })
})

describe('objetivosConReal', () => {
  it('sin sección, sin corte o inválida: todo FALTA, nunca un cero', () => {
    for (const s of [undefined, ultimoCortePorSeccion([]).find((x) => x.seccion === 'influencers')]) {
      expect(objetivosConReal(s).every((o) => o.real === null)).toBe(true)
    }
  })

  it('una fila bola-<clave> con cifra trae lo real y su fuente; una cifra vacía o FALTA sigue siendo FALTA', () => {
    const r = objetivosConReal(
      seccion(influencers([
        { id: 'bola-contactos-semana', cifra: '12' },
        { id: 'bola-creadores-activos', cifra: '' },
        { id: 'bola-techo-de-perdida', cifra: 'FALTA: finanzas' },
        { id: 'otra-cosa', cifra: '99' },
      ])),
    )
    const por = Object.fromEntries(r.map((o) => [o.objetivo.clave, o]))
    expect(por['contactos-semana'].real).toBe('12')
    expect(por['contactos-semana'].fuenteReal).toBe('guardian.json · 2026-09-28')
    expect(por['creadores-activos'].real).toBeNull()
    expect(por['techo-de-perdida'].real).toBeNull()
    expect(r.filter((o) => o.real !== null)).toHaveLength(1)
  })
})
