// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { aplicarSalidaDelAgente, armarEntradaDelAgente, personasDetenidas } from './mensaje-semanal.mjs'

// Paso 1.6 de la cadena: entre los guiones de la plantilla y la voz, el agente LOCAL
// `mensaje_semanal.py` (cerebro-alpha-agentes) reescribe el guion de cada persona. Todo en este
// equipo: ningún dato de salud viaja a un modelo externo. Aquí solo se prueba el traspaso de
// datos de un lado a otro; el criterio del mensaje es del agente y se prueba allí.

const SEMANA = '2026-10-19'
const ANA = '00000000-0000-4000-8000-0000000000a1'
const BETO = '00000000-0000-4000-8000-0000000000b2'
const CARLA = '00000000-0000-4000-8000-0000000000c3'

const manifiestoBase = () => ({
  semana: SEMANA,
  encargos: [
    {
      usuarioId: ANA,
      nombre: 'Ana Ficticia Prueba',
      semana: SEMANA,
      guion: 'Hola Ana, esta es tu revisión de la semana. Tu plan sigue en pie esta semana.',
      archivoGuion: `${ANA}.txt`,
      audioEsperado: `${ANA}.mp3`,
      frasesOmitidas: 1,
      numeros: {
        sesionesHechas: 3,
        sesionesPautadas: 4,
        adherenciaPct: 82,
        checkinsDeLaSemana: 5,
        regularidad: { estado: 'medido', indice: 71, nochesConDato: 9 },
      },
    },
    {
      usuarioId: BETO,
      nombre: 'Beto Ficticio',
      semana: SEMANA,
      guion: 'Hola Beto, esta es tu revisión de la semana.',
      archivoGuion: `${BETO}.txt`,
      audioEsperado: `${BETO}.mp3`,
      frasesOmitidas: 3,
      numeros: {
        sesionesHechas: 0,
        sesionesPautadas: 0,
        checkinsDeLaSemana: 2,
        regularidad: { estado: 'sin_dato', nochesConDato: 3 },
      },
    },
  ],
})

describe('lo que se le entrega al agente', () => {
  it('pasa los números tal cual, en el contrato del agente (snake_case), con el nombre de pila', () => {
    const entrada = armarEntradaDelAgente({ manifiesto: manifiestoBase() })
    expect(entrada.version).toBe(1)
    expect(entrada.semana).toBe(SEMANA)
    const ana = entrada.personas.find((p) => p.usuario_id === ANA)
    expect(ana.nombre_pila).toBe('Ana')
    expect(ana.numeros).toEqual({
      sesiones_pautadas: 4,
      sesiones_hechas: 3,
      adherencia_pct: 82,
      regularidad: { estado: 'medido', indice: 71, noches_con_dato: 9 },
    })
  })

  it('una adherencia que no existe viaja como null, nunca como 0', () => {
    const entrada = armarEntradaDelAgente({ manifiesto: manifiestoBase() })
    const beto = entrada.personas.find((p) => p.usuario_id === BETO)
    expect(beto.numeros.adherencia_pct).toBeNull()
    expect(beto.numeros.regularidad).toEqual({ estado: 'sin_dato', noches_con_dato: 3 })
  })

  it('la clave es el usuario_id: el slug sale del roster explícito, nunca del nombre', () => {
    const entrada = armarEntradaDelAgente({
      manifiesto: manifiestoBase(),
      roster: [{ usuario_id: ANA, slug: 'ana-ficticia' }],
    })
    expect(entrada.personas.find((p) => p.usuario_id === ANA).slug).toBe('ana-ficticia')
    expect(entrada.personas.find((p) => p.usuario_id === BETO).slug).toBeUndefined()
  })

  it('la tasa llega solo a quien tiene ficha con su usuario_id', () => {
    const fichas = [
      { usuario_id: ANA, nombre: 'Ana Ficticia Prueba', microciclo_activo: 35, ejes: [{ eje: 'cargas', estado: 'medido', valor: -4.2, unidad: '%' }] },
      { usuario_id: CARLA, nombre: 'Beto Ficticio', ejes: [{ eje: 'cargas', estado: 'medido', valor: 9, unidad: '%' }] },
    ]
    const entrada = armarEntradaDelAgente({ manifiesto: manifiestoBase(), fichas })
    expect(entrada.personas.find((p) => p.usuario_id === ANA).tasa).toEqual({
      ejes: fichas[0].ejes,
      microciclo_activo: 35,
    })
    // Beto comparte NOMBRE con la ficha de Carla, y aun así no recibe su tasa.
    expect(entrada.personas.find((p) => p.usuario_id === BETO).tasa).toBeUndefined()
  })

  it('marca como detenida a quien tiene una orden detener vigente esa semana o la siguiente', () => {
    const ordenes = [
      { tipo: 'detener', objetivo: { usuario_id: ANA, semana_inicio: '2026-10-26' }, creada_en: '2026-10-21T10:00:00Z' },
      { tipo: 'detener', objetivo: { usuario_id: BETO, semana_inicio: SEMANA }, creada_en: '2026-10-21T10:00:00Z' },
      { tipo: 'reanudar', objetivo: { usuario_id: BETO, semana_inicio: SEMANA }, creada_en: '2026-10-21T11:00:00Z' },
    ]
    expect([...personasDetenidas(ordenes, SEMANA)]).toEqual([ANA])
    const entrada = armarEntradaDelAgente({ manifiesto: manifiestoBase(), ordenes })
    expect(entrada.personas.find((p) => p.usuario_id === ANA).banderas.detenido).toBe(true)
    expect(entrada.personas.find((p) => p.usuario_id === BETO).banderas?.detenido ?? false).toBe(false)
  })

  it('no inventa banderas de salud que el puente no calcula', () => {
    const entrada = armarEntradaDelAgente({ manifiesto: manifiestoBase() })
    for (const p of entrada.personas) {
      expect(p.banderas?.dolor_alto).toBeUndefined()
      expect(p.banderas?.animo_muy_bajo).toBeUndefined()
      expect(p.banderas?.alerta_clinica).toBeUndefined()
    }
  })
})

describe('lo que se hace con la respuesta del agente', () => {
  const salida = (mensajes) => ({ version: 1, semana: SEMANA, agente: 'mensaje_semanal@1', entrada_sha256: 'abc123', mensajes })

  it('«publicar» cambia el guion y guarda el de la plantilla; «bandeja_humana» sin guion deja el de la plantilla', () => {
    const r = aplicarSalidaDelAgente({
      manifiesto: manifiestoBase(),
      salida: salida([
        { usuario_id: ANA, estado: 'publicar', motivo: null, guion: 'Hola Ana, texto del agente.', preguntas_a_persona: [{ id: 'P-COMIDA' }], avisos_al_coach: [] },
        { usuario_id: BETO, estado: 'bandeja_humana', motivo: 'sin datos de la semana', guion: null, preguntas_a_persona: [], avisos_al_coach: [] },
      ]),
    })
    const [ana, beto] = r.manifiesto.encargos
    expect(ana.guion).toBe('Hola Ana, texto del agente.')
    expect(ana.guionPlantilla).toBe('Hola Ana, esta es tu revisión de la semana. Tu plan sigue en pie esta semana.')
    expect(ana.mensaje).toMatchObject({ estado: 'publicar', agente: 'mensaje_semanal@1', entradaSha256: 'abc123', preguntas: 1 })
    expect(beto.guion).toBe('Hola Beto, esta es tu revisión de la semana.')
    expect(beto.mensaje).toMatchObject({ estado: 'bandeja_humana', motivo: 'sin datos de la semana' })
    expect(r.textos).toEqual([{ archivoGuion: `${ANA}.txt`, texto: 'Hola Ana, texto del agente.' }])
    expect(r.resumen).toEqual({ publicar: 1, bandeja_humana: 1, omitir: 0, sin_respuesta: 0 })
  })

  it('«omitir» deja a esa persona fuera del audio', () => {
    const r = aplicarSalidaDelAgente({
      manifiesto: manifiestoBase(),
      salida: salida([{ usuario_id: ANA, estado: 'omitir', motivo: 'detenido', guion: null }]),
    })
    expect(r.manifiesto.encargos[0]).toMatchObject({ omitido: true })
    expect(r.manifiesto.encargos[0].mensaje.motivo).toBe('detenido')
  })

  it('quien el agente no devolvió queda «sin_respuesta» y NO se le firmará nada', () => {
    const r = aplicarSalidaDelAgente({ manifiesto: manifiestoBase(), salida: salida([{ usuario_id: ANA, estado: 'publicar', guion: 'x.' }]) })
    expect(r.manifiesto.encargos[1].mensaje).toMatchObject({ estado: 'sin_respuesta' })
    expect(r.resumen.sin_respuesta).toBe(1)
  })

  it('un usuario_id que no está en el manifiesto se ignora y se avisa', () => {
    const r = aplicarSalidaDelAgente({
      manifiesto: manifiestoBase(),
      salida: salida([{ usuario_id: CARLA, estado: 'publicar', guion: 'Texto de otra persona.' }]),
    })
    expect(r.manifiesto.encargos.map((e) => e.guion).join(' ')).not.toContain('otra persona')
    expect(r.ignorados).toEqual([CARLA])
  })

  it('aplicarla dos veces no pierde la plantilla original ni cambia nada', () => {
    const primera = aplicarSalidaDelAgente({ manifiesto: manifiestoBase(), salida: salida([{ usuario_id: ANA, estado: 'publicar', guion: 'Texto del agente.' }]) })
    const segunda = aplicarSalidaDelAgente({ manifiesto: primera.manifiesto, salida: salida([{ usuario_id: ANA, estado: 'publicar', guion: 'Texto del agente.' }]) })
    expect(segunda.manifiesto.encargos[0].guionPlantilla).toBe(primera.manifiesto.encargos[0].guionPlantilla)
    expect(segunda.manifiesto.encargos[0].guion).toBe('Texto del agente.')
  })

  it('no muta el manifiesto que recibe', () => {
    const original = manifiestoBase()
    const copia = JSON.stringify(original)
    aplicarSalidaDelAgente({ manifiesto: original, salida: salida([{ usuario_id: ANA, estado: 'publicar', guion: 'Otro texto.' }]) })
    expect(JSON.stringify(original)).toBe(copia)
  })

  it('un estado que el agente no define no se acepta: queda sin_respuesta', () => {
    const r = aplicarSalidaDelAgente({ manifiesto: manifiestoBase(), salida: salida([{ usuario_id: ANA, estado: 'quizas', guion: 'x.' }]) })
    expect(r.manifiesto.encargos[0].mensaje.estado).toBe('sin_respuesta')
    expect(r.manifiesto.encargos[0].guion).toContain('Tu plan sigue en pie')
  })

  it('los avisos al coach se convierten en avisos para notificaciones.log, con id estable', () => {
    const r = aplicarSalidaDelAgente({
      manifiesto: manifiestoBase(),
      salida: salida([{ usuario_id: ANA, estado: 'publicar', guion: 'x.', avisos_al_coach: [{ tipo: 'dolor_alto', texto: 'Anotó dolor alto' }] }]),
    })
    expect(r.avisos).toHaveLength(1)
    expect(r.avisos[0]).toMatchObject({ tipo: 'mensaje_semanal_dolor_alto' })
    expect(r.avisos[0].id).toContain(SEMANA)
    expect(r.avisos[0].id).toContain(ANA)
    expect(r.avisos[0].mensaje).toContain('Anotó dolor alto')
  })
})
