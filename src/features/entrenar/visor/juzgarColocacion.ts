import { calificarEncuadre, encuadre } from '../encoder/nucleo/encuadre'
import type { CalidadEncuadre } from '../encoder/nucleo/encuadre'
import { desvioDe, type Colocacion } from '../../../domain/escenario/tripode'

/**
 * Qué diría la puerta del encoder si se grabara con el trípode donde está.
 *
 * ## Esto NO decide nada
 *
 * Traduce una colocación —ángulo, distancia, altura— a la entrada que espera el núcleo,
 * y quien juzga es `calificarEncuadre()`: **la misma función que juzga una toma de
 * verdad**, con sus mismos topes y sus mismos motivos.
 *
 * Reimplementar la regla aquí habría sido lo fácil y lo peor. Dos puertas que nacen
 * iguales se separan en el primer ajuste del núcleo, y a partir de ahí el ensayo enseña
 * a plantar el móvil donde la medición ya no lo admite — un error que además se
 * descubriría en el gimnasio, con la serie hecha.
 *
 * ## Vive en `features/` y no en `domain/`
 *
 * Porque importa del núcleo vendorizado del encoder, que es código de la herramienta y
 * no del dominio de entrenamiento. `domain/escenario/` se queda con la geometría, que
 * no sabe de cámaras.
 *
 * ## Por qué hace falta el interruptor del disco
 *
 * El núcleo no puede adivinar si el ejercicio lleva barra con discos, y la diferencia
 * es enorme: viendo un disco de 450 mm se puede deshacer el escorzo —φ sale de lo
 * aplastada que está la elipse— y admite hasta 30° de desvío; sin él, solo 12. Por eso
 * el valor por defecto es «no hay disco»: dar por hecho que lo hay sería dar por hecho
 * la corrección.
 */
export function juzgarColocacion(c: Colocacion, hayDisco: boolean): CalidadEncuadre {
  const e = encuadre({
    dist: c.distancia,
    altura: c.altura,
    desvio: desvioDe(c.anguloGrados),
  })
  return calificarEncuadre(e, { hayDisco })
}

/**
 * Los números que el asesorado necesita ver mientras mueve el trípode.
 *
 * Se sacan del MISMO `encuadre()` que alimenta el juicio, no de una cuenta paralela:
 * si la pantalla dijera un ancho de escena y la puerta usara otro, el asesorado vería
 * un número que no es el que le están juzgando.
 */
export function lecturasDeColocacion(c: Colocacion): {
  desvio: number
  anchoEscenaM: number
  discoPx: number
  inclinacionGrados: number
} {
  const e = encuadre({
    dist: c.distancia,
    altura: c.altura,
    desvio: desvioDe(c.anguloGrados),
  })
  return {
    desvio: e.desvio,
    anchoEscenaM: e.anchoEscenaM,
    discoPx: e.discoPx,
    inclinacionGrados: e.inclinacionGrados,
  }
}
