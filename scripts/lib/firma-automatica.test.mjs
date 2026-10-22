// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { banderaDeFirmaEncendida, elegirParaFirmar, firmarRevisionesAutomaticas } from './firma-automatica.mjs'

// La firma automática (decisión de Bryan, 21-oct: «Solos, sin freno») firma SOLO lo que el agente
// de mensajes marcó «publicar» y que la base muestra tal cual se revisó. La función SQL pone sus
// propias guardas (pruebas-sql/aprobacion-automatica.mjs); esto es lo que decide el puente.

const ANA = '00000000-0000-4000-8000-0000000000a1'
const BETO = '00000000-0000-4000-8000-0000000000b2'
const CARLA = '00000000-0000-4000-8000-0000000000c3'
const DANI = '00000000-0000-4000-8000-0000000000d4'

const encargo = (usuarioId, estado, guion = `Guion de ${usuarioId}`, extra = {}) => ({
  usuarioId,
  nombre: 'Persona ficticia',
  guion,
  ...(estado ? { mensaje: { estado } } : {}),
  ...extra,
})
const fila = (usuarioId, guion = `Guion de ${usuarioId}`, extra = {}) => ({
  usuario_id: usuarioId,
  guion,
  aprobado_en: null,
  tipo: 'audio',
  ...extra,
})

describe('a quién se firma', () => {
  it('solo a quien el agente marcó «publicar» y cuya fila dice lo mismo que el manifiesto', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'publicar'), encargo(BETO, 'bandeja_humana')] }
    const r = elegirParaFirmar({ manifiesto, filas: [fila(ANA), fila(BETO)] })
    expect(r.usuarios).toEqual([ANA])
    expect(r.noFirmadas).toEqual([{ usuarioId: BETO, motivo: 'el agente lo mandó a la bandeja del coach' }])
  })

  it('sin la respuesta del agente (cayó a la plantilla) no se firma a nadie', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, null)] }
    const r = elegirParaFirmar({ manifiesto, filas: [fila(ANA)] })
    expect(r.usuarios).toEqual([])
    expect(r.noFirmadas[0].motivo).toMatch(/plantilla|sin respuesta del agente/)
  })

  it('si la fila de la base dice OTRA cosa que el manifiesto, no se firma (audio y letra desparejos)', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'publicar', 'Guion nuevo')] }
    const r = elegirParaFirmar({ manifiesto, filas: [fila(ANA, 'Guion viejo')] })
    expect(r.usuarios).toEqual([])
    expect(r.noFirmadas[0].motivo).toMatch(/guion/)
  })

  it('compara el guion sin que cuenten los espacios de los bordes', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'publicar', 'Hola.\n')] }
    expect(elegirParaFirmar({ manifiesto, filas: [fila(ANA, 'Hola.')] }).usuarios).toEqual([ANA])
  })

  it('sin fila publicada, o ya firmada, no se firma', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'publicar'), encargo(BETO, 'publicar')] }
    const r = elegirParaFirmar({ manifiesto, filas: [fila(BETO, undefined, { aprobado_en: '2026-10-23T10:00:00Z' })] })
    expect(r.usuarios).toEqual([])
    expect(r.noFirmadas.map((n) => n.usuarioId).sort()).toEqual([ANA, BETO].sort())
  })

  it('los omitidos no cuentan como pendientes', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'omitir', undefined, { omitido: true }), encargo(BETO, 'publicar')] }
    const r = elegirParaFirmar({ manifiesto, filas: [fila(BETO)] })
    expect(r.usuarios).toEqual([BETO])
    expect(r.noFirmadas).toEqual([])
  })

  it('con un solo uuid repetido en el manifiesto lo manda una vez', () => {
    const manifiesto = { semana: '2026-10-19', encargos: [encargo(ANA, 'publicar'), encargo(ANA, 'publicar')] }
    expect(elegirParaFirmar({ manifiesto, filas: [fila(ANA)] }).usuarios).toEqual([ANA])
  })
})

describe('la llamada a la base', () => {
  it('llama a la RPC con la semana y los usuarios, y dice cuántas firmó', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 2, error: null })
    const r = await firmarRevisionesAutomaticas({ rpc }, { semana: '2026-10-19', usuarios: [ANA, BETO, CARLA] })
    expect(rpc).toHaveBeenCalledWith('firmar_revisiones_automaticas', { p_semana: '2026-10-19', p_usuarios: [ANA, BETO, CARLA] })
    expect(r).toEqual({ firmadas: 2, pedidas: 3 })
  })

  it('con nadie que firmar no llama a la base', async () => {
    const rpc = vi.fn()
    const r = await firmarRevisionesAutomaticas({ rpc }, { semana: '2026-10-19', usuarios: [] })
    expect(rpc).not.toHaveBeenCalled()
    expect(r).toEqual({ firmadas: 0, pedidas: 0 })
  })

  it('un error de la base NO se lee como «cero firmadas»: revienta con el motivo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'function firmar_revisiones_automaticas does not exist' } })
    await expect(firmarRevisionesAutomaticas({ rpc }, { semana: '2026-10-19', usuarios: [ANA] })).rejects.toThrow(/does not exist/)
  })

  it('una respuesta que no es un número tampoco se da por buena', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    await expect(firmarRevisionesAutomaticas({ rpc }, { semana: '2026-10-19', usuarios: [ANA] })).rejects.toThrow(/no contest/)
  })
})

describe('la bandera: apagada por defecto', () => {
  let carpeta
  beforeEach(async () => {
    carpeta = await mkdtemp(join(tmpdir(), 'bandera-firma-'))
  })
  afterEach(async () => {
    await rm(carpeta, { recursive: true, force: true })
  })

  it('sin argumento ni archivo, está APAGADA', () => {
    expect(banderaDeFirmaEncendida({ archivo: join(carpeta, 'no-existe.activa') })).toBe(false)
    expect(banderaDeFirmaEncendida({})).toBe(false)
  })

  it('--firma-automatica la enciende para esa corrida', () => {
    expect(banderaDeFirmaEncendida({ argumento: true, archivo: join(carpeta, 'no-existe.activa') })).toBe(true)
  })

  it('el archivo %USERPROFILE%\\.alpha\\firma-automatica.activa la enciende de forma persistente', async () => {
    const archivo = join(carpeta, 'firma-automatica.activa')
    await writeFile(archivo, 'encendida por Bryan')
    expect(banderaDeFirmaEncendida({ archivo })).toBe(true)
  })

  it('un valor raro en el argumento no la enciende por accidente', () => {
    expect(banderaDeFirmaEncendida({ argumento: 'no', archivo: join(carpeta, 'x') })).toBe(false)
    expect(banderaDeFirmaEncendida({ argumento: false, archivo: join(carpeta, 'x') })).toBe(false)
  })
})
