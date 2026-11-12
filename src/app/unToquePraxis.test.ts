import { describe, expect, it } from 'vitest'
import { PIEZAS_DE_OTRAS_PANTALLAS } from './catalogoDePiezas'
import { aplicarCambio, ESTADO_INICIAL, type EstadoLocal } from './organizacionLocal'
import { TOPE_DE_OCULTAS } from './organizacionPraxis'
import { esFraseDeSalud, esPreguntaDeConocimiento, resolverTurno, type ContextoDelTurno } from './unToquePraxis'
import { TEXTOS_APROBADOS as A } from '../features/praxis/unToque/textos'
import { engancheDeCharla } from '../features/praxis/unToque/engancheDeCharla'

const asesorado = { rol: 'asesorado' as const, capacidades: new Set<never>() }
const ctx = (extra: Partial<ContextoDelTurno> = {}): ContextoDelTurno => ({
  perfil: asesorado,
  estado: ESTADO_INICIAL,
  pantallaActual: '/nutricion',
  charlaActiva: false,
  puedeAvisarAlCoach: false,
  ...extra,
})
const libres = ['nutricion.recetas', 'nutricion.micros', 'nutricion.calibracion', 'nutricion.agua', 'nutricion.tira-semana', 'nutricion.adherencia']

function conOcultas(n: number): EstadoLocal {
  let e = ESTADO_INICIAL
  for (const id of libres.slice(0, n)) e = aplicarCambio(e, 'ocultar', PIEZAS_DE_OTRAS_PANTALLAS.find((p) => p.id === id)!, id)
  return e
}

describe('resolverTurno: los candados del dueño', () => {
  it('traer va sin tarjeta de confirmación y dice la frase aprobada', () => {
    const t = resolverTurno('Muéstrame el agua', ctx())
    expect(t.traer?.id).toBe('nutricion.agua')
    expect(t.tarjeta).toBeUndefined()
    expect(t.mensaje).toBe(A.traje('el agua'))
  })

  it('ocultar una parte libre propone con dos botones y no cambia nada por sí solo', () => {
    const t = resolverTurno('Oculta las recetas', ctx())
    expect(t.tarjeta?.botones.map((b) => b.etiqueta)).toEqual([A.confirmaOcultarSi, A.confirmaOcultarNo])
    expect(t.tarjeta?.texto).toBe(A.confirmaOcultar('las recetas', 'Nutrición'))
    expect(t.traer).toBeUndefined()
  })

  it('mover lleva tarjeta con antes y después y dos botones', () => {
    const t = resolverTurno('Pon el agua arriba', ctx())
    expect(t.tarjeta?.antesDespues).toBeDefined()
    expect(t.tarjeta?.botones).toHaveLength(2)
  })

  it('lo fijo no se oculta: dice la frase aprobada y no hay tarjeta', () => {
    const t = resolverTurno('Oculta mi check-in del día', ctx())
    expect(t.mensaje).toBe(A.ocultarFija)
    expect(t.tarjeta).toBeUndefined()
    expect(t.pasos.some((p) => p.alerta)).toBe(true)
  })

  it('lo del coach no se oculta; el aviso solo se ofrece si hay camino para dejarlo', () => {
    const sin = resolverTurno('Oculta mi sesión de hoy', ctx())
    expect(sin.tarjeta).toBeUndefined()
    expect(sin.mensaje).toBe(A.ocultarDelCoachSinAviso('la sesión de hoy'))
    const con = resolverTurno('Oculta mi sesión de hoy', ctx({ puedeAvisarAlCoach: true }))
    expect(con.tarjeta?.texto).toBe(A.ocultarDelCoach('la sesión de hoy'))
    expect(con.tarjeta?.sub).toBe(A.ocultarDelCoachSub)
  })

  it('con 5 ocultas todavía se propone; con 6 la séptima se frena con la frase del tope', () => {
    expect(TOPE_DE_OCULTAS).toBe(6)
    const con5 = resolverTurno('Oculta los carteles del día', ctx({ estado: conOcultas(5), pantallaActual: '/' }))
    expect(con5.tarjeta).toBeDefined()
    const con6 = resolverTurno('Oculta los carteles del día', ctx({ estado: conOcultas(6), pantallaActual: '/' }))
    expect(con6.mensaje).toBe(A.tope)
    expect(con6.tarjeta).toBeUndefined()
  })

  it('Hoy no se mueve de la barra', () => {
    const t = resolverTurno('Pon hoy abajo', ctx())
    expect(t.mensaje).toBe(A.barra)
    expect(t.tarjeta).toBeUndefined()
  })

  it('«quita eso» pregunta cuál y no elige', () => {
    const t = resolverTurno('Quita eso', ctx())
    expect(t.tarjeta?.estilo).toBe('neutra')
    expect(t.tarjeta?.botones[0]?.accion).toEqual({ t: 'quitar_ultimo' })
  })

  it('deshacer sin cambios lo dice; con cambios propone con tarjeta', () => {
    expect(resolverTurno('Déjalo como estaba', ctx()).tarjeta).toBeUndefined()
    const t = resolverTurno('Déjalo como estaba', ctx({ estado: conOcultas(1) }))
    expect(t.tarjeta?.botones[0]?.accion).toEqual({ t: 'deshacer' })
  })

  it('lo que no se entiende se pregunta con la frase aprobada', () => {
    expect(resolverTurno('blablabla', ctx()).mensaje).toBe(A.noEntendi)
  })
})

describe('resolverTurno: la salud va primero', () => {
  it('una frase de dolor se desvía al coach con la tarjeta aprobada, sin modelo ni enganche', () => {
    const t = resolverTurno('Me duele la rodilla al bajar en sentadilla', ctx({ charlaActiva: true }))
    expect(t.salud).toBe(true)
    expect(t.pregunta).toBeUndefined()
    expect(t.tarjeta?.texto).toBe(A.saludTitulo)
    expect(t.tarjeta?.sub).toBe(A.saludSub)
    expect(t.tarjeta?.botones.map((b) => b.etiqueta)).toEqual([A.saludAvisar, A.saludCheckin])
  })

  it('una orden de organizar que habla de salud gana seguridad y no organiza nada', () => {
    const t = resolverTurno('Oculta lo de la rodilla que me duele', ctx())
    expect(t.salud).toBe(true)
    expect(t.traer).toBeUndefined()
  })

  it('una pregunta con señal de salud nunca llega al enganche aunque la charla esté activa', () => {
    expect(esFraseDeSalud('¿Por qué me duele el hombro al hacer press?')).toBe(true)
    expect(resolverTurno('¿Por qué me duele el hombro al hacer press?', ctx({ charlaActiva: true })).pregunta).toBeUndefined()
  })

  it('control positivo del detector: una frase sin salud no se marca', () => {
    expect(esFraseDeSalud('Muéstrame el agua')).toBe(false)
  })
})

describe('resolverTurno: la charla detrás de la segunda bandera', () => {
  it('apagada, una pregunta de conocimiento da «no entendí» y nada más', () => {
    const t = resolverTurno('¿Cuántas series por músculo a la semana?', ctx())
    expect(t.pregunta).toBeUndefined()
    expect(t.mensaje).toBe(A.noEntendi)
  })

  it('encendida, la pregunta se marca para el enganche, que hoy está vacío', () => {
    expect(resolverTurno('¿Cuántas series por músculo a la semana?', ctx({ charlaActiva: true })).pregunta).toBe(true)
    expect(engancheDeCharla()).toBeNull()
  })

  it('detecta preguntas con y sin signos', () => {
    expect(esPreguntaDeConocimiento('cuánto descanso entre series')).toBe(true)
    expect(esPreguntaDeConocimiento('Muéstrame el agua')).toBe(false)
  })
})
