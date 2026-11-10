import { describe, expect, it } from 'vitest'
import { DE_SALUD } from '../domain/praxis/ordenes/ordenesDeVoz'
import { filtroDeRiesgo } from '../domain/praxis/riesgo'
import { limpiarFrase } from '../domain/praxis/organizacion/pedido'
import type { Rol } from '../domain/types'
import { TOPE_DE_OCULTAS, decidirOrganizacion, type DecisionDeOrganizacion, type EstadoDeOrganizacion } from './organizacionPraxis'
import type { PerfilAcceso } from './rutas'

/**
 * LA MUESTRA DE 20 FRASES que Bryan etiquetó a ciegas el 9-nov-2026 (qué quiso hacer la persona con la app).
 * Las frases las escribió Claude, así que NO miden acierto (una frase escrita por quien escribió la gramática
 * siempre le gana): son el primer caso real de cada forma de hablar que la gramática no entendía y ahora entiende.
 * Para medir de verdad hacen falta frases de personas, etiquetadas por Bryan, de la sombra (fase O2b).
 *
 * Etiqueta de Bryan entre paréntesis; el resultado es lo que decide hoy la gramática.
 */
const ASESORADO: PerfilAcceso = { rol: 'asesorado' as Rol, capacidades: new Set() }
const SIN_NADA: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }
const CON_CAMBIOS: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: true }
const CON_ALBUM_OCULTO: EstadoDeOrganizacion = { ocultas: new Set(['hoy.album']), hayCambiosParaDeshacer: true }

const resumen = (x: DecisionDeOrganizacion): string => {
  if (x.tipo === 'traer') return `traer:${x.pieza.id}`
  if (x.tipo === 'propone') return `propone:${x.accion}:${x.pieza.id}`
  if (x.tipo === 'rechaza') return `rechaza:${x.motivo}`
  if (x.tipo === 'pregunta_cual') return `pregunta:${x.opciones.map((o) => o.id).sort().join('|')}`
  if (x.tipo === 'lista_ocultas') return `lista_ocultas:${x.piezas.map((p) => p.id).join('|')}`
  if (x.tipo === 'sugiere_ocultar') return `sugiere_ocultar:${x.pieza.id}`
  if (x.tipo === 'propone_solo_lo_importante') return `solo_lo_importante:${x.esconderia.length}`
  return x.tipo
}

const MUESTRA: [number, string, string, string, EstadoDeOrganizacion?][] = [
  [1, 'muéstrame lo del agua', 'ver', 'traer:nutricion.agua'],
  [2, 'ya no quiero ver los logros', 'esconder', 'propone:ocultar:pantalla:/logros'],
  [3, 'ponme el plan de comida de primero', 'mover', 'propone:mover_arriba:pantalla:/nutricion/plan'],
  [6, 'regrésamelo todo como venía', 'mover o volver atrás', 'propone_restablecer'],
  [7, 'esconde el radar por favor', 'esconder', 'propone:ocultar:hoy.radar'],
  [8, 'bájame lo de las medidas', 'mover', 'pregunta:bienestar.medidas|progreso.medidas'], // están en dos pantallas: pregunta cuál
  [9, 'abre mi semana', 'ver', 'traer:pantalla:/semana'],
  [10, 'no quiero que me salga el álbum', 'esconder', 'propone:ocultar:hoy.album'],
  [11, 'qué tengo escondido', 'decir qué pestañas tiene escondidas', 'lista_ocultas:hoy.album', CON_ALBUM_OCULTO],
  [12, 'borra el ranking', 'esconder', 'propone:ocultar:logros.ranking'],
  [13, 'pon el agua de primera', 'ver', 'traer:nutricion.agua'],
  [14, 'oculta la bandeja', 'esconder', 'rechaza:sin_acceso'], // es del equipo: a un asesorado no le existe
  [15, 'quita las recetas de ahí', 'esconder', 'propone:ocultar:nutricion.recetas'],
  [16, 'me aburre el álbum de fichas', 'Praxis le propone si lo esconde', 'sugiere_ocultar:logros.album'],
  [17, 'súbeme el chat con mi coach', 'mover', 'propone:mover_arriba:pantalla:/chat'],
  [19, 'ordéname hoy como lo tenía antes', 'mover o volver atrás', 'propone_deshacer', CON_CAMBIOS],
  [20, 'quiero ver mi progreso', 'ver', 'traer:pantalla:/progreso'],
]

describe('la muestra de 20 frases etiquetada por Bryan (9-nov)', () => {
  it.each(MUESTRA)('frase %i «%s» (Bryan: %s) → %s', (_n, frase, _bryan, esperado, estado) => {
    expect(resumen(decidirOrganizacion(frase, ASESORADO, estado ?? SIN_NADA))).toBe(esperado)
  })

  it('«qué tengo escondido» sin nada oculto contesta con la lista vacía, no con un error', () => {
    expect(resumen(decidirOrganizacion('qué tengo escondido', ASESORADO, SIN_NADA))).toBe('lista_ocultas:')
  })

  it('frase 5 «me duele la rodilla, quita el check-in» (Bryan: esconder): la salud gana, antes de llegar a organizar', () => {
    const frase = 'me duele la rodilla, quita el check-in'
    // Esta gramática no la toma (no empieza con una orden). La atienden los detectores de riesgo, que el enrutador
    // corre primero (paso 1): aquí se comprueba que ESA frase sí los enciende, para que no se pierda en silencio.
    expect(decidirOrganizacion(frase, ASESORADO, SIN_NADA).tipo).toBe('no_es_organizacion')
    expect(Boolean(filtroDeRiesgo(frase)) || DE_SALUD.test(limpiarFrase(frase))).toBe(true)
  })

  it('una queja sobre algo fijo o asignado NO ofrece esconderlo (no se puede)', () => {
    expect(decidirOrganizacion('me aburre el check-in del día', ASESORADO, SIN_NADA).tipo).toBe('no_es_organizacion')
    expect(decidirOrganizacion('me aburre la sesión de hoy', ASESORADO, SIN_NADA).tipo).toBe('no_es_organizacion')
  })

  it('frase 4 «quita eso» (Bryan: esconder): choca con «quitar lo último que anoté»; Bryan decidió que Praxis pregunta cuál', () => {
    expect(resumen(decidirOrganizacion('quita eso', ASESORADO, SIN_NADA))).toBe('pregunta_que_quitar')
    expect(resumen(decidirOrganizacion('bórrame eso', ASESORADO, SIN_NADA))).toBe('pregunta_que_quitar')
  })

  it('«deshaz eso» y «quita lo último que anoté» siguen siendo SOLO del deshacer de registros (no se pregunta)', () => {
    expect(resumen(decidirOrganizacion('deshaz eso', ASESORADO, SIN_NADA))).toBe('no_es_organizacion')
    expect(resumen(decidirOrganizacion('quita lo último que anoté', ASESORADO, SIN_NADA))).toBe('no_es_organizacion')
  })

  it('frase 18 «déjame ver solo lo importante» (Bryan: mover): modo que esconde todo lo libre que está a la vista, con una tarjeta', () => {
    const x = decidirOrganizacion('déjame ver solo lo importante', ASESORADO, SIN_NADA)
    expect(x.tipo).toBe('propone_solo_lo_importante')
    if (x.tipo !== 'propone_solo_lo_importante') return
    expect(x.esconderia.length).toBeGreaterThan(TOPE_DE_OCULTAS) // salta el tope de 6 a propósito, solo en este modo
    expect(x.esconderia.every((p) => p.nivel === 'libre')).toBe(true) // lo fijo y lo asignado se quedan
    expect(x.esconderia.some((p) => p.id === 'hoy.checkin' || p.id === 'hoy.sesion')).toBe(false)
  })

  it('«solo lo importante» no vuelve a esconder lo que ya estaba oculto', () => {
    const x = decidirOrganizacion('quiero ver solo lo esencial', ASESORADO, CON_ALBUM_OCULTO)
    expect(x.tipo).toBe('propone_solo_lo_importante')
    if (x.tipo !== 'propone_solo_lo_importante') return
    expect(x.esconderia.some((p) => p.id === 'hoy.album')).toBe(false)
  })
})
