import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { db } from '../../../../data/dbInstance'
import { cargaPorGrupo } from '../../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../../domain/nivelesAlfa'
import { indiceRecuperacion } from '../../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../../domain/rutaEntrenamiento'
import { SalonEntrenar } from '../SalonEntrenar'

/**
 * EL DÍA QUE SE ELIGE EN EL TAMBOR MANDA TAMBIÉN EN EL CARDIO.
 *
 * Nace **en rojo** el 2026-09-10. Todo el salón se pinta con `sesionEnPantalla` —la sesión
 * del día al que se ha viajado— menos dos cosas, que leían `sesion`, la de HOY:
 *
 *     const patronDelBloque = useMemo(() => patronDeLosBloques(sesion?.bloquesCardio), …)
 *     <SalonSinSujeto ejercicio={ejercicio} bloques={sesion?.bloquesCardio} />
 *
 * Consecuencia medida en el navegador antes de escribir esto: **desde un día de fuerza,
 * viajar al METABÓLICO A del seed —treinta minutos con diez intervalos a RPE 8— daba una
 * sala vacía con cuatro tarjetas que decían «Sin minutos prescritos», «Sin zona ni RPE
 * escritos» y «Sin ritmo escrito»**, y ningún sujeto en el centro. Los datos existen desde
 * siempre en el seed; lo que no llegaba era el día.
 *
 * Y al revés, que es peor porque no se nota: parado en el día metabólico, cualquier otro día
 * sin ejercicio elegido heredaría el corredor de hoy.
 *
 * Se entra por el tambor y no escribiendo `diaElegido` a mano: el fallo está justo en el
 * camino entre elegir el día y pintar el centro, así que saltárselo sería probar otra cosa.
 */

function montarEnUnDiaDeFuerza() {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion = microciclo.sesiones.find((s) => s.ejercicios.length > 0)!
  // LA FECHA VA CLAVADA, Y ES LA PARTE IMPORTANTE DE ESTE MONTAJE.
  //
  // Con `hoyIso()` esta prueba dependía del calendario y fallaba UN día de cada siete. El
  // seed reparte LEG A · UPPER A · LEG B · UPPER B · FULL C · METABÓLICO A · descanso, así
  // que **el sábado el día metabólico ES hoy** — y el tambor, al elegir hoy, pone el día
  // en «ninguno» a propósito (`setDiaElegido(esHoy ? null : i)`): volver a hoy es dejar de
  // viajar. Entonces el salón cae en la sesión del prop `sesion`, que aquí es una de
  // FUERZA, y la prueba veía «HIP THRUST CON BARRA» donde esperaba «CARRERA».
  //
  // Eso NO es un fallo de la app: en la app real el prop `sesion` es la de hoy, así que
  // volver a hoy enseña hoy. El fallo era del montaje, que le daba a la vez una semana
  // real y una sesión que no le correspondía.
  //
  // Se arregla fijando el escenario, no invirtiendo el criterio: un LUNES, que en este
  // seed es día de fuerza, así que el metabólico nunca es «hoy» y viajar a él es viajar de
  // verdad. Es la misma lección que ya está escrita en `salon.test.tsx`: un test que
  // depende del calendario no prueba lo que dice.
  const hoy = '2026-09-07'
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  render(
    <MemoryRouter>
      <SalonEntrenar
        microciclo={microciclo}
        ruta={db.ruta.byUsuario(usuario.id)}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
      />
    </MemoryRouter>,
  )
  return { microciclo, sesion }
}

/** Viaja al día del tambor cuya fila nombre esa sesión. */
async function viajarA(nombreDeSesion: string) {
  const usuario = userEvent.setup()
  const chip = document.querySelector('[data-barra="sesion"] button') as HTMLButtonElement
  expect(chip, 'el chip del día no está en la banda').not.toBeNull()
  await usuario.click(chip)
  const tambor = await screen.findByRole('dialog')
  const fila = within(tambor)
    .getAllByRole('button')
    .find((b) => (b.textContent ?? '').toUpperCase().includes(nombreDeSesion))
  expect(fila, `el tambor no ofrece ${nombreDeSesion}`).toBeDefined()
  await usuario.click(fila!)
  // PULSAR NO ES HABER LLEGADO, y aquí no hay una sola señal fiable de que se llegó: el
  // tambor NO se cierra al elegir —se probó a esperar a que desapareciera y las cuatro
  // pruebas murieron por timeout—. Así que quien espera es cada aserción, que es además
  // lo correcto: lo que hay que esperar no es el viaje, es lo que el día nuevo pinta.
}

describe('el día elegido manda también en el cardio', () => {
  it('viajar al día metabólico trae SU prescripción, no la de hoy', async () => {
    const { microciclo } = montarEnUnDiaDeFuerza()
    const metabolica = microciclo.sesiones.find((s) => s.bloquesCardio?.length)!
    const minutos = metabolica.bloquesCardio!.reduce((t, b) => t + (b.duracionMin ?? 0), 0)
    expect(minutos, 'el seed dejó de traer minutos y la prueba ya no prueba nada').toBeGreaterThan(0)

    await viajarA(metabolica.nombre)

    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    expect(
      salon.textContent,
      'la sala del día metabólico dice que no hay minutos prescritos, y los hay',
    ).not.toContain('Sin minutos prescritos')
  })

  it('y ese día tiene sujeto, porque sus bloques nombran una modalidad', async () => {
    const { microciclo } = montarEnUnDiaDeFuerza()
    const metabolica = microciclo.sesiones.find((s) => s.bloquesCardio?.length)!

    await viajarA(metabolica.nombre)

    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    // «Calentamiento: 5 min trote suave» es carrera en cinta: desde el 7-sep el cardio con
    // modalidad reconocida lleva sujeto y máquina, no una sala vacía.
    expect(salon.querySelector('[data-testigo="sujeto"]'), 'el día de cardio se quedó sin sujeto').not.toBeNull()
    expect(salon.querySelector('[data-hueco="sinPatron"]'), 'montó la rama sin sujeto').toBeNull()
  })

  it('y enseña sus números alrededor del cuerpo, no solo el corredor', async () => {
    // Al ganar sujeto, el cardio dejó de montar la rama que enseñaba su prescripción. Sin
    // esto, el día metabólico es alguien corriendo y ni una cifra: treinta minutos en tres
    // tramos a RPE 8 escritos en la sesión y ninguno en pantalla.
    const { microciclo } = montarEnUnDiaDeFuerza()
    const metabolica = microciclo.sesiones.find((s) => s.bloquesCardio?.length)!

    await viajarA(metabolica.nombre)

    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    // Se ESPERA a que el día nuevo pinte sus estaciones. El salón las monta en un efecto
    // posterior al viaje, así que mirarlas de golpe es mirar el día que ya no es.
    await waitFor(() => {
      const estaciones = Array.from(salon.querySelectorAll('[data-estacion]'))
      expect(estaciones.length, 'el día de cardio se quedó sin estaciones').toBeGreaterThan(0)
      expect(salon.querySelector('[data-estacion="minutos"]')?.textContent).toContain('30')
    })
  })

  it('y el muro dice de qué sala es y qué se hace en ella', async () => {
    // Sin contenido de pared no se monta el tablón, y un día de cardio abría con la
    // habitación muda: sin código de sala y sin nombre en trazo. El nombre sale del título
    // de la ficha —«Carrera»—, el mismo que decide qué sujeto se pinta.
    const { microciclo } = montarEnUnDiaDeFuerza()
    const metabolica = microciclo.sesiones.find((s) => s.bloquesCardio?.length)!

    await viajarA(metabolica.nombre)

    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    // El tablón del muro ENTRA con animación y se monta después del viaje: hay que
    // esperarlo. Es la misma trampa que ya está anotada para fotografiar el muro.
    //
    // LA ESPERA COMPRUEBA EL CONTENIDO, NO QUE HAYA ALGO. Esperar a «que exista un
    // nombre» no sirve: el muro del día ANTERIOR ya tiene nombre, así que la espera se
    // cumplía al instante y la aserción leía el día viejo —«HIP THRUST CON BARRA» donde
    // se esperaba «CARRERA»—. Hay que esperar a que el nombre sea EL DEL DÍA NUEVO.
    //
    // Se lee del `aria-label` y no del texto: el rótulo en trazo pinta cada letra TRES
    // veces —el trazo y sus dos ecos, que son los que le dan el canto—, así que su
    // `textContent` dice «CCCAAARRRRRREEERRRAAA». El `aria-label` es el nombre de verdad,
    // y además es lo único que lee un lector de pantalla.
    await waitFor(() => {
      const enEspera = salon.querySelector('[data-campo="nombre"] [aria-label]')
      expect(enEspera, 'el muro se quedó sin nombre').not.toBeNull()
      expect(enEspera?.getAttribute('aria-label')?.toUpperCase()).toContain('CARRERA')
    })
    // El código de sala sale del orden de la sesión: la metabólica es la sexta.
    expect(salon.textContent).toContain(`Sala 0${metabolica.orden}`)
    // Y las cifras del muro son las del cardio, no las de una serie que no existe.
    expect(salon.querySelector('[data-prescripcion="muro"]')?.textContent).toContain('30')
  })

  /**
   * EL RECUADRO DEL ENCUADRE NO SE COMPRUEBA AQUÍ, y hay que decir por qué.
   *
   * Se escribió primero como una comprobación de pantalla —«no existe `[data-recuadro=
   * "encuadre"]` en un día de cardio»— y **pasaba también con el guardián quitado**: el
   * panel de abajo está bajado, así que en jsdom sus recuadros no llegan a montarse y la
   * comprobación decía que sí con la pregunta sin hacer. Un verde en vacío es peor que no
   * tener prueba. La decisión —cuándo hay encuadre que contar— se comprueba donde vive, en
   * `contenidoPared.test.ts`.
   */
})
