import { beforeEach, describe, expect, it } from 'vitest'
import { PLAZO_HORAS_PROPUESTA, armarPropuestaDeCarga, armarVoyAEscribirte, type FilaBajarCarga, type FilaVoyAEscribirte } from '../../domain/praxis/propuestaCoach'
import { MAX_PENDIENTES_POR_PERSONA, crearRepoPropuestasEnMemoria, type RepositorioPropuestasCoach, type SesionPropuestas } from './propuestasCoach'

const PERSONA = 'persona-1'
const OTRA = 'persona-2'
const persona: SesionPropuestas = { uid: PERSONA, rol: 'asesorado' }
const otra: SesionPropuestas = { uid: OTRA, rol: 'asesorado' }
const coach: SesionPropuestas = { uid: 'coach-1', rol: 'coach' }
const nutri: SesionPropuestas = { uid: 'nutri-1', rol: 'nutricionista' }
const anon: SesionPropuestas = { uid: null, rol: 'anon' }

function carga(ejercicioId = 'press-banca', cargaKg = 100): FilaBajarCarga {
  const r = armarPropuestaDeCarga({
    series: [{ orden: 1, cargaKg, reps: 8, rir: 1 }], cansancio: 'algo', motivo: 'cansancio', ejercicioId, microcicloId: 'mc-1',
  })
  if (r.tipo !== 'fila') throw new Error('fila')
  return r.fila
}
function contacto(fichaId = 'vida-sin-ganas'): FilaVoyAEscribirte {
  const r = armarVoyAEscribirte({ origenContacto: 'ficha', fichaId, tema: 'animo' })
  if (!r.ok) throw new Error('fila')
  return r.fila
}

let reloj: number
let repo: RepositorioPropuestasCoach
beforeEach(() => {
  reloj = Date.parse('2026-10-21T08:00:00.000Z')
  let n = 0
  repo = crearRepoPropuestasEnMemoria({ ahora: () => new Date(reloj), nuevoId: () => `id-${++n}` })
})

describe('insertar: la persona inserta lo suyo', () => {
  it('inserta una carga propia y nace pendiente, con la hora de la base y sin decisión', async () => {
    const r = await repo.insertar(persona, PERSONA, carga())
    expect(r).toMatchObject({ ok: true })
    const [f] = await repo.leer(coach)
    expect(f).toMatchObject({
      usuarioId: PERSONA, tipo: 'bajar_carga', estado: 'pendiente', creadoEn: new Date(reloj).toISOString(),
      decididoPor: null, decididoEn: null, cargaDecididaKg: null, motivoRechazo: null, aplicadaEn: null,
    })
  })

  it('no inserta a nombre de otra persona', async () => {
    expect(await repo.insertar(persona, OTRA, carga())).toEqual({ ok: false, motivo: 'ajeno' })
    expect(await repo.leer(coach)).toHaveLength(0)
  })

  it('anon no inserta', async () => {
    expect(await repo.insertar(anon, PERSONA, carga())).toEqual({ ok: false, motivo: 'sin_permiso' })
  })

  it('un campo que no es de la lista (frase, estado, decisión) se rechaza sin guardar nada', async () => {
    for (const extra of [{ frase: 'me siento sin ganas' }, { estado: 'aceptada' }, { decididoPor: 'coach-1' }, { cargaDecididaKg: 50 }, { aplicadaEn: 'ya' }]) {
      const r = await repo.insertar(persona, PERSONA, { ...contacto(), ...extra } as never)
      expect(r).toEqual({ ok: false, motivo: 'campo_no_permitido' })
    }
    expect(await repo.leer(coach)).toHaveLength(0)
  })

  it('un texto libre dentro de un campo de lista cerrada se rechaza', async () => {
    const r = await repo.insertar(persona, PERSONA, { ...contacto(), tema: 'me siento muy mal hoy' } as never)
    expect(r).toEqual({ ok: false, motivo: 'campo_no_permitido' })
  })

  it('una carga con regla firmada = true se rechaza (la regla sigue sin revisión profesional)', async () => {
    const r = await repo.insertar(persona, PERSONA, { ...carga(), reglaFirmada: true } as never)
    expect(r).toEqual({ ok: false, motivo: 'campo_no_permitido' })
  })

  it('una carga cuya propuesta no baja se rechaza', async () => {
    const r = await repo.insertar(persona, PERSONA, { ...carga(), cargaPropuestaKg: 100 })
    expect(r).toEqual({ ok: false, motivo: 'campo_no_permitido' })
  })

  it('dos iguales pendientes dejan una sola (descarte silencioso) y no se devuelve el id de la otra fila', async () => {
    await repo.insertar(persona, PERSONA, carga())
    const r = await repo.insertar(persona, PERSONA, carga())
    expect(r).toEqual({ ok: true, duplicada: true })
    expect(await repo.leer(coach)).toHaveLength(1)
  })

  it('un «voy a escribirte» de OTRO tema dentro de 24 h NO se descarta (señal clínica)', async () => {
    const otroTema = armarVoyAEscribirte({ origenContacto: 'ficha', fichaId: 'vida-sin-ganas', tema: 'otro' })
    if (!otroTema.ok) throw new Error('fila')
    await repo.insertar(persona, PERSONA, otroTema.fila)
    expect(await repo.insertar(persona, PERSONA, contacto())).toMatchObject({ ok: true })
    expect((await repo.leer(coach)).map((f) => (f as FilaVoyAEscribirte).tema).sort()).toEqual(['animo', 'otro'])
  })

  it('un «voy a escribirte» de OTRO origen dentro de 24 h NO se descarta', async () => {
    const otroOrigen = armarVoyAEscribirte({ origenContacto: 'filtro_clinico', fichaId: 'vida-sin-ganas', tema: 'animo' })
    if (!otroOrigen.ok) throw new Error('fila')
    await repo.insertar(persona, PERSONA, contacto())
    await repo.insertar(persona, PERSONA, otroOrigen.fila)
    expect(await repo.leer(coach)).toHaveLength(2)
  })

  it('la fila guardada vence 12 horas después de crearse', async () => {
    await repo.insertar(persona, PERSONA, carga())
    const [f] = await repo.leer(coach)
    expect(Date.parse(f.venceEn) - Date.parse(f.creadoEn)).toBe(PLAZO_HORAS_PROPUESTA * 3_600_000)
  })

  it('rangos como los del SQL: reps 1-100, RIR 0-10, RIR objetivo 0-15, salto > 0, 1RM > 0, enteros', async () => {
    const malas: Partial<FilaBajarCarga>[] = [
      { serieReps: 0 }, { serieReps: 101 }, { serieReps: 8.5 }, { serieRir: -1 }, { serieRir: 11 }, { serieRir: 1.5 },
      { rirObjetivo: 16 }, { rirObjetivo: -1 }, { rirObjetivo: 2.5 }, { saltoKg: 0 }, { saltoKg: -1 }, { unRmKg: 0 }, { unRmKg: -3 },
    ]
    for (const m of malas) expect(await repo.insertar(persona, PERSONA, { ...carga(), ...m }), JSON.stringify(m)).toEqual({ ok: false, motivo: 'campo_no_permitido' })
    expect(await repo.leer(coach)).toHaveLength(0)
  })

  it('los extremos válidos entran', async () => {
    expect(await repo.insertar(persona, PERSONA, { ...carga(), serieReps: 100, serieRir: 10, rirObjetivo: 15 })).toMatchObject({ ok: true })
  })

  it('«voy a escribirte» repetido dentro de 24 h deja una; pasadas 24 h entra otra', async () => {
    await repo.insertar(persona, PERSONA, contacto())
    await repo.insertar(persona, PERSONA, contacto())
    expect(await repo.leer(coach)).toHaveLength(1)
    reloj += 25 * 3_600_000
    await repo.insertar(persona, PERSONA, contacto())
    expect(await repo.leer(coach)).toHaveLength(2)
  })

  it('el tope de pendientes por persona se cumple', async () => {
    for (let i = 0; i < MAX_PENDIENTES_POR_PERSONA; i++) expect(await repo.insertar(persona, PERSONA, carga(`ej-${i}`))).toMatchObject({ ok: true })
    expect(await repo.insertar(persona, PERSONA, carga('ej-extra'))).toEqual({ ok: false, motivo: 'tope' })
    // el tope es por persona
    expect(await repo.insertar(otra, OTRA, carga('ej-extra'))).toMatchObject({ ok: true })
  })
})

describe('leer: permisos por rol', () => {
  beforeEach(async () => {
    await repo.insertar(persona, PERSONA, carga())
    await repo.insertar(persona, PERSONA, contacto())
  })

  it('la persona no lee nada, ni lo suyo', async () => {
    expect(await repo.leer(persona)).toEqual([])
  })

  it('anon no lee nada', async () => {
    expect(await repo.leer(anon)).toEqual([])
  })

  it('el coach lee las dos clases', async () => {
    expect((await repo.leer(coach)).map((f) => f.tipo).sort()).toEqual(['bajar_carga', 'voy_a_escribirte'])
  })

  it('la nutricionista solo ve «voy a escribirte»', async () => {
    const filas = await repo.leer(nutri)
    expect(filas.map((f) => f.tipo)).toEqual(['voy_a_escribirte'])
  })

  it('lo leído es una copia: cambiarla no cambia la tabla', async () => {
    const [f] = await repo.leer(coach)
    ;(f as { estado: string }).estado = 'aceptada'
    expect((await repo.leer(coach))[0].estado).toBe('pendiente')
  })
})

describe('decidir', () => {
  let idCarga: string
  let idContacto: string
  beforeEach(async () => {
    await repo.insertar(persona, PERSONA, carga())
    await repo.insertar(persona, PERSONA, contacto())
    const filas = await repo.leer(coach)
    idCarga = filas.find((f) => f.tipo === 'bajar_carga')!.id
    idContacto = filas.find((f) => f.tipo === 'voy_a_escribirte')!.id
  })

  it('la persona no decide', async () => {
    expect(await repo.decidir(persona, idCarga, { accion: 'aceptar' })).toEqual({ ok: false, motivo: 'sin_permiso' })
    expect(await repo.decidir(anon, idContacto, { accion: 'atender' })).toEqual({ ok: false, motivo: 'sin_permiso' })
  })

  it('el coach acepta: queda la carga propuesta, quién y cuándo', async () => {
    reloj += 60_000
    expect(await repo.decidir(coach, idCarga, { accion: 'aceptar' })).toMatchObject({ ok: true })
    const f = (await repo.leer(coach)).find((x) => x.id === idCarga)!
    expect(f).toMatchObject({ estado: 'aceptada', cargaDecididaKg: 95, decididoPor: 'coach-1', decididoEn: new Date(reloj).toISOString(), aplicadaEn: null })
  })

  it('el coach ajusta: carga distinta de la propuesta', async () => {
    expect(await repo.decidir(coach, idCarga, { accion: 'ajustar', cargaKg: 92.5 })).toMatchObject({ ok: true })
    expect((await repo.leer(coach)).find((x) => x.id === idCarga)).toMatchObject({ estado: 'ajustada', cargaDecididaKg: 92.5 })
  })

  it('ajustar a la misma carga propuesta, a cero o a un número raro es inválido', async () => {
    for (const cargaKg of [95, 0, -5, Number.NaN]) expect(await repo.decidir(coach, idCarga, { accion: 'ajustar', cargaKg })).toEqual({ ok: false, motivo: 'decision_invalida' })
  })

  it('el coach rechaza con motivo de lista cerrada; un motivo libre es inválido', async () => {
    expect(await repo.decidir(coach, idCarga, { accion: 'rechazar', motivo: 'le duele mucho' as never })).toEqual({ ok: false, motivo: 'decision_invalida' })
    expect(await repo.decidir(coach, idCarga, { accion: 'rechazar', motivo: 'no_corresponde' })).toMatchObject({ ok: true })
    expect((await repo.leer(coach)).find((x) => x.id === idCarga)).toMatchObject({ estado: 'rechazada', motivoRechazo: 'no_corresponde' })
  })

  it('«atender» solo vale para «voy a escribirte»; aceptar no vale para «voy a escribirte»', async () => {
    expect(await repo.decidir(coach, idCarga, { accion: 'atender' })).toEqual({ ok: false, motivo: 'decision_invalida' })
    expect(await repo.decidir(coach, idContacto, { accion: 'aceptar' })).toEqual({ ok: false, motivo: 'decision_invalida' })
    expect(await repo.decidir(coach, idContacto, { accion: 'atender' })).toMatchObject({ ok: true })
  })

  it('una fila ya decidida no se reescribe', async () => {
    await repo.decidir(coach, idCarga, { accion: 'aceptar' })
    expect(await repo.decidir(coach, idCarga, { accion: 'rechazar', motivo: 'otro' })).toEqual({ ok: false, motivo: 'ya_no_pendiente' })
  })

  it('una fila inexistente se dice', async () => {
    expect(await repo.decidir(coach, 'no-existe', { accion: 'aceptar' })).toEqual({ ok: false, motivo: 'no_encontrada' })
  })

  it('no se puede aceptar una carga que no trae número', async () => {
    const sinNumero: FilaBajarCarga = { ...carga('sin-numero'), cargaPropuestaKg: null, razonSinCalculo: 'no_baja', unRmKg: null }
    await repo.insertar(otra, OTRA, sinNumero)
    const id = (await repo.leer(coach)).find((f) => f.usuarioId === OTRA)!.id
    expect(await repo.decidir(coach, id, { accion: 'aceptar' })).toEqual({ ok: false, motivo: 'sin_propuesta' })
    expect(await repo.decidir(coach, id, { accion: 'ajustar', cargaKg: 70 })).toMatchObject({ ok: true })
  })

  it('la nutricionista no decide cargas ni las ve, y solo atiende «voy a escribirte»', async () => {
    // Sin oráculo: una carga existente y un id que no existe dan EXACTAMENTE el mismo resultado.
    const inexistente = await repo.decidir(nutri, 'no-existe', { accion: 'atender' })
    expect(await repo.decidir(nutri, idCarga, { accion: 'aceptar' })).toEqual(inexistente)
    expect(await repo.decidir(nutri, idCarga, { accion: 'atender' })).toEqual(inexistente)
    expect(inexistente.ok).toBe(false)
    expect(await repo.decidir(nutri, idContacto, { accion: 'rechazar', motivo: 'otro' })).toEqual({ ok: false, motivo: 'sin_permiso' })
    expect(await repo.decidir(nutri, idContacto, { accion: 'atender' })).toMatchObject({ ok: true })
    expect((await repo.leer(coach)).find((x) => x.id === idContacto)).toMatchObject({ estado: 'atendida', decididoPor: 'nutri-1' })
  })
})

describe('aplicarAlPlan: solo se marca aplicada_en si el plan confirmó', () => {
  let id: string
  beforeEach(async () => {
    await repo.insertar(persona, PERSONA, carga())
    id = (await repo.leer(coach))[0].id
  })
  const aplicada = async () => (await repo.leer(coach)).find((f) => f.id === id)!.aplicadaEn

  it('una fila pendiente no se aplica', async () => {
    expect(await repo.aplicarAlPlan(coach, id, async () => true)).toEqual({ ok: false, motivo: 'no_decidida' })
  })

  it('con el plan confirmando, queda la hora', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    reloj += 5_000
    expect(await repo.aplicarAlPlan(coach, id, async () => true)).toMatchObject({ ok: true })
    expect(await aplicada()).toBe(new Date(reloj).toISOString())
  })

  it('si el plan no confirma (false), no se marca', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    expect(await repo.aplicarAlPlan(coach, id, async () => false)).toEqual({ ok: false, motivo: 'no_confirmo_plan' })
    expect(await aplicada()).toBeNull()
  })

  it('si la escritura al plan lanza, no se marca y no revienta', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    expect(await repo.aplicarAlPlan(coach, id, async () => { throw new Error('red') })).toEqual({ ok: false, motivo: 'no_confirmo_plan' })
    expect(await aplicada()).toBeNull()
  })

  it('no se aplica dos veces', async () => {
    await repo.decidir(coach, id, { accion: 'ajustar', cargaKg: 90 })
    await repo.aplicarAlPlan(coach, id, async () => true)
    let llamadas = 0
    expect(await repo.aplicarAlPlan(coach, id, async () => { llamadas++; return true })).toEqual({ ok: false, motivo: 'ya_aplicada' })
    expect(llamadas).toBe(0)
  })

  it('una rechazada no se aplica', async () => {
    await repo.decidir(coach, id, { accion: 'rechazar', motivo: 'otro' })
    expect(await repo.aplicarAlPlan(coach, id, async () => true)).toEqual({ ok: false, motivo: 'no_decidida' })
  })

  it('dos aplicaciones a la vez: la escritura al plan corre UNA vez y solo una marca', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    let llamadas = 0
    const aplicar = async () => { llamadas++; await Promise.resolve(); await Promise.resolve(); return true }
    const [a, b] = await Promise.all([repo.aplicarAlPlan(coach, id, aplicar), repo.aplicarAlPlan(coach, id, aplicar)])
    expect(llamadas).toBe(1)
    expect([a.ok, b.ok].sort()).toEqual([false, true])
  })

  it('si la primera falla, la segunda puede intentarlo después (no queda bloqueada)', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    expect(await repo.aplicarAlPlan(coach, id, async () => false)).toMatchObject({ ok: false })
    expect(await repo.aplicarAlPlan(coach, id, async () => true)).toMatchObject({ ok: true })
  })

  it('solo el coach aplica', async () => {
    await repo.decidir(coach, id, { accion: 'aceptar' })
    expect(await repo.aplicarAlPlan(nutri, id, async () => true)).toEqual({ ok: false, motivo: 'sin_permiso' })
    expect(await repo.aplicarAlPlan(persona, id, async () => true)).toEqual({ ok: false, motivo: 'sin_permiso' })
  })
})
