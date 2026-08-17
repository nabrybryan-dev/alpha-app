import { beforeEach, describe, expect, it } from 'vitest'
import { crearMockDb } from '../../data/mockDb'
import { sumarDias } from '../../domain/activacion'
import type { Usuario } from '../../domain/types'
import {
  activarAutomaticas,
  barrerYActivar,
  conclusion,
  reiniciarBarrido,
  revisarCartera,
  type FilaCartera,
} from './revisionCartera'

/** El asesorado del seed y su microciclo activo. */
function partida() {
  const db = crearMockDb()
  const usuario = db.usuarios.byId('u-valentina')
  const activo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
  if (!usuario || !activo) throw new Error('el seed no trae asesorado con microciclo activo')
  return { db, usuario, activo }
}

const filaDe = (filas: FilaCartera[]) => {
  const fila = filas.find((f) => f.usuario.id === 'u-valentina')
  if (!fila) throw new Error('el barrido no incluyó al asesorado del seed')
  return fila
}

describe('revisarCartera', () => {
  beforeEach(() => localStorage.clear())

  it('el día antes de vencer lo deja en curso', () => {
    const { db, activo } = partida()
    const vispera = sumarDias(activo.fechaInicio, activo.cadenciaDias - 1)
    expect(filaDe(revisarCartera(db, vispera)).estado).toBe('en-curso')
  })

  it('el día que vence por calendario ya trae propuesta', () => {
    const { db, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    const fila = filaDe(revisarCartera(db, fin))

    expect(fila.estado).not.toBe('en-curso')
    expect(fila.cierre?.motivo).toBe('calendario')
    expect(fila.propuesta?.numero).toBe(activo.numero + 1)
  })

  /**
   * Un microciclo a medias con muchas sesiones sin registrar es justo el caso que
   * Bryan pidió ver antes de que se active. Si esto pasara a `automatica`, la
   * propuesta se calcularía sobre un puñado de series y llegaría al gimnasio sin
   * que nadie la hubiera mirado.
   */
  it('no se activa sola cuando quedaron sesiones sin registrar', () => {
    const { db, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    const fila = filaDe(revisarCartera(db, fin))

    expect(fila.estado).toBe('revisar')
    expect(fila.propuesta?.revision.motivos.length).toBeGreaterThan(0)
  })

  it('quien no tiene microciclo activo no genera propuesta', () => {
    const { db } = partida()
    const filas = revisarCartera(db, '2030-01-01')
    const sinMicro = filas.filter((f) => f.estado === 'sin-microciclo')
    expect(sinMicro.every((f) => f.propuesta === undefined)).toBe(true)
  })

  /** Mirar no es decidir: el barrido corre en cada apertura del panel. */
  it('no escribe nada: ni propuestas ni cambios de estado', () => {
    const { db } = partida()
    const antes = JSON.stringify(db.microciclos.byUsuario('u-valentina'))
    revisarCartera(db, '2030-01-01')
    expect(JSON.stringify(db.microciclos.byUsuario('u-valentina'))).toBe(antes)
  })
})

describe('activarAutomaticas', () => {
  beforeEach(() => localStorage.clear())

  const filaAutomatica = (usuario: Usuario, numeroActual: number): FilaCartera => ({
    usuario,
    estado: 'automatica',
    numeroActual,
  })

  it('genera la propuesta y la deja activa, cerrando la anterior', () => {
    const { db, usuario, activo } = partida()
    activarAutomaticas(db, [filaAutomatica(usuario, activo.numero)])

    const todos = db.microciclos.byUsuario('u-valentina')
    const activos = todos.filter((m) => m.estado === 'activo')
    expect(activos).toHaveLength(1)
    expect(activos[0].numero).toBe(activo.numero + 1)
    expect(todos.find((m) => m.id === activo.id)?.estado).toBe('cerrado')
  })

  it('el microciclo nuevo llega sin series registradas', () => {
    const { db, usuario, activo } = partida()
    activarAutomaticas(db, [filaAutomatica(usuario, activo.numero)])

    const nuevo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    const series = nuevo?.sesiones.flatMap((s) => s.ejercicios).flatMap((e) => e.series) ?? []
    expect(series).toHaveLength(0)
  })

  it('a las de revisar no las toca', () => {
    const { db, usuario, activo } = partida()
    activarAutomaticas(db, [{ usuario, estado: 'revisar', numeroActual: activo.numero }])

    const activos = db.microciclos.byUsuario('u-valentina').filter((m) => m.estado === 'activo')
    expect(activos).toHaveLength(1)
    expect(activos[0].numero).toBe(activo.numero)
  })

  /**
   * Entre el barrido y la escritura puede entrar una hidratación. Si el activo ya
   * no es el que se evaluó, la propuesta calculada sobre él está vieja: prescribir
   * con ella sería mandarle al gimnasio una semana deducida de datos que ya
   * cambiaron.
   */
  it('se salta al asesorado cuyo microciclo cambió entre el barrido y la escritura', () => {
    const { db, usuario, activo } = partida()
    activarAutomaticas(db, [filaAutomatica(usuario, 999)])

    const activos = db.microciclos.byUsuario('u-valentina').filter((m) => m.estado === 'activo')
    expect(activos).toHaveLength(1)
    expect(activos[0].numero).toBe(activo.numero)
  })

  it('devuelve solo las que activó', () => {
    const { db, usuario, activo } = partida()
    const hechas = activarAutomaticas(db, [
      filaAutomatica(usuario, activo.numero),
      { usuario, estado: 'en-curso', numeroActual: activo.numero },
    ])
    expect(hechas).toHaveLength(1)
  })

  /**
   * ✅ REGRESIÓN. El microciclo nuevo nacía con la `fechaInicio` del viejo, o sea
   * ya vencido, y el barrido siguiente le proponía otro encima de uno recién
   * creado y vacío. Visto en el panel del coach, no en un test: «M10: 0 suben · 0
   * sostienen · 0 bajan» sobre un M9 que acababa de activarse.
   */
  it('el microciclo activado no nace vencido', () => {
    const { db, usuario, activo } = partida()
    const hoy = sumarDias(activo.fechaInicio, activo.cadenciaDias + 30) // muy tarde
    activarAutomaticas(db, [filaAutomatica(usuario, activo.numero)], hoy)

    const nuevo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    if (!nuevo) throw new Error('no quedó microciclo activo')
    expect(nuevo.fechaInicio).toBe(hoy)
    expect(sumarDias(nuevo.fechaInicio, nuevo.cadenciaDias) > hoy).toBe(true)
  })

  it('activado a tiempo, encadena con el día en que terminaba el anterior', () => {
    const { db, usuario, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    activarAutomaticas(db, [filaAutomatica(usuario, activo.numero)], fin)

    const nuevo = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    expect(nuevo?.fechaInicio).toBe(fin)
  })
})

/**
 * ✅ REGRESIÓN. StrictMode corre el inicializador de `useState` dos veces. Sin el
 * memo, la segunda pasada barría de nuevo —ya con el microciclo activado— y su foto
 * pisaba la primera: en pantalla, a quien se le acababa de activar el suyo aparecía
 * bajo «te esperan a ti». El resumen decía lo contrario de lo que había pasado.
 */
describe('barrerYActivar', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarBarrido()
  })

  it('dos pasadas del mismo día devuelven la misma foto', () => {
    const { db, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    const primera = barrerYActivar(db, fin)
    const segunda = barrerYActivar(db, fin)
    expect(segunda).toBe(primera)
  })

  it('no activa dos veces: el segundo barrido no toca la base', () => {
    const { db, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    barrerYActivar(db, fin)
    const despues = JSON.stringify(db.microciclos.byUsuario('u-valentina'))
    barrerYActivar(db, fin)
    expect(JSON.stringify(db.microciclos.byUsuario('u-valentina'))).toBe(despues)
  })

  it('al día siguiente vuelve a barrer', () => {
    const { db, activo } = partida()
    const fin = sumarDias(activo.fechaInicio, activo.cadenciaDias)
    const primera = barrerYActivar(db, fin)
    const otroDia = barrerYActivar(db, sumarDias(fin, 1))
    expect(otroDia).not.toBe(primera)
  })
})

describe('conclusion', () => {
  const usuario = { id: 'u1', nombre: 'X', rol: 'asesorado' } as Usuario
  const propuesta = {
    numero: 23,
    prs: 5,
    filas: [],
    sinDatos: 0,
    revision: { auto: true, motivos: [] },
    reparto: { suben: 8, sostienen: 3, bajan: 1 },
    // La conclusión de cartera no los mira, pero el tipo los exige: son parte
    // de la propuesta desde que el volumen dejó de heredarse.
    volumen: [],
    desalineados: [],
  }

  it('en curso dice cuándo vence', () => {
    const texto = conclusion({
      usuario,
      estado: 'en-curso',
      numeroActual: 22,
      cierre: { vencido: false, sesionesPendientes: 2, fechaFin: '2026-08-05' },
    })
    expect(texto).toContain('2 sesiones por registrar')
    expect(texto).toContain('2026-08-05')
  })

  it('activada resume el reparto y el PRS', () => {
    const texto = conclusion({
      usuario,
      estado: 'automatica',
      numeroActual: 22,
      cierre: { vencido: true, motivo: 'sesiones-completas', sesionesPendientes: 0, fechaFin: '2026-08-05' },
      propuesta,
    })
    expect(texto).toBe('M23: 8 suben · 3 sostienen · 1 bajan. PRS 5. Activado.')
  })

  /** El «cerrar avisando» que pidió Bryan. */
  it('activada por calendario avisa de lo que quedó sin registrar', () => {
    const texto = conclusion({
      usuario,
      estado: 'automatica',
      numeroActual: 22,
      cierre: { vencido: true, motivo: 'calendario', sesionesPendientes: 1, fechaFin: '2026-08-05' },
      propuesta,
    })
    expect(texto).toContain('se cerró con 1 sesión sin registrar')
  })

  it('en espera enseña los motivos, que es para lo que existe', () => {
    const texto = conclusion({
      usuario,
      estado: 'revisar',
      numeroActual: 22,
      cierre: { vencido: true, motivo: 'calendario', sesionesPendientes: 3, fechaFin: '2026-08-05' },
      propuesta: {
        ...propuesta,
        revision: { auto: false, motivos: ['3 sesiones sin registrar', 'entró mal recuperado (PRS 3)'] },
      },
    })
    expect(texto).toContain('Esperando revisión')
    expect(texto).toContain('3 sesiones sin registrar')
    expect(texto).toContain('entró mal recuperado (PRS 3)')
  })
})
