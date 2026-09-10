/**
 * EL MOVIMIENTO NO ES DECORACIÓN: ES UNA CAPA QUE SE ADAPTA AL CONTEXTO.
 *
 * La app se usa con un móvil en la mano, en un gimnasio, a veces a mitad de una
 * serie pesada. Ahí el movimiento deja de ayudar y estorba: partículas y
 * rebotes compiten con el número que hay que leer. Y el aparato tampoco es
 * siempre el mismo — un teléfono de hace cinco años no puede pagar lo que paga
 * uno nuevo.
 *
 * Este módulo decide UN valor —`pleno`, `sobrio` o `minimo`— que se escribe en
 * `<html data-movimiento>`, y `tokens.css` apaga cosas a partir de ahí. Un solo
 * interruptor, en un solo sitio, en vez de cada componente decidiendo por su
 * cuenta.
 *
 * ## Los tres niveles
 *
 * - `pleno`   — todo: muelles, parallax, ambiente, partículas.
 * - `sobrio`  — se queda el movimiento que INFORMA (que algo apareció, que algo
 *               se guardó) y se va el que solo ambienta. Es el nivel de una
 *               serie pesada y el de un aparato justo.
 * - `minimo`  — sin animación. Es lo que pide `prefers-reduced-motion`, y esa
 *               petición no se discute nunca: gana a todo lo demás.
 *
 * ## La trampa que ya nos costó una tarde
 *
 * Medir la fluidez con la pestaña OCULTA no da un dato malo: da uno **falso que
 * parece bueno**. `requestAnimationFrame` deja de dispararse cuando la pestaña
 * se va al fondo, así que las muestras salen separadas por segundos y el
 * cálculo concluye «este aparato va a 0 fps» — y la app se degradaría sola por
 * estar de fondo. Por eso `medirFluidez` descarta la medición entera si la
 * pestaña se esconde mientras mide, y devuelve `null` en vez de un número.
 *
 * **`null` no es «va lento»: es «no lo sé», y con no saberlo no se degrada
 * nada.** Un falso rojo aquí es peor que un falso verde, porque le quita la
 * app buena a alguien que la tenía bien.
 */

export type NivelDeMovimiento = 'pleno' | 'sobrio' | 'minimo'

export interface Contexto {
  /** `prefers-reduced-motion: reduce`. Manda sobre todo lo demás. */
  reducido: boolean
  /**
   * Fotogramas por segundo medidos, o `null` si no se pudo medir. `null` se
   * trata como «va bien»: no se castiga a nadie por una medición que falló.
   */
  fps: number | null
  /**
   * `true` mientras el asesorado tiene una serie en curso. Es contexto de
   * producto, no de rendimiento: aunque el aparato vaya sobrado, durante una
   * serie pesada el ambiente sobra.
   */
  enSerie: boolean
}

/**
 * Por debajo de esto el aparato no sostiene el movimiento pleno.
 *
 * 45 y no 60: entre 60 y 45 la pérdida se nota poco y bajar de nivel se notaría
 * más que el tirón que evita. Por debajo de 45 ya se ve a saltos, y ahí sí
 * compensa quitar el ambiente para recuperar los datos.
 */
export const FPS_MINIMO = 45

/** La decisión, sin tocar nada. Pura a propósito, para poder probarla. */
export function nivelDeMovimiento({ reducido, fps, enSerie }: Contexto): NivelDeMovimiento {
  // La preferencia del sistema no se negocia ni se pondera: si alguien pidió
  // menos movimiento, es porque le sienta mal. Va antes que cualquier otra cosa.
  if (reducido) return 'minimo'
  if (enSerie) return 'sobrio'
  if (fps !== null && fps < FPS_MINIMO) return 'sobrio'
  return 'pleno'
}

/**
 * Mide la fluidez durante unos fotogramas y devuelve los fps, o `null`.
 *
 * Devuelve `null` si la pestaña se esconde durante la medición, si el navegador
 * no tiene `requestAnimationFrame`, o si no llegaron muestras suficientes.
 */
export function medirFluidez(muestras = 30): Promise<number | null> {
  return new Promise((resolver) => {
    if (typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') {
      resolver(null)
      return
    }
    // Si ya arrancamos escondidos no hay nada que medir.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      resolver(null)
      return
    }

    const tiempos: number[] = []
    let cancelado = false

    const alEsconderse = () => {
      if (document.visibilityState === 'hidden') cancelado = true
    }
    document?.addEventListener?.('visibilitychange', alEsconderse)

    const terminar = (valor: number | null) => {
      document?.removeEventListener?.('visibilitychange', alEsconderse)
      resolver(valor)
    }

    const paso = (t: number) => {
      if (cancelado) return terminar(null)
      tiempos.push(t)
      if (tiempos.length <= muestras) return void requestAnimationFrame(paso)

      // La MEDIANA de los intervalos, no la media: el primer fotograma después
      // de montar la página suele llegar tardísimo y una media lo arrastra
      // todo. La mediana ignora ese caso raro sin tener que recortarlo a mano.
      const huecos = tiempos.slice(1).map((v, i) => v - tiempos[i]).sort((a, b) => a - b)
      const mediana = huecos[Math.floor(huecos.length / 2)]
      terminar(mediana > 0 ? Math.round(1000 / mediana) : null)
    }

    requestAnimationFrame(paso)
  })
}

/** Escribe el nivel en `<html>`, que es de donde lo lee `tokens.css`. */
export function aplicarNivel(nivel: NivelDeMovimiento): void {
  document?.documentElement?.setAttribute('data-movimiento', nivel)
}

/** ¿El sistema pide menos movimiento? */
export function prefiereMenosMovimiento(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
