/**
 * La hoja con la que el coach programa el microciclo siguiente de un asesorado.
 *
 * No tenía tests, y es la única pantalla desde la que sale una prescripción hacia
 * una persona. Los primeros seis describen lo que ya hacía antes de tocarla
 * (procedimiento de `tests-primero-sin-cobertura`); los de «cuándo empieza»
 * nacieron rojos y documentan lo que le faltaba para poder programar una semana
 * por adelantado.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { sumarDias } from '../../domain/activacion'
import { inicioProximaSemana } from '../../domain/calendario'
import { GenerarMicrocicloSheet } from './GenerarMicrocicloSheet'

/** El asesorado del seed ficticio y su microciclo activo. */
function partida() {
  const activo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
  if (!activo) throw new Error('el seed no trae microciclo activo')
  return activo
}

function abrir(microciclo = partida()) {
  return render(
    <GenerarMicrocicloSheet
      abierto
      nombreAsesorado="Valentina"
      microciclo={microciclo}
      onCerrar={() => {}}
    />,
  )
}

const propuestasDe = (usuarioId: string) =>
  db.microciclos.byUsuario(usuarioId).filter((m) => m.estado === 'propuesto')

describe('GenerarMicrocicloSheet', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('anuncia el número del microciclo que propone', () => {
    const activo = partida()
    abrir(activo)
    expect(screen.getByText(`M${activo.numero + 1}`)).toBeInTheDocument()
  })

  it('lista un ejercicio por fila con su prescripción y su motivo', () => {
    const activo = partida()
    abrir(activo)
    const conFuerza = activo.sesiones.filter((s) => s.tipo !== 'metabolica')
    const total = conFuerza.reduce((suma, s) => suma + s.ejercicios.length, 0)
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(total)
  })

  it('sin microciclo del que partir, lo dice y no ofrece guardar', () => {
    render(
      <GenerarMicrocicloSheet
        abierto
        nombreAsesorado="Valentina"
        microciclo={undefined}
        onCerrar={() => {}}
      />,
    )
    expect(screen.getByText(/todavía no tiene un microciclo/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
  })

  it('guarda la propuesta en estado propuesto, nunca activa', async () => {
    const activo = partida()
    abrir(activo)
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const propuestas = propuestasDe('u-valentina')
    expect(propuestas).toHaveLength(1)
    expect(propuestas[0].numero).toBe(activo.numero + 1)
    expect(propuestas[0].estado).toBe('propuesto')
  })

  /**
   * La razón de ser del estado `propuesto`: mientras no se active, el asesorado
   * sigue viendo el microciclo que está entrenando y no el que se le está
   * preparando.
   */
  it('guardar no le cambia el microciclo activo al asesorado', async () => {
    const activo = partida()
    abrir(activo)
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const activos = db.microciclos.byUsuario('u-valentina').filter((m) => m.estado === 'activo')
    expect(activos).toHaveLength(1)
    expect(activos[0].id).toBe(activo.id)
  })

  /**
   * Escrito primero al revés («todos los ejercicios salen ondulados») y nació
   * rojo contra el código viejo. No era un bug del motor: **se ondula lo que
   * tiene ancla**, y en el seed solo LEG A trae series registradas porque la
   * asesorada va a mitad del microciclo.
   *
   * Queda como está para dejar dicho de dónde sale la ondulación. Lo que sí era
   * un hueco —que un ejercicio ya pautado y todavía no entrenado se quedara sin
   * ancla— lo cubre `ondulacion.test.ts`.
   */
  it('ondula los ejercicios que tienen ancla y no inventa los que no', async () => {
    const activo = partida()
    abrir(activo)
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const guardada = propuestasDe('u-valentina')[0]
    const conRegistro = activo.sesiones
      .filter((s) => s.tipo !== 'metabolica')
      .flatMap((s) => s.ejercicios)
      .filter((e) => e.series.length > 0)
    expect(conRegistro.length).toBeGreaterThan(0)

    const ondulados = guardada.sesiones
      .flatMap((s) => s.ejercicios)
      .filter((e) => conRegistro.some((c) => c.id === e.id))
    expect(ondulados.every((e) => (e.seriesPrescritas?.length ?? 0) > 0)).toBe(true)
  })

  it('tras guardar, confirma y no deja guardar dos veces', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
    expect(propuestasDe('u-valentina')).toHaveLength(1)
  })

  /**
   * ✅ REGRESIÓN. Nació rojo: no había forma de decir «esta semana no, la que
   * viene». La propuesta empezaba siempre donde terminaba el microciclo anterior
   * (o hoy, si eso ya era pasado), así que programar por adelantado la semana de
   * alguien era imposible desde la app.
   */
  it('permite programar para la próxima semana en vez de a continuación', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /próxima semana/i }))
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const guardada = propuestasDe('u-valentina')[0]
    expect(guardada.fechaInicio).toBe(inicioProximaSemana(hoy()))
  })

  /**
   * El otro lado del límite: la opción por defecto no cambia. Encadenar con el
   * microciclo en curso sigue siendo lo normal, y quien no toque nada tiene que
   * seguir obteniendo exactamente lo de antes.
   */
  it('por defecto sigue encadenando con el microciclo en curso', async () => {
    const activo = partida()
    abrir(activo)
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    const guardada = propuestasDe('u-valentina')[0]
    const finAnterior = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    expect(guardada.fechaInicio).toBe(finAnterior > hoy() ? finAnterior : hoy())
  })

  /**
   * ✅ REGRESIÓN de texto, encontrada mirando la pantalla y no un test. El aviso
   * ámbar decía «no se activaría sola», y desde que la propuesta preparada manda
   * eso es falso: guardarla ES la revisión, así que se activa igual. Un aviso que
   * promete lo contrario de lo que hace el sistema es peor que no tenerlo, y este
   * salía justo en el caso de más riesgo (dato flojo).
   */
  it('el aviso de dato flojo no promete que la propuesta se quedará quieta', async () => {
    abrir()
    const aviso = await screen.findByText(/hay que mirarla/i)
    expect(aviso).toBeInTheDocument()
    expect(screen.queryByText(/no se activaría sola/i)).not.toBeInTheDocument()
    expect(screen.getByText(/se activa tal cual cuando venza el actual/i)).toBeInTheDocument()
  })

  it('enseña la fecha en la que arrancaría, para no programar a ciegas', async () => {
    abrir()
    await userEvent.click(screen.getByRole('button', { name: /próxima semana/i }))
    expect(screen.getByText(new RegExp(inicioProximaSemana(hoy())))).toBeInTheDocument()
  })
})

/** La misma fecha que usa la hoja, sin importar `hoyIso` en cada aserción. */
function hoy(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
