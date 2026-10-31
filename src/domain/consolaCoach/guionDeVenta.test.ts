import { describe, expect, it } from 'vitest'
import EJEMPLO from './guion-llamada-v1.fixture.json'
import { franjaEnClaro, guionTieneContenido, leerGuion, marcasDeSalud, type GuionDeVenta } from './guionDeVenta'

// El fixture copia la FORMA de guion-llamada-v1 (landing: lib/praxis/guion-llamada.ts) con datos
// inventados: ninguna persona real.

function leido(crudo: unknown): GuionDeVenta {
  const l = leerGuion(crudo)
  if (!l.ok) throw new Error(`no se leyó: ${l.motivo}`)
  return l.guion
}

describe('leerGuion · guion-llamada-v1', () => {
  it('lee el ejemplo completo con su forma', () => {
    const g = leido(EJEMPLO)
    expect(g.persona).toEqual({
      nombre: 'Persona Ficticia',
      email: 'persona.ficticia@ejemplo.test',
      whatsapp: '+57 300 000 0000',
      edadTramo: '30-34',
      objetivo: 'Bajar grasa',
      decision: 'Evaluando la inversión',
    })
    expect(g.alerta).toEqual({ requiereAval: false, menorDeEdad: false })
    expect(g.dolores).toHaveLength(3)
    expect(g.dolores[2]).toEqual({ texto: '«Empiezo con ganas y a las tres semanas lo dejo.»', conSusPalabras: true })
    expect(g.queMostrar[0]).toEqual({
      tema: 'gasto_diario',
      titulo: 'Su gasto diario',
      dato: '1.700 kcal al día (estimado)',
      comoDecirlo: 'Mira tu gasto diario: es la base de tu plan de comida, calculado con tu cuerpo y tu movimiento de hoy.',
    })
    expect(g.queMostrar[2].dato).toBeNull()
    expect(g.objeciones[0]).toMatchObject({ tipo: 'tiempo', objecion: '«No tengo tiempo»' })
    expect(g.recomendaciones).toHaveLength(2)
    expect(g.reserva).toEqual({ fecha: '2026-11-05', hora: '15:00', enClaro: 'el jueves 5 de noviembre a las 3:00 p. m.' })
    expect(g.origen).toBe('modelo')
    expect(g.generadoEn).toBe('2026-10-30T15:00:00.000Z')
  })

  it('ignora los campos desconocidos y los que no pinta (gasto, molestias…)', () => {
    const g = leido({ ...EJEMPLO, campo_del_futuro: { a: 1 } })
    expect(Object.keys(g)).not.toContain('campo_del_futuro')
    expect(Object.keys(g.persona)).not.toContain('gasto_diario_kcal')
  })

  it('un v1 casi vacío no rompe: todo ausente y sin contenido', () => {
    const g = leido({ version: 'guion-llamada-v1' })
    expect(g.persona.nombre).toBeNull()
    expect(g.dolores).toEqual([])
    expect(g.alerta).toEqual({ requiereAval: false, menorDeEdad: false })
    expect(guionTieneContenido(g)).toBe(false)
  })

  it('una versión que no es la v1 no se pinta a ciegas: se dice cuál era', () => {
    expect(leerGuion({ ...EJEMPLO, version: 'guion-llamada-v2' })).toEqual({
      ok: false,
      motivo: 'version_desconocida',
      version: 'guion-llamada-v2',
    })
    expect(leerGuion({ apertura: 'sin versión' })).toMatchObject({ ok: false, motivo: 'version_desconocida' })
    expect(leerGuion(null)).toEqual({ ok: false, motivo: 'no_es_objeto' })
    expect(leerGuion([EJEMPLO])).toEqual({ ok: false, motivo: 'no_es_objeto' })
  })

  it('un campo con forma equivocada cuenta como ausente sin tumbar al resto', () => {
    const g = leido({
      version: 'guion-llamada-v1',
      persona: 'texto',
      apertura: 42,
      dolores: [{ texto: 'Válido', fuente: 'formulario' }, 'suelto', { fuente: 'palabras' }],
      que_mostrar: [{ tema: 'pasos', dato: 'sin título' }, { titulo: 'Con título' }],
      objeciones_probables: [{ objecion: 'Sin respuesta' }, { respuesta: 'Sin objeción' }],
      recomendaciones_praxis: 'no es lista',
      cierre: 'Cierre válido',
    })
    expect(g.persona.nombre).toBeNull()
    expect(g.apertura).toBeNull()
    expect(g.dolores).toEqual([{ texto: 'Válido', conSusPalabras: false }])
    expect(g.queMostrar).toEqual([{ tema: null, titulo: 'Con título', dato: null, comoDecirlo: null }])
    expect(g.objeciones).toEqual([{ tipo: null, objecion: 'Sin respuesta', respuesta: '' }])
    expect(g.recomendaciones).toEqual([])
    expect(g.cierre).toBe('Cierre válido')
  })
})

describe('marcasDeSalud · solo sí/no, nunca un detalle', () => {
  it('dice las dos marcas y nada más', () => {
    const g = leido({ ...EJEMPLO, alerta_salud: { hay: true, requiere_aval: true, menor_de_edad: true } })
    expect(marcasDeSalud(g.alerta)).toEqual(['Requiere aval médico', 'Menor de edad'])
    expect(guionTieneContenido(leido({ version: 'guion-llamada-v1', alerta_salud: { requiere_aval: true } }))).toBe(true)
  })

  it('un detalle colado en la alerta no se lee, y solo `true` enciende', () => {
    const g = leido({ ...EJEMPLO, alerta_salud: { hay: true, requiere_aval: 'sí', menor_de_edad: false, detalle: 'Inventado' } })
    expect(marcasDeSalud(g.alerta)).toEqual([])
    expect(JSON.stringify(g)).not.toContain('Inventado')
  })
})

describe('franjaEnClaro', () => {
  it('traduce las franjas y deja tal cual lo que no reconoce', () => {
    expect(franjaEnClaro('tarde')).toBe('en la tarde')
    expect(franjaEnClaro('manana')).toBe('en la mañana')
    expect(franjaEnClaro('al mediodía')).toBe('al mediodía')
    expect(franjaEnClaro(null)).toBeNull()
  })
})
