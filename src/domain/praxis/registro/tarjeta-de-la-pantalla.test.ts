// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { construirTarjeta } from './tarjeta.ts'
import type { Propuesta, RegistroPropuesto, RegistroSeries } from './tipos.ts'

/**
 * La tarjeta es lo ÚNICO que la persona lee antes de tocar «Guardar» en la pantalla de
 * Praxis. Si una línea calla algo —que es por mano, que reemplaza una serie, que es una
 * copia de la pauta—, la persona confirma una cosa distinta de la que se va a escribir.
 *
 * Estas pruebas arman la propuesta a mano, sin el modelo: cubren cada clase de registro que
 * el registrador puede proponer, que el corpus grabado no recorre entero.
 */
const propuesta = (registros: RegistroPropuesto[], extra: Partial<Propuesta> = {}): Propuesta => ({
  accion: 'tarjeta', registros, descartado: [], notas_coach: [], citas_invalidas: [], ...extra,
})
const series = (o: Partial<RegistroSeries> = {}): RegistroSeries => ({
  campo: 'series', ejercicio_id: 'e1', ejercicio_nombre: 'CURL MARTILLO', sesion_id: 's1',
  valor: [{ orden: 1, cargaKg: 12, reps: 10 }], unidad: 'kg', confianza: 'alta', avisos: [], ...o,
})
const textos = (p: Propuesta) => construirTarjeta(p, 'm1').lineas.map((l) => l.texto)

describe('la tarjeta dice CÓMO se cuenta la carga', () => {
  it('por mano y por lado se leen en la línea', () => {
    expect(textos(propuesta([series({ unidad: 'por_mano' })]))).toEqual(['CURL MARTILLO · serie 1 · 12 kg por mano × 10'])
    expect(textos(propuesta([series({ unidad: 'por_lado' })]))).toEqual(['CURL MARTILLO · serie 1 · 12 kg por lado × 10'])
  })

  it('una banda no lleva kilos: dice cuál, o al menos que es banda', () => {
    expect(textos(propuesta([series({ unidad: 'banda', detalle: 'banda roja' })]))).toEqual(['CURL MARTILLO · serie 1 · con banda roja × 10'])
    expect(textos(propuesta([series({ unidad: 'banda' })]))).toEqual(['CURL MARTILLO · serie 1 · con banda × 10'])
  })

  it('el peso corporal se dice, con el lastre si lo hay', () => {
    expect(textos(propuesta([series({ unidad: 'corporal', valor: [{ orden: 1, cargaKg: 0, reps: 8 }] })]))).toEqual(['CURL MARTILLO · serie 1 · peso corporal × 8'])
    expect(textos(propuesta([series({ unidad: 'corporal', valor: [{ orden: 1, cargaKg: 10, reps: 8 }] })]))).toEqual(['CURL MARTILLO · serie 1 · peso corporal +10 kg de lastre × 8'])
  })

  it('sin repeticiones dichas, no se inventa un «× n»', () => {
    expect(textos(propuesta([series({ valor: [{ orden: 2, cargaKg: 12 }] })]))).toEqual(['CURL MARTILLO · serie 2 · 12 kg'])
  })

  it('el RIR y los bloques extra de una técnica se ven', () => {
    const t = textos(propuesta([series({ valor: [{ orden: 1, cargaKg: 12, reps: 10, rir: 1, extra: [{ reps: 4, cargaKg: 8 }] }] })]))
    expect(t).toEqual(['CURL MARTILLO · serie 1 · 12 kg × 10 · RIR 1 + 4 × 8 kg (extra, no cuenta como serie)'])
  })
})

describe('la tarjeta dice DE DÓNDE sale cada dato', () => {
  it.each([
    ['copiado_de_pauta', 'copiado de tu pauta'],
    ['copiado_de_semana_anterior', 'copiado de la semana pasada'],
    ['copiado_de_serie_anterior', 'igual que la serie anterior'],
  ] as const)('%s se marca como copia', (origen, texto) => {
    expect(construirTarjeta(propuesta([series({ origen })]), 'm1').lineas[0].origen).toBe(texto)
  })

  it('lo que la persona dictó no lleva marca de copia', () => {
    expect(construirTarjeta(propuesta([series()]), 'm1').lineas[0].origen).toBeUndefined()
  })

  it('un reemplazo se ve como reemplazo, con el antes y el después', () => {
    const conReps = construirTarjeta(propuesta([series({ valor: [{ orden: 1, cargaKg: 14, reps: 8 }], reemplaza: { orden: 1, antes: { cargaKg: 12, reps: 10 } } })]), 'm1')
    expect(conReps.lineas[0].detalle).toBe('Reemplaza la serie 1: 12 × 10 → 14 × 8')
    const sinReps = construirTarjeta(propuesta([series({ valor: [{ orden: 1, cargaKg: 14 }], reemplaza: { orden: 1, antes: { cargaKg: 12 } } })]), 'm1')
    expect(sinReps.lineas[0].detalle).toBe('Reemplaza la serie 1: 12 → 14')
  })

  it('el desglose de discos y lo estimado van en el detalle', () => {
    const t = construirTarjeta(propuesta([series({ desglose: '20 + 40 = 60 kg', confianza: 'baja' })]), 'm1')
    expect(t.lineas[0].detalle).toBe('20 + 40 = 60 kg · Estimado: revísalo antes de guardar')
  })

  it('avisa cuántas series quedan, y cuándo el ejercicio queda completo', () => {
    expect(construirTarjeta(propuesta([series({ quedan: 1 })]), 'm1').avisos).toContain('Queda 1 serie de CURL MARTILLO')
    expect(construirTarjeta(propuesta([series({ quedan: 0 })]), 'm1').avisos).toContain('CURL MARTILLO queda completo')
  })
})

describe('la tarjeta de lo que no es una serie', () => {
  it('el check-in dice el campo en palabras, y el antes si lo había', () => {
    const t = construirTarjeta(propuesta([{
      campo: 'checkin', fecha: '2026-10-01', parche: { horasSueno: 6.5, calidadSueno: 'MALA', campoNuevo: 'x' },
      confianza_por_campo: { horasSueno: 'alta', calidadSueno: 'media' }, antes: { horasSueno: 8, calidadSueno: null },
    }]), 'm1')
    expect(t.lineas.map((l) => l.texto)).toEqual(['Horas de sueño: 6,5', 'Calidad del sueño: MALA', 'campoNuevo: x'])
    expect(t.lineas[0].detalle).toBe('antes 8, ahora 6.5')
    expect(t.lineas[1].detalle).toBeUndefined()
    expect(t.lineas[0].confianza).toBe('alta')
  })

  it('un dato de hoy dicho de noche avisa que queda para el check-in de mañana', () => {
    const t = construirTarjeta(propuesta([{ campo: 'checkin', fecha: '2026-10-02', parche: { pasos: 9000 }, confianza_por_campo: { pasos: 'alta' }, diferido: true }]), 'm1')
    expect(t.lineas[0]).toMatchObject({ texto: 'Pasos: 9000', detalle: 'Se lo dijiste a Praxis hoy; queda para tu check-in de mañana' })
  })

  it('la duración y el esfuerzo de la sesión', () => {
    const t = textos(propuesta([
      { campo: 'testPost.rpeSesion', sesion_id: 's1', valor: 8, unidad: 'rpe', confianza: 'alta' },
      { campo: 'testPost.duracionMin', sesion_id: 's1', valor: 55, unidad: 'min', confianza: 'media', fuente: 'dicho' },
    ]))
    expect(t).toEqual(['Esfuerzo de la sesión: 8 (escala 6-10)', 'Duración de la sesión: 55 min'])
  })

  it.each([['si', 'sí'], ['parcial', 'en parte'], ['no', 'no']] as const)('la adherencia «%s» se lee «%s»', (estado, leido) => {
    expect(textos(propuesta([{ campo: 'adherencia', fecha: '2026-10-01', estado, confianza: 'alta' }]))).toEqual([`Seguiste el plan: ${leido}`])
  })

  it('el agua, el cardio y la preparación', () => {
    const t = construirTarjeta(propuesta([
      { campo: 'hidratacion', fecha: '2026-10-01', delta_ml: 500, confianza: 'alta', detalle: '2 vasos' },
      { campo: 'bloquesCardio[c1].duracionRealMin', sesion_id: 's1', bloque_id: 'c1', bloque_nombre: 'Caminata', valor: 20, unidad: 'min', confianza: 'alta' },
      { campo: 'preparacion[p1].hechoEn', sesion_id: 's1', parte_id: 'p1', parte_nombre: 'Movilidad de cadera', valor: '2026-10-01T10:00:00-05:00', unidad: 'iso', confianza: 'alta' },
    ]), 'm1')
    expect(t.lineas.map((l) => l.texto)).toEqual(['Agua: +500 mL', 'Caminata: 20 min', 'Movilidad de cadera: hecha'])
    expect(t.lineas[0].detalle).toBe('2 vasos')
    expect(t.lineas[2].editable).toBe(false)
  })

  it('la comida: gramos con su medida y su fuente, y lo que no tiene cantidad lo dice', () => {
    const t = construirTarjeta(propuesta([{
      campo: 'comida', comida: 'almuerzo', fecha: '2026-10-01', confianza_registro: 'estimado', aceite_g: 5, sal_g: null,
      items: [
        { alimento: 'arroz blanco', gramos: 150, medida_nombre: 'taza', medida_cantidad: 1, estado_asumido: 'cocido', fuente_medida: 'TCAC 2018', confianza: 'media', editable: true, nota: 'cocido' },
        { alimento: 'pollo', gramos: 120, medida_nombre: null, medida_cantidad: null, estado_asumido: null, fuente_medida: null, confianza: 'alta', editable: true },
        { alimento: 'ensalada', gramos: null, medida_nombre: null, medida_cantidad: null, estado_asumido: null, fuente_medida: null, confianza: 'baja', editable: true },
      ],
    }]), 'm1')
    expect(t.titulo).toBe('Comida (almuerzo)')
    expect(t.lineas.map((l) => l.texto)).toEqual(['arroz blanco: 1 taza ≈ 150 g', 'pollo: 120 g', 'ensalada: sin cantidad', 'Aceite: 5 g', 'Sal: sin cantidad'])
    expect(t.lineas[0].detalle).toBe('Fuente: TCAC 2018 · cocido')
    expect(t.lineas[1].detalle).toBeUndefined()
  })

  it('un campo que la tarjeta no conoce no pinta una línea vacía', () => {
    const raro = { campo: 'bloquesCardio[c1].duracionRealMin', sesion_id: 's1' } as unknown as RegistroPropuesto
    expect(construirTarjeta(propuesta([raro]), 'm1').lineas).toEqual([])
    const sinNombre = { campo: 'preparacion[p1].hechoEn', sesion_id: 's1' } as unknown as RegistroPropuesto
    expect(construirTarjeta(propuesta([sinNombre]), 'm1').lineas).toEqual([])
    const desconocido = { campo: 'otra_cosa' } as unknown as RegistroPropuesto
    expect(construirTarjeta(propuesta([desconocido]), 'm1').lineas).toEqual([])
  })
})

describe('la tarjeta según lo que hay que hacer', () => {
  it('con registros es guardable; sin ninguno, no', () => {
    expect(construirTarjeta(propuesta([series()]), 'm1').guardable).toBe(true)
    const vacia = construirTarjeta(propuesta([]), 'm1')
    expect(vacia.guardable).toBe(false)
    expect(vacia.titulo).toBe('Esto entendí')
  })

  it('si hay que sellar la fecha de otra sesión, el botón lo dice', () => {
    const t = construirTarjeta(propuesta([series()], { requiere_confirmacion_de_sesion: true, fecha_real: '2026-09-29' }), 'm1')
    expect(t.requiereConfirmarSesion).toBe(true)
    expect(t.botones[0]).toMatchObject({ id: 'guardar', texto: 'Sí, anótalo ahí', confirma_sesion: true })
    expect(t.avisos).toContain('Fecha del registro: martes 29-sep')
  })

  it('una duda que no bloquea viaja como seguimiento', () => {
    const t = construirTarjeta(propuesta([series()], { seguimiento: { texto: '¿Y el RIR?', opciones: ['1', '2'], campo_bloqueante: 'rir' } }), 'm1')
    expect(t.seguimiento).toEqual({ texto: '¿Y el RIR?', opciones: ['1', '2'] })
    expect(construirTarjeta(propuesta([series()]), 'm1').seguimiento).toBeUndefined()
  })

  it('una pregunta ofrece como mucho tres opciones, «Otro» y «Descartar»', () => {
    const t = construirTarjeta(propuesta([], { accion: 'preguntar', pregunta: { texto: '¿Cuál remo?', opciones: ['A', 'B', 'C', 'D'], campo_bloqueante: 'ejercicio' } }), 'm1')
    expect(t.tipo).toBe('pregunta')
    expect(t.botones.map((b) => b.texto)).toEqual(['A', 'B', 'C', 'Otro', 'Descartar'])
    expect(t.guardable).toBe(false)
  })

  it('una pregunta abierta no ofrece «Otro»', () => {
    const t = construirTarjeta(propuesta([], { accion: 'preguntar', pregunta: { texto: '¿Cuánto fue?', opciones: [], campo_bloqueante: 'carga' } }), 'm1')
    expect(t.botones.map((b) => b.id)).toEqual(['descartar'])
  })

  it('«nada que guardar» lo dice, y enseña lo que oyó y no guarda', () => {
    const t = construirTarjeta(propuesta([], { accion: 'nada', motivo: 'charla', respuesta: 'De eso no hablo.', aviso: 'ojo', descartado: [{ cita: 'calenté con 20', motivo: 'calentamiento' }] }), 'm1')
    expect(t).toMatchObject({ tipo: 'informativa', mensaje: 'De eso no hablo.', guardable: false, botones: [], avisos: ['ojo'], descartado: ['calenté con 20: calentamiento'] })
  })

  it('una derivación nunca es guardable, y en crisis no ofrece ni el formulario', () => {
    const dolor = construirTarjeta(propuesta([], { accion: 'derivar', motivo: 'clinico', filtro: 'dolor', respuesta: 'x' }), 'm1')
    expect(dolor).toMatchObject({ tipo: 'derivacion', guardable: false })
    expect(dolor.botones.map((b) => b.id)).toEqual(['abrir_formulario'])
    for (const filtro of ['crisis', 'conducta_alimentaria', 'animo'] as const) {
      expect(construirTarjeta(propuesta([], { accion: 'derivar', motivo: 'clinico', filtro }), 'm1').botones).toEqual([])
    }
  })
})
