import { describe, expect, it } from 'vitest'
import {
  armarRespuesta,
  decidirVia,
  esCrisis,
  esTemaDeSalud,
  normalizar,
  textoDeAviso,
  tokenDeCabecera,
} from '../../supabase/functions/responder-chat/index.ts'

describe('normalizar', () => {
  it('quita tildes y baja a minusculas', () => {
    expect(normalizar('QUIERO MORIRME')).toBe('quiero morirme')
    expect(normalizar('Me duele la rodilla')).toBe('me duele la rodilla')
    expect(normalizar('  hola   mundo  ')).toBe('hola mundo')
  })
})

describe('esCrisis', () => {
  it('detecta frases inequivocas', () => {
    expect(esCrisis('ya no quiero vivir')).toBe(true)
    expect(esCrisis('estoy pensando en hacerme dano')).toBe(true)
    expect(esCrisis('quiero quitarme la vida')).toBe(true)
    expect(esCrisis('a veces pienso en matarme')).toBe(true)
  })

  it('funciona con tildes y mayusculas', () => {
    expect(esCrisis('quiero hacerme DAÑO')).toBe(true)
  })

  it('NO dispara con cansancio o frustracion', () => {
    expect(esCrisis('ya no puedo mas con estas series')).toBe(false)
    expect(esCrisis('no aguanto el dolor de piernas')).toBe(false)
    expect(esCrisis('estoy muerto despues de esa sesion')).toBe(false)
    expect(esCrisis('me quiero morir de agujetas')).toBe(false)
    expect(esCrisis('no tengo ganas de nada')).toBe(false)
  })

  // La exageracion se BORRA del texto y la crisis se busca en lo que queda.
  // Vetar el mensaje entero dejaba pasar los mensajes mixtos, que son
  // justamente los que mas importan.
  it('la exageracion no tapa una crisis en el mismo mensaje', () => {
    expect(esCrisis('me muero de ganas de que acabe, quiero quitarme la vida')).toBe(true)
    expect(esCrisis('me quiero morir de agujetas pero tambien pienso en matarme')).toBe(true)
  })

  it('sigue sin dispararse con exageraciones solas', () => {
    expect(esCrisis('me quiero morir de agujetas')).toBe(false)
    expect(esCrisis('estoy muerto del cansancio')).toBe(false)
    expect(esCrisis('me muero de hambre')).toBe(false)
  })
})

describe('tokenDeCabecera', () => {
  it('extrae el token de un Bearer', () => {
    expect(tokenDeCabecera('Bearer abc.def.ghi')).toBe('abc.def.ghi')
    expect(tokenDeCabecera('bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('devuelve vacio si no hay cabecera o no es Bearer', () => {
    expect(tokenDeCabecera(null)).toBe('')
    expect(tokenDeCabecera('')).toBe('')
    expect(tokenDeCabecera('Basic abc')).toBe('')
    expect(tokenDeCabecera('Bearer')).toBe('')
  })
})

describe('esTemaDeSalud', () => {
  it('detecta dolor y lesion', () => {
    expect(esTemaDeSalud('me duele la rodilla al bajar')).toBe(true)
    expect(esTemaDeSalud('vengo de una lesion de hombro')).toBe(true)
    expect(esTemaDeSalud('me punza el tendon')).toBe(true)
  })

  it('detecta urgencias', () => {
    expect(esTemaDeSalud('me maree en la serie')).toBe(true)
    expect(esTemaDeSalud('senti opresion en el pecho')).toBe(true)
    expect(esTemaDeSalud('casi me desmayo')).toBe(true)
  })

  it('detecta salud femenina', () => {
    expect(esTemaDeSalud('se me retraso la regla')).toBe(true)
    expect(esTemaDeSalud('estoy embarazada')).toBe(true)
    expect(esTemaDeSalud('se me escapa la orina al saltar')).toBe(true)
  })

  it('detecta angustia ambigua sin ser crisis', () => {
    expect(esTemaDeSalud('ya no puedo mas')).toBe(true)
    expect(esCrisis('ya no puedo mas')).toBe(false)
  })

  it('NO marca preguntas normales de entrenamiento', () => {
    expect(esTemaDeSalud('hasta donde bajo en la sentadilla')).toBe(false)
    expect(esTemaDeSalud('cuanta proteina necesito')).toBe(false)
    expect(esTemaDeSalud('puedo cambiar el orden de los ejercicios')).toBe(false)
    expect(esTemaDeSalud('que es un rest pause')).toBe(false)
  })
})

describe('decidirVia', () => {
  it('ficha directa por encima de 0,50', () => {
    expect(decidirVia(0.78)).toBe('ficha')
    expect(decidirVia(0.50)).toBe('ficha')
  })

  it('tentativa en la banda intermedia', () => {
    expect(decidirVia(0.49)).toBe('ficha_tentativa')
    expect(decidirVia(0.42)).toBe('ficha_tentativa')
  })

  it('escala al coach por debajo de 0,42', () => {
    expect(decidirVia(0.41)).toBe('escalado')
    expect(decidirVia(0.26)).toBe('escalado')
    expect(decidirVia(null)).toBe('escalado')
  })
})

const CUERPO = {
  respuesta_directa: 'Baja hasta pasar la paralela.',
  por_que: 'El estimulo esta donde el musculo se estira bajo carga.',
  tu_caso_hoy: 'Hoy tienes {{ejercicio_hoy}} a RIR {{rir_pautado}}.',
  que_hago_ahora: 'Graba una serie de lado.',
  senal_alarma: 'Si duele dentro de la rodilla, para.',
}

describe('armarRespuesta', () => {
  it('rellena las ranuras con los datos reales', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'SENTADILLA HACK', rir_pautado: '2' })
    expect(r).toContain('Hoy tienes SENTADILLA HACK a RIR 2.')
    expect(r).not.toContain('{{')
  })

  it('omite tu_caso_hoy entero si falta un dato', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'SENTADILLA HACK' })
    expect(r).not.toContain('SENTADILLA HACK')
    expect(r).not.toContain('{{')
    expect(r).toContain('Baja hasta pasar la paralela.')
    expect(r).toContain('Si duele dentro de la rodilla, para.')
  })

  it('omite tu_caso_hoy si no hay ningun dato', () => {
    const r = armarRespuesta(CUERPO, {})
    expect(r).not.toContain('{{')
    expect(r).toContain('El estimulo esta donde')
  })

  it('mantiene el orden de las cinco partes', () => {
    const r = armarRespuesta(CUERPO, { ejercicio_hoy: 'X', rir_pautado: '2' })
    expect(r.indexOf('Baja hasta')).toBeLessThan(r.indexOf('El estimulo'))
    expect(r.indexOf('El estimulo')).toBeLessThan(r.indexOf('Hoy tienes'))
    expect(r.indexOf('Hoy tienes')).toBeLessThan(r.indexOf('Graba una serie'))
    expect(r.indexOf('Graba una serie')).toBeLessThan(r.indexOf('Si duele'))
  })
})

// Ficha con ranuras en DOS partes distintas: es el caso real de
// `cargas-sobraron-reps`, `fatiga-dormi-mal` y `mujer-embarazo-postparto`,
// que tienen ranuras en que_hago_ahora y no solo en tu_caso_hoy.
const CUERPO_MULTI = {
  respuesta_directa: 'Sube 2,5 kg si te sobraron reps.',
  por_que: 'La sobrecarga progresiva necesita un salto medible.',
  tu_caso_hoy: 'Vienes de {{carga_anterior}} en {{ejercicio_hoy}}.',
  que_hago_ahora: 'Cierra el microciclo {{microciclo_actual}} y registra el RIR real.',
  senal_alarma: 'Si la tecnica se rompe, baja el peso.',
}

describe('armarRespuesta — ranuras fuera de tu_caso_hoy', () => {
  it('rellena la ranura de que_hago_ahora cuando el dato esta', () => {
    const r = armarRespuesta(CUERPO_MULTI, {
      carga_anterior: '40KG',
      ejercicio_hoy: 'SENTADILLA HACK',
      microciclo_actual: 'M22',
    })
    expect(r).toContain('Cierra el microciclo M22 y registra el RIR real.')
    expect(r).toContain('Vienes de 40KG en SENTADILLA HACK.')
    expect(r).not.toContain('{{')
  })

  it('omite que_hago_ahora si falta su dato, sin tumbar las demas partes', () => {
    const r = armarRespuesta(CUERPO_MULTI, {
      carga_anterior: '40KG',
      ejercicio_hoy: 'SENTADILLA HACK',
    })
    expect(r).not.toContain('Cierra el microciclo')
    expect(r).not.toContain('{{')
    expect(r).toContain('Sube 2,5 kg si te sobraron reps.')
    expect(r).toContain('La sobrecarga progresiva necesita un salto medible.')
    expect(r).toContain('Vienes de 40KG en SENTADILLA HACK.')
    expect(r).toContain('Si la tecnica se rompe, baja el peso.')
  })

  it('cae solo la parte incompleta: tu_caso_hoy fuera, que_hago_ahora dentro', () => {
    const r = armarRespuesta(CUERPO_MULTI, { microciclo_actual: 'M22' })
    expect(r).not.toContain('Vienes de')
    expect(r).toContain('Cierra el microciclo M22 y registra el RIR real.')
    expect(r).not.toContain('{{')
  })

  it('un dato de dos en tu_caso_hoy tampoco basta: cae la parte entera', () => {
    const r = armarRespuesta(CUERPO_MULTI, { carga_anterior: '40KG', microciclo_actual: 'M22' })
    expect(r).not.toContain('Vienes de')
    expect(r).not.toContain('40KG')
    expect(r).toContain('Cierra el microciclo M22')
    expect(r).not.toContain('{{')
  })

  it('NUNCA deja un {{hueco}} a la vista, con cualquier combinacion de datos', () => {
    const claves = ['carga_anterior', 'ejercicio_hoy', 'microciclo_actual']
    // Las 8 combinaciones posibles de datos presentes/ausentes.
    for (let mascara = 0; mascara < 8; mascara++) {
      const datos: Record<string, string> = {}
      claves.forEach((k, i) => {
        if (mascara & (1 << i)) datos[k] = 'VALOR'
      })
      const r = armarRespuesta(CUERPO_MULTI, datos)
      expect(r).not.toContain('{{')
      expect(r).not.toContain('}}')
      // La respuesta y el aviso de seguridad siempre se entregan.
      expect(r).toContain('Sube 2,5 kg si te sobraron reps.')
      expect(r).toContain('Si la tecnica se rompe, baja el peso.')
    }
  })
})

// El aviso sale de Supabase hacia Telegram, que es un tercero. Por eso NO lleva
// el texto del mensaje: puede contener datos de salud de una persona real. Ver
// §9 de CLAUDE.md. El contenido se lee en el panel del coach.
describe('textoDeAviso', () => {
  it('marca la crisis como urgente y la distingue', () => {
    const t = textoDeAviso({ tipo: 'crisis', nombre: 'Laura', panel: 'https://x/coach/consultas' })
    expect(t).toContain('URGENTE')
    expect(t).toContain('Laura')
    expect(t).toContain('https://x/coach/consultas')
  })

  it('la bandera de salud no dice urgente', () => {
    const t = textoDeAviso({ tipo: 'salud', nombre: 'Laura', panel: 'https://x/coach/consultas' })
    expect(t).not.toContain('URGENTE')
    expect(t).toContain('Laura')
  })

  it('NUNCA incluye el texto del mensaje', () => {
    const t = textoDeAviso({
      tipo: 'salud',
      nombre: 'Laura',
      panel: 'https://x/coach/consultas',
      mensaje: 'se me escapa la orina al saltar',
    } as never)
    expect(t).not.toContain('orina')
  })

  it('usa solo el nombre de pila', () => {
    const t = textoDeAviso({ tipo: 'salud', nombre: 'Maria Isabel Restrepo Gomez', panel: 'https://x' })
    expect(t).toContain('Maria')
    expect(t).not.toContain('Restrepo')
  })

  it('aguanta que no se sepa el nombre', () => {
    const t = textoDeAviso({ tipo: 'salud', nombre: '', panel: 'https://x' })
    expect(t).toContain('Una asesorada')
  })
})

describe('armarRespuesta — partes que nunca se omiten', () => {
  // El validador prohibe ranuras en respuesta_directa y senal_alarma, asi que
  // esto no deberia existir en produccion. Si una ficha se colara igual, se
  // entrega la respuesta y el aviso de seguridad antes que un {{hueco}}.
  const CUERPO_MAL = {
    respuesta_directa: 'Sube a {{carga_anterior}} esta semana.',
    por_que: 'Porque si.',
    tu_caso_hoy: '',
    que_hago_ahora: 'Registra el RIR.',
    senal_alarma: 'Para si duele en {{ejercicio_hoy}}.',
  }

  it('entrega respuesta_directa y senal_alarma aunque falte el dato, sin el hueco', () => {
    const r = armarRespuesta(CUERPO_MAL, {})
    expect(r).not.toContain('{{')
    expect(r).toContain('Sube a')
    expect(r).toContain('Para si duele en')
    expect(r).toContain('Registra el RIR.')
  })
})
