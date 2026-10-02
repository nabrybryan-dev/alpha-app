import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  SECCIONES,
  contarQueRequierenAccion,
  filaRequiereAccion,
  filasQueRequierenAccion,
  nombreDueno,
  seccionRequiereAccion,
  semaforoDe,
  textoCifra,
  ultimoCortePorSeccion,
  validarDatos,
  type FilaAdminTablero,
} from './adminTablero'

const fuente = { archivo: 'finanzas.json', corte: '2026-09-28', huella: 'abc123' }
const fila = (extra: Record<string, unknown> = {}) => ({
  id: 'caja',
  titulo: 'Caja',
  cifra: '3,2 M',
  semaforo: 'verde',
  dueno: 'agente:finanzas',
  detalle: 'lo que hay en el banco',
  que_hacer: 'nada',
  fuente,
  ...extra,
})
const datos = (extra: Record<string, unknown> = {}) => ({
  tarjeta: { titulo: 'Finanzas', semaforo: 'amarillo', frase: 'Caja justa', cifra: '3,2 M', cifra_etiqueta: 'caja' },
  filas: [fila()],
  grafico: null,
  ...extra,
})
const cruda = (seccion: string, corte: string, d: unknown = datos()): FilaAdminTablero => ({
  id: `${seccion}-${corte}`, seccion, corte, datos: d, fuente: 'f', huella: 'h',
})

describe('validarDatos', () => {
  it('acepta el esquema de la espec y lo traduce a camelCase', () => {
    const r = validarDatos(datos())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.datos.tarjeta.cifraEtiqueta).toBe('caja')
    expect(r.datos.filas[0].queHacer).toBe('nada')
    expect(r.datos.grafico).toBeNull()
  })

  it('acepta gráfico de barras y de flujo, y sin gráfico (null o ausente)', () => {
    for (const tipo of ['barras', 'flujo']) {
      const r = validarDatos(datos({ grafico: { tipo, series: [{ etiqueta: 'A', valor: 2 }] } }))
      expect(r.ok).toBe(true)
    }
    const sin: Record<string, unknown> = datos()
    delete sin.grafico
    expect(validarDatos(sin).ok).toBe(true)
  })

  it.each([
    ['no es objeto', [1]],
    ['sin tarjeta', { filas: [] }],
    ['semáforo desconocido en la tarjeta', datos({ tarjeta: { titulo: 'x', semaforo: 'azul', frase: '', cifra: '', cifra_etiqueta: '' } })],
    ['sin filas', { tarjeta: datos().tarjeta }],
    ['cifra numérica (un 0 disfrazado)', datos({ filas: [fila({ cifra: 0 })] })],
    ['semáforo de fila desconocido', datos({ filas: [fila({ semaforo: 'morado' })] })],
    ['dueño inventado', datos({ filas: [fila({ dueno: 'pedro' })] })],
    ['fuente sin huella', datos({ filas: [fila({ fuente: { archivo: 'a', corte: 'c' } })] })],
    ['id repetido', datos({ filas: [fila(), fila()] })],
    ['tipo de gráfico desconocido', datos({ grafico: { tipo: 'pastel', series: [] } })],
    ['valor de gráfico no finito', datos({ grafico: { tipo: 'barras', series: [{ etiqueta: 'A', valor: NaN }] } })],
  ])('rechaza: %s', (_n, malo) => {
    const r = validarDatos(malo)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(3)
  })

  it('admite dueño vacío (sin asignar) y cifra vacía (falta)', () => {
    expect(validarDatos(datos({ filas: [fila({ dueno: '', cifra: '' })] })).ok).toBe(true)
  })
})

describe('ultimoCortePorSeccion', () => {
  it('devuelve las siete secciones en el orden de la espec, aunque no haya nada', () => {
    const r = ultimoCortePorSeccion([])
    expect(r.map((s) => s.seccion)).toEqual([...SECCIONES])
    expect(r.every((s) => s.estado === 'sin_corte')).toBe(true)
  })

  it('se queda con el corte más reciente de cada sección', () => {
    const r = ultimoCortePorSeccion([cruda('finanzas', '2026-09-21'), cruda('finanzas', '2026-09-28'), cruda('plan', '2026-09-14')])
    const fin = r[0]
    expect(fin.estado === 'ok' && fin.corte).toBe('2026-09-28')
    const plan = r[1]
    expect(plan.estado === 'ok' && plan.corte).toBe('2026-09-14')
  })

  it('un jsonb malo en el último corte NO cae al corte anterior: se dice inválida', () => {
    const r = ultimoCortePorSeccion([cruda('plan', '2026-09-21'), cruda('plan', '2026-09-28', { tarjeta: null })])
    expect(r[1].estado).toBe('invalida')
  })

  it('ignora una sección desconocida', () => {
    const r = ultimoCortePorSeccion([cruda('inventada', '2026-09-28')])
    expect(r.every((s) => s.estado === 'sin_corte')).toBe(true)
  })
})

describe('sin dato = gris FALTA', () => {
  it('una cifra vacía o «FALTA…» se dice FALTA y nunca 0', () => {
    expect(textoCifra('')).toEqual({ texto: 'FALTA', falta: true })
    expect(textoCifra('FALTA')).toEqual({ texto: 'FALTA', falta: true })
    expect(textoCifra('FALTA: caja (de Bryan)')).toEqual({ texto: 'FALTA', falta: true })
    expect(textoCifra('  ')).toEqual({ texto: 'FALTA', falta: true })
    expect(textoCifra('0')).toEqual({ texto: '0', falta: false })
  })

  it('sección sin corte o inválida es gris; la buena, el semáforo de su tarjeta', () => {
    const r = ultimoCortePorSeccion([cruda('finanzas', '2026-09-28'), cruda('plan', '2026-09-28', 5)])
    expect(semaforoDe(r[0])).toBe('amarillo')
    expect(semaforoDe(r[1])).toBe('gris')
    expect(semaforoDe(r[2])).toBe('gris')
  })
})

describe('requiere acción (acuerdo con el importador)', () => {
  const v = (extra: Record<string, unknown>) => {
    const r = validarDatos(datos(extra))
    if (!r.ok) throw new Error('debía validar')
    return r.datos
  }
  const leida = (d: Record<string, unknown>) => ultimoCortePorSeccion([cruda('finanzas', '2026-09-28', d)])[0]

  it('una fila la requiere si su que_hacer no está vacío, sin mirar el semáforo', () => {
    const d = v({ filas: [fila({ id: 'a', que_hacer: '' }), fila({ id: 'b', que_hacer: 'Decidir', semaforo: 'verde' }), fila({ id: 'c', que_hacer: '  ', semaforo: 'rojo' })] })
    expect(d.filas.map(filaRequiereAccion)).toEqual([false, true, false])
    expect(filasQueRequierenAccion(d.filas).map((f) => f.id)).toEqual(['b'])
  })

  it('una tarjeta la requiere si es roja o si alguna fila la requiere', () => {
    const sin = { filas: [fila({ que_hacer: '' })] }
    const amarillaSin = datos({ ...sin, tarjeta: { ...datos().tarjeta, semaforo: 'amarillo' } })
    const rojaSin = datos({ ...sin, tarjeta: { ...datos().tarjeta, semaforo: 'rojo' } })
    const verdeCon = datos({ tarjeta: { ...datos().tarjeta, semaforo: 'verde' } }) // fila con que_hacer 'nada'
    expect(seccionRequiereAccion(leida(amarillaSin))).toBe(false)
    expect(seccionRequiereAccion(leida(rojaSin))).toBe(true)
    expect(seccionRequiereAccion(leida(verdeCon))).toBe(true)
  })

  it('una sección sin corte o inválida también pide acción: falta un dato', () => {
    const r = ultimoCortePorSeccion([cruda('plan', '2026-09-28', 5)])
    expect(seccionRequiereAccion(r[0])).toBe(true)
    expect(seccionRequiereAccion(r[1])).toBe(true)
  })

  it('cuenta las secciones que piden acción', () => {
    const limpia = datos({ filas: [fila({ que_hacer: '' })], tarjeta: { ...datos().tarjeta, semaforo: 'verde' } })
    const r = ultimoCortePorSeccion([cruda('finanzas', '2026-09-28', limpia)])
    expect(contarQueRequierenAccion(r)).toBe(6)
  })
})

/**
 * CASO REAL: la salida del importador `exportar_admin.py` del 28-sep-2026, copiada TAL CUAL
 * (`admin-2026-09-28.fixture.json`). Si el importador y el validador se desacoplan, esto falla.
 */
describe('la salida real del importador (admin-2026-09-28)', () => {
  const real = JSON.parse(readFileSync(join(process.cwd(), 'src', 'domain', 'admin-2026-09-28.fixture.json'), 'utf8')) as {
    corte: string
    secciones: Record<string, { datos: unknown; fuente: string; huella: string }>
  }
  const crudas: FilaAdminTablero[] = Object.entries(real.secciones).map(([seccion, v]) => ({
    id: seccion, seccion, corte: real.corte, datos: v.datos, fuente: v.fuente, huella: v.huella,
  }))
  const leidas = ultimoCortePorSeccion(crudas)

  it('trae las siete secciones y todas validan', () => {
    expect(Object.keys(real.secciones).sort()).toEqual([...SECCIONES].sort())
    for (const s of leidas) expect(s.estado, s.seccion + (s.estado === 'invalida' ? `: ${s.motivo}` : '')).toBe('ok')
  })

  it('47 filas en total, con id único por sección', () => {
    const filas = leidas.flatMap((s) => (s.estado === 'ok' ? s.datos.filas : []))
    expect(filas).toHaveLength(47)
  })

  it('cabe en los límites de la tabla (fuente ≤ 300, huella ≤ 200) y es jsonb objeto', () => {
    for (const v of Object.values(real.secciones)) {
      expect(v.fuente.length).toBeGreaterThan(0)
      expect(v.fuente.length).toBeLessThanOrEqual(300)
      expect(v.huella.length).toBeLessThanOrEqual(200)
    }
  })

  it('una cifra «FALTA» del importador se dice FALTA, no un número', () => {
    const fin = leidas.find((s) => s.seccion === 'finanzas')
    if (!fin || fin.estado !== 'ok') throw new Error('finanzas debía validar')
    const caja = fin.datos.filas.find((f) => f.id === 'finanzas-caja')
    expect(caja && textoCifra(caja.cifra)).toEqual({ texto: 'FALTA', falta: true })
    expect(fin.datos.grafico?.tipo).toBe('flujo')
  })

  it('el plan es gris (falta un dato), y las semáforos vienen del importador sin tocar', () => {
    const porSeccion = Object.fromEntries(leidas.map((s) => [s.seccion, semaforoDe(s)]))
    expect(porSeccion.plan).toBe('gris')
    expect(porSeccion.finanzas).toBe('rojo')
  })

  it('con la regla de que_hacer, las siete piden acción', () => {
    expect(contarQueRequierenAccion(leidas)).toBe(7)
  })
})

describe('nombreDueno', () => {
  it('dice a la persona, al agente y la ausencia', () => {
    expect(nombreDueno('bryan')).toBe('Bryan')
    expect(nombreDueno('manuela')).toBe('Manuela')
    expect(nombreDueno('agente:finanzas')).toBe('agente finanzas')
    expect(nombreDueno('')).toBe('sin dueño asignado')
  })
})
