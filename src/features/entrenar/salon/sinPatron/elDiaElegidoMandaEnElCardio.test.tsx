import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { db, hoyIso } from '../../../../data/dbInstance'
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
  const hoy = hoyIso()
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
    const estaciones = Array.from(salon.querySelectorAll('[data-estacion]'))
    expect(estaciones.length, 'el día de cardio se quedó sin estaciones').toBeGreaterThan(0)
    const minutos = salon.querySelector('[data-estacion="minutos"]')
    expect(minutos?.textContent).toContain('30')
  })
})
