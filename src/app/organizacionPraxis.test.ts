import { describe, expect, it } from 'vitest'
import type { Capacidad } from '../data/consola/capacidadesStaff'
import type { Rol } from '../domain/types'
import { leerPedidoDeOrganizacion } from '../domain/praxis/organizacion/pedido'
import { NUCLEO_DE_LA_BARRA, TOPE_DE_OCULTAS, decidirOrganizacion, decidirParaPieza, type DecisionDeOrganizacion, type EstadoDeOrganizacion } from './organizacionPraxis'
import { piezasPara } from './catalogoDePiezas'
import type { PerfilAcceso } from './rutas'

/**
 * La decisión de organización (fase O2). Cada caso sale del diseño (§5, §6 y §10). Frases y datos inventados;
 * ninguna es de un asesorado. Las frases son de ejemplo y las escribe Claude: sirven de prueba de la gramática,
 * no de medida de aprobación (para eso hacen falta frases reales etiquetadas por Bryan).
 */
const perfil = (rol: Rol, capacidades: Capacidad[] = []): PerfilAcceso => ({ rol, capacidades: new Set(capacidades) })
const ASESORADO = perfil('asesorado')
const COACH = perfil('coach', ['leer_entrenamiento', 'ver_administracion', 'revisar_creadores', 'responder_mercadeo', 'organizar_plan', 'decisiones_compartidas'])
const LIBRE: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }

const d = (frase: string, estado: EstadoDeOrganizacion = LIBRE, p: PerfilAcceso = ASESORADO): DecisionDeOrganizacion => decidirOrganizacion(frase, p, estado)
const resumen = (x: DecisionDeOrganizacion): string => {
  if (x.tipo === 'traer') return `traer:${x.pieza.id}`
  if (x.tipo === 'propone') return `propone:${x.accion}:${x.pieza.id}`
  if (x.tipo === 'rechaza') return `rechaza:${x.motivo}`
  if (x.tipo === 'sugiere_ocultar') return `sugiere_ocultar:${x.pieza.id}`
  if (x.tipo === 'pregunta_cual') return `pregunta:${x.opciones.map((o) => o.id).sort().join('|')}`
  return x.tipo
}

describe('leer el pedido: solo si la frase empieza con la orden', () => {
  it.each([
    ['muéstrame el agua', 'traer'],
    ['ábreme Nutrición', 'traer'],
    ['quiero ver mi fatiga', 'traer'],
    ['oculta Logros', 'ocultar'],
    ['no me muestres Logros', 'ocultar'],
    ['por favor oculta el álbum', 'ocultar'],
    ['ponme el agua arriba', 'mover_arriba'],
    ['pon el agua de primera', 'traer'], // sin lugar es traer: así lo etiquetó Bryan el 9-nov
    ['baja el radar', 'mover_abajo'],
    ['déjame el agua siempre a la vista', 'fijar'],
    ['déjalo como estaba', 'deshacer'],
    ['restablece todo', 'restablecer'],
    ['qué puedo ocultar', 'listar'],
  ])('«%s» es %s', (frase, verbo) => {
    const p = leerPedidoDeOrganizacion(frase)
    expect(p.tipo === 'pedido' ? p.verbo : p.tipo).toBe(verbo)
  })

  it.each([
    'mi hermano ocultó todo',
    'mi hermano me dijo oculta el álbum', // la orden está dentro de otra frase: no empieza con ella
    'mi hermano me dijo que oculte el celular mientras entreno', // «que oculte» suena igual que «qué oculté»: solo vale al principio de la frase
    'ayer le dije muéstrame el agua a mi prima',
    'toca ocultar el domingo',
    'me gusta el agua',
    'mueve el agua', // sin decir dónde: no se adivina
    'hola praxis',
    '',
  ])('«%s» no es una orden de organizar', (frase) => {
    expect(leerPedidoDeOrganizacion(frase).tipo).toBe('ninguno')
  })

  it('el deshacer de REGISTROS gana: «deshaz lo del agua» y «quita lo último que anoté» no son de organización', () => {
    expect(leerPedidoDeOrganizacion('deshaz lo del agua').tipo).toBe('ninguno')
    expect(leerPedidoDeOrganizacion('quita lo último que anoté').tipo).toBe('ninguno')
    expect(leerPedidoDeOrganizacion('deshaz eso').tipo).toBe('ninguno')
  })

  it('«quita el agua» (la pieza, no un registro) SÍ es ocultar', () => {
    const p = leerPedidoDeOrganizacion('quita el agua')
    expect(p.tipo === 'pedido' && p.verbo).toBe('ocultar')
  })
})

describe('riesgo primero', () => {
  it.each(['oculta lo de la rodilla que me duele', 'muéstrame mi dolor de espalda', 'ponme el check-in arriba que me siento mareada'])('«%s» gana seguridad y no organiza nada', (frase) => {
    expect(d(frase)).toEqual({ tipo: 'seguridad' })
  })

  it('una frase de salud SIN orden de organizar no es de este módulo (la atiende el filtro de riesgo del enrutador)', () => {
    expect(d('me duele la rodilla')).toEqual({ tipo: 'no_es_organizacion' })
  })
})

describe('traer: no cambia nada guardado', () => {
  it('trae una tarjeta y una pantalla sin pedir confirmación', () => {
    expect(resumen(d('muéstrame el agua'))).toBe('traer:nutricion.agua')
    expect(resumen(d('ábreme Nutrición'))).toBe('traer:pantalla:/nutricion')
  })

  it('traer una pieza oculta la trae igual (solo ahora)', () => {
    const ocultaLaAgua: EstadoDeOrganizacion = { ocultas: new Set(['nutricion.agua']), hayCambiosParaDeshacer: true }
    expect(resumen(d('muéstrame el agua', ocultaLaAgua))).toBe('traer:nutricion.agua')
  })
})

describe('ocultar, fijar y mover: se proponen, no se hacen', () => {
  it('una pieza libre se propone para ocultar', () => {
    expect(resumen(d('oculta el álbum'))).toBe('propone:ocultar:hoy.album')
    expect(resumen(d('no me muestres el radar'))).toBe('propone:ocultar:hoy.radar')
  })

  it('lo FIJO no se oculta pero SÍ se mueve (sus avisos siguen llegando)', () => {
    expect(resumen(d('oculta mis avisos'))).toBe('rechaza:fija')
    expect(resumen(d('oculta el cuestionario de salud'))).toBe('rechaza:fija')
    expect(resumen(d('ponme el cuestionario de salud abajo'))).toBe('propone:mover_abajo:hoy.cuestionario-de-salud')
  })

  it('lo que el coach asigna no se oculta, pero se mueve', () => {
    expect(resumen(d('quita mi plan de entreno'))).toBe('rechaza:asignada')
    expect(resumen(d('oculta la sesión de hoy'))).toBe('rechaza:asignada')
    expect(resumen(d('ponme la sesión de hoy arriba'))).toBe('propone:mover_arriba:hoy.sesion')
  })

  it('el núcleo de la barra (Hoy) no se mueve ni se oculta', () => {
    expect(NUCLEO_DE_LA_BARRA.has('pantalla:/')).toBe(true)
    expect(resumen(decidirParaPieza('mover_arriba', piezasPara(ASESORADO).find((p) => p.id === 'pantalla:/')!, LIBRE))).toBe('rechaza:nucleo_de_la_barra')
    expect(resumen(decidirParaPieza('ocultar', piezasPara(ASESORADO).find((p) => p.id === 'pantalla:/')!, LIBRE))).toBe('rechaza:fija')
  })

  it('el tope de piezas ocultas frena la siguiente, y lo ya oculto se dice', () => {
    const libres = piezasPara(ASESORADO).filter((p) => p.nivel === 'libre')
    const llenas: EstadoDeOrganizacion = { ocultas: new Set(libres.slice(0, TOPE_DE_OCULTAS).map((p) => p.id)), hayCambiosParaDeshacer: true }
    expect(resumen(d('oculta el radar', llenas))).toBe(llenas.ocultas.has('hoy.radar') ? 'rechaza:ya_oculta' : 'rechaza:tope_de_ocultas')
    const yaOculta: EstadoDeOrganizacion = { ocultas: new Set(['hoy.album']), hayCambiosParaDeshacer: true }
    expect(resumen(d('oculta el álbum', yaOculta))).toBe('rechaza:ya_oculta')
  })
})

describe('quién ve qué', () => {
  it('un asesorado que pide algo del equipo oye «sin acceso», no «no existe», y no se le desvía', () => {
    expect(resumen(d('muéstrame la bandeja'))).toBe('rechaza:sin_acceso')
    expect(resumen(d('oculta la bandeja'))).toBe('rechaza:sin_acceso')
  })

  it('el equipo sí trae sus pantallas, pero organizarlas no está diseñado todavía', () => {
    expect(resumen(d('muéstrame la bandeja', LIBRE, COACH))).toBe('traer:pantalla:/bandeja')
    expect(resumen(d('oculta la bandeja', LIBRE, COACH))).toBe('rechaza:equipo_sin_organizacion')
  })

  it('un nombre que no existe en ninguna parte es «no existe»', () => {
    expect(resumen(d('muéstrame el unicornio'))).toBe('rechaza:no_existe')
    expect(resumen(d('oculta eso'))).toBe('rechaza:no_existe')
  })

  it('«qué puedo ocultar» lista solo lo libre de ESA persona, nunca lo fijo ni lo del equipo', () => {
    const x = d('qué puedo ocultar')
    expect(x.tipo).toBe('lista')
    if (x.tipo !== 'lista') return
    expect(x.libres.length).toBeGreaterThan(10)
    expect(x.libres.every((p) => p.nivel === 'libre')).toBe(true)
  })
})

describe('preguntar cuál, deshacer y restablecer', () => {
  it('un nombre en dos pantallas pregunta cuál (máximo 3) y no elige', () => {
    const x = d('oculta mis medidas')
    expect(x.tipo).toBe('pregunta_cual')
    if (x.tipo !== 'pregunta_cual') return
    expect(x.opciones.map((o) => o.id).sort()).toEqual(['bienestar.medidas', 'progreso.medidas'])
    expect(x.opciones.length).toBeLessThanOrEqual(3)
  })

  it('tras elegir una de las opciones se decide sobre esa pieza', () => {
    const x = d('oculta mis medidas')
    if (x.tipo !== 'pregunta_cual') throw new Error('debía preguntar')
    expect(resumen(decidirParaPieza(x.verbo, x.opciones[0]!, LIBRE))).toMatch(/^propone:ocultar:/)
  })

  it('«déjalo como estaba» propone deshacer solo si hay algo, y «restablece» propone volver a fábrica', () => {
    expect(d('déjalo como estaba').tipo).toBe('nada_que_deshacer')
    expect(d('déjalo como estaba', { ocultas: new Set(), hayCambiosParaDeshacer: true }).tipo).toBe('propone_deshacer')
    expect(d('restablece todo').tipo).toBe('propone_restablecer')
  })
})

describe('casos del diseño: lo que no debe dispararse', () => {
  it.each(['mi hermano ocultó todo', 'toca ocultar fotos', 'me quitaron el agua'])('«%s» no organiza nada', (frase) => {
    expect(d(frase).tipo).toBe('no_es_organizacion')
  })
})

describe('hallazgos de la revisión adversarial (10-nov)', () => {
  it('ocultar una pantalla libre que lleva piezas fijas o asignadas dentro se rechaza («oculta mi semana» no esconde el chat con el coach)', () => {
    expect(resumen(d('oculta mi semana'))).toBe('rechaza:contiene_piezas_protegidas')
    expect(resumen(d('oculta Semana'))).toBe('rechaza:contiene_piezas_protegidas')
  })

  it('una pantalla libre SIN piezas protegidas sí se oculta, y «solo lo importante» no esconde pantallas con piezas protegidas', () => {
    expect(resumen(d('oculta Logros'))).toBe('propone:ocultar:pantalla:/logros')
    const x = d('déjame ver solo lo importante')
    expect(x.tipo).toBe('propone_solo_lo_importante')
    if (x.tipo !== 'propone_solo_lo_importante') return
    expect(x.esconderia.some((p) => p.id === 'pantalla:/semana')).toBe(false)
  })

  it('«de hoy» no nombra la pantalla Hoy cuando la frase ya nombra una tarjeta', () => {
    expect(resumen(d('ponme el agua de hoy arriba'))).toBe('propone:mover_arriba:nutricion.agua')
    expect(resumen(d('muéstrame el agua de hoy'))).toBe('traer:nutricion.agua')
  })

  it('«borra» y «elimina» solo esconden la tarjeta y la decisión lo marca para decir que los datos NO se borran', () => {
    const borra = d('borra el álbum')
    expect(borra.tipo === 'propone' && borra.quisoBorrar).toBe(true)
    const oculta = d('oculta el álbum')
    expect(oculta.tipo === 'propone' && oculta.quisoBorrar).toBeFalsy()
  })

  it('«quita eso» con una pieza nombrada la esconde; sin pieza, pregunta qué quitar', () => {
    expect(resumen(d('quita eso del álbum'))).toBe('propone:ocultar:hoy.album')
    expect(d('quita eso').tipo).toBe('pregunta_que_quitar')
  })

  it('«solo lo importante» solo cuenta si la frase TERMINA ahí: «muéstrame solo lo básico de mi nutrición» no activa el modo', () => {
    expect(d('muéstrame solo lo básico de mi nutrición').tipo).not.toBe('propone_solo_lo_importante')
    expect(d('quiero ver solo lo importante').tipo).toBe('propone_solo_lo_importante')
  })

  it('preguntas de entrenamiento con «muéstrame» o «enséñame» no son órdenes de organizar', () => {
    expect(d('muéstrame cómo se hace la sentadilla').tipo).toBe('no_es_organizacion')
    expect(d('enséñame cómo respirar en el peso muerto').tipo).toBe('no_es_organizacion')
  })

  it('una queja emocional («me da ansiedad») no se convierte en oferta de esconder: la atiende la conversación', () => {
    expect(d('ay no mis números me dan ansiedad').tipo).toBe('no_es_organizacion')
  })
})

describe('cómo habla la gente de verdad (frases a ciegas, 10-nov): muletillas, rodeos, subjuntivo y objeto primero', () => {
  it.each([
    ['oye Praxis necesito que me muestres el agua', 'traer:nutricion.agua'],
    ['mira uy esconde el radar por favor', 'propone:ocultar:hoy.radar'],
    ['pues como que mejor oculta el álbum', 'propone:ocultar:hoy.album'],
    ['hazme el favor y quitas el radar', 'propone:ocultar:hoy.radar'],
    ['quiero que el radar ya no aparezca', 'propone:ocultar:hoy.radar'],
    ['el agua más abajo porfa', 'propone:mover_abajo:nutricion.agua'],
    ['quiero el agua arriba del todo', 'propone:mover_arriba:nutricion.agua'],
    ['manda el radar pa abajo', 'propone:mover_abajo:hoy.radar'],
    ['que el agua quede siempre visible', 'propone:fijar:nutricion.agua'],
    ['el radar me aburre', 'sugiere_ocultar:hoy.radar'],
    ['qué pereza el radar', 'sugiere_ocultar:hoy.radar'],
  ])('«%s» → %s', (frase, esperado) => {
    expect(resumen(d(frase))).toBe(esperado)
  })

  it.each([
    ['restablece toda la app', 'propone_restablecer'],
    ['pon la app en su configuración inicial', 'propone_restablecer'],
    ['vuelve atrás porfa', 'propone_deshacer'],
    ['anula lo anterior', 'propone_deshacer'],
  ])('«%s» → %s (hay cambios que deshacer)', (frase, esperado) => {
    expect(resumen(d(frase, { ocultas: new Set(), hayCambiosParaDeshacer: true }))).toBe(esperado)
  })

  it('«qué hay oculto en mi app» lista lo escondido, y «no quiero que se oculte el agua jamás» pide dejarla a la vista (no listar)', () => {
    expect(d('qué hay oculto en mi app').tipo).toBe('lista_ocultas')
    expect(resumen(d('no quiero que se oculte el agua jamás'))).toBe('propone:fijar:nutricion.agua')
  })
})
