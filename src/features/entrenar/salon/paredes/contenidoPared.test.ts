import { describe, expect, it } from 'vitest'
import { CAMPOS_DE_PARED, contenidoDelCardio, contenidoPared, hayEncuadre, huellaDeTexto } from './contenidoPared'
import { MURO_DERECHO, MURO_IZQUIERDO } from './muros'
import { TOPE_PARED } from '../huecos'
import type { EjercicioPrescrito, ItemMarcable } from '../../../../domain/types'

/**
 * LO QUE CUELGA DE LAS PAREDES, PROBADO.
 *
 * `contenidoPared()` decide qué lee el asesorado mientras entrena y qué se va al panel de
 * abajo, y hasta hoy no tenía ni una prueba: se escribió, se miró en pantalla y se dio por
 * bueno. El archivo promete dos cosas en su encabezado —que ningún texto de pared pasa de
 * `TOPE_PARED` y que **recortar no es tirar**— y las dos son comprobables sin abrir el
 * navegador, porque la función es pura.
 *
 * Las pruebas se escribieron ANTES de tocar el archivo, contra el código como estaba, que
 * es la regla de este repo para un módulo sin cobertura: si una pasa por casualidad no
 * sirve de red, así que cada una se vio fallar con un señuelo antes de darla por buena.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'EMPUJE HORIZONTAL',
    nombre: 'Press de banca con barra',
    cues: 'Escápulas retraídas y pegadas al banco. Baja a la línea del pezón, no al cuello.',
    prescripcion: '80KG A 8 REPS; 3 SERIES (RIR 2).',
    cargaKg: 80,
    descansoMin: 3,
    sets: 3,
    rango: '(8-10)',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

describe('el ejercicio que solo trae el camino rojo', () => {
  /**
   * EL QUE TIRÓ LA PESTAÑA ENTRENAR EN PRODUCCIÓN el 2026-09-07 por la mañana. Bryan mandó
   * la captura del iPhone: «undefined is not an object (evaluating
   * 'e.escenarios.verde.techoCargaKg')».
   *
   * Medido en la base ese día, solo cifras: de 482 ejercicios en microciclos activos, 477
   * traían `escenarios`, y **los 477 sin rama `verde`** —ninguno sin `rojo`—, en 22
   * microciclos. O sea, toda la cartera activa. El tipo decía que `verde` era obligatorio y
   * los datos decían que no, y este módulo comprobaba `escenarios ?` y luego leía
   * `.verde.techoCargaKg` sin más. El muro entero se caía, y con él la pestaña.
   *
   * Lo que se afirma: sin camino verde escrito el muro sigue en pie, el camino rojo se lee
   * igual, y el hueco de «si el día viene bueno» dice que no hay nada autorizado en vez de
   * inventarse un techo.
   */
  const soloRojo = ejercicio({
    escenarios: { rojo: { deltaRir: 1, sueloRir: 3, quitarUltimaSerie: true } },
  })

  it('no revienta: el muro se lee', () => {
    expect(() => contenidoPared(soloRojo)).not.toThrow()
  })

  it('el día malo se sigue leyendo entero', () => {
    const malo = contenidoPared(soloRojo).alPanel.find((x) => x.titulo === 'Si el día viene malo')
    expect(malo?.texto).toContain('1 escalón')
    expect(malo?.texto).toContain('RIR 3')
    expect(malo?.texto).toContain('última serie')
  })

  it('y el día bueno dice que no hay nada autorizado, sin inventar un techo', () => {
    const bueno = contenidoPared(soloRojo).alPanel.find((x) => x.titulo === 'Si el día viene bueno')
    expect(bueno?.texto).toBeDefined()
    expect(bueno?.texto).not.toMatch(/Techo/)
    expect(bueno?.texto).toMatch(/no hay|sin camino/i)
  })
})

describe('contenidoPared', () => {
  it('devuelve un texto para cada campo declarado, y ninguno vacío', () => {
    const c = contenidoPared(ejercicio())
    for (const clave of CAMPOS_DE_PARED) {
      expect(c[clave], `el campo ${clave} salió vacío`).toBeTruthy()
      expect(c[clave].trim().length, `el campo ${clave} salió vacío`).toBeGreaterThan(0)
    }
  })

  it('ningún texto de pared pasa del tope: una pared se lee de reojo', () => {
    // Con los textos más largos que el dominio puede dar: cues de tres frases, ondulado y
    // una categoría con plan de medida. Si algo se pasa, se pasa aquí.
    const c = contenidoPared(
      ejercicio({
        nombre: 'Press de banca con barra en banco declinado y agarre cerrado',
        cues: 'Escápulas retraídas y pegadas al banco durante toda la serie. Baja a la línea del pezón, nunca al cuello. Los pies clavados en el suelo desde la primera repetición.',
        seriesPrescritas: [
          { orden: 1, reps: 10, cargaKg: 72.5, rir: 3 },
          { orden: 2, reps: 8, cargaKg: 80, rir: 2 },
          { orden: 3, reps: 6, cargaKg: 87.5, rir: 1 },
        ],
        pvObjetivo: 25,
      }),
    )
    for (const clave of CAMPOS_DE_PARED) {
      expect(
        Array.from(c[clave]).length,
        `${clave} mide ${Array.from(c[clave]).length} y el tope es ${TOPE_PARED}: "${c[clave]}"`,
      ).toBeLessThanOrEqual(TOPE_PARED)
    }
  })

  /**
   * LA INVARIANTE DEL ARCHIVO, y la razón de que recortar no pierda nada.
   *
   * Para cada campo: o su texto completo ESTÁ en la pared, o está entero en `alPanel`.
   * Nunca en ninguno de los dos, que es exactamente cómo se pierde información sin que
   * nadie lo note — un texto cortado se lee como un texto entero.
   */
  it('lo que no cabe arriba baja entero: ningún campo se queda sin sitio', () => {
    const largo = contenidoPared(
      ejercicio({
        cues: 'Escápulas retraídas y pegadas al banco durante toda la serie. Baja a la línea del pezón, nunca al cuello.',
      }),
    )
    const abajo = new Set(largo.alPanel.filter((t) => t.campo).map((t) => t.campo))
    for (const clave of CAMPOS_DE_PARED) {
      const cabeArriba = !largo[clave].endsWith('…')
      expect(
        cabeArriba || abajo.has(clave),
        `${clave} salió recortado en la pared ("${largo[clave]}") y no bajó al panel`,
      ).toBe(true)
    }
  })

  it('los dos muros reparten los campos: los declarados, cada uno una vez', () => {
    const juntos = [...MURO_IZQUIERDO, ...MURO_DERECHO]
    expect(new Set(juntos).size).toBe(juntos.length)
    expect([...juntos].sort()).toEqual([...CAMPOS_DE_PARED].sort())
  })

  /**
   * `FALLO` NO ES `RIR 0`. Es la unidad de cuenta del método y no una forma de hablar: el
   * cero es la última repetición completa con la parcial en reserva, y el fallo es la
   * instrucción de meterse en esa parcial. Escribir «RIR 0» donde el coach pidió el fallo
   * cambia lo prescrito, y el asesorado lo lee en la pared mientras entrena.
   */
  it('cuando el objetivo es el fallo, la pared no lo escribe como RIR 0', () => {
    const c = contenidoPared(ejercicio({ rirObjetivo: 'FALLO' }))
    expect(c.rir).not.toMatch(/RIR\s*0/i)
    expect(c.rir.toUpperCase()).toContain('FALLO')
  })

  /**
   * LA CARGA, EN LA PARED.
   *
   * Bryan lo dejó anotado al cerrar el salón el 2026-09-03: «la carga en kg no está en el
   * cartel de la pared, solo en el mando». Y el mando es un botón que se pliega — mirar
   * cuánto hay que poner en la barra no puede depender de desplegar un control.
   */
  it('los kilos prescritos se leen en la pared, no solo en el mando', () => {
    const c = contenidoPared(ejercicio({ cargaKg: 80 }))
    const enLaPared = CAMPOS_DE_PARED.map((k) => c[k]).join(' | ')
    expect(enLaPared, `la pared no dice los kilos: ${enLaPared}`).toMatch(/80\s*kg/i)
  })

  it('sin kilos prescritos la pared no se inventa un número', () => {
    // `cargaKg` sin definir NO es carga cero: es «esta prescripción no lleva kilos»
    // —porcentajes, peso corporal, tiempo—. Un «0 kg» en la pared sería una carga.
    const c = contenidoPared(ejercicio({ cargaKg: undefined }))
    const enLaPared = CAMPOS_DE_PARED.map((k) => c[k]).join(' | ')
    expect(enLaPared).not.toMatch(/\d\s*kg/i)
  })

  it('el matiz de la unidad acompaña a los kilos y no se dice dos veces', () => {
    const porLado = contenidoPared(ejercicio({ cargaKg: 22.5, unidadCarga: 'por lado' }))
    const enLaPared = CAMPOS_DE_PARED.map((k) => porLado[k]).join(' | ')
    expect(enLaPared).toMatch(/22,5\s*kg/)
    expect(enLaPared).toContain('por lado')
    expect(enLaPared).not.toMatch(/kg\s*\(kg\)/)
  })
})

describe('huellaDeTexto', () => {
  it('el mismo texto da la misma huella y dos distintos no la comparten', () => {
    expect(huellaDeTexto('escápulas retraídas')).toBe(huellaDeTexto('escápulas retraídas'))
    expect(huellaDeTexto('escápulas retraídas')).not.toBe(huellaDeTexto('escapulas retraidas'))
  })
})

/**
 * EL MURO DE UN DÍA DE CARDIO.
 *
 * Nace en rojo el 2026-09-10: sin contenido de pared no se monta el tablón, y un día de
 * cardio abría con la habitación **muda** —sin nombre en trazo y sin código de sala—.
 */
describe('contenidoDelCardio', () => {
  const bloque = (titulo: string, indicaciones: string, duracionMin?: number): ItemMarcable => ({
    id: titulo,
    titulo,
    indicaciones,
    duracionMin,
  })
  const METABOLICO = [
    bloque('Calentamiento: 5 min trote suave', 'Ritmo conversacional, zancada corta.', 5),
    bloque('10 × 1 min fuerte / 1 min suave', 'El minuto fuerte a RPE 8.', 20),
    bloque('Enfriamiento: 5 min caminata', 'Baja pulsaciones caminando.', 5),
  ]

  it('sin bloques o sin ficha no hay muro que montar', () => {
    expect(contenidoDelCardio(undefined, 'Carrera')).toBeUndefined()
    expect(contenidoDelCardio([], 'Carrera')).toBeUndefined()
    expect(contenidoDelCardio(METABOLICO, undefined)).toBeUndefined()
  })

  it('el nombre en trazo es el de la FICHA, no el título del bloque', () => {
    // «10 × 1 min fuerte / 1 min suave» es la prescripción, no el gesto, y en trazo a 84 px
    // ni cabe ni se lee de lejos.
    expect(contenidoDelCardio(METABOLICO, 'Carrera')?.nombre).toBe('Carrera')
  })

  it('dice los tramos y los minutos en la lengua del cardio', () => {
    expect(contenidoDelCardio(METABOLICO, 'Carrera')?.seriesReps).toBe('3 tramos · 30 min')
  })

  it('saca la intensidad escrita, y dice que no está cuando no está', () => {
    expect(contenidoDelCardio(METABOLICO, 'Carrera')?.rir).toBe('RPE 8')
    const sinNada = contenidoDelCardio([bloque('20 min caminata', 'Suave.', 20)], 'Caminata')
    expect(sinNada?.rir).toBe('Sin intensidad escrita')
  })

  it('la carga va vacía: en cardio no hay kilos, y el hueco se queda con el reloj', () => {
    expect(contenidoDelCardio(METABOLICO, 'Carrera')?.carga).toBe('')
  })

  it('ningún texto pasa del tope de la pared', () => {
    const c = contenidoDelCardio(METABOLICO, 'Carrera')!
    for (const campo of CAMPOS_DE_PARED) {
      expect(c[campo].length, `${campo} pasa de ${TOPE_PARED}`).toBeLessThanOrEqual(TOPE_PARED)
    }
  })
})

describe('hayEncuadre', () => {
  it('un ejercicio de hierro tiene encuadre que contar', () => {
    expect(hayEncuadre(contenidoPared(ejercicio()))).toBe(true)
  })

  it('un día de cardio NO, y por eso el panel no pinta ese recuadro', () => {
    const c = contenidoDelCardio(
      [{ id: 'b', titulo: '30 min bici zona 2', indicaciones: 'Continuo.', duracionMin: 30 }],
      'Bicicleta',
    )!
    expect(hayEncuadre(c)).toBe(false)
  })
})
