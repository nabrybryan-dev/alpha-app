import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../../../app/SessionProvider'
import { ThemeProvider } from '../../../../app/ThemeProvider'
import { AppRouter } from '../../../../app/router'
import {
  faseAhora,
  faseDelMando,
  repeticionPausada,
  soltarElTiempo,
} from '../../visor/controlDelTiempo'
import { ESPERA_DEL_RECORRIDO, RECORRIDO_COMPLETO } from './rumboDelJoystick'
import { comoReloj, rotuloDelModo, segundosDelReloj } from './relojDelMuro'

/**
 * EL TIEMPO DE LA REPETICIÓN SE MANDA DESDE EL DISCO, y no toca los otros dos relojes.
 *
 * El salón tiene tres tiempos y hasta el 2026-09-08 solo dos se podían tocar: el reloj de
 * sesión (que corre solo) y el descanso (que arranca el mando). El tercero —el que tarda
 * el sujeto en bajar y subir— corría dentro del bucle de dibujo y no había forma de
 * pararlo para mirar un punto del gesto.
 *
 * Lo que aquí se comprueba es lo que puede salir mal al juntarlos: que recorrer la
 * demostración **no** arranque un descanso ni mueva el reloj de la pared. Son tres tiempos
 * distintos y un solo gesto no puede mover dos.
 *
 * Se monta el salón entero por la ruta, como `salon.test.tsx`, y no el disco a pelo: la
 * pregunta no es «¿el componente llama a su callback?» sino «¿el mando del salón mueve la
 * demostración y deja el descanso donde estaba?».
 *
 * Lo que jsdom NO puede decir: aquí no hay WebGL, así que el sujeto no se dibuja. Que la
 * fase que manda el dedo se VEA en el cuerpo es cosa del ojo y del testigo con toque
 * emulado; aquí se lee del mando del tiempo, que es la misma fuente que consulta el bucle.
 */

function renderizarEntrenar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={['/entrenar']}>
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

async function esperarAlDisco(): Promise<HTMLElement> {
  return await waitFor(() => screen.getByRole('button', { name: /Mando del reloj de la pared/i }))
}

/**
 * El rótulo del reloj del muro: «Sesión», «Descanso» o «Excéntrico».
 *
 * Se busca por el rótulo que va PEGADO a la cifra viva (`muro-reloj-vivo`) y no por la
 * clase `muro-rotulo` a secas: esa clase la llevan todos los rótulos del muro —«Series»,
 * «Carga»— y `querySelector` devolvía el primero que encontrara, que no es el reloj.
 */
function rotuloDelMuro(): string | null {
  const cifra = document.querySelector('.muro-reloj-vivo')
  const rotulo = cifra?.parentElement?.querySelector('.muro-rotulo')
  return rotulo ? (rotulo.textContent ?? '').trim() : null
}

/**
 * jsdom no implementa `PointerEvent`, así que `fireEvent.pointerMove` cae a un `Event`
 * genérico y `clientX`/`clientY` se pierden por el camino: el mando recibía `undefined` y
 * la fase salía `NaN`. Un `MouseEvent` con nombre de puntero sí lleva coordenadas y React
 * lo entrega igual. Es la misma trampa que ya está escrita en
 * `lib/inclinacionAlPuntero.test.tsx`.
 */
function dedo(el: HTMLElement, tipo: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) {
  fireEvent(el, new MouseEvent(tipo, { clientX: x, clientY: y, bubbles: true }))
}

describe('el tiempo de la repetición, desde el disco', () => {
  beforeEach(() => {
    soltarElTiempo()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    soltarElTiempo()
  })

  it('aguantar el disco para la demostración y el dedo la lleva de 0 a 1 y de vuelta', async () => {
    renderizarEntrenar()
    const disco = await esperarAlDisco()

    expect(repeticionPausada()).toBe(false)

    // El dedo baja y AGUANTA. Antes de que venza la espera no ha pasado nada: un tirón
    // corto sigue siendo un tirón corto.
    dedo(disco, 'pointerdown', 200, 600)
    act(() => {
      vi.advanceTimersByTime(ESPERA_DEL_RECORRIDO - 50)
    })
    expect(repeticionPausada()).toBe(false)

    act(() => {
      vi.advanceTimersByTime(60)
    })
    expect(repeticionPausada()).toBe(true)

    // Y ahora el dedo recorre: doce pasos a la derecha hasta el fondo del recorrido.
    const pasos = 12
    const ida: number[] = []
    for (let i = 1; i <= pasos; i++) {
      dedo(disco, 'pointermove', 200 + (i * RECORRIDO_COMPLETO) / pasos, 600)
      ida.push(faseDelMando() ?? -1)
    }
    expect(ida[ida.length - 1]).toBeCloseTo(1, 6)

    // Y de vuelta al principio.
    const vuelta: number[] = []
    for (let i = pasos - 1; i >= 0; i--) {
      dedo(disco, 'pointermove', 200 + (i * RECORRIDO_COMPLETO) / pasos, 600)
      vuelta.push(faseDelMando() ?? -1)
    }
    expect(vuelta[vuelta.length - 1]).toBeCloseTo(0, 6)

    // SIN SALTOS. Un recorrido a trompicones no sirve para mirar un punto del gesto: lo
    // que se busca es el instante en que el codo pasa por 90°, y con saltos de un cuarto
    // de repetición ese instante no se puede parar.
    const recorrido = [0, ...ida, ...vuelta]
    const saltos = recorrido.slice(1).map((f, i) => Math.abs(f - recorrido[i]))
    expect(Math.max(...saltos)).toBeLessThanOrEqual(0.1)

    // Al soltar, la demostración sigue por donde la dejaron.
    dedo(disco, 'pointerup', 200, 600)
    expect(repeticionPausada()).toBe(false)
    expect(faseDelMando()).toBeUndefined()
  })

  it('el descanso y el reloj de sesión valen lo mismo antes y después', async () => {
    renderizarEntrenar()
    const disco = await esperarAlDisco()

    // Los dos relojes de la pared, leídos como los lee el muro: por su rótulo y por sus
    // segundos, con el mismo instante en las dos medidas para que la resta signifique algo.
    const anclas = { abierto: 1_000_000, cuenta: 1_000_000, duracion: 120 }
    const ahora = 1_060_000
    const antes = {
      // En reposo el muro no cuenta nada y este rótulo es `null`: lo que importa es que
      // valga LO MISMO después. Que el instrumento sepa moverse lo demuestra la prueba
      // siguiente, donde un tirón corto sí lo pone en «Descanso».
      rotulo: rotuloDelMuro(),
      sesion: comoReloj(segundosDelReloj('sesion', anclas, ahora)),
      descanso: comoReloj(segundosDelReloj('descanso', anclas, ahora)),
    }

    dedo(disco, 'pointerdown', 200, 600)
    act(() => {
      vi.advanceTimersByTime(ESPERA_DEL_RECORRIDO + 40)
    })
    dedo(disco, 'pointermove', 200 + RECORRIDO_COMPLETO, 600)
    dedo(disco, 'pointerup', 200 + RECORRIDO_COMPLETO, 600)

    const despues = {
      rotulo: rotuloDelMuro(),
      sesion: comoReloj(segundosDelReloj('sesion', anclas, ahora)),
      descanso: comoReloj(segundosDelReloj('descanso', anclas, ahora)),
    }
    expect(despues).toEqual(antes)
    // Y el muro NO se ha puesto a contar nada: si el gesto hubiera emitido rumbo, el
    // rótulo diría «Excéntrico» —el disco terminó tirado a la derecha— y esto sería rojo.
    expect(despues.rotulo).not.toBe(rotuloDelModo('excentrico'))
    expect(despues.rotulo).not.toBe(rotuloDelModo('descanso'))
  })

  it('un tirón corto sigue cambiando lo que cuenta la pared, y no toca la repetición', async () => {
    renderizarEntrenar()
    const disco = await esperarAlDisco()

    // Sin aguantar: se baja el dedo, se tira a la izquierda y se suelta antes de la espera.
    dedo(disco, 'pointerdown', 200, 600)
    dedo(disco, 'pointermove', 120, 600)
    act(() => {
      vi.advanceTimersByTime(ESPERA_DEL_RECORRIDO + 40)
    })
    dedo(disco, 'pointerup', 120, 600)

    // La demostración ni se entera.
    expect(repeticionPausada()).toBe(false)
    expect(faseDelMando()).toBeUndefined()
    // Y la pared sí: pasa a contar el descanso.
    await waitFor(() => expect(rotuloDelMuro()).toBe(rotuloDelModo('descanso')))
  })

  it('si el salón se cierra con el dedo puesto, la demostración no se queda congelada', async () => {
    // Se navega a otra pestaña sin levantar el dedo: `alSoltarDedo` no corre nunca. Como
    // el mando del tiempo es de módulo y sobrevive al componente, sin la limpieza del
    // desmontaje el siguiente que abriera el salón vería un sujeto parado para siempre.
    const { unmount } = renderizarEntrenar()
    const disco = await esperarAlDisco()
    dedo(disco, 'pointerdown', 200, 600)
    act(() => {
      vi.advanceTimersByTime(ESPERA_DEL_RECORRIDO + 40)
    })
    expect(repeticionPausada()).toBe(true)

    unmount()
    expect(repeticionPausada()).toBe(false)
  })

  it('el recorrido empieza donde está el sujeto, no en el principio del gesto', async () => {
    renderizarEntrenar()
    const disco = await esperarAlDisco()

    // Sin WebGL el bucle no corre, así que la demostración está en su fase de arranque.
    // Lo que se comprueba es que el mando ARRANCA de ahí y no de un cero inventado: el
    // primer píxel de dedo mueve la fase un píxel, no la teletransporta.
    const alAgarrar = faseAhora()
    dedo(disco, 'pointerdown', 200, 600)
    act(() => {
      vi.advanceTimersByTime(ESPERA_DEL_RECORRIDO + 40)
    })
    dedo(disco, 'pointermove', 201, 600)
    expect(faseDelMando()).toBeCloseTo(alAgarrar + 1 / RECORRIDO_COMPLETO, 6)

    dedo(disco, 'pointerup', 201, 600)
  })
})
