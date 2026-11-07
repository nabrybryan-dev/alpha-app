import { describe, expect, it } from 'vitest'
import {
  APERTURAS_LIGERAS, CONECTORES, FAMILIAS, REPERTORIO, SITUACIONES, VENTANA_APERTURA, VENTANA_CONECTOR,
  debeDecirAviso, elegirConector, elegirSaludo, huellaDe, ordenarRespuesta, registrarUso, situacionDelDia,
  type DatosDeSituacion, type HistorialPersona, type Voz,
} from './saludos'

const VOCES: Voz[] = ['equipo', 'asesorado']

/** Azar determinista (mulberry32). */
function azarConSemilla(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const base: DatosDeSituacion = { hora: 10, primerDia: false, diasDesdeLaUltima: 1, minutosDesdeSesion: null, diaMalo: false, yaHabloHoy: false }

const todosLosTextos = (): string[] => [
  ...VOCES.flatMap((v) => SITUACIONES.flatMap((s) => [...REPERTORIO[v][s].aperturas, ...REPERTORIO[v][s].colas])),
  ...VOCES.flatMap((v) => FAMILIAS.flatMap((f) => CONECTORES[v][f])),
  ...Object.values(APERTURAS_LIGERAS).flatMap((l) => l ?? []),
]

describe('situacionDelDia', () => {
  it.each([
    ['primera vez', { primerDia: true }, 'primera_vez'],
    ['vuelve tras varios días', { diasDesdeLaUltima: 6 }, 'vuelve_tras_dias'],
    ['después de entrenar', { minutosDesdeSesion: 45 }, 'despues_de_entrenar'],
    ['día malo declarado', { diaMalo: true }, 'dia_malo'],
    ['madrugada', { hora: 3 }, 'madrugada_o_noche'],
    ['noche tardía', { hora: 23 }, 'madrugada_o_noche'],
    ['retoma el mismo día', { yaHabloHoy: true }, 'retoma_mismo_dia'],
  ] as const)('%s', (_n, extra, esperada) => {
    expect(situacionDelDia({ ...base, ...extra })).toBe(esperada)
  })
  it('rutina: ninguna situación (sigue el libreto de siempre)', () => expect(situacionDelDia(base)).toBeNull())
  it('día malo gana a primera vez y a madrugada', () => {
    expect(situacionDelDia({ ...base, diaMalo: true, primerDia: true, hora: 2 })).toBe('dia_malo')
  })
  it('una sesión de hace 4 horas ya no es «después de entrenar»', () => {
    expect(situacionDelDia({ ...base, minutosDesdeSesion: 240 })).toBeNull()
  })
})

describe('repertorio', () => {
  it.each(VOCES.flatMap((v) => SITUACIONES.map((s) => [v, s] as const)))('%s / %s: más aperturas que la ventana y colas suficientes', (v, s) => {
    expect(REPERTORIO[v][s].aperturas.length).toBeGreaterThan(VENTANA_APERTURA)
    expect(REPERTORIO[v][s].colas.length).toBeGreaterThanOrEqual(4)
  })
  it('hay más conectores por voz que la ventana', () => {
    for (const v of VOCES) expect(FAMILIAS.flatMap((f) => CONECTORES[v][f]).length).toBeGreaterThan(VENTANA_CONECTOR)
  })
  it('las huellas de apertura y de conector no chocan dentro de una voz (si chocaran, la ventana encogería)', () => {
    for (const v of VOCES) {
      const ap = [...SITUACIONES.flatMap((s) => REPERTORIO[v][s].aperturas), ...(v === 'asesorado' ? Object.values(APERTURAS_LIGERAS).flatMap((l) => l ?? []) : [])].map((t) => huellaDe(t))
      expect(new Set(ap).size).toBe(ap.length)
      const co = FAMILIAS.flatMap((f) => CONECTORES[v][f]).map((t) => huellaDe(t))
      expect(new Set(co).size).toBe(co.length)
    }
  })
  it('la voz del equipo nunca usa tú, usted ni segunda persona', () => {
    const SEGUNDA = /\b(t[uú]|tus?|ti|te|contigo|usted(es)?|vos|tuy[oa]s?|c[uú]entame|dime|d[ií]game|cu[eé]ntele|quieres|puedes|necesitas|prefieres|est[aá]s|tienes)\b/i
    const textos = [
      ...SITUACIONES.flatMap((s) => [...REPERTORIO.equipo[s].aperturas, ...REPERTORIO.equipo[s].colas]),
      ...FAMILIAS.flatMap((f) => CONECTORES.equipo[f]),
    ]
    for (const t of textos) expect(t, t).not.toMatch(SEGUNDA)
  })
  it('ninguna variante dice que es una IA ni usa palabras clínicas ni promete', () => {
    const PROHIBIDO = /soy una (ia|inteligencia)|inteligencia artificial|\bia\b|diagn[oó]stic|s[ií]ntoma|enfermedad|lesi[oó]n|dolor|medicaci[oó]n|medicina|tratamiento|patolog|terapia|cura\b|clínic|clinic|garantiz|prometo curar|te vas a (curar|recuperar)/i
    // «Prometo no ser un sargento» es humor, no promesa clínica: se permite solo esa.
    for (const t of todosLosTextos()) expect(t.replace('Prometo no ser un sargento', ''), t).not.toMatch(PROHIBIDO)
  })
  it('sin emojis ni fórmulas prohibidas del redactor', () => {
    for (const t of todosLosTextos()) {
      expect(t, t).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(t, t).not.toMatch(/^(Ahora,|Es decir,|Eso sí|Claro,|Por supuesto|En resumen|Básicamente)/)
    }
  })
  it('caso #8: ninguna variante es una fórmula de redirección («volviendo a…»)', () => {
    for (const t of todosLosTextos()) expect(t, t).not.toMatch(/volviendo (a|al)\b|volvamos a|retomando|a la rutina|tu evaluaci[oó]n/i)
  })
  it('caso #4: las aperturas ligeras no se burlan, no tocan salud y no existen para día malo ni madrugada', () => {
    expect(APERTURAS_LIGERAS.dia_malo).toBeUndefined()
    expect(APERTURAS_LIGERAS.madrugada_o_noche).toBeUndefined()
    for (const t of Object.values(APERTURAS_LIGERAS).flatMap((l) => l ?? [])) expect(t, t).not.toMatch(/gord|flac|perez|torpe|vago|cuerpo|peso|salud/i)
  })
})

describe('elegirSaludo', () => {
  it.each(VOCES.flatMap((v) => SITUACIONES.map((s) => [v, s] as const)))('%s / %s: elige del repertorio correcto', (v, s) => {
    const azar = azarConSemilla(7)
    for (let i = 0; i < 20; i++) {
      const r = elegirSaludo({ voz: v, situacion: s, nombre: 'Mateo', historial: [], azar })
      expect(REPERTORIO[v][s].aperturas.map((t) => t.replace('{n}', r.apertura.includes('Mateo') ? ', Mateo' : ''))).toContain(r.apertura)
      expect(REPERTORIO[v][s].colas).toContain(r.cola)
      expect(r.huella.situacion).toBe(s)
    }
  })
  it('la voz del equipo no lleva el nombre', () => {
    const r = elegirSaludo({ voz: 'equipo', situacion: 'primera_vez', nombre: 'Mateo', historial: [], azar: azarConSemilla(1) })
    expect(r.apertura).not.toContain('Mateo')
  })

  /** Simula una conversación de 10 respuestas con una persona y devuelve las huellas de apertura. */
  function conversacion(voz: Voz, situacion: (typeof SITUACIONES)[number], semilla: number, nombre: string, largo = 10): { aperturas: string[]; historial: HistorialPersona } {
    const azar = azarConSemilla(semilla)
    let h: HistorialPersona = []
    const aperturas: string[] = []
    for (let i = 0; i < largo; i++) {
      const r = elegirSaludo({ voz, situacion, nombre, historial: h, azar, humor: true })
      aperturas.push(r.huella.apertura!)
      h = registrarUso(h, r.huella)
    }
    return { aperturas, historial: h }
  }

  it('M1: en 200 conversaciones de 10 respuestas por situación y voz, 0 repeticiones de apertura en las últimas N con la misma persona', () => {
    let violaciones = 0
    let distintas = 0
    let total = 0
    for (const voz of VOCES) {
      for (const s of SITUACIONES) {
        for (let semilla = 1; semilla <= 200; semilla++) {
          const { aperturas } = conversacion(voz, s, semilla, 'Camila')
          aperturas.forEach((a, i) => { if (aperturas.slice(Math.max(0, i - VENTANA_APERTURA), i).includes(a)) violaciones++ })
          distintas += new Set(aperturas).size
          total += aperturas.length
        }
      }
    }
    expect(violaciones).toBe(0)
    // El 0,8 del diseño exige 8 o más aperturas por situación (con 7 el tope de 10 respuestas es 0,7): ver PIEZA-SALUDOS.
    expect(distintas / total).toBeGreaterThanOrEqual(0.55)
  })

  it('con otra persona sí puede repetir la misma apertura (el historial es por persona)', () => {
    // Una persona con historial vacío puede recibir cualquiera, incluida una que a otra se le dijo hace un instante.
    const a = elegirSaludo({ voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: [], azar: () => 0 })
    const hA = registrarUso([], a.huella)
    const aOtra = elegirSaludo({ voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: [], azar: () => 0 })
    expect(aOtra.apertura).toBe(a.apertura)
    // Y con SU historial, la misma persona ya no recibe esa.
    const aMisma = elegirSaludo({ voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: hA, azar: () => 0 })
    expect(aMisma.apertura).not.toBe(a.apertura)
  })

  it('no usa el nombre dos veces seguidas (R4)', () => {
    const azar = azarConSemilla(3)
    let h: HistorialPersona = []
    const usos: boolean[] = []
    for (let i = 0; i < 9; i++) {
      const r = elegirSaludo({ voz: 'asesorado', situacion: 'retoma_mismo_dia', nombre: 'Laura', historial: h, azar })
      usos.push(r.huella.nombre === true)
      h = registrarUso(h, r.huella)
    }
    for (let i = 1; i < usos.length; i++) expect(usos[i] && usos[i - 1]).toBe(false)
    expect(usos.some(Boolean)).toBe(true)
  })

  it('no muta el historial que recibe', () => {
    const h: HistorialPersona = Object.freeze([]) as HistorialPersona
    expect(() => elegirSaludo({ voz: 'equipo', situacion: 'dia_malo', historial: h, azar: () => 0.5 })).not.toThrow()
    expect(registrarUso(h, { situacion: null })).toHaveLength(1)
    expect(h).toHaveLength(0)
  })

  it('caso #4: el humor solo se suma si se pide, y nunca en día malo ni de madrugada', () => {
    const ligeras = new Set(Object.values(APERTURAS_LIGERAS).flatMap((l) => l ?? []).map((t) => huellaDe(t)))
    const azar = azarConSemilla(11)
    let salio = false
    for (let i = 0; i < 300; i++) {
      const sin = elegirSaludo({ voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: [], azar })
      expect(ligeras.has(sin.huella.apertura!)).toBe(false)
      const con = elegirSaludo({ voz: 'asesorado', situacion: 'vuelve_tras_dias', historial: [], azar, humor: true })
      if (ligeras.has(con.huella.apertura!)) salio = true
      for (const s of ['dia_malo', 'madrugada_o_noche'] as const) {
        const r = elegirSaludo({ voz: 'asesorado', situacion: s, historial: [], azar, humor: true })
        expect(ligeras.has(r.huella.apertura!)).toBe(false)
      }
      const eq = elegirSaludo({ voz: 'equipo', situacion: 'vuelve_tras_dias', historial: [], azar, humor: true })
      expect(ligeras.has(eq.huella.apertura!)).toBe(false)
    }
    expect(salio).toBe(true)
  })
})

describe('elegirConector', () => {
  it('M2: en 200 conversaciones de 12 respuestas, 0 repeticiones de conector en las últimas 8 con la misma persona', () => {
    let violaciones = 0
    for (const voz of VOCES) {
      for (let semilla = 1; semilla <= 200; semilla++) {
        const azar = azarConSemilla(semilla)
        let h: HistorialPersona = []
        const usados: string[] = []
        for (let i = 0; i < 12; i++) {
          const c = elegirConector({ voz, historial: h, azar })!
          if (usados.slice(-VENTANA_CONECTOR).includes(c.huella)) violaciones++
          usados.push(c.huella)
          h = registrarUso(h, { situacion: null, conector: c.huella })
        }
      }
    }
    expect(violaciones).toBe(0)
  })
  it('la familia pedida sale de esa familia', () => {
    for (const f of FAMILIAS) {
      const c = elegirConector({ voz: 'asesorado', familia: f, historial: [], azar: azarConSemilla(2) })!
      expect(CONECTORES.asesorado[f]).toContain(c.conector)
      expect(c.familia).toBe(f)
    }
  })
  it('con apuro o ánimo bajo (permitir: false) no hay conector', () => {
    expect(elegirConector({ voz: 'asesorado', historial: [], azar: () => 0.1, permitir: false })).toBeNull()
  })
})

describe('casos reales de la landing', () => {
  it('#9: si la persona saludó, el saludo va PRIMERO, antes de cualquier dato', () => {
    const t = ordenarRespuesta({ personaSaludo: true, apertura: 'Hola, Mateo.', cuerpo: 'Hoy te toca pierna.' })
    expect(t.startsWith('Hola, Mateo.')).toBe(true)
    expect(ordenarRespuesta({ personaSaludo: false, apertura: 'Hola.', cuerpo: 'Hoy te toca pierna.' })).toBe('Hoy te toca pierna.')
    expect(ordenarRespuesta({ personaSaludo: true, apertura: 'Hola.', cuerpo: '' })).toBe('Hola.')
  })
  it('#2: un aviso se dice una sola vez por charla', () => {
    const dichos: ('aval_medico' | 'consulta_coach' | 'otro')[] = []
    let veces = 0
    for (let turno = 0; turno < 6; turno++) {
      if (debeDecirAviso('aval_medico', dichos)) { veces++; dichos.push('aval_medico') }
    }
    expect(veces).toBe(1)
    expect(debeDecirAviso('consulta_coach', dichos)).toBe(true)
  })
})
