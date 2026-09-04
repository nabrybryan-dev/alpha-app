import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../../../data/dbInstance'
import type { EjercicioPrescrito, SerieRegistrada } from '../../../../domain/types'
import { anotarVelocidadEnBorrador } from './borrador'
import { RegistroSerieSalon } from './RegistroSerieSalon'

/**
 * EL TEST QUE NO EXISTÍA: que lo que se teclea es lo que se guarda.
 *
 * Registrar la serie es la ÚNICA acción del salón y la única escritura de la pantalla. Hasta
 * ahora nada comprobaba el camino entero —tecla → borrador → `db.microciclos.registrarSerie`—
 * de punta a punta: `RegistroSerie.test.tsx` cubre de dónde sale la carga SUGERIDA, que es la
 * pregunta anterior, y ninguno de los dos miraba qué llega a la base.
 *
 * Y es el sitio donde un fallo se paga caro: si el número que viaja no es el que el asesorado
 * puso, el registro queda con un dato que nadie escribió, la progresión del microciclo
 * siguiente se calcula sobre él, y no hay forma de notarlo mirando la pantalla.
 *
 * ## Qué se espía y por qué ese punto
 *
 * `db.microciclos.registrarSerie` es la MISMA llamada que hace la sesión. Espiar ahí —y no
 * más abajo— comprueba el contrato que la interfaz tiene que cumplir sin atarse a cómo el
 * repositorio lo guarde. Si mañana la escritura cambia por dentro, este test sigue valiendo.
 */

const MICROCICLO = 'm-de-prueba'
const EJERCICIO = 'e-de-prueba'
const CLAVE_BORRADOR = `alpha-serie-${MICROCICLO}-${EJERCICIO}-1`

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: EJERCICIO,
    categoria: 'DOMINANTE DE CADERA',
    nombre: 'Hip thrust con barra',
    cues: '',
    prescripcion: '',
    descansoMin: 3,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function montar(parcial: Partial<EjercicioPrescrito> = {}) {
  return render(
    <RegistroSerieSalon microcicloId={MICROCICLO} ejercicio={ejercicio(parcial)} />,
  )
}

const campo = (etiqueta: string) => screen.getByLabelText(etiqueta) as HTMLInputElement
const carga = () => campo('Carga en kg')
const reps = () => campo('Reps')
const rir = () => campo('RIR')

/**
 * Espera a que la cifra del stepper SE POSE en su valor.
 *
 * La cifra de estos mandos «viaja» hasta su valor nuevo (`cifraViva` → `useContadorAnimado`,
 * con rAF y ease-out), así que leer `input.value` justo después de teclear devuelve un
 * fotograma intermedio —la primera versión de este test comparó `179.48` contra `999`—. No es
 * un fallo del salón: es que la aserción llegaba antes que el mando. Lo que sí es dato es que
 * el valor de verdad, el que se guarda, nunca depende de esa animación; eso se comprueba
 * aparte contra el espía.
 */
async function esperaCifra(campoDe: () => HTMLInputElement, valor: string) {
  await waitFor(() => expect(campoDe().value).toBe(valor))
}

/** Escribe un valor exacto en un stepper: limpiar, teclear y salir del campo. */
async function teclear(usuario: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, valor: string) {
  await usuario.clear(input)
  await usuario.type(input, valor)
  await usuario.tab()
}

describe('RegistroSerieSalon · lo que se teclea es lo que se guarda', () => {
  let espia: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    espia = vi.spyOn(db.microciclos, 'registrarSerie').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('manda a la base LOS TRES valores que se pusieron, y no los sugeridos', async () => {
    const usuario = userEvent.setup()
    montar()

    await teclear(usuario, carga(), '82.5')
    await teclear(usuario, reps(), '9')
    await teclear(usuario, rir(), '1')

    await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))

    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia).toHaveBeenCalledWith(MICROCICLO, EJERCICIO, {
      orden: 1,
      cargaKg: 82.5,
      reps: 9,
      rir: 1,
    })
  })

  /**
   * LA MEDIDA DEL ENCODER VIAJA CON LA SERIE.
   *
   * `historial.ts` lee `SerieRegistrada.velocidad` desde agosto y nadie la escribía. La
   * cámara del salón la anota en el borrador DESPUÉS de que el registro se haya montado
   * —la hoja de medición se abre con la serie a medias—, así que el registro no puede
   * fiarse de su estado: tiene que releer el borrador al guardar. Esto lo prueba con la
   * secuencia real: montar, medir, guardar.
   */
  it('si la cámara anotó una medida después de montar, la serie viaja con ella', async () => {
    const usuario = userEvent.setup()
    montar()
    await teclear(usuario, carga(), '80')

    const velocidad = {
      pvPct: 14,
      hayEscala: false,
      calidad: 'buena',
      huella: { duracionSeg: 2.4, fase: [1, 0.5, 0, 0.5, 1] },
    }
    anotarVelocidadEnBorrador(MICROCICLO, ejercicio(), 1, velocidad)

    await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))

    expect(espia).toHaveBeenCalledTimes(1)
    const serie = espia.mock.calls[0][2] as SerieRegistrada
    expect(serie.cargaKg).toBe(80)
    expect(serie.velocidad).toEqual(velocidad)
  })

  it('avisa a quien lo monta con la misma serie que escribió', async () => {
    const usuario = userEvent.setup()
    const alGuardar = vi.fn()
    render(
      <RegistroSerieSalon
        microcicloId={MICROCICLO}
        ejercicio={ejercicio()}
        onGuardado={alGuardar}
      />,
    )
    await teclear(usuario, carga(), '60')
    await teclear(usuario, reps(), '12')
    await teclear(usuario, rir(), '3')
    await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))

    const guardada = alGuardar.mock.calls[0][0] as SerieRegistrada
    expect(guardada).toEqual({ orden: 1, cargaKg: 60, reps: 12, rir: 3 })
    // Y es exactamente lo mismo que fue a la base: un solo dato, no dos que puedan
    // separarse.
    expect(espia).toHaveBeenCalledWith(MICROCICLO, EJERCICIO, guardada)
  })

  it('la serie que registra es la SIGUIENTE a las ya hechas, no un contador propio', async () => {
    const usuario = userEvent.setup()
    montar({ series: [{ orden: 1, cargaKg: 80, reps: 10, rir: 2 }] })
    await usuario.click(screen.getByRole('button', { name: 'Guardar serie 2' }))
    expect(espia.mock.calls[0][2]).toMatchObject({ orden: 2 })
  })

  it('con todas las series hechas no hay nada que guardar', () => {
    montar({ series: [1, 2, 3].map((orden) => ({ orden, cargaKg: 80, reps: 10, rir: 2 })) })
    expect(screen.getByText('3 series registradas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Guardar serie/ })).toBeNull()
  })

  // ── LOS TOPES ─────────────────────────────────────────────────────────────
  describe('los topes son los mismos que en la sesión: carga 0-999, reps 1-50, RIR 0-5', () => {
    it('la carga no pasa de 999 ni baja de 0', async () => {
      const usuario = userEvent.setup()
      montar()
      await teclear(usuario, carga(), '4000')
      await esperaCifra(carga, '999')

      // El campo no deja teclear un signo menos, así que el suelo se comprueba bajando
      // con la tecla desde un valor pequeño.
      await teclear(usuario, carga(), '2')
      const bajar = screen.getByRole('button', { name: 'Bajar Carga' })
      for (let i = 0; i < 6; i += 1) await usuario.click(bajar)
      await esperaCifra(carga, '0')

      await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))
      expect(espia.mock.calls[0][2]).toMatchObject({ cargaKg: 0 })
    })

    it('las repeticiones van de 1 a 50: cero repeticiones no es una serie', async () => {
      const usuario = userEvent.setup()
      montar()
      await teclear(usuario, reps(), '80')
      await esperaCifra(reps, '50')

      await teclear(usuario, reps(), '1')
      const bajar = screen.getByRole('button', { name: 'Bajar Reps' })
      for (let i = 0; i < 3; i += 1) await usuario.click(bajar)
      await esperaCifra(reps, '1')
    })

    it('el RIR va de 0 a 5 y no admite un sexto escalón', async () => {
      const usuario = userEvent.setup()
      montar()
      await teclear(usuario, rir(), '9')
      await esperaCifra(rir, '5')

      const bajar = screen.getByRole('button', { name: 'Bajar RIR' })
      for (let i = 0; i < 8; i += 1) await usuario.click(bajar)
      await esperaCifra(rir, '0')

      await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))
      expect(espia.mock.calls[0][2]).toMatchObject({ rir: 0 })
    })

    it('un valor topado se guarda topado: la base no ve el número de fuera de rango', async () => {
      const usuario = userEvent.setup()
      montar()
      await teclear(usuario, carga(), '1200')
      await teclear(usuario, reps(), '77')
      await teclear(usuario, rir(), '8')
      await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))
      expect(espia).toHaveBeenCalledWith(MICROCICLO, EJERCICIO, {
        orden: 1,
        cargaKg: 999,
        reps: 50,
        rir: 5,
      })
    })
  })

  // ── EL BORRADOR ───────────────────────────────────────────────────────────
  describe('si el guardado se cae a media operación, el borrador no se pierde', () => {
    it('el borrador sigue en el teléfono y vuelve al remontar', async () => {
      const usuario = userEvent.setup()
      // La escritura revienta: sin conexión, cuota llena, un microciclo con forma vieja.
      espia.mockImplementation(() => {
        throw new Error('la escritura se cayó a media operación')
      })
      /**
       * El error de un manejador de evento no lo atrapa ningún `ErrorBoundary` —React solo
       * los usa para el render—: sale por el `dispatchEvent` de jsdom y acaba como excepción
       * no capturada de la corrida, que ensucia el informe de toda la suite con un rojo que
       * no es de nadie. Aquí se recoge a propósito: lo que se está probando es qué queda
       * DESPUÉS del fallo, no cómo se propaga.
       */
      const capturados: string[] = []
      const recoger = (e: ErrorEvent) => {
        capturados.push(e.message)
        e.preventDefault()
      }
      window.addEventListener('error', recoger)
      montar()

      await teclear(usuario, carga(), '95')
      await teclear(usuario, reps(), '7')
      await teclear(usuario, rir(), '0')

      await usuario
        .click(screen.getByRole('button', { name: 'Guardar serie 1' }))
        .catch(() => {})
      window.removeEventListener('error', recoger)

      expect(espia).toHaveBeenCalledTimes(1)
      // Y el fallo ocurrió de verdad: si no, esto probaría el camino feliz con otro nombre.
      expect(capturados.join(' | ')).toMatch(/se cayó a media operación/)
      // La clave la comparte con la sesión: una serie empezada allí aparece a medio llenar
      // aquí y al revés. Dos claves para la misma serie serían dos borradores que se pisan.
      const guardado = localStorage.getItem(CLAVE_BORRADOR)
      expect(guardado, 'el borrador se borró aunque la escritura falló').not.toBeNull()
      expect(JSON.parse(guardado!)).toEqual({ cargaKg: 95, reps: 7, rir: 0 })

      // Y lo que de verdad ve el asesorado: al volver, sus números siguen puestos.
      cleanup()
      montar()
      await esperaCifra(carga, '95')
      await esperaCifra(reps, '7')
      await esperaCifra(rir, '0')
    })

    it('cuando el guardado sí sale bien, el borrador se retira', async () => {
      const usuario = userEvent.setup()
      montar()
      await teclear(usuario, carga(), '70')
      expect(localStorage.getItem(CLAVE_BORRADOR)).not.toBeNull()

      await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))
      // Ya quedó en la base: dejar el borrador haría que la serie siguiente arrancara con
      // los números de la anterior.
      expect(localStorage.getItem(CLAVE_BORRADOR)).toBeNull()
    })
  })

  // ── EL CAMINO DE ESCRITURA ────────────────────────────────────────────────
  it('no abre un segundo camino de escritura: solo habla con `db`', async () => {
    const usuario = userEvent.setup()
    const enRed = vi.spyOn(globalThis, 'fetch' as never).mockImplementation((() => {
      throw new Error('el registro del salón no puede salir a la red por su cuenta')
    }) as never)
    montar()
    await usuario.click(screen.getByRole('button', { name: 'Guardar serie 1' }))
    expect(enRed).not.toHaveBeenCalled()
    expect(espia).toHaveBeenCalledTimes(1)
  })
})
