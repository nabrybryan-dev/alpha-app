import { describe, expect, it } from 'vitest'
import {
  CAMPOS_INGRESO, MENSAJES_DE_BLOQUE, TURNOS_VOZ, campoPorId, camposDeSalud, camposDeVoz, turnosDeBloque,
} from './guion.ts'
import {
  FUERA_DE_LA_PRUEBA, IDS_FORMULARIO, SEGMENTOS_DE, TOQUES_DE_SALUD, TOQUES_RAPIDOS, aplica, armarResultado, camposCorregidos, camposVisibles, comparar,
  contarLlenos, detenerCronometro, formatoTiempo, guionDelTurno, idDetalle, iniciarCronometro, pasarASegmento, preguntaDeToque, siguienteToque,
  textoParaCopiar, tiempos, valoresDeExtraccion, PREGUNTAS_USTED,
  type ResultadoModo, type Valores,
} from './prueba.ts'

describe('el formulario de la prueba cubre el guion', () => {
  it('todos los campos del formulario existen en el guion', () => {
    for (const id of IDS_FORMULARIO) expect(campoPorId(id), id).toBeDefined()
    expect(new Set(IDS_FORMULARIO).size).toBe(IDS_FORMULARIO.length)
  })

  it('cada campo de voz y cada toque del guion está en el formulario, o está dicho por qué no', () => {
    for (const c of CAMPOS_INGRESO) {
      const dentro = IDS_FORMULARIO.includes(c.id)
      const fuera = c.id in FUERA_DE_LA_PRUEBA
      expect(dentro || fuera, `${c.id}: ni está en el formulario ni se explica por qué no`).toBe(true)
      expect(dentro && fuera, `${c.id}: está en el formulario Y fuera a la vez`).toBe(false)
    }
    for (const c of camposDeVoz()) expect(IDS_FORMULARIO, c.id).toContain(c.id)
  })

  it('REPARTO: los 13 campos de voz van en los cinco turnos, y las marcas de fuerza quedan como opcional escrito', () => {
    expect(TURNOS_VOZ.map((t) => [t.id, t.bloque, t.campos])).toEqual([
      ['sobre_ti', 'preciso', ['ciudad', 'edad', 'altura_cm', 'peso_actual_kg']],
      ['historia_entreno', 'preciso', ['peso_objetivo_kg', 'tiempo_entrenando', 'nivel_fuerza']],
      ['objetivo', 'contexto', ['objetivo_principal', 'parte_a_mejorar']],
      ['trabajo_horarios', 'contexto', ['tipo_trabajo', 'dia_tipo_alimentacion']],
      ['comida', 'contexto', ['cocina_o_compra', 'vasos_agua']],
    ])
    expect(camposDeVoz()).toHaveLength(13)
    const marcas = campoPorId('marcas_fuerza')!
    expect(marcas.modo).toBe('toque')
    expect(marcas.opcional).toBe(true)
    expect(IDS_FORMULARIO).toContain('marcas_fuerza')
  })

  it('los dos bloques hablados traen sus turnos en orden: 2 de preciso, 3 de contexto', () => {
    expect(turnosDeBloque('preciso').map((t) => t.id)).toEqual(['sobre_ti', 'historia_entreno'])
    expect(turnosDeBloque('contexto').map((t) => t.id)).toEqual(['objetivo', 'trabajo_horarios', 'comida'])
  })

  it('REGLA DURA: la salud solo se toca, y la lista de salud de la prueba son exactamente los campos de salud del guion', () => {
    expect([...TOQUES_DE_SALUD].sort()).toEqual(camposDeSalud().map((c) => c.id).sort())
    for (const id of TOQUES_DE_SALUD) expect(campoPorId(id)?.modo, id).toBe('toque')
    for (const id of TOQUES_RAPIDOS) expect(campoPorId(id)?.salud, id).toBe(false)
  })
})

describe('los textos de Praxis son los de Bryan, literales', () => {
  it('la entrada y los tres bloques, en tú', () => {
    expect(MENSAJES_DE_BLOQUE.entrada.tu).toBe('Te voy a preguntar en tres partes, y antes de cada una te digo cómo responder. Al final revisas todo antes de enviarlo.')
    expect(MENSAJES_DE_BLOQUE.preciso.tu).toBe('En estas necesito que seas preciso: solo el dato, sin explicar. Por ejemplo: "Cali, 28, uno setenta, 82 kilos".')
    expect(MENSAJES_DE_BLOQUE.contexto.tu).toBe('En estas necesito que me des mucho contexto: cuéntame con detalle, sin afán.')
    expect(MENSAJES_DE_BLOQUE.si_no.tu).toBe('En estas próximas necesito que me digas solo sí o no.')
  })

  it('las cinco preguntas y el ejemplo del segundo turno, en tú', () => {
    expect(TURNOS_VOZ.map((t) => t.pregunta)).toEqual([
      '¿Ciudad, edad, estatura y peso?',
      '¿A qué peso quieres llegar, cuánto llevas entrenando y en qué nivel te sientes?',
      '¿Qué quieres lograr y qué parte de tu cuerpo quieres mejorar?',
      '¿En qué trabajas y cómo son tus horarios?',
      '¿Cómo comes en un día normal y cuánta agua tomas?',
    ])
    expect(TURNOS_VOZ[1].ejemplo).toBe('75 kilos, dos años, intermedio')
  })

  it('la versión de usted es equivalente: mismo ejemplo y sin formas de tú', () => {
    expect(MENSAJES_DE_BLOQUE.preciso.usted).toContain('"Cali, 28, uno setenta, 82 kilos"')
    expect(MENSAJES_DE_BLOQUE.entrada.usted).toBe('Le voy a preguntar en tres partes, y antes de cada una le digo cómo responder. Al final revisa todo antes de enviarlo.')
    const delTu = /\b(te|tu|tus|tú|quieres|llevas|sientes|trabajas|comes|tomas|seas|des|digas|cuéntame|revisas|mejorar tu)\b/i
    const deUsted = [...Object.values(MENSAJES_DE_BLOQUE).map((m) => m.usted), ...TURNOS_VOZ.map((t) => t.preguntaUsted), ...Object.values(PREGUNTAS_USTED)]
    for (const texto of deUsted) expect(texto, texto).not.toMatch(delTu)
    expect(TURNOS_VOZ.map((t) => t.preguntaUsted)).toEqual([
      '¿Ciudad, edad, estatura y peso?',
      '¿A qué peso quiere llegar, cuánto lleva entrenando y en qué nivel se siente?',
      '¿Qué quiere lograr y qué parte de su cuerpo quiere mejorar?',
      '¿En qué trabaja y cómo son sus horarios?',
      '¿Cómo come en un día normal y cuánta agua toma?',
    ])
  })

  it('cada pregunta de toque tiene su versión de usted', () => {
    for (const id of [...TOQUES_RAPIDOS, ...TOQUES_DE_SALUD]) {
      const c = campoPorId(id)!
      expect(PREGUNTAS_USTED[id], id).toBeTruthy()
      expect(preguntaDeToque(c, true)).toBe(PREGUNTAS_USTED[id])
      expect(preguntaDeToque(c, false)).toBe(c.pregunta)
    }
  })

  it('lo que Praxis dice en cada turno: la entrada solo en el primero y la explicación del bloque solo al empezarlo', () => {
    const dicho = TURNOS_VOZ.map((t, i) => guionDelTurno(t, i, false))
    expect(dicho.map((d) => d.entrada !== null)).toEqual([true, false, false, false, false])
    expect(dicho.map((d) => d.bloque)).toEqual([
      MENSAJES_DE_BLOQUE.preciso.tu, null, MENSAJES_DE_BLOQUE.contexto.tu, null, null,
    ])
    expect(dicho[1].ejemplo).toBe('75 kilos, dos años, intermedio')
    expect(dicho[0].ejemplo).toBeNull()
    expect(guionDelTurno(TURNOS_VOZ[2], 2, true).bloque).toBe(MENSAJES_DE_BLOQUE.contexto.usted)
  })
})

describe('lo que la voz le pone al formulario', () => {
  it('solo entran campos de voz; un campo de salud o uno que no existe se ignora aunque llegue', () => {
    const v = valoresDeExtraccion({ ciudad: 'Cali', edad: 28, lesiones: 'Sí', parq_enfermedad_cardiaca: 'Sí', color_favorito: 'rojo', genero: 'Femenino', marcas_fuerza: '130 kilos' })
    expect(v).toEqual({ ciudad: 'Cali', edad: '28' })
  })

  it('un valor vacío no entra («no sé» deja el campo vacío)', () => {
    expect(valoresDeExtraccion({ ciudad: '   ', edad: '' })).toEqual({})
  })
})

describe('qué se pregunta y qué se cuenta', () => {
  it('el ciclo solo aplica a mujeres; ejercicios limitados y medicación, solo tras su sí', () => {
    const ids = (v: Valores) => camposVisibles(v).map((c) => c.id)
    expect(ids({})).not.toContain('solo_mujeres_ciclo')
    expect(ids({ genero: 'Femenino' })).toContain('solo_mujeres_ciclo')
    expect(ids({})).not.toContain('ejercicios_limitados')
    expect(ids({ parq_huesos_articulaciones: 'Sí' })).toContain('ejercicios_limitados')
    expect(aplica(campoPorId('medicacion')!, { parq_medicamento_presion: 'No' })).toBe(false)
  })

  it('cuenta los llenos contra los que se piden; el opcional no cuenta como faltante', () => {
    const vacio = contarLlenos({})
    expect(vacio.llenos).toBe(0)
    expect(vacio.total).toBeGreaterThan(20)
    const con = contarLlenos({ ciudad: 'Cali', edad: '  ', marcas_fuerza: '130 kilos' })
    expect(con.llenos).toBe(1) // la edad en blanco no cuenta y las marcas son opcionales
    expect(con.total).toBe(vacio.total)
  })

  it('los campos corregidos: los que cambian, y un número escrito distinto no es un cambio', () => {
    const antes: Valores = { ciudad: 'Cali', edad: '28', peso_actual_kg: '82', lesiones: 'Sí', [idDetalle('lesiones')]: 'rodilla' }
    const despues: Valores = { ciudad: 'Cali', edad: '29', peso_actual_kg: '82.0', lesiones: 'Sí', [idDetalle('lesiones')]: 'rodilla izquierda', altura_cm: '170' }
    expect(camposCorregidos(antes, despues).sort()).toEqual(['altura_cm', 'edad', 'lesiones'])
    expect(camposCorregidos(antes, antes)).toEqual([])
  })
})

describe('el siguiente toque', () => {
  it('va en orden, salta lo contestado y lo saltado, y devuelve null al terminar', () => {
    expect(siguienteToque(TOQUES_RAPIDOS, {})?.id).toBe('genero')
    expect(siguienteToque(TOQUES_RAPIDOS, { genero: 'Femenino' })?.id).toBe('pais')
    expect(siguienteToque(TOQUES_RAPIDOS, { genero: 'Femenino' }, new Set(['pais']))?.id).toBe('dias_por_semana')
    expect(siguienteToque(TOQUES_RAPIDOS, { genero: 'x', pais: 'x', dias_por_semana: '3', cadencia_revision: '8' })).toBeNull()
  })

  it('lo de salud que la voz dejó entrever va primero, sin saltarse una condición', () => {
    expect(siguienteToque(TOQUES_DE_SALUD, {})?.id).toBe('parq_enfermedad_cardiaca')
    const prioridad = ['lesiones', 'parq_huesos_articulaciones']
    expect(siguienteToque(TOQUES_DE_SALUD, {}, new Set(), prioridad)?.id).toBe('parq_huesos_articulaciones')
    expect(siguienteToque(TOQUES_DE_SALUD, { parq_huesos_articulaciones: 'No' }, new Set(), prioridad)?.id).toBe('lesiones')
    // «medicación» depende del PAR-Q de la presión: prioritario pero no aplica todavía, así que no se pregunta antes
    expect(siguienteToque(TOQUES_DE_SALUD, {}, new Set(), ['medicacion'])?.id).toBe('parq_enfermedad_cardiaca')
    expect(siguienteToque(['medicacion'], { parq_medicamento_presion: 'Sí' })?.id).toBe('medicacion')
  })

  it('el ciclo se pregunta solo a quien dijo ser mujer', () => {
    const todo = Object.fromEntries(TOQUES_DE_SALUD.filter((id) => id !== 'solo_mujeres_ciclo' && id !== 'ejercicios_limitados' && id !== 'medicacion').map((id) => [id, 'No']))
    expect(siguienteToque(TOQUES_DE_SALUD, { ...todo, genero: 'Masculino' })).toBeNull()
    expect(siguienteToque(TOQUES_DE_SALUD, { ...todo, genero: 'Femenino' })?.id).toBe('solo_mujeres_ciclo')
  })
})

describe('el cronómetro', () => {
  it('cuenta cada segmento y el total, y el total es la suma de las partes', () => {
    let c = iniciarCronometro('voz', 1_000)
    expect(c.segmento).toBe('preciso')
    c = pasarASegmento(c, 'contexto', 43_000) // preciso 42 s
    c = pasarASegmento(c, 'sino', 108_000) // contexto 65 s
    c = pasarASegmento(c, 'revision', 131_000) // sí o no 23 s
    c = detenerCronometro(c, 152_000) // revisión 21 s
    const t = tiempos(c, 999_999)
    expect(t.segmentosMs).toEqual({ preciso: 42_000, contexto: 65_000, sino: 23_000, revision: 21_000 })
    expect(t.totalMs).toBe(151_000)
    expect(Object.values(t.segmentosMs).reduce((a, b) => a + (b ?? 0), 0)).toBe(t.totalMs)
  })

  it('mientras corre, el tiempo sigue al reloj; después de parar, no', () => {
    const c = iniciarCronometro('escribir', 0)
    expect(tiempos(c, 5_000).totalMs).toBe(5_000)
    const parado = detenerCronometro(c, 7_000)
    expect(tiempos(parado, 60_000).totalMs).toBe(7_000)
    expect(detenerCronometro(parado, 90_000)).toBe(parado) // parar dos veces deja la primera hora
  })

  it('pasar al mismo segmento, o después de parar, no cambia nada', () => {
    const c = iniciarCronometro('voz', 0)
    expect(pasarASegmento(c, 'preciso', 10_000)).toBe(c)
    const parado = detenerCronometro(c, 20_000)
    expect(pasarASegmento(parado, 'revision', 30_000)).toBe(parado)
  })

  it('escribir tiene un solo segmento; voz, cuatro', () => {
    expect(SEGMENTOS_DE.escribir).toEqual(['escribir'])
    expect(SEGMENTOS_DE.voz).toEqual(['preciso', 'contexto', 'sino', 'revision'])
  })

  it('el formato: m:ss y con horas', () => {
    expect(formatoTiempo(0)).toBe('0:00')
    expect(formatoTiempo(42_400)).toBe('0:42')
    expect(formatoTiempo(151_000)).toBe('2:31')
    expect(formatoTiempo(3_723_000)).toBe('1:02:03')
  })
})

describe('el resultado y el texto que se copia', () => {
  const alLlegar: Valores = { ciudad: 'Zipaquirá', edad: '47', peso_actual_kg: '83.7', objetivo_principal: 'Pérdida de grasa', lesiones: 'Sí', [idDetalle('lesiones')]: 'meniscos de la rodilla izquierda' }
  const final: Valores = { ...alLlegar, ciudad: 'Zipaquirá, Cundinamarca', edad: '48', lesiones: 'No', [idDetalle('lesiones')]: '', parte_a_mejorar: 'barriga y espalda' }

  function voz(): ResultadoModo {
    let c = iniciarCronometro('voz', 0)
    c = pasarASegmento(c, 'contexto', 42_000)
    c = pasarASegmento(c, 'sino', 107_000)
    c = pasarASegmento(c, 'revision', 130_000)
    c = detenerCronometro(c, 151_000)
    return armarResultado({ cronometro: c, final, alLlegarALaRevision: alLlegar, turnos: { porVoz: 5, porTeclado: 0, repetidos: 1, detenidos: 0 } })
  }
  function escribir(): ResultadoModo {
    return armarResultado({ cronometro: detenerCronometro(iniciarCronometro('escribir', 0), 72_000), final })
  }

  it('cuenta lo que corrigió en la revisión: los campos por nombre y los de salud solo por número', () => {
    const r = voz()
    expect(r.totalMs).toBe(151_000)
    expect(r.corregidos?.etiquetas.sort()).toEqual(['Ciudad', 'Edad', 'Qué quiere mejorar'].sort())
    expect(r.corregidos?.deSalud).toBe(1)
    expect(escribir().corregidos).toBeNull()
  })

  it('el texto para copiar lleva tiempos y conteos', () => {
    const texto = textoParaCopiar({ voz: voz(), escribir: escribir() }, new Date(2026, 9, 3))
    expect(texto).toContain('Prueba de ingreso con Praxis · 3 oct 2026')
    expect(texto).toContain('HABLANDO · total 2:31 (preciso 0:42 · contexto 1:05 · sí o no y toques 0:23 · revisión 0:21)')
    expect(texto).toContain('ESCRIBIENDO · total 1:12')
    expect(texto).toContain('corrigió 4 en la revisión')
    expect(texto).toContain('1 de salud')
    expect(texto).toContain('COMPARACIÓN · escribiendo fue más rápido por 1:19 (2,1 veces')
  })

  it('NUNCA lleva un valor del formulario (ni lo escrito, ni lo dicho, ni el detalle de salud)', () => {
    const texto = textoParaCopiar({ voz: voz(), escribir: escribir() }, new Date(2026, 9, 3))
    for (const valor of Object.values({ ...alLlegar, ...final }).filter((v) => v.length > 3)) expect(texto, valor).not.toContain(valor)
    for (const secreto of ['Zipaquirá', 'Cundinamarca', 'meniscos', 'rodilla', 'barriga', '83.7', 'Pérdida de grasa']) expect(texto, secreto).not.toContain(secreto)
  })

  it('un modo solo no inventa la comparación', () => {
    expect(textoParaCopiar({ voz: voz(), escribir: null }, new Date(2026, 9, 3))).not.toContain('COMPARACIÓN')
    expect(textoParaCopiar({ voz: null, escribir: escribir() }, new Date(2026, 9, 3))).not.toContain('HABLANDO')
  })

  it('compara: quién fue más rápido, por cuánto y cuántas veces', () => {
    const c = comparar(voz(), escribir())
    expect(c.masRapido).toBe('escribir')
    expect(c.diferenciaMs).toBe(79_000)
    expect(c.veces).toBeCloseTo(151 / 72, 5)
  })
})
