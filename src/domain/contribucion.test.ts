import { describe, expect, it } from 'vitest'
import {
  CONTRIBUCION,
  contribucionDeEjercicio,
  implementoDeEjercicio,
  motivoSinContribucion,
  reconocerMovimiento,
} from './contribucion'

/**
 * El catálogo cerrado de movimientos y su reparto fraccionado.
 * Diseño y evidencia: `docs/specs/2026-08-12-reparto-de-volumen-por-zona-diseno.md`.
 *
 * Lo que más se prueba aquí es **el orden**, porque es donde este tipo de tabla
 * falla: el primer patrón que calza gana, así que un patrón goloso colocado
 * antes se traga ejercicios que no le tocan. Ya pasó una vez —`FONDO` estaba
 * dentro de `triceps` y los fondos en paralelas contaban como tríceps puro— y
 * esos casos están cubertos uno a uno más abajo.
 */

describe('reconocerMovimiento — trampas de orden', () => {
  it('los fondos en paralelas son de pecho, no de tríceps', () => {
    expect(reconocerMovimiento('PECHO', 'Fondos en paralelas')).toBe('fondos')
    expect(reconocerMovimiento('TRÍCEPS', 'Fondos con lastre')).toBe('fondos')
    expect(reconocerMovimiento('TRÍCEPS', 'Extensión de codo en polea')).toBe('triceps')
  })

  it('la extensión de cadera en banco romano es bisagra, no patada de glúteo', () => {
    // Contiene literalmente «extensión de cadera»: sin el orden correcto la
    // atrapa `extension-cadera` y pierde isquios, cuádriceps y erectores.
    expect(reconocerMovimiento('GLÚTEO', 'Extensión de cadera en banco 45°')).toBe(
      'bisagra-rodilla-flexionada',
    )
    expect(reconocerMovimiento('LUMBAR', 'Hiperextensión en banco romano')).toBe(
      'bisagra-rodilla-flexionada',
    )
    expect(reconocerMovimiento('GLÚTEO', 'Patada de glúteo en polea')).toBe('extension-cadera')
  })

  it('el pull-through es bisagra de rodilla extendida, no patada', () => {
    expect(reconocerMovimiento('GLÚTEO', 'Pull-through en polea')).toBe(
      'bisagra-rodilla-extendida',
    )
    expect(reconocerMovimiento('CADERA', 'Extensión de cadera entre piernas en polea')).toBe(
      'bisagra-rodilla-extendida',
    )
  })

  it('la sentadilla búlgara es zancada, no sentadilla', () => {
    expect(reconocerMovimiento('PIERNA UNILATERAL', 'Sentadilla búlgara')).toBe('zancada-split')
    expect(reconocerMovimiento('CUÁDRICEPS', 'Sentadilla libre con barra')).toBe('sentadilla')
  })

  it('el rumano y el stiff se separan del peso muerto convencional', () => {
    expect(reconocerMovimiento('BISAGRA', 'Peso muerto rumano')).toBe(
      'bisagra-rodilla-extendida',
    )
    expect(reconocerMovimiento('BISAGRA', 'Peso muerto stiff')).toBe('bisagra-rodilla-extendida')
    expect(reconocerMovimiento('BISAGRA', 'Peso muerto convencional')).toBe(
      'bisagra-rodilla-flexionada',
    )
    expect(reconocerMovimiento('BISAGRA', 'Rack pull desde rack')).toBe(
      'bisagra-rodilla-flexionada',
    )
  })

  it('«peso muerto (bisagra)» va a flexionada, no lo desvía la palabra bisagra', () => {
    expect(reconocerMovimiento('DOMINANTE DE CADERA', 'Peso muerto (bisagra)')).toBe(
      'bisagra-rodilla-flexionada',
    )
  })

  it('la mecánica de aterrizaje no es trabajo de pierna aunque diga «cajón»', () => {
    expect(reconocerMovimiento('PREV', 'Aterrizaje amortiguado desde cajón')).toBeUndefined()
    expect(reconocerMovimiento('PREV', 'Drop squat desde cajón bajo')).toBeUndefined()
    // Y la subida al cajón sí cuenta.
    expect(reconocerMovimiento('PIERNA UNILATERAL', 'Subida al cajón con mancuernas')).toBe(
      'subida-al-cajon',
    )
  })

  it('la subida al cajón y la zancada inversa se separan de la búlgara', () => {
    // Van antes en el orden porque `zancada-split` lleva CAJON en su patrón.
    for (const nombre of ['STEP UP', 'Subida al cajón con mancuernas', 'Zancada inversa']) {
      expect(reconocerMovimiento('PIERNA UNILATERAL', nombre)).toBe('subida-al-cajon')
    }
    // La bajada controlada es descenso excéntrico: se queda con la rodilla.
    expect(reconocerMovimiento('PIERNA UNILATERAL', 'Bajada controlada desde cajón')).toBe(
      'zancada-split',
    )
  })

  it('la subida al cajón reparte al revés que la búlgara', () => {
    expect(contribucionDeEjercicio('PIERNA UNILATERAL', 'Subida al cajón en máquina')).toEqual({
      Glúteos: 1,
      Cuádriceps: 0.5,
    })
    expect(contribucionDeEjercicio('PIERNA UNILATERAL', 'Sentadilla búlgara en Smith')).toEqual({
      Cuádriceps: 1,
      Glúteos: 0.5,
    })
  })

  it('las palabras de «no cuenta» dentro de un ejercicio legítimo no lo anulan', () => {
    // Regresión: la primera versión comprobaba el filtro de «no cuenta» ANTES
    // del catálogo y se comía 129 series de trabajo real, porque «isometría» y
    // «estabilidad» viven dentro de nombres de ejercicios que sí cuentan. El
    // core solo caía de 236 a 185 series.
    expect(reconocerMovimiento('CORE', 'Plancha isométrica')).toBe('core')
    expect(reconocerMovimiento('CORE', 'Plancha con estabilidad sobre balón')).toBe('core')
    expect(reconocerMovimiento('CUÁDRICEPS', 'Sentadilla con pausa isométrica')).toBe('sentadilla')
    expect(reconocerMovimiento('GLÚTEO', 'Hip thrust isométrico')).toBe('hip-thrust')
  })

  it('lo que no es trabajo de fuerza no devuelve movimiento', () => {
    expect(reconocerMovimiento('PREV', 'Rotación externa con banda')).toBeUndefined()
    expect(reconocerMovimiento('ACONDICIONAMIENTO', 'Bicicleta 10 min')).toBeUndefined()
    expect(reconocerMovimiento('MOVILIDAD', 'Movilidad de cadera')).toBeUndefined()
  })

  it('la ortografía no decide: el mismo ejercicio escrito de varias formas cae igual', () => {
    // Es el fallo que arrastraba `grupoDeCategoria`: «BÚLGARA EN SMITH» no
    // contaba para nadie y «Sentadilla búlgara» sí.
    for (const nombre of ['BÚLGARA EN SMITH', 'Búlgara con mancuerna', 'Sentadilla búlgara']) {
      expect(reconocerMovimiento('', nombre)).toBe('zancada-split')
    }
    for (const nombre of ['Zancada con mancuernas', 'ZANCADA CAMINANDO', 'Zancada en déficit']) {
      expect(reconocerMovimiento('', nombre)).toBe('zancada-split')
    }
  })
})

describe('motivoSinContribucion — separa el agujero del descarte', () => {
  it('distingue lo que no debe contar de lo que no sabemos clasificar', () => {
    expect(motivoSinContribucion('PREV', 'Rotación externa con banda')).toBe('no-cuenta')
    expect(motivoSinContribucion('ACONDICIONAMIENTO', 'Bicicleta 10 min')).toBe('no-cuenta')
    expect(motivoSinContribucion('SUPERSERIE A1', 'Ejercicio raro sin patrón')).toBe(
      'sin-clasificar',
    )
  })

  it('no da motivo cuando el ejercicio sí reparte', () => {
    expect(motivoSinContribucion('CUÁDRICEPS', 'Sentadilla')).toBeUndefined()
  })
})

describe('la escala solo admite 1 y 0,5', () => {
  it('ningún movimiento reparte valores fuera de la escala', () => {
    for (const [movimiento, reparto] of Object.entries(CONTRIBUCION)) {
      for (const [grupo, valor] of Object.entries(reparto)) {
        expect([1, 0.5], `${movimiento} → ${grupo}`).toContain(valor)
      }
    }
  })

  it('todo movimiento que cuenta tiene exactamente un grupo primario', () => {
    // Un ejercicio sin primario no existe: la escala define el 1 como «el
    // ejercicio existe para entrenar ese grupo».
    for (const [movimiento, reparto] of Object.entries(CONTRIBUCION)) {
      const primarios = Object.values(reparto).filter((v) => v === 1)
      expect(primarios, `${movimiento}`).toHaveLength(1)
    }
  })
})

describe('contribucionDeEjercicio — reparto', () => {
  it('la sentadilla suma aductores junto al glúteo', () => {
    expect(contribucionDeEjercicio('CUÁDRICEPS', 'Sentadilla en máquina')).toEqual({
      Cuádriceps: 1,
      Glúteos: 0.5,
      Aductores: 0.5,
    })
  })

  it('el remo da hombro, que era la omisión del primer borrador', () => {
    expect(contribucionDeEjercicio('ESPALDA', 'Remo en máquina')).toEqual({
      Espalda: 1,
      Bíceps: 0.5,
      Hombros: 0.5,
    })
  })

  it('la bisagra de rodilla flexionada manda al glúteo y la extendida al isquio', () => {
    expect(contribucionDeEjercicio('BISAGRA', 'Peso muerto convencional en máquina')).toEqual({
      Glúteos: 1,
      Isquios: 0.5,
      Cuádriceps: 0.5,
      Erectores: 0.5,
    })
    expect(contribucionDeEjercicio('BISAGRA', 'Peso muerto rumano en máquina')).toEqual({
      Isquios: 1,
      Glúteos: 0.5,
      Erectores: 0.5,
    })
  })

  it('un ejercicio que no cuenta devuelve un reparto vacío', () => {
    expect(contribucionDeEjercicio('PREV', 'Rotación externa con banda')).toEqual({})
  })

  it('devuelve un objeto nuevo: mutarlo no envenena la tabla', () => {
    const uno = contribucionDeEjercicio('CUÁDRICEPS', 'Sentadilla')
    uno.Glúteos = 1
    expect(contribucionDeEjercicio('CUÁDRICEPS', 'Sentadilla').Glúteos).toBe(0.5)
  })
})

describe('implementoDeEjercicio — el impuesto de estabilización', () => {
  it('lo guiado gana aunque el nombre diga barra o sea unilateral', () => {
    expect(implementoDeEjercicio('', 'Búlgara en Smith')).toBe('guiado')
    expect(implementoDeEjercicio('', 'Sentadilla en máquina Smith con barra guiada')).toBe(
      'guiado',
    )
    expect(implementoDeEjercicio('', 'Prensa de piernas unilateral')).toBe('guiado')
  })

  it('reconoce el peso libre bilateral y el unilateral', () => {
    expect(implementoDeEjercicio('', 'Sentadilla libre con barra')).toBe('libre-bilateral')
    expect(implementoDeEjercicio('', 'Zancada con mancuernas (unilateral)')).toBe(
      'libre-unilateral',
    )
    expect(implementoDeEjercicio('', 'Swing con kettlebell')).toBe('libre-bilateral')
  })

  it('cuando el nombre no lo dice, asume guiado — el conservador', () => {
    expect(implementoDeEjercicio('GLÚTEO', 'Hip thrust')).toBe('guiado')
    expect(implementoDeEjercicio('ESPALDA', 'Remo')).toBe('guiado')
  })
})

describe('el modificador de implemento solo toca estabilizadores', () => {
  it('el peso libre bilateral añade erectores', () => {
    const guiado = contribucionDeEjercicio('ESPALDA', 'Remo en máquina')
    const libre = contribucionDeEjercicio('ESPALDA', 'Remo con barra')
    expect(guiado.Erectores).toBeUndefined()
    expect(libre.Erectores).toBe(0.5)
  })

  it('el peso libre unilateral añade abdomen por la demanda antirrotacional', () => {
    const libre = contribucionDeEjercicio('ESPALDA', 'Remo con mancuerna a una mano (unilateral)')
    expect(libre.Abdomen).toBe(0.5)
    expect(libre.Erectores).toBeUndefined()
  })

  it('nunca cambia el grupo primario ni sus sinergistas', () => {
    // La evidencia no respalda que el implemento cambie la hipertrofia del
    // objetivo: metaanálisis sin diferencias libre vs máquina.
    const guiado = contribucionDeEjercicio('CUÁDRICEPS', 'Sentadilla en máquina')
    const libre = contribucionDeEjercicio('CUÁDRICEPS', 'Sentadilla libre con barra')
    for (const grupo of ['Cuádriceps', 'Glúteos', 'Aductores'] as const) {
      expect(libre[grupo]).toBe(guiado[grupo])
    }
  })

  it('no empuja los erectores por encima de 1 cuando el movimiento ya los daba', () => {
    const rumano = contribucionDeEjercicio('BISAGRA', 'Peso muerto rumano con barra')
    expect(rumano.Erectores).toBe(1)
  })

  it('no añade nada a un ejercicio que no cuenta', () => {
    expect(contribucionDeEjercicio('PREV', 'Movilidad de cadera con barra')).toEqual({})
  })
})
