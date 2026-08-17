/**
 * El recorrido entero, tal y como lo hace el coach: preparar por adelantado la
 * semana de varios asesorados y comprobar que les llega.
 *
 * Los tres de aquí son los del seed ficticio. Nunca datos de personas reales: lo
 * que se prueba es el mecanismo, y el mecanismo no distingue quién está dentro.
 *
 * Existe porque las piezas ya se prueban por separado —la hoja, el motor, el
 * barrido— y aun así el recorrido completo estaba roto: cada pieza cumplía su
 * parte y entre la segunda y la tercera no había cable. Un test por pieza no lo
 * habría visto nunca.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from '../../data/mockDb'
import type { Db } from '../../data/repos'
import { sumarDias } from '../../domain/activacion'
import { inicioProximaSemana } from '../../domain/calendario'
import type { Microciclo } from '../../domain/types'
import { microcicloPropuesto, proponerMicrociclo } from './propuestaMicrociclo'
import { barrerYActivar, reiniciarBarrido } from './revisionCartera'

const HOY = '2026-08-02'

const activoDe = (db: Db, usuarioId: string): Microciclo => {
  const m = db.microciclos.byUsuario(usuarioId).find((x) => x.estado === 'activo')
  if (!m) throw new Error(`${usuarioId} no tiene microciclo activo`)
  return m
}

/** Lo mismo que hace `GenerarMicrocicloSheet` al elegir «próxima semana». */
function prepararProximaSemana(db: Db, usuarioId: string): Microciclo {
  const propuesta = microcicloPropuesto(activoDe(db, usuarioId), {
    hoy: HOY,
    fechaInicio: inicioProximaSemana(HOY),
  })
  db.microciclos.guardarPropuesta(propuesta)
  return propuesta
}

const ejerciciosDeFuerza = (m: Microciclo) =>
  m.sesiones.filter((s) => s.tipo !== 'metabolica').flatMap((s) => s.ejercicios)

describe('programar la semana siguiente de varios asesorados', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarBarrido()
  })

  it('los tres del seed entrenan y tienen microciclo activo del que partir', () => {
    const db = crearMockDb()
    const quienesEntrenan = db.usuarios.entrenan()
    expect(quienesEntrenan.length).toBeGreaterThanOrEqual(3)
    for (const u of quienesEntrenan) expect(activoDe(db, u.id).numero).toBeGreaterThan(0)
  })

  it('preparar la semana de los tres no le cambia nada a ninguno todavía', () => {
    const db = crearMockDb()
    const antes = db.usuarios.entrenan().map((u) => activoDe(db, u.id).id)

    for (const u of db.usuarios.entrenan()) prepararProximaSemana(db, u.id)

    // Siguen entrenando lo suyo: una propuesta no se le enseña a nadie.
    const despues = db.usuarios.entrenan().map((u) => activoDe(db, u.id).id)
    expect(despues).toEqual(antes)
  })

  /**
   * El corazón del asunto. Cada uno vence un día distinto —cadencias de 8 y 15
   * días, fechas de inicio distintas— así que el barrido tiene que activarle a
   * cada uno la suya el día que le toca, no a todos a la vez.
   */
  it('a cada uno se le activa la suya el día que vence, con la fecha elegida', () => {
    const db = crearMockDb()
    const preparadas = new Map(
      db.usuarios.entrenan().map((u) => [u.id, prepararProximaSemana(db, u.id)]),
    )

    for (const [usuarioId, preparada] of preparadas) {
      const actual = activoDe(db, usuarioId)
      const vence = sumarDias(actual.fechaInicio, actual.cadenciaDias)

      reiniciarBarrido()
      barrerYActivar(db, vence)

      const nuevo = activoDe(db, usuarioId)
      expect(nuevo.id).toBe(preparada.id)
      expect(nuevo.numero).toBe(actual.numero + 1)
      expect(nuevo.fechaInicio).toBe(inicioProximaSemana(HOY))
    }
  })

  it('nadie se queda con dos microciclos activos ni con ninguno', () => {
    const db = crearMockDb()
    for (const u of db.usuarios.entrenan()) prepararProximaSemana(db, u.id)

    for (const u of db.usuarios.entrenan()) {
      const actual = activoDe(db, u.id)
      reiniciarBarrido()
      barrerYActivar(db, sumarDias(actual.fechaInicio, actual.cadenciaDias))
    }

    for (const u of db.usuarios.entrenan()) {
      const activos = db.microciclos.byUsuario(u.id).filter((m) => m.estado === 'activo')
      expect(activos).toHaveLength(1)
    }
  })

  it('la semana activada llega limpia: sin las series de la anterior', () => {
    const db = crearMockDb()
    const actual = activoDe(db, 'u-valentina')
    prepararProximaSemana(db, 'u-valentina')
    barrerYActivar(db, sumarDias(actual.fechaInicio, actual.cadenciaDias))

    const series = ejerciciosDeFuerza(activoDe(db, 'u-valentina')).flatMap((e) => e.series)
    expect(series).toHaveLength(0)
  })

  /**
   * La cadena de la ondulación, que es lo que hace que preparar por adelantado
   * sirva de algo — y hasta dónde llega, que es lo que hay que saber antes de
   * programar una semana a ciegas.
   *
   * El ancla de un ejercicio no entrenado es su propia prescripción serie a serie.
   * O sea que **la ondulación se propaga sola de un microciclo al siguiente, pero
   * solo por donde ya entró**: lo que el motor onduló una vez se puede volver a
   * ondular sin que nadie entrene, y lo que nunca tuvo prescripción por series
   * sigue necesitando que el asesorado registre algo.
   *
   * En el seed se ve el escalón exacto: los microciclos son de antes de que la
   * ondulación se guardara, así que en la primera vuelta solo entran los 5
   * ejercicios de la sesión que la asesorada ya registró. Esos 5 se propagan; los
   * otros 20 esperan a que los entrene.
   */
  it('la ondulación se propaga al microciclo siguiente sin que nadie entrene', () => {
    const db = crearMockDb()
    const actual = activoDe(db, 'u-valentina')
    prepararProximaSemana(db, 'u-valentina')
    barrerYActivar(db, sumarDias(actual.fechaInicio, actual.cadenciaDias))

    // Segunda vuelta: se prepara la siguiente sin que haya entrenado nada de esta.
    const delMotor = activoDe(db, 'u-valentina')
    expect(ejerciciosDeFuerza(delMotor).flatMap((e) => e.series)).toHaveLength(0)

    const conAncla = ejerciciosDeFuerza(delMotor).filter(
      (e) => (e.seriesPrescritas?.length ?? 0) > 0,
    )
    expect(conAncla.length).toBeGreaterThan(0)

    /**
     * Se mira `sinDatos` y no `seriesPrescritas`, y la diferencia importa: el
     * ejercicio YA traía prescripción de la vuelta anterior, así que comprobar que
     * el campo viene lleno lo cumpliría también una copia sin recalcular. Lo que
     * dice que el motor pudo ondular de verdad es que deje de contarlo como sin
     * datos. Sin el ancla pautada, los 5 volvían a caer ahí.
     */
    const propuesta = proponerMicrociclo(delMotor)
    const nombresConAncla = new Set(conAncla.map((e) => e.nombre))
    const filasConAncla = propuesta.filas.filter((f) => nombresConAncla.has(f.ejercicio))

    expect(filasConAncla.length).toBe(conAncla.length)
    expect(filasConAncla.every((f) => f.direccion !== 'sin-datos')).toBe(true)
    expect(filasConAncla.every((f) => f.prescripcion !== '')).toBe(true)

    const siguiente = microcicloPropuesto(delMotor, { fechaInicio: '2026-08-17' })
    const ondulados = ejerciciosDeFuerza(siguiente).filter((e) =>
      conAncla.some((c) => c.id === e.id),
    )
    expect(ondulados).toHaveLength(conAncla.length)
    expect(ondulados.every((e) => e.seriesPrescritas!.every((s) => s.cargaKg > 0))).toBe(true)
  })

  /**
   * El límite, dicho en un test para que nadie prometa de más: un ejercicio que
   * nunca tuvo prescripción serie a serie **y** que el asesorado no ha entrenado
   * no se puede ondular. No hay de dónde sacar el 1RM, y prescribir kilos
   * inventados a alguien que va a levantarlos es peor que dejarlo como está.
   *
   * Lo que decide cuánto entra, entonces, no es la app: es cuánto ha registrado la
   * persona antes de que se le prepare la semana.
   */
  it('lo que nunca tuvo prescripción ni registro se queda sin ondular, y se avisa', () => {
    const db = crearMockDb()
    const propuesta = proponerMicrociclo(activoDe(db, 'u-valentina'))
    const sinNada = propuesta.filas.filter((f) => f.direccion === 'sin-datos')

    expect(sinNada.length).toBeGreaterThan(0)
    expect(propuesta.sinDatos).toBe(sinNada.length)
    // Y no se le inventa una prescripción: la hoja del coach lo enseña en blanco.
    expect(sinNada.every((f) => f.prescripcion === '')).toBe(true)
  })

  /**
   * Aislamiento entre asesorados: la propiedad que ya se rompió dos veces en este
   * repo. Preparar y activar la semana de uno no puede tocar la de los demás.
   */
  it('activar la semana de uno no le mueve el microciclo a los otros', () => {
    const db = crearMockDb()
    for (const u of db.usuarios.entrenan()) prepararProximaSemana(db, u.id)

    const otros = db.usuarios.entrenan().filter((u) => u.id !== 'u-valentina')
    const antes = otros.map((u) => activoDe(db, u.id).id)

    const actual = activoDe(db, 'u-valentina')
    barrerYActivar(db, sumarDias(actual.fechaInicio, actual.cadenciaDias))

    expect(otros.map((u) => activoDe(db, u.id).id)).toEqual(antes)
  })

  it('las propuestas de uno no aparecen en la lista de otro', () => {
    const db = crearMockDb()
    const dePrimero = prepararProximaSemana(db, 'u-valentina')

    for (const u of db.usuarios.entrenan().filter((x) => x.id !== 'u-valentina')) {
      expect(db.microciclos.byUsuario(u.id).some((m) => m.id === dePrimero.id)).toBe(false)
    }
  })
})
