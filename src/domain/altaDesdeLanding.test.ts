/**
 * El volcado de la encuesta de la landing a la ficha y al cribado (`alta-cliente`).
 *
 * Lo que se protege aquí es la regla de la 0058: «no se le preguntó» no es «no tiene».
 * Un texto libre que menciona algo clínico NO puede convertirse en `presente`, y un
 * campo vacío NO puede convertirse en `ausente`. Datos ficticios.
 */
import { describe, expect, it } from 'vitest'
import {
  cribadoDesdeEncuesta,
  edadA,
  fichaSeQuedaSinTocar,
  MEDIDAS_CERRADAS,
  perfilDesdeEncuesta,
  respuestasDe,
  siNo,
} from '../../supabase/functions/alta-cliente/desdeLanding.ts'
import { MEDIDA_POR_CLAVE } from './medidas'

const PARQ_TODO_NO = {
  parq_enfermedad_cardiaca: 'No',
  parq_dolor_pecho_actividad: 'No',
  parq_dolor_pecho_reposo: 'No',
  parq_mareo_conciencia: 'No',
  parq_huesos_articulaciones: 'No',
  parq_medicamento_presion: 'No',
  parq_otra_razon_medica: 'No',
}

describe('cribado desde la encuesta', () => {
  it('un PAR-Q todo en «No» da ausente/false solo en lo que la landing pregunta igual', () => {
    const c = cribadoDesdeEncuesta(PARQ_TODO_NO)!
    expect(c.fuente).toBe('encuesta')
    expect(c.parq_enfermedad_cardiaca).toBe(false)
    expect(c.parq_medicamento_presion).toBe(false)
    expect(c.parq_huesos_articulaciones).toBe(false)
    expect(c.sintomas_con_esfuerzo).toBe('ausente')
    // Lo que la landing no pregunta, no aparece: ni como clave.
    expect(c).not.toHaveProperty('quien_lo_lleva')
    expect(c).not.toHaveProperty('autorizacion_sanitaria')
    expect(c.diagnostico).toBeNull()
    expect(c.medicacion_cronica).toBeNull()
    expect(c.detalle).toEqual({})
  })

  it('un solo «Sí» de pecho o mareo pone síntomas presente, con el literal en detalle', () => {
    const c = cribadoDesdeEncuesta({ ...PARQ_TODO_NO, parq_mareo_conciencia: 'Sí' })!
    expect(c.sintomas_con_esfuerzo).toBe('presente')
    expect(c.detalle.sintomas_con_esfuerzo).toMatch(/mareo/)
  })

  it('síntomas a medias (uno «No» y dos sin contestar) se quedan sin poner', () => {
    const c = cribadoDesdeEncuesta({ parq_dolor_pecho_actividad: 'No', parq_enfermedad_cardiaca: 'No' })!
    expect(c.sintomas_con_esfuerzo).toBeNull()
  })

  it('el texto libre clínico va literal a detalle y NO decide el estado', () => {
    const c = cribadoDesdeEncuesta({
      ...PARQ_TODO_NO,
      enfermedades_diagnosticadas: 'Hipotiroidismo',
      medicamentos: 'Levotiroxina en ayunas',
    })!
    expect(c.diagnostico).toBeNull()
    expect(c.medicacion_cronica).toBeNull()
    expect(c.detalle.diagnostico).toContain('Hipotiroidismo')
    expect(c.detalle.medicacion_cronica).toContain('Levotiroxina')
  })

  it('una negación literal sí es un «no»; vacío no lo es', () => {
    const c = cribadoDesdeEncuesta({ ...PARQ_TODO_NO, enfermedades_diagnosticadas: 'Ninguna.', medicamentos: '  ' })!
    expect(c.diagnostico).toBe('ausente')
    expect(c.medicacion_cronica).toBeNull()
  })

  it('«otra razón médica» deja constancia pero no fija ningún campo', () => {
    const c = cribadoDesdeEncuesta({ ...PARQ_TODO_NO, parq_otra_razon_medica: 'Sí' })!
    expect(c.detalle.parq_otra_razon_medica).toBeTruthy()
    expect(c).not.toHaveProperty('que_le_han_dicho_que_no_haga')
  })

  it('huesos «Sí» lleva el texto de lesiones como detalle (la app lo exige)', () => {
    const c = cribadoDesdeEncuesta({ ...PARQ_TODO_NO, parq_huesos_articulaciones: 'Sí', lesiones: 'Esguince de tobillo' })!
    expect(c.parq_huesos_articulaciones).toBe(true)
    expect(c.detalle.parq_huesos_articulaciones).toContain('Esguince')
  })

  it('una encuesta sin nada de salud no deja fila (la app creería que ya contestó)', () => {
    expect(cribadoDesdeEncuesta({ ciudad: 'Cali' })).toBeNull()
  })

  it('siNo no adivina', () => {
    expect(siNo('Sí')).toBe(true)
    expect(siNo('no')).toBe(false)
    expect(siNo('Prefiero no decirlo')).toBeNull()
    expect(siNo(undefined)).toBeNull()
  })
})

describe('ficha desde la encuesta', () => {
  const a = {
    fecha_nacimiento: '1996-05-20',
    altura_cm: '168',
    peso_actual_kg: 64.5,
    fecha_medidas: '2026-10-30',
    medida_cuello_cm: 33,
    medida_cintura_natural_cm: 70,
    medida_cintura_ombligo_cm: 76,
    medida_cadera_cm: 92,
    medida_gluteo_cm: 98,
    medida_clavicular_cm: 36,
    medida_hombros_cm: 105,
    medida_pecho_cm: 90,
    dias_por_semana: 4,
    tiempo_por_sesion: '75 minutos',
    objetivo_principal: 'Ganar masa muscular',
    objetivo_detalle: 'Sobre todo tren inferior',
    somatotipo_autopercibido: 'Mesomorfo — punto medio.',
  }

  it('traduce lo que tiene el mismo sentido en la app', () => {
    const p = perfilDesdeEncuesta('u1', a, '2026-11-04')
    expect(p.usuarioId).toBe('u1')
    expect(p.edad).toBe(30)
    expect(p.diasEntrenamiento).toBe(4)
    expect(p.tiempoSesionMin).toBe(75)
    expect(p.objetivos).toBe('Ganar masa muscular — Sobre todo tren inferior')
    const [m] = p.medidas
    expect(m.fecha).toBe('2026-10-30')
    expect(m.alturaCm).toBe(168)
    expect(m.pesoKg).toBe(64.5)
    expect(m.cuerpo).toEqual({ cuelloCm: 33, cinturaCm: 70, caderasCm: 98, anchoClavicularCm: 36 })
    expect(m.perimetros).toMatchObject({ 'Cintura al ombligo': 76, 'Cadera ósea': 92, Pecho: 90 })
  })

  it('no mete hombros (no se sabe si es contorno o anchura) ni el somatotipo autopercibido', () => {
    const p = perfilDesdeEncuesta('u1', a, '2026-11-04')
    expect(JSON.stringify(p.medidas)).not.toContain('105')
    expect(p.somatotipo).toBe('')
    expect(p).not.toHaveProperty('sexo')
  })

  it('lo que falta o no cuadra queda con el neutro de perfilVacio', () => {
    const p = perfilDesdeEncuesta('u1', { dias_por_semana: 9, altura_cm: 'alto', tiempo_por_sesion: '90 minutos o más' }, '2026-11-04')
    expect(p.diasEntrenamiento).toBe(0)
    expect(p.medidas).toEqual([])
    expect(p.edad).toBe(0)
    expect(p.objetivos).toBe('')
    expect(p.tiempoSesionMin).toBe(90)
  })

  it('una fecha de medidas futura se cambia por hoy', () => {
    const p = perfilDesdeEncuesta('u1', { altura_cm: 170, fecha_medidas: '2027-01-01' }, '2026-11-04')
    expect(p.medidas[0].fecha).toBe('2026-11-04')
  })

  it('la edad cuenta el cumpleaños', () => {
    expect(edadA('2000-11-05', '2026-11-04')).toBe(25)
    expect(edadA('2000-11-04', '2026-11-04')).toBe(26)
    expect(edadA('20/11/2000', '2026-11-04')).toBe(0)
  })

  it('los rangos de las medidas cerradas son los de la app', () => {
    for (const [clave, def] of Object.entries(MEDIDAS_CERRADAS)) {
      const app = MEDIDA_POR_CLAVE[clave as keyof typeof MEDIDA_POR_CLAVE]
      expect(app, clave).toBeDefined()
      expect([def.minimo, def.maximo], clave).toEqual([app.minimo, app.maximo])
    }
  })
})

describe('idempotencia y forma de entrada', () => {
  it('solo se escribe sobre una ficha inexistente o vacía', () => {
    expect(fichaSeQuedaSinTocar(null)).toBe(false)
    expect(fichaSeQuedaSinTocar({ usuarioId: 'u1', medidas: [] })).toBe(false)
    expect(fichaSeQuedaSinTocar({ usuarioId: 'u1', medidas: [{ fecha: '2026-11-01' }] })).toBe(true)
    expect(fichaSeQuedaSinTocar({ usuarioId: 'u1', objetivos: 'x', medidas: [] })).toBe(true)
  })

  it('acepta las respuestas sueltas o envueltas', () => {
    const r = { altura_cm: 170 }
    expect(respuestasDe(r)).toBe(r)
    expect(respuestasDe({ answers: r })).toBe(r)
    expect(respuestasDe({ client_intake: { answers: r } })).toBe(r)
    expect(respuestasDe('texto')).toBeNull()
    expect(respuestasDe([1])).toBeNull()
  })
})
