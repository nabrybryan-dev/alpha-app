import { describe, expect, it } from 'vitest'
import { CAMPOS_INGRESO, camposDeSalud, campoPorId } from './guion.ts'
import { normalizarTexto } from '../registro/numeros.ts'
import {
  PISTAS_DE_OPCION, PROMPT_SISTEMA_INGRESO, alturaDeCita, citaSostieneOpcion, citaTraeContenido, numeroHablado, armarMensajeIngreso, juntarTurnos, leerSalidaIngreso, marcarSaludPorDiccionario,
  validarIngreso,
} from './extraer.ts'

const campo = (cita: string, opcion: string | null = null) => ({ cita, opcion })
const crudo = (campos: Record<string, unknown>, salud: unknown[] = []) => ({ campos, salud })

const SOBRE_TI = 'Pues soy de Cali, eh, tengo treinta y un años y mido uno sesenta y seis, peso como 55 y medio'

describe('validarIngreso: las citas', () => {
  it('una cita literal pasa, y el número lo convierte el código', () => {
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo({
      ciudad: campo('Cali'), edad: campo('treinta y un años'), altura_cm: campo('uno sesenta y seis'), peso_actual_kg: campo('como 55 y medio'),
    }))
    expect(r.campos.ciudad?.valor).toBe('Cali')
    expect(r.campos.edad?.valor).toBe(31)
    expect(r.campos.altura_cm?.valor).toBe(166)
    expect(r.campos.peso_actual_kg?.valor).toBe(55.5)
    expect(r.descartados).toEqual([])
  })

  it('una cita que NO está en lo dicho se descarta: el campo queda vacío', () => {
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo({ ciudad: campo('Medellín'), edad: campo('treinta y dos años') }))
    expect(r.campos.ciudad).toBeUndefined()
    expect(r.campos.edad).toBeUndefined()
    expect(r.descartados.map((d) => `${d.campo}:${d.motivo}`)).toEqual(['ciudad:cita_invalida', 'edad:cita_invalida'])
  })

  it('un campo sin cita se descarta aunque traiga valor', () => {
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo({ edad: { cita: null, opcion: null, valor: 31 }, ciudad: { cita: '   ' } }))
    expect(Object.keys(r.campos)).toEqual([])
    expect(r.descartados.every((d) => d.motivo === 'sin_cita')).toBe(true)
  })

  it('tildes y mayúsculas distintas no rompen una cita legítima', () => {
    const r = validarIngreso('sobre_ti', 'Soy de BOGOTÁ y tengo 30 años', crudo({ ciudad: campo('Bogota') }))
    expect(r.campos.ciudad?.valor).toBe('Bogota')
  })

  it('una opción fuera de la lista se descarta; una válida vuelve con la etiqueta canónica', () => {
    const t = 'Quiero bajar de grasa y verme mejor'
    const mala = validarIngreso('objetivo', t, crudo({ objetivo_principal: campo('bajar de grasa', 'Bajar de peso') }))
    expect(mala.campos.objetivo_principal).toBeUndefined()
    expect(mala.descartados[0]?.motivo).toBe('opcion_invalida')
    const buena = validarIngreso('objetivo', t, crudo({ objetivo_principal: campo('bajar de grasa', 'pérdida de grasa') }))
    expect(buena.campos.objetivo_principal?.valor).toBe('Pérdida de grasa')
  })

  it('una opción con cita inventada no pasa aunque la opción exista', () => {
    const r = validarIngreso('objetivo', 'Quiero bajar de grasa', crudo({ objetivo_principal: campo('quiero ganar músculo', 'Hipertrofia / estética') }))
    expect(r.campos.objetivo_principal).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('cita_invalida')
  })

  it('dos cifras en una cita no se adivinan; fuera de rango tampoco', () => {
    const dos = validarIngreso('objetivo', 'Peso 80 y quiero llegar a 70', crudo({ peso_objetivo_kg: campo('80 y quiero llegar a 70') }))
    expect(dos.campos.peso_objetivo_kg).toBeUndefined()
    expect(dos.descartados[0]?.motivo).toBe('numero_ambiguo')
    const rango = validarIngreso('sobre_ti', 'tengo 250 años', crudo({ edad: campo('250 años') }))
    expect(rango.campos.edad).toBeUndefined()
    expect(rango.descartados[0]?.motivo).toBe('fuera_de_rango')
  })

  it('un campo de otro turno o desconocido se descarta', () => {
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo({ tipo_trabajo: campo('Cali', 'teletrabajo'), color_favorito: campo('Cali') }))
    expect(r.descartados.map((d) => d.motivo)).toEqual(['fuera_de_turno', 'desconocido'])
  })

  it('la salida basura nunca lanza y no llena nada', () => {
    for (const malo of [null, undefined, 'hola', 42, [], { campos: 'x' }, { campos: [1], salud: 'x' }]) {
      const r = validarIngreso('sobre_ti', SOBRE_TI, malo)
      expect(r.campos).toEqual({})
    }
  })
})

describe('validarIngreso: la salud no se rellena desde la voz', () => {
  const TEXTO = 'Entreno hace dos años pero me duele la rodilla izquierda y tomo enalapril'

  it('cada campo de salud que el modelo intente llenar se descarta, aunque la cita sea literal', () => {
    for (const c of camposDeSalud()) {
      const r = validarIngreso('historia_entreno', TEXTO, crudo({ [c.id]: { cita: 'me duele la rodilla izquierda', opcion: 'Sí' } }))
      expect(r.campos[c.id], c.id).toBeUndefined()
      expect(Object.keys(r.campos), c.id).toEqual([])
      expect(r.descartados[0], c.id).toMatchObject({ campo: c.id, motivo: 'salud' })
    }
  })

  it('lo que el modelo quiso poner como lesión queda como MARCA y como pregunta de toque, no como valor', () => {
    const r = validarIngreso('historia_entreno', TEXTO, crudo({ lesiones: { cita: 'me duele la rodilla izquierda', opcion: 'Sí' } }))
    expect(r.salud.some((m) => m.tema === 'lesion' && m.origen === 'modelo')).toBe(true)
    expect(r.toques).toContain('lesiones')
    expect(r.toques).toContain('parq_huesos_articulaciones')
  })

  it('el diccionario marca la salud aunque el modelo no la vea', () => {
    const r = validarIngreso('historia_entreno', TEXTO, crudo({ tiempo_entrenando: campo('hace dos años', '1 a 2 años') }))
    const temas = r.salud.map((m) => m.tema)
    expect(temas).toContain('dolor')
    expect(temas).toContain('medicacion')
    expect(r.salud.every((m) => m.origen === 'diccionario')).toBe(true)
    expect(r.toques).toEqual(expect.arrayContaining(['lesiones', 'medicacion', 'parq_medicamento_presion']))
    // y lo no clínico del mismo turno sí se llena
    expect(r.campos.tiempo_entrenando?.valor).toBe('1 a 2 años')
  })

  it('un texto libre con dolor o lesión no se guarda en el campo: se marca', () => {
    const t = 'Quiero fortalecer piernas, pero me pincha horrible la rodilla derecha al bajar escaleras'
    const r = validarIngreso('objetivo', t, crudo({ parte_a_mejorar: campo('me pincha horrible la rodilla derecha al bajar escaleras') }))
    expect(r.campos.parte_a_mejorar).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('texto_clinico')
    expect(r.toques).toContain('lesiones')
    // el tramo sin salud sí pasa
    const ok = validarIngreso('objetivo', t, crudo({ parte_a_mejorar: campo('fortalecer piernas') }))
    expect(ok.campos.parte_a_mejorar?.valor).toBe('fortalecer piernas')
  })

  it('una cita de salud inventada por el modelo en "salud" no vale', () => {
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo({}, [{ tema: 'cardiaco', cita: 'tengo problemas del corazón' }]))
    expect(r.salud).toEqual([])
    expect(r.toques).toEqual([])
  })

  it('decir que no hay dolor NO dispara la marca', () => {
    const r = validarIngreso('historia_entreno', 'Llevo un año entrenando, sin ninguna molestia', crudo({}))
    expect(r.salud).toEqual([])
  })

  it('crisis o síntoma urgente suben la urgencia para que la pantalla aplique su flujo de riesgo', () => {
    const r = validarIngreso('objetivo', 'a veces me falta el aire cuando subo escaleras', crudo({}))
    expect(r.urgencia).toBe('alta')
    expect(marcarSaludPorDiccionario('hola').urgencia).toBeNull()
  })

  it('invariante: ningún campo de salud llega jamás al formulario, hable de lo que hable el modelo', () => {
    const ids = CAMPOS_INGRESO.map((c) => c.id)
    const todos = Object.fromEntries(ids.map((id) => [id, { cita: 'Cali', opcion: 'Sí' }]))
    const r = validarIngreso('sobre_ti', SOBRE_TI, crudo(todos))
    const f = juntarTurnos([r])
    for (const c of camposDeSalud()) expect(f.valores[c.id], c.id).toBeUndefined()
  })
})

describe('alturaDeCita', () => {
  it.each([
    ['1,66', 166], ['1.75', 175], ['uno sesenta y seis', 166], ['uno setenta', 170], ['metro setenta y cinco', 175],
    ['1 con 66', 166], ['166 centímetros', 166], ['180', 180],
  ])('%s => %s', (cita, esperado) => {
    expect(alturaDeCita(cita)).toBe(esperado)
  })
})

describe('numeroHablado: decimales dichos y rangos que no se suman', () => {
  it.each([
    ['cuarenta y dos punto nueve kilos', 42.9], ['sesenta y seis, ocho kilos', 66.8], ['42,9', 42.9], ['como 72', 72],
    ['cincuenta y cinco punto cinco', 55.5], ['sesenta coma cinco', 60.5], ['treinta y un años', 31], ['como 55 y medio', 55.5],
  ])('%s => %s', (cita, esperado) => {
    expect(numeroHablado(cita)).toEqual({ valor: esperado })
  })
  it.each([
    ['cincuenta y seis, cincuenta y siete kilos'], // un rango: la suma daba 113
    ['sesenta y tres, treinta y cuatro kilos'],
    ['80 y quiero llegar a 70'],
    ['entre 70, 72 y 75'],
  ])('%s es ambiguo y no se adivina', (cita) => {
    expect(numeroHablado(cita)).toEqual({ motivo: 'numero_ambiguo' })
  })
  it('sin cifra es ilegible', () => {
    expect(numeroHablado('bastante')).toEqual({ motivo: 'numero_ilegible' })
  })
  it('validarIngreso no deja pasar la suma de un rango', () => {
    const t = 'peso como cincuenta y seis, cincuenta y siete kilos'
    const r = validarIngreso('sobre_ti', t, { campos: { peso_actual_kg: { cita: 'cincuenta y seis, cincuenta y siete kilos', opcion: null } } })
    expect(r.campos.peso_actual_kg).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('numero_ambiguo')
  })
})

describe('apoyo de las opciones: el modelo no puede deducir lo que no se dijo', () => {
  it('cada opción de los campos con pistas se sostiene con sus propias palabras', () => {
    for (const [nombre, mapa] of Object.entries(PISTAS_DE_OPCION)) {
      const def = campoPorId(nombre)
      expect(Object.keys(mapa).sort(), nombre).toEqual([...(def?.opciones ?? [])].sort())
      for (const [opcion, re] of Object.entries(mapa)) {
        // la etiqueta de la opción, dicha tal cual, tiene que bastar para sostenerla (el tiempo se dice con números)
        expect(re.test(normalizarTexto(opcion)) || nombre === 'tiempo_entrenando', `${nombre}/${opcion}`).toBe(true)
      }
    }
  })
  it('una opción deducida de otra cosa se descarta y el campo queda vacío', () => {
    const t = 'Quiero trabajar bastante la espalda, o sea, la postura principalmente'
    const r = validarIngreso('objetivo', t, crudo({ objetivo_principal: campo('trabajar bastante la espalda, o sea, la postura', 'Salud general') }))
    expect(r.campos.objetivo_principal).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('opcion_sin_apoyo')
    const nivel = validarIngreso('historia_entreno', 'voy bien ahí, progresando poco a poco', crudo({ nivel_fuerza: campo('voy bien ahí, progresando', 'Intermedio') }))
    expect(nivel.campos.nivel_fuerza).toBeUndefined()
  })
  it('una opción que la persona sí dijo con otras palabras pasa', () => {
    expect(citaSostieneOpcion('nivel_fuerza', 'Intermedio', 'Me veo en un nivel medio')).toBe(true)
    expect(citaSostieneOpcion('nivel_fuerza', 'Intermedio', 'no soy principiante total pero tampoco avanzado, un término medio')).toBe(true)
    expect(citaSostieneOpcion('tipo_trabajo', 'teletrabajo', 'trabajo desde la casa')).toBe(true)
    expect(citaSostieneOpcion('objetivo_principal', 'Pérdida de grasa', 'quiero bajar de peso')).toBe(true)
    expect(citaSostieneOpcion('campo_sin_pistas', 'x', 'lo que sea')).toBe(true)
  })
})

describe('citas vacías y tiempos vagos', () => {
  it('«soy de…» sin ciudad no es una ciudad', () => {
    expect(citaTraeContenido('soy de')).toBe(false)
    expect(citaTraeContenido('Cali')).toBe(true)
    const r = validarIngreso('sobre_ti', 'tengo treinta años, soy de... bueno, mido uno sesenta', crudo({ ciudad: campo('soy de') }))
    expect(r.campos.ciudad).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('texto_sin_contenido')
  })
  it('«poco tiempo» no elige un rango de entreno; «seis meses» sí', () => {
    const vago = validarIngreso('historia_entreno', 'llevo poco tiempo, apenas estoy empezando', crudo({ tiempo_entrenando: campo('llevo poco tiempo, apenas estoy empezando', 'Menos de 6 meses') }))
    expect(vago.campos.tiempo_entrenando).toBeUndefined()
    expect(vago.descartados[0]?.motivo).toBe('opcion_sin_apoyo')
    for (const [dicho, opcion] of [['llevo seis meses', '6 meses a 1 año'], ['desde hace un año', '1 a 2 años'], ['entre dos y tres años', '2 a 3 años'], ['unas semanas', 'Menos de 6 meses'], ['toda la vida', 'Más de 3 años ininterrumpidos']] as const) {
      const r = validarIngreso('historia_entreno', dicho, crudo({ tiempo_entrenando: campo(dicho, opcion) }))
      expect(r.campos.tiempo_entrenando?.valor, dicho).toBe(opcion)
    }
  })
})

describe('un récord de gimnasio no es el peso corporal', () => {
  it('la cifra pegada a «récord» o a un ejercicio se descarta', () => {
    const t = 'quiero romper mi récord personal que tengo de ciento setenta y uno kilos en peso muerto'
    const r = validarIngreso('objetivo', t, crudo({ peso_objetivo_kg: campo('ciento setenta y uno kilos') }))
    expect(r.campos.peso_objetivo_kg).toBeUndefined()
    expect(r.descartados[0]?.motivo).toBe('contexto_de_levantamiento')
  })
  it('un peso corporal normal pasa aunque más adelante hable de ejercicios', () => {
    const t = 'quiero llegar a setenta y cinco kilos, y en sentadilla ando por cien'
    const r = validarIngreso('objetivo', t, crudo({ peso_objetivo_kg: campo('setenta y cinco kilos') }))
    expect(r.campos.peso_objetivo_kg?.valor).toBe(75)
  })
})

describe('prompt y mensaje', () => {
  it('el prompt exige citas literales, lo no dicho vacío y la salud aparte', () => {
    expect(PROMPT_SISTEMA_INGRESO).toMatch(/CITAS LITERALES/)
    expect(PROMPT_SISTEMA_INGRESO).toMatch(/LO NO DICHO SE QUEDA FUERA/)
    expect(PROMPT_SISTEMA_INGRESO).toMatch(/SALUD, NUNCA EN UN CAMPO/)
  })
  it('el mensaje lista solo los campos del turno, con sus opciones', () => {
    const m = armarMensajeIngreso('trabajo_horarios', 'trabajo en una obra')
    expect(m).toContain('tipo_trabajo')
    expect(m).toContain('«teletrabajo»')
    expect(m).not.toContain('edad (')
    expect(m).not.toContain('lesiones')
    expect(() => armarMensajeIngreso('nada' as never, 'x')).toThrow()
  })
  it('leerSalidaIngreso saca el JSON de entre texto', () => {
    expect(leerSalidaIngreso('claro:\n{"campos":{},"salud":[]}\nlisto')).toEqual({ campos: {}, salud: [] })
    expect(leerSalidaIngreso('sin json')).toBeNull()
    expect(leerSalidaIngreso('{roto')).toBeNull()
  })
})
