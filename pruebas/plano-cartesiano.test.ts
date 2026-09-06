import { describe, expect, it } from 'vitest'
import { PATRONES } from '../src/domain/patrones/catalogo'
import { CATEGORIAS } from '../src/domain/taxonomia'
import { poseAnimada } from '../src/domain/patrones/movimiento'
import { informeDelPlano, planoDe, planoDeId } from './plano-cartesiano'

/**
 * EL PLANO CARTESIANO DE LAS CINCO FICHAS NUEVAS, medido.
 *
 * Las cinco fichas del 2026-09-06 —flexión de hombro, rotación de cadera, extensión
 * lumbar y las dos muñecas— cierran el hueco del barrido de patrones. Que existan no
 * dice que estén bien: una ficha con los ángulos mal escritos pasa igual el recuento
 * de cobertura y enseña un gesto que no es.
 *
 * Aquí se mide lo que de verdad hace cada una cuando el motor la anima: cuántos grados
 * recorre cada articulación, qué segmento se mueve sobre cuál, por dónde pasa el punto
 * seguido en los tres ejes del mundo, y cuánto brazo de momento le queda a cada eje en
 * cada fase. Los números van clavados por la misma razón que en
 * `cobertura-de-patrones.test.ts`: un `toBeGreaterThan` dejaría que un ángulo cambiara
 * de sitio sin que nadie se enterase.
 *
 * Se afirma poco y de lo que decide el gesto. Clavar los 26 puntos de la traza sería
 * clavar el motor de animación entero, y este archivo dejaría de hablar del catálogo.
 */

const IDS_NUEVOS = [
  'flexion_hombro',
  'rotacion_cadera',
  'extension_lumbar',
  'flexion_muneca',
  'extension_muneca',
]

describe('las cinco fichas nuevas, en el plano', () => {
  it('la elevación frontal sube la mano y casi no la desplaza de lado', () => {
    const p = planoDeId('flexion_hombro')
    expect(p.traza?.hueso).toBe('manoD')
    // Sube de la cadera (80 cm) a la altura de los ojos (155 cm): 76 cm de recorrido, y el
    // gesto entero está en la vertical. Medido el 2026-09-06 **con el varón real como juego
    // de huesos por defecto** (commit 7eed7a0). Con el neutro anterior daba 80 cm, así que
    // el umbral va holgado a propósito: lo que se afirma es la FORMA del gesto —sube mucho,
    // no se va de lado—, no la estatura del muñeco que lo hace.
    expect(p.traza!.vertical).toBeGreaterThan(50)
    // Y el barrido frontal es de 5 cm y no de cero: no lo pone la ficha, lo pone la capa
    // de contrapeso de `movimiento.ts`, que mece un poco lo que no trabaja. Lo que
    // importa es que sea despreciable frente a los 80 de vertical: una elevación FRONTAL
    // que se fuera de lado sería una elevación LATERAL, que es otro patrón y otro
    // deltoides.
    expect(p.traza!.frontal).toBeLessThan(8)
  })

  it('la rotación de cadera NO sube nada: barre en el eje frontal', () => {
    const p = planoDeId('rotacion_cadera')
    // Es la comprobación que justifica su cámara desde arriba. Un gesto del plano
    // transverso con la cámara de perfil es una línea: aquí el recorrido está en X,
    // el eje que la cámara sagital NO ve.
    expect(p.traza!.frontal).toBeGreaterThan(p.traza!.vertical)
    expect(p.traza!.frontal).toBeGreaterThan(20)
    // Y las dos caderas giran, no una: el 90/90 es simétrico y opuesto.
    const cadera = p.articulaciones.find((a) => a.nombre === 'Cadera')
    expect(cadera?.ejes.some((e) => e.plano === 'transverso' && e.recorrido >= 70)).toBe(true)
  })

  it('la extensión lumbar reparte el recorrido entre columna y cadera', () => {
    const p = planoDeId('extension_lumbar')
    const de = (nombre: string) =>
      p.articulaciones.find((a) => a.nombre === nombre)?.ejes.find((e) => e.plano === 'sagital')
        ?.recorrido ?? 0
    // La mitad la pone la cadera, y por eso el ejercicio entrena glúteo e isquio tanto
    // como erectores: llamarlo «de espalda» a secas es la mitad de la verdad.
    expect(de('Columna lumbar')).toBeGreaterThan(50)
    expect(de('Cadera')).toBeGreaterThan(30)
    // En cadena cerrada el punto fijo está abajo, así que la relación se invierte: es
    // la pelvis la que se mueve sobre el fémur y no al revés.
    expect(p.articulaciones.find((a) => a.nombre === 'Cadera')?.movil).toBe('Pelvis')
  })

  it('las dos muñecas recorren su rango entero y en sentidos opuestos', () => {
    const flexion = planoDeId('flexion_muneca')
    const extension = planoDeId('extension_muneca')
    const eje = (p: ReturnType<typeof planoDeId>) =>
      p.articulaciones.find((a) => a.nombre === 'Muñeca')?.ejes.find((e) => e.plano === 'sagital')
    // Escrito en la ficha: 114° de flexión y 106° de extensión. Medido sobre el motor:
    // 101° y 94°. La diferencia NO es un error de la ficha, es el retardo distal de
    // `movimiento.ts`: la muñeca es lo más distal de la cadena y llega tarde, así que al
    // llegar la fase 1 todavía le faltan trece grados. Se deja escrito porque cambia lo
    // que hay que escribir en una ficha de articulación pequeña: para ver el rango
    // entero hay que pedir más del que se quiere ver.
    expect(eje(flexion)!.recorrido).toBeGreaterThan(90)
    expect(eje(extension)!.recorrido).toBeGreaterThan(90)
    // El signo es lo que las distingue: una va de extendida a flexionada y la otra al
    // revés. Sin esto serían la misma ficha con dos nombres.
    expect(eje(flexion)!.hasta).toBeGreaterThan(eje(flexion)!.desde)
    expect(eje(extension)!.hasta).toBeLessThan(eje(extension)!.desde)
  })

  it('cada ficha nueva tiene articulación motora, y no es una cualquiera', () => {
    const motoras: Record<string, string> = {
      flexion_hombro: 'Hombro',
      rotacion_cadera: 'Cadera',
      extension_lumbar: 'Columna lumbar',
      flexion_muneca: 'Muñeca',
      extension_muneca: 'Muñeca',
    }
    for (const [id, esperada] of Object.entries(motoras)) {
      const p = planoDeId(id)
      const motor = p.articulaciones.filter((a) => a.rol === 'motor').map((a) => a.nombre)
      expect(motor, `${id}: motoras ${motor.join(', ')}`).toContain(esperada)
    }
  })
})

describe('lo que el plano dice de TODO el catálogo', () => {
  it('solo un patrón se queda sin modelo de palanca, y es una decisión, no un hueco', () => {
    // Esta prueba nació el 2026-09-06 diciendo CINCO, y ese día se puso roja: era el
    // recuento de un hueco, no de una decisión, y el hueco se cerró unas horas después.
    //
    // La tabla mecánica va indexada por las 34 categorías CANÓNICAS de `taxonomia.ts`, y
    // el catálogo 3D tiene fichas con categorías que no están ahí. Cuatro se dibujaban sin
    // ninguna flecha de fuerza por ese desajuste de índice —salto, rotación externa de
    // hombro, apoyo a una pierna y suspensión, que son 19 de las 150 familias que se
    // prescriben de verdad—, y ahora las nombra `MODELOS_DE_FICHA`.
    //
    // El que queda es distinto: `movilidad_toracica` SÍ tiene categoría canónica y su
    // modelo está escrito `null` a propósito, porque una movilidad no tiene carga contra
    // la que medir palanca. Va clavado a uno para que un hueco nuevo no se pueda esconder
    // detrás de esa excepción.
    const sinModelo = PATRONES.filter((p) => planoDe(p).linea === 'sin modelo de palanca')
    expect(sinModelo.map((p) => p.id)).toEqual(['movilidad_toracica'])
    expect(CATEGORIAS as readonly string[]).toContain(sinModelo[0].categoria)
  })

  it('la cadena de la ficha no contradice a la del modelo mecánico', () => {
    // Dos sitios distintos declaran lo mismo: `Patron.cadena` decide qué segmento se
    // dice que se mueve, y `ModeloDePalanca.cadena` decide contra qué se mide. Si se
    // separan, el desglose y la medida cuentan dos ejercicios distintos del mismo.
    // Se comprueba comparando la única señal que las dos capas comparten sin copiarse:
    // en cadena cerrada `segmentosDe` invierte la relación de manual.
    for (const patron of PATRONES) {
      const plano = planoDe(patron)
      const cadera = plano.articulaciones.find((a) => a.nombre === 'Cadera')
      if (!cadera) continue
      const esperado = patron.cadena === 'cerrada' ? 'Pelvis' : 'Fémur'
      expect(cadera.movil, `${patron.id}: cadena ${patron.cadena}`).toBe(esperado)
    }
  })
})

describe('lo que la ficha declara y lo que el motor llega a enseñar', () => {
  /** El recorrido REAL de un canal a lo largo del ciclo entero, muestreado fino. */
  function recorridoVisto(patron: (typeof PATRONES)[number], canal: string): number {
    let mn = Infinity
    let mx = -Infinity
    for (let i = 0; i <= 200; i++) {
      const v = poseAnimada(patron, i / 200, 1, 0).pose[canal]
      if (v === undefined) continue
      mn = Math.min(mn, v)
      mx = Math.max(mx, v)
    }
    return mx - mn
  }

  /** Todos los canales que declaran al menos 15° de recorrido, con lo que pierden. */
  function perdidas(): { id: string; canal: string; declarado: number; visto: number; parte: number }[] {
    const salida = []
    for (const patron of PATRONES) {
      for (const canal of new Set([...Object.keys(patron.inicio), ...Object.keys(patron.fin)])) {
        const declarado = Math.abs((patron.fin[canal] ?? 0) - (patron.inicio[canal] ?? 0))
        if (declarado < 15) continue
        const visto = recorridoVisto(patron, canal)
        salida.push({ id: patron.id, canal, declarado, visto, parte: (declarado - visto) / declarado })
      }
    }
    return salida
  }

  it('el retardo distal se come parte del recorrido, y cuanto más lejos de la cadera, más', () => {
    // MEDIDO Y NO ARREGLADO, a propósito: arreglarlo cambia cómo se mueve TODO el catálogo
    // y esa decisión no es de esta tanda.
    //
    // El mecanismo está en una línea de `poseAnimada`: cada canal se lee en
    // `fase − retardo`, y la fase va topada a 1. O sea que un canal con retardo nunca
    // llega a leer su fase final: **la ficha declara un ángulo que el salón no enseña
    // nunca**. Cuanto más distal, mayor el retardo y mayor lo que se pierde.
    //
    // Se descubrió persiguiendo los 13° que faltaban en la muñeca, y resultó no ser de la
    // muñeca: es de todo el catálogo. Medido el 2026-09-06 sobre los canales que declaran
    // 15° o más — 70 de 91 pierden algo, con una mediana del 3 % y un techo del 11 % en
    // las dos muñecas, que son lo más distal que hay.
    //
    // Va clavado en la MEDIANA y en el número de afectados y no canal a canal: lo que hay
    // que vigilar es que la pérdida no crezca, no cada decimal.
    const todas = perdidas().filter((x) => x.id !== 'movilidad_toracica' || x.canal !== 'cuelloFlex')
    expect(todas).toHaveLength(90)
    expect(todas.filter((x) => x.parte > 0.01)).toHaveLength(69)
    const partes = todas.map((x) => x.parte).sort((a, b) => a - b)
    expect(partes[Math.floor(partes.length / 2)]).toBeLessThan(0.05)
    // Y el TECHO se mide en GRADOS, no en tanto por ciento, porque el porcentaje aquí
    // engaña: el que peor sale en proporción es `salto toraxFlex` con un 17,7 %, y son
    // 2,8° sobre 16 declarados — nadie ve eso. Los que de verdad se notan son las dos
    // muñecas, que pierden 12 grados enteros. Un cociente con el denominador pequeño
    // fabrica un peor caso que no lo es.
    const enGrados = todas.map((x) => x.declarado - x.visto)
    expect(Math.max(...enGrados)).toBeLessThan(14)
  })

  it('en la movilidad torácica el cuello declara 48° y hace 12: se lo come otra capa', () => {
    // El caso aparte, y no es el retardo: 74 % no lo explica ningún retardo. Lo que pasa
    // es que `movimiento.ts` mantiene la cabeza mirando al frente cuando el tronco se
    // inclina, y esa capa se aplica DESPUÉS de la pose de la ficha. En casi todo el
    // catálogo eso está bien —nadie quiere un maniquí mirándose los pies en una
    // sentadilla— pero aquí el cuello es parte de lo que se enseña: la ficha lo lleva de
    // +26 a −22 a propósito, y de eso se ve una cuarta parte.
    //
    // Medido y no arreglado: tocar la capa de la cabeza afecta a los 36 patrones.
    const patron = PATRONES.find((p) => p.id === 'movilidad_toracica')!
    const declarado = Math.abs((patron.fin.cuelloFlex ?? 0) - (patron.inicio.cuelloFlex ?? 0))
    expect(declarado).toBe(48)
    const visto = recorridoVisto(patron, 'cuelloFlex')
    expect(visto).toBeGreaterThan(10)
    expect(visto).toBeLessThan(16)
  })
})

describe('el plano, para regenerar el informe', () => {
  it('imprime la hoja de las cinco fichas nuevas', () => {
    // `informes/plano-cartesiano-fichas-nuevas.md` sale de aquí. Se imprime para poder
    // volver a sacarlo sin escribir código: `npx vitest run pruebas/plano-cartesiano.test.ts`.
    const texto = informeDelPlano(IDS_NUEVOS)
    console.log(texto)
    expect(texto).toContain('flexion_hombro')
  })
})
