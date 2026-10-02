import { describe, expect, it } from 'vitest'
import { ultimoCortePorSeccion, type FilaAdminTablero } from './adminTablero'
import { contarRiesgos, riesgosDeSecciones } from './riesgosAdmin'

const fuente = { archivo: 'finanzas.json', corte: '2026-09-28', huella: 'h' }
const cruda = (seccion: string, filas: { id: string; semaforo: string; cifra?: string }[]): FilaAdminTablero => ({
  id: seccion, seccion, corte: '2026-09-28', fuente: null, huella: null,
  datos: {
    tarjeta: { titulo: seccion, semaforo: 'gris', frase: '', cifra: '', cifra_etiqueta: '' },
    filas: filas.map((f) => ({ id: f.id, titulo: `Fila ${f.id}`, cifra: f.cifra ?? '', semaforo: f.semaforo, dueno: 'bryan', detalle: '', que_hacer: '', fuente })),
    grafico: null,
  },
})

describe('riesgosDeSecciones', () => {
  it('toma solo las filas rojas de finanzas, desvíos y plan, cada una en su clase', () => {
    const s = ultimoCortePorSeccion([
      cruda('finanzas', [{ id: 'a', semaforo: 'rojo' }, { id: 'b', semaforo: 'amarillo' }]),
      cruda('desvios', [{ id: 'c', semaforo: 'verde' }]),
      cruda('plan', [{ id: 'd', semaforo: 'rojo' }]),
      cruda('mercadeo', [{ id: 'e', semaforo: 'rojo' }]),
    ])
    const g = riesgosDeSecciones(s)
    expect(g.map((x) => `${x.clase}:${x.estado}`)).toEqual(['financiero:con_riesgos', 'operativo:sin_rojos', 'estrategia:con_riesgos'])
    expect(contarRiesgos(g)).toBe(2)
    expect(g[0].estado === 'con_riesgos' && g[0].riesgos.map((r) => r.id)).toEqual(['a'])
  })

  it('una sección sin corte es FALTA, nunca «sin riesgos»', () => {
    const g = riesgosDeSecciones(ultimoCortePorSeccion([]))
    expect(g.every((x) => x.estado === 'falta')).toBe(true)
    expect(contarRiesgos(g)).toBe(0)
  })

  it('datos inválidos se dicen inválidos, no se pintan a medias', () => {
    const mala: FilaAdminTablero = { id: 'x', seccion: 'finanzas', corte: '2026-09-28', fuente: null, huella: null, datos: { filas: [] } }
    const g = riesgosDeSecciones(ultimoCortePorSeccion([mala]))
    expect(g[0].estado).toBe('invalida')
  })

  it('la fuente de un riesgo dice archivo y corte, o FALTA si la fila no la trae', () => {
    const s = ultimoCortePorSeccion([cruda('finanzas', [{ id: 'a', semaforo: 'rojo' }])])
    const g = riesgosDeSecciones(s)[0]
    expect(g.estado === 'con_riesgos' && g.riesgos[0].fuente).toBe('finanzas.json · 2026-09-28')
  })
})
