import { describe, expect, it } from 'vitest'
import type { Rol } from '../domain/types'
import { decidirOrganizacion, type DecisionDeOrganizacion, type EstadoDeOrganizacion } from './organizacionPraxis'
import { buscarPiezas } from './catalogoDePiezas'
import type { PerfilAcceso } from './rutas'

/**
 * FRASES REALES DE BRYAN (11-nov-2026), dictadas con sus errores («albun», «hidrataccion», «bajalos»), de las
 * tarjetas 1 a 9 del formulario «Cómo le pedirías a Praxis». Son el CONJUNTO DE AJUSTE: la gramática se corrigió
 * mirándolas, así que ya no miden acierto. Las tarjetas 10 a 18 quedan selladas como examen y NO se ven aquí.
 *
 * Antes de los ajustes la gramática entendía 5 de 22 (23 %) de estas frases; ahora 19 de 22. Las tres que siguen
 * sin entenderse están al final, con `todavía no`, para que se vea qué falta y no se pierdan.
 */
const ASESORADO: PerfilAcceso = { rol: 'asesorado' as Rol, capacidades: new Set() }
const SIN_NADA: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }

const resumen = (x: DecisionDeOrganizacion): string => {
  if (x.tipo === 'traer') return `traer:${x.pieza.id}`
  if (x.tipo === 'propone') return `propone:${x.accion}:${x.pieza.id}`
  if (x.tipo === 'rechaza') return `rechaza:${x.motivo}`
  if (x.tipo === 'pregunta_cual') return `pregunta:${x.opciones.map((o) => o.id).sort().join('|')}`
  if (x.tipo === 'lista_ocultas') return `lista_ocultas:${x.piezas.length}`
  if (x.tipo === 'sugiere_ocultar') return `sugiere_ocultar:${x.pieza.id}`
  return x.tipo
}

const ENTIENDE: [string, string][] = [
  ['hey praxis revisa como va la hidrataccion de hoy', 'traer:nutricion.agua'],
  ['esconde el albun de fichas', 'pregunta:hoy.album|logros.album'],
  ['deja abajo el albun de fichas', 'pregunta:hoy.album|logros.album'],
  ['esas fichas llenan la app y  no necesito verlas ahora', 'pregunta:hoy.album|logros.album'],
  ['cambiemos el orden de la app y colocame hidrataccion primero', 'propone:mover_arriba:nutricion.agua'],
  ['coloca la seccion de entreno de hoy al final', 'propone:mover_abajo:hoy.sesion'],
  ['revisemos como vamos esta semana', 'traer:pantalla:/semana'],
  ['revisa que tanto he avanzado', 'traer:pantalla:/progreso'],
  ['ya no quiero ver la pantalla de logros', 'propone:ocultar:pantalla:/logros'],
  ['los logros me desaniman bajalos', 'propone:mover_abajo:pantalla:/logros'],
  ['quita mis logros de mi vista', 'propone:ocultar:pantalla:/logros'],
  ['revisemos que parte de la app tengo escondidas', 'lista_ocultas:0'],
  ['que areas de la app tengo escondidas', 'lista_ocultas:0'],
  ['desbloqueame las areas que tengo escondidas', 'lista_ocultas:0'],
  ['devuelveme a la app de siempre en su orden', 'propone_restablecer'],
  ['coloca la app por defecto', 'propone_restablecer'],
  ['quiero ver como estaba antes la app', 'propone_restablecer'],
  ['deja la app en su orden por defecto', 'propone_restablecer'],
  // «coloccamos» (letra doble) se corrige a «colocamos»; el agua está en Nutrición y en los menús del plan, así que pregunta cuál.
  ['revisemos si coloccamos de primero las cosas que menos anoto creo que es el agua', 'pregunta:nutricion.agua|plan.menus'],
]

const TODAVIA_NO: string[] = [
  'colocame la hidracion en el menu', // «en el menú» no dice arriba ni abajo
  'como ya entrene colca la parte de entreno cada que termine de llenar abajo', // pide una regla («cada que»), no un movimiento
  'como estaremos de juiciosos con el plan', // no nombra una pantalla
]

describe('frases reales de Bryan, tarjetas 1 a 9 (conjunto de ajuste)', () => {
  it.each(ENTIENDE)('«%s» → %s', (frase, esperado) => {
    expect(resumen(decidirOrganizacion(frase, ASESORADO, SIN_NADA))).toBe(esperado)
  })

  it.each(TODAVIA_NO)('todavía no la entiende, y no hace nada: «%s»', (frase) => {
    const r = resumen(decidirOrganizacion(frase, ASESORADO, SIN_NADA))
    expect(['no_es_organizacion', 'rechaza:no_existe']).toContain(r)
  })

  it('una pregunta de contenido con «revisemos» no se contesta «eso no existe»: se deja a la conversación', () => {
    expect(resumen(decidirOrganizacion('revisemos que comidas me recomiendas con lo anote en la mañana', ASESORADO, SIN_NADA))).toBe('no_es_organizacion')
  })
})

describe('corrección de dictado en buscarPiezas', () => {
  it('corrige una letra cambiada, de menos o doble hacia una palabra del catálogo', () => {
    expect(buscarPiezas('el albun', ASESORADO).map((p) => p.id)).toContain('hoy.album')
    expect(buscarPiezas('la hidratacon', ASESORADO).map((p) => p.id)).toContain('nutricion.agua')
    // «hidracion» (le faltan dos letras) NO se corrige: la regla es una sola letra, para no inventar palabras.
    expect(buscarPiezas('la hidracion', ASESORADO)).toEqual([])
    expect(buscarPiezas('la hidrataccion', ASESORADO).map((p) => p.id)).toContain('nutricion.agua')
  })

  it('no inventa: una palabra lejana de todo el catálogo no nombra nada', () => {
    expect(buscarPiezas('el tractor de mi abuelo', ASESORADO)).toEqual([])
  })
})
