/**
 * Eco del tono (cata de Bryan, 7-nov-2026). Los 4 «no» de la cata fallaron en el saludo: no respondía a lo que la
 * persona acababa de decir. Las frases son inventadas (las de la cata, que también lo eran).
 * Reglas de VOZ-DEL-PERSONAJE y POLITICA-FRASES-MOTIVACION (estilo-de-vida, 29-sep/1-oct): una sola pregunta y al
 * final; sin «!» al validar; sin «debes/tienes que/hay que»; en día malo NO hay refrán ni frase motivacional.
 */
import { describe, expect, it } from 'vitest'
import { ECO_TU, ECO_USTED, elegirEco, leerTono, type LecturaDeTono } from './eco'
import { huellaDe, REPERTORIO, REPERTORIO_USTED, type HistorialPersona } from './saludos'

const fijo = (v: number) => () => v
const todos = (x: typeof ECO_TU): string[] => [
  ...x.contento.conPalabra, ...x.contento.aperturas, ...x.contento.colas,
  ...x.cansado.conSueno, ...x.cansado.aperturas, ...x.cansado.colas,
  ...x.semana_dura.aperturas, ...x.semana_dura.colas,
  ...x.tema_ajeno.futbol, ...x.tema_ajeno.gol, ...x.tema_ajeno.serie, ...x.tema_ajeno.aperturas, ...x.tema_ajeno.colas,
]

describe('leerTono: los cuatro casos de la cata', () => {
  it('c03: «me fue increíble» es alegría y se guarda su palabra', () => {
    expect(leerTono('acabo de terminar, me fue increíble hoy')).toEqual({ tono: 'contento', palabra: 'increíble' })
  })
  it('c04: «mal día, estoy agotada» es cansancio; con «dormí poquísimo» marca el sueño', () => {
    expect(leerTono('mal día la verdad, estoy agotada')?.tono).toBe('cansado')
    expect(leerTono('dormí poquísimo y en el trabajo todo salió al revés')).toEqual({ tono: 'cansado', sueno: true })
  })
  it('c06: «uy qué semana» es semana dura aunque no diga que fue mala', () => {
    expect(leerTono('hola! uy qué semana, salgo de la oficina a las siete')?.tono).toBe('semana_dura')
  })
  it('c07: el partido y el gol son tema ajeno; la serie también', () => {
    expect(leerTono('hola, oye viste el partido de anoche, qué locura ese gol al final')).toEqual({ tono: 'tema_ajeno', tema: 'futbol', gol: true })
    expect(leerTono('estoy viendo una serie nueva que me tiene enganchadísimo')).toEqual({ tono: 'tema_ajeno', tema: 'serie' })
  })
  it('el cansancio manda sobre la alegría', () => {
    expect(leerTono('me fue increíble pero estoy agotada')?.tono).toBe('cansado')
  })
  it('una frase neutra no tiene tono', () => {
    expect(leerTono('hola')).toBeNull()
    expect(leerTono('¿cuántas series me tocan hoy?')).toBeNull()
  })
})

describe('elegirEco', () => {
  const sin: HistorialPersona = []
  it('c03: devuelve la palabra de la persona y pregunta con dos conceptos (cansancio, intensidad)', () => {
    const e = elegirEco({ lectura: { tono: 'contento', palabra: 'increíble' }, nombre: 'Santiago', historial: sin, azar: fijo(0) })
    expect(e.apertura).toContain('increíble')
    expect(e.apertura).toContain('Santiago')
    expect(e.apertura).not.toContain('{')
    const colas = ECO_TU.contento.colas
    expect(colas.some((c) => /cansancio/.test(c) && /intens/.test(c))).toBe(true)
  })
  it('c04: con sueño, la apertura refleja que durmió poco', () => {
    const e = elegirEco({ lectura: { tono: 'cansado', sueno: true }, historial: sin, azar: fijo(0) })
    expect(e.apertura).toMatch(/sueño|[Dd]orm/)
  })
  it('no repite la apertura ni la cola dichas hace poco a la misma persona', () => {
    const lectura: LecturaDeTono = { tono: 'semana_dura' }
    let h: HistorialPersona = []
    const vistas: string[] = []
    for (let i = 0; i < 4; i++) {
      const e = elegirEco({ lectura, historial: h, azar: fijo(0) })
      vistas.push(e.huella.apertura)
      h = [...h, e.huella]
    }
    expect(new Set(vistas).size).toBe(4)
  })
  it('el nombre no sale dos veces seguidas', () => {
    const a = elegirEco({ lectura: { tono: 'contento' }, nombre: 'Laura', historial: [], azar: fijo(0) })
    const b = elegirEco({ lectura: { tono: 'contento' }, nombre: 'Laura', historial: [a.huella], azar: fijo(0) })
    expect(a.apertura).toContain('Laura')
    expect(b.apertura).not.toContain('Laura')
  })
  it('de usted no se cuela el tú', () => {
    const e = elegirEco({ lectura: { tono: 'cansado' }, historial: sin, azar: fijo(0.5), trato: 'usted' })
    expect(ECO_USTED.cansado.aperturas.map((x) => x.replace('{n}', ''))).toContain(e.apertura)
  })
})

describe('reglas de voz en todos los textos del eco', () => {
  const textos = [...todos(ECO_TU), ...todos(ECO_USTED)]
  it('ninguna frase de obligación ni de formulario', () => {
    for (const t of textos) {
      expect(t).not.toMatch(/\b(debes|debe usted|tienes que|tiene que|hay que)\b/i)
      expect(t).not.toMatch(/nada que completar|quedó el cuerpo|qué más hay|no te quite el foco|no pasa nada/i)
    }
  })
  it('a lo sumo una pregunta, y al final', () => {
    for (const t of textos) {
      expect((t.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
      if (t.includes('?')) expect(t.trim().endsWith('?')).toBe(true)
    }
  })
  it('las aperturas no preguntan: la pregunta la pone la cola (una por turno)', () => {
    const aperturas = [ECO_TU, ECO_USTED].flatMap((x) => [
      ...x.contento.conPalabra, ...x.contento.aperturas, ...x.cansado.conSueno, ...x.cansado.aperturas,
      ...x.semana_dura.aperturas, ...x.tema_ajeno.futbol, ...x.tema_ajeno.gol, ...x.tema_ajeno.serie, ...x.tema_ajeno.aperturas,
    ])
    for (const a of aperturas) expect(a).not.toContain('?')
  })
  it('en día malo no hay refrán ni dicho', () => {
    for (const x of [ECO_TU, ECO_USTED]) {
      for (const t of [...x.cansado.conSueno, ...x.cansado.aperturas, ...x.cansado.colas]) {
        expect(t).not.toMatch(/como dicen|mañana será otro día|no hay mal que/i)
      }
    }
  })
  it('sin «!» al validar alegría o cansancio', () => {
    for (const x of [ECO_TU, ECO_USTED]) {
      for (const t of [...x.contento.conPalabra, ...x.contento.aperturas, ...x.cansado.aperturas, ...x.cansado.conSueno]) expect(t).not.toContain('!')
    }
  })
  it('de usted no hay formas de tú', () => {
    for (const t of todos(ECO_USTED)) expect(t).not.toMatch(/\b(te|tu|tú|ti|contigo|tienes|quieres|cuentas|estás|eres)\b/i)
  })
  it('huellas de apertura distintas dentro de cada tono', () => {
    for (const x of [ECO_TU, ECO_USTED]) {
      for (const lista of [x.contento.conPalabra, x.contento.aperturas, x.cansado.aperturas, x.semana_dura.aperturas, x.tema_ajeno.futbol]) {
        const h = lista.map((a) => huellaDe(a))
        expect(new Set(h).size).toBe(h.length)
      }
    }
  })
})

describe('repertorio de saludos: las frases que Bryan marcó «no» ya no están', () => {
  it('ni de tú, ni de usted, ni del equipo', () => {
    const todo = JSON.stringify([REPERTORIO, REPERTORIO_USTED])
    for (const malo of ['nada que completar', 'quedó el cuerpo', 'qué más hay', 'en la pausa', 'Un día cuesta arriba']) expect(todo).not.toContain(malo)
  })
})
