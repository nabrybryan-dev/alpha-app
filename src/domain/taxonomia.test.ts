import { describe, expect, it } from 'vitest'
import {
  aportesDeCategoria,
  categoriaCanonica,
  CATEGORIAS,
  tieneTecnicaDeclarada,
  grupoPrimario,
  ORDEN_GRUPOS,
  PICO_DE_EXIGENCIA,
  type Grupo,
} from './taxonomia'

describe('CATEGORIAS', () => {
  it('son las 34 acciones articulares de la taxonomía', () => {
    expect(CATEGORIAS).toHaveLength(34)
  })

  it('no tiene duplicados', () => {
    expect(new Set(CATEGORIAS).size).toBe(CATEGORIAS.length)
  })

  it('todas se escriben en mayúsculas', () => {
    for (const categoria of CATEGORIAS) {
      expect(categoria).toBe(categoria.toUpperCase())
    }
  })
})

describe('invariantes de la tabla de equivalencia', () => {
  it('cada categoría aporta como mucho a un grupo directo', () => {
    for (const categoria of CATEGORIAS) {
      const directos = aportesDeCategoria(categoria).filter((a) => a.factor === 1)
      expect(directos.length, `${categoria} tiene ${directos.length} grupos directos`).toBeLessThanOrEqual(1)
    }
  })

  it('solo usa las dos monedas: 1 directo y 0,5 indirecto', () => {
    for (const categoria of CATEGORIAS) {
      for (const aporte of aportesDeCategoria(categoria)) {
        expect([1, 0.5]).toContain(aporte.factor)
      }
    }
  })

  it('ninguna categoría cuenta dos veces al mismo grupo', () => {
    for (const categoria of CATEGORIAS) {
      const grupos = aportesDeCategoria(categoria).map((a) => a.grupo)
      expect(new Set(grupos).size, `${categoria} repite un grupo`).toBe(grupos.length)
    }
  })

  it('todos los grupos referidos existen en el orden del PANEL', () => {
    for (const categoria of CATEGORIAS) {
      for (const aporte of aportesDeCategoria(categoria)) {
        expect(ORDEN_GRUPOS).toContain(aporte.grupo)
      }
    }
  })

  it('cada grupo del PANEL recibe trabajo directo de alguna categoría', () => {
    const conDirecto = new Set<Grupo>()
    for (const categoria of CATEGORIAS) {
      const primario = grupoPrimario(categoria)
      if (primario) conDirecto.add(primario)
    }
    for (const grupo of ORDEN_GRUPOS) {
      expect(conDirecto.has(grupo), `${grupo} no tiene ninguna categoría directa`).toBe(true)
    }
  })
})

describe('categorías que no suman volumen', () => {
  it.each([
    'PREV/REHAB',
    'ACONDICIONAMIENTO',
    'MOVILIDAD',
    'FLEXIÓN DE MUÑECA',
    'EXTENSIÓN DE MUÑECA',
    'DORSIFLEXIÓN',
  ])('%s no aporta a ningún grupo', (categoria) => {
    expect(aportesDeCategoria(categoria)).toEqual([])
    expect(grupoPrimario(categoria)).toBeUndefined()
  })
})

describe('DORSIFLEXIÓN sale del conteo (2026-08-27)', () => {
  // Hasta esta fecha aportaba `Pantorrillas 0,5`, y era un error de anatomía: el
  // tibial anterior dorsiflexiona y el tríceps sural plantiflexiona. Son
  // antagonistas. El test no comprueba una preferencia de conteo — comprueba que la
  // app no vuelve a acreditar a un músculo series de su antagonista.
  it('una elevación de puntas no acredita nada a Pantorrillas', () => {
    expect(aportesDeCategoria('DORSIFLEXIÓN')).toEqual([])
  })

  it('Pantorrillas sigue teniendo su directo, que es FLEXIÓN PLANTAR', () => {
    expect(grupoPrimario('FLEXIÓN PLANTAR')).toBe('Pantorrillas')
  })
})

describe('las dos de muñeca (2026-08-25)', () => {
  // El hueco era que la taxonomía llegaba hasta el codo: un curl de muñeca no
  // se podía ni nombrar. Esto es lo que arregla el cambio.
  it.each(['FLEXIÓN DE MUÑECA', 'EXTENSIÓN DE MUÑECA'])('%s es una categoría canónica', (c) => {
    expect(categoriaCanonica(c)).toBe(c)
  })

  it('se reconocen aunque la base las escriba sin acentos ni mayúsculas', () => {
    expect(categoriaCanonica('flexion de muneca')).toBe('FLEXIÓN DE MUÑECA')
    expect(categoriaCanonica('Extension De Muñeca')).toBe('EXTENSIÓN DE MUÑECA')
  })

  // La razón de que no cuenten: el PANEL no tiene grupo «Antebrazo», y contar
  // solo las series directas diría «2» en una semana con cuarenta de agarre.
  it('no aportan a ningún grupo, ni siquiera indirecto', () => {
    expect(aportesDeCategoria('FLEXIÓN DE MUÑECA', 'Curl de muñeca con barra')).toEqual([])
    expect(aportesDeCategoria('EXTENSIÓN DE MUÑECA', 'Extensión de muñeca con mancuerna')).toEqual([])
  })

  // El guardián de la regresión: antes del cambio caían en la capa heredada y
  // devolvían []. Si alguien añade un patrón a HEREDADAS que las capture —
  // «CURL» a bíceps, pongamos— el PANEL empezaría a contar antebrazo como
  // bíceps sin que nadie lo pidiera.
  it('el curl de muñeca NO cuenta como bíceps', () => {
    expect(grupoPrimario('FLEXIÓN DE MUÑECA', 'Curl de muñeca sentado con barra')).toBeUndefined()
  })

  it('la extensión de muñeca NO cuenta como tríceps', () => {
    expect(grupoPrimario('EXTENSIÓN DE MUÑECA', 'Extensión de muñeca con banda')).toBeUndefined()
  })
})

describe('aportesDeCategoria', () => {
  it('la bisagra reparte a isquios, glúteo y lumbares', () => {
    expect(aportesDeCategoria('BISAGRA DE CADERA')).toEqual([
      { grupo: 'Isquios', factor: 1 },
      { grupo: 'Glúteos', factor: 0.5 },
      { grupo: 'Lumbares', factor: 0.5 },
    ])
  })

  it('la extensión de cadera invierte los papeles de la bisagra', () => {
    expect(grupoPrimario('EXTENSIÓN DE CADERA')).toBe('Glúteos')
    expect(aportesDeCategoria('EXTENSIÓN DE CADERA')).toContainEqual({ grupo: 'Isquios', factor: 0.5 })
  })

  it('el empuje horizontal paga tríceps y hombro como indirectos', () => {
    expect(aportesDeCategoria('EMPUJE HORIZONTAL')).toEqual([
      { grupo: 'Pecho', factor: 1 },
      { grupo: 'Tríceps', factor: 0.5 },
      { grupo: 'Hombros', factor: 0.5 },
    ])
  })

  it('la tracción vertical paga bíceps', () => {
    expect(aportesDeCategoria('TRACCIÓN VERTICAL')).toContainEqual({ grupo: 'Bíceps', factor: 0.5 })
  })

  it('las categorías de asistencia solo tienen indirecto', () => {
    expect(aportesDeCategoria('ROTACIÓN DE CADERA')).toEqual([{ grupo: 'Glúteos', factor: 0.5 }])
    // DORSIFLEXIÓN estuvo aquí hasta el 2026-08-27. Salió porque no es una categoría
    // de asistencia: no asiste a la pantorrilla, es su antagonista. Ahora vive en
    // «categorías que no suman volumen», que es donde le corresponde.
  })
})

/**
 * Tres vectores de la sentadilla unilateral (análisis de Bryan, 2026-08-13):
 * el músculo primario cambia con el ángulo del torso y la posición de la carga.
 * En ninguno de los tres el cuádriceps es el primario, que es justo lo que la
 * fila genérica de la tabla decía mal hasta el 2026-08-15.
 */
/**
 * Un combinado cobra por las dos mitades.
 *
 * «PRESS MILITAR + CURL BÍCEPS» vivía en FLEXIÓN DE CODO y solo acreditaba
 * bíceps: la mitad del press desaparecía del recuento de hombro. Decisión del
 * 2026-08-16: cuenta el volumen efectivo de las dos, porque cada repetición
 * hace las dos cosas.
 */
describe('los ejercicios combinados', () => {
  it('el press militar + curl acredita hombro Y bíceps, los dos directos', () => {
    expect(aportesDeCategoria('FLEXIÓN DE CODO', 'PRESS MILITAR + CURL BÍCEPS')).toEqual([
      { grupo: 'Bíceps', factor: 1 },
      { grupo: 'Hombros', factor: 1 },
      { grupo: 'Tríceps', factor: 0.5 },
    ])
  })

  /** El tríceps acompaña la extensión del press; no la dirige. */
  it('el tríceps entra a la mitad, no como primario', () => {
    const aportes = aportesDeCategoria('FLEXIÓN DE CODO', 'PRESS MILITAR + CURL BÍCEPS')
    expect(aportes.find((a) => a.grupo === 'Tríceps')?.factor).toBe(0.5)
    expect(grupoPrimario('FLEXIÓN DE CODO', 'PRESS MILITAR + CURL BÍCEPS')).not.toBe('Tríceps')
  })

  /** Un curl a secas sigue siendo un curl: la variante no puede contaminarlo. */
  it('el curl normal no se lleva el hombro de regalo', () => {
    expect(aportesDeCategoria('FLEXIÓN DE CODO', 'Curl de bíceps con mancuernas')).toEqual([
      { grupo: 'Bíceps', factor: 1 },
    ])
  })
})

describe('la variante de ejecución redistribuye el estímulo', () => {
  it('el torso vertical carga el glúteo, con el cuádriceps de secundario', () => {
    expect(aportesDeCategoria('SENTADILLA UNILATERAL', 'Sentadilla búlgara con mancuernas (torso vertical · unilateral)')).toEqual([
      { grupo: 'Glúteos', factor: 1 },
      { grupo: 'Cuádriceps', factor: 0.5 },
    ])
  })

  it('el torso inclinado cambia el primario al aductor', () => {
    expect(aportesDeCategoria('SENTADILLA UNILATERAL', 'Zancada con mancuernas (torso inclinado · unilateral)')).toEqual([
      { grupo: 'Aductores', factor: 1 },
      { grupo: 'Glúteos', factor: 0.5 },
    ])
  })

  it('la carga ipsilateral con rotación carga el glúteo', () => {
    expect(grupoPrimario('SENTADILLA UNILATERAL', 'Sentadilla búlgara con mancuerna (ipsilateral con rotación)')).toBe('Glúteos')
  })

  it('en ningún vector el cuádriceps es el primario', () => {
    for (const variante of ['torso vertical', 'torso inclinado', 'ipsilateral con rotación']) {
      expect(grupoPrimario('SENTADILLA UNILATERAL', `Sentadilla búlgara (${variante})`)).not.toBe('Cuádriceps')
    }
  })

  it('sin variante declarada aplica el default, que es el torso vertical', () => {
    expect(aportesDeCategoria('SENTADILLA UNILATERAL', 'Búlgara con mancuerna')).toEqual(
      aportesDeCategoria('SENTADILLA UNILATERAL', 'Búlgara con mancuerna (torso vertical)'),
    )
  })

  it('la variante no se le aplica a la sentadilla bilateral', () => {
    expect(grupoPrimario('SENTADILLA', 'Sentadilla con barra (torso inclinado)')).toBe('Cuádriceps')
  })

  it('tolera la variante sin acentos y en mayúsculas', () => {
    expect(grupoPrimario('SENTADILLA UNILATERAL', 'ZANCADA (TORSO INCLINADO)')).toBe('Aductores')
  })
})

describe('tolerancia de escritura', () => {
  it('reconoce la categoría sin acentos', () => {
    expect(categoriaCanonica('EXTENSION DE RODILLA')).toBe('EXTENSIÓN DE RODILLA')
    expect(grupoPrimario('TRACCION HORIZONTAL')).toBe('Espalda')
  })

  it('reconoce la categoría en minúsculas y con espacios sobrantes', () => {
    expect(categoriaCanonica('  flexión de codo  ')).toBe('FLEXIÓN DE CODO')
  })

  it('categoriaCanonica distingue la taxonomía nueva de la vieja', () => {
    expect(categoriaCanonica('ABDUCCIÓN DE CADERA')).toBeDefined()
    expect(categoriaCanonica('AISLAMIENTO GLÚTEOS')).toBeUndefined()
  })
})

/**
 * Las 16 categorías que la lista de regex de `fatiga.ts` resolvía mal antes de
 * esta tabla: 14 se quedaban sin grupo y desaparecían del PANEL, y 2 —las dos
 * abducciones de hombro— caían en la regex /ABDUCCION/ de glúteos, así que las
 * elevaciones laterales contaban como volumen de glúteo.
 */
describe('regresión: lo que la lista de regex rompía', () => {
  it.each([
    ['EXTENSIÓN DE CADERA', 'Glúteos'],
    ['FLEXIÓN DE RODILLA', 'Isquios'],
    ['FLEXIÓN PLANTAR', 'Pantorrillas'],
    ['APERTURA DE PECHO', 'Pecho'],
    ['EXTENSIÓN DE HOMBRO', 'Espalda'],
    ['FLEXIÓN DE HOMBRO', 'Hombros'],
    ['FLEXIÓN DE CODO', 'Bíceps'],
    ['ANTIEXTENSIÓN', 'Abdomen'],
    ['ANTIRROTACIÓN', 'Abdomen'],
    ['ANTIFLEXIÓN LATERAL', 'Abdomen'],
    ['FLEXIÓN DE TRONCO', 'Abdomen'],
    ['EXTENSIÓN LUMBAR', 'Lumbares'],
  ])('%s ya no se pierde: cuenta a %s', (categoria, grupo) => {
    expect(grupoPrimario(categoria)).toBe(grupo)
  })

  it.each(['ABDUCCIÓN DE HOMBRO', 'ABDUCCIÓN HORIZONTAL'])(
    '%s cuenta a hombro, no a glúteo',
    (categoria) => {
      expect(grupoPrimario(categoria)).toBe('Hombros')
      expect(aportesDeCategoria(categoria).map((a) => a.grupo)).not.toContain('Glúteos')
    },
  )
})

/**
 * Mientras queden microciclos sin migrar, la base sigue teniendo categorías por
 * grupo muscular y categorías sucias. No pueden desaparecer del PANEL.
 */
describe('compatibilidad con la taxonomía vieja', () => {
  it.each([
    ['AISLAMIENTO GLÚTEOS', 'Glúteos'],
    ['AISLAMIENTO ISQUIOS', 'Isquios'],
    ['AISLAMIENTO CUÁDRICEPS', 'Cuádriceps'],
    ['AISLAMIENTO PECTORAL', 'Pecho'],
    ['DELTOIDES LATERALES', 'Hombros'],
    ['DELTOIDES POSTERIORES', 'Hombros'],
    ['ESPALDA SUPERIOR', 'Espalda'],
    ['PIERNA UNILATERAL', 'Cuádriceps'],
    ['SENTADILLAS', 'Cuádriceps'],
    ['PANTORRILLAS', 'Pantorrillas'],
    ['ABDOMEN', 'Abdomen'],
    ['ADUCTORES', 'Aductores'],
    ['BÍCEPS', 'Bíceps'],
    ['TRÍCEPS', 'Tríceps'],
  ])('la categoría vieja %s sigue contando a %s', (categoria, grupo) => {
    expect(grupoPrimario(categoria)).toBe(grupo)
  })

  it.each([
    ['EMPUJE PECHO (REST-PAUSE)', 'Pecho'],
    ['GLÚTEO FINISHER', 'Glúteos'],
    ['ISQUIOS · PROXIMAL (PRIORIDAD 1)', 'Isquios'],
    ['DELTOIDES LATERAL (2ª DOSIS)', 'Hombros'],
    ['TRACCIÓN HORIZONTAL (A2)', 'Espalda'],
    ['CORE ANTI-EXTENSIÓN', 'Abdomen'],
  ])('la categoría sucia %s sigue contando a %s', (categoria, grupo) => {
    expect(grupoPrimario(categoria)).toBe(grupo)
  })

  it('la categoría vieja solo paga directo: no se inventa el indirecto', () => {
    expect(aportesDeCategoria('AISLAMIENTO GLÚTEOS')).toEqual([{ grupo: 'Glúteos', factor: 1 }])
  })

  it.each([
    ['AISLAMIENTO', 'Curl femoral sentado', 'Isquios'],
    ['AISLAMIENTO', 'Abducción de cadera en máquina', 'Glúteos'],
    ['AISLAMIENTO', 'Elevaciones laterales con mancuernas', 'Hombros'],
    ['AISLAMIENTO', 'Curl de bíceps en banco inclinado', 'Bíceps'],
    ['AISLAMIENTO', 'Extensión de tríceps en polea con cuerda', 'Tríceps'],
    ['AISLAMIENTO', 'Elevación de gemelo de pie', 'Pantorrillas'],
    ['SUPERSERIE A1', 'Sentadilla búlgara con mancuernas', 'Cuádriceps'],
    ['DROP SET', 'Press de banca con barra', 'Pecho'],
  ])('cae al nombre cuando la categoría %s no dice nada: %s → %s', (categoria, nombre, grupo) => {
    expect(grupoPrimario(categoria, nombre)).toBe(grupo)
  })

  it('la categoría manda sobre el nombre cuando ella sí es clara', () => {
    // «Face pull» calza con el patrón de espalda, pero la categoría dice hombro.
    expect(grupoPrimario('DELTOIDES POSTERIORES', 'Face pull en polea alta')).toBe('Hombros')
    // Y al revés: «Jalón al pecho» es espalda, no pecho.
    expect(grupoPrimario('ESPALDA SUPERIOR', 'Jalón al pecho en polea')).toBe('Espalda')
  })

  it('las categorías ambiguas por construcción ceden ante el nombre', () => {
    expect(grupoPrimario('DOMINANTE DE CADERA', 'Hip thrust con barra')).toBe('Glúteos')
    expect(grupoPrimario('DOMINANTE DE CADERA', 'Peso muerto rumano con barra')).toBe('Isquios')
    expect(grupoPrimario('DOMINANTE DE RODILLA', 'Prensa 45° pies altos')).toBe('Cuádriceps')
    // Y siguen resolviendo cuando el nombre tampoco aporta.
    expect(grupoPrimario('DOMINANTE DE CADERA', 'Ejercicio sin pistas')).toBe('Glúteos')
  })

  it('devuelve vacío cuando no hay forma de saberlo', () => {
    expect(aportesDeCategoria('CARDIO HIIT')).toEqual([])
    expect(aportesDeCategoria('ENTRADA/PASARELA')).toEqual([])
    expect(aportesDeCategoria('COMBINADO')).toEqual([])
  })
})

describe('pico de exigencia', () => {
  it('las 34 categorías están decididas: con pico, o excluidas a propósito', () => {
    const sinPico = CATEGORIAS.filter((c) => !PICO_DE_EXIGENCIA[c])
    // Isométricas (no hay recorrido que perder) y las que no van al fallo.
    expect([...sinPico].sort()).toEqual([
      'ACONDICIONAMIENTO',
      'ANTIEXTENSIÓN',
      'ANTIFLEXIÓN LATERAL',
      'ANTIRROTACIÓN',
      'EXTENSIÓN DE MUÑECA',
      'FLEXIÓN DE MUÑECA',
      'MOVILIDAD',
      'PREV/REHAB',
    ])
  })

  it('no hay claves inventadas en la tabla de picos', () => {
    for (const clave of Object.keys(PICO_DE_EXIGENCIA)) {
      expect(CATEGORIAS).toContain(clave)
    }
  })

  it('las resueltas contra la doctrina de perfiles-de-resistencia §2.1', () => {
    // Donde el segmento queda más horizontal está el pico.
    expect(PICO_DE_EXIGENCIA['SENTADILLA']).toBe('inicio')          // máxima profundidad
    expect(PICO_DE_EXIGENCIA['BISAGRA DE CADERA']).toBe('inicio')   // al despegue
    expect(PICO_DE_EXIGENCIA['EXTENSIÓN DE RODILLA']).toBe('final') // tibia horizontal
    expect(PICO_DE_EXIGENCIA['FLEXIÓN DE CODO']).toBe('medio')      // antebrazo a 90°
  })

  it('las dos resueltas por observación del coach el 25/08', () => {
    // En máquina la regla de la palanca no basta: la leva no deja caer la
    // resistencia y se falla sin cerrar.
    expect(PICO_DE_EXIGENCIA['FLEXIÓN DE RODILLA']).toBe('final')
    expect(PICO_DE_EXIGENCIA['TRACCIÓN HORIZONTAL']).toBe('final')
  })
})

describe('técnica declarada en la prescripción', () => {
  // Sigue vivo aunque el ancla se retirara: es lo que le dirá a la UI que ese
  // ejercicio lleva mini-bloques que capturar en `SerieRegistrada.extra`.
  it('la detecta venga en el cue o en la frase', () => {
    expect(tieneTecnicaDeclarada('parciales abajo al final', '')).toBe(true)
    expect(tieneTecnicaDeclarada('', 'ULTIMA SERIE EN REST-PAUSE')).toBe(true)
    expect(tieneTecnicaDeclarada('', '3 SERIES (RIR 2) EN MYO-REPS')).toBe(true)
  })

  it('también el recorrido reducido, que es lo contrario pero también se declara', () => {
    expect(tieneTecnicaDeclarada('', 'SERIES 1 A 3: RECORRIDO PARCIAL')).toBe(true)
    expect(tieneTecnicaDeclarada('', 'CRUCE EN POLEA A RANGO MEDIO')).toBe(true)
  })

  it('un ejercicio normal no la declara: el rango completo es el defecto', () => {
    expect(tieneTecnicaDeclarada('Rango completo, espalda pegada', '40KG A 10 REPS')).toBe(false)
  })
})
