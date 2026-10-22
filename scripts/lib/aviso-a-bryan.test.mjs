// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { avisarABryan, lineaDeAviso, rutaDeNotificaciones } from './aviso-a-bryan.mjs'

// El canal que ya existe es `notificaciones.log` (agentes/cola_mensajes_vida.py::avisar_bryan en
// cerebro-alpha-agentes): una línea JSON por aviso, idempotente por `id`. Aquí se escribe en la
// MISMA forma para que quien ya lo lee no tenga que enterarse de un formato nuevo.

let carpeta
beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'aviso-bryan-'))
})
afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

const ahora = new Date('2026-10-23T14:30:15.123Z')

describe('el aviso a Bryan', () => {
  it('lleva la misma forma que avisar_bryan: ts, id, slug, estado AVISO_BRYAN, tipo, urgente, mensaje', () => {
    const linea = JSON.parse(lineaDeAviso({ id: 'x-1', tipo: 'revision_semanal_sin_publicar', mensaje: 'No publicó', ahora }))
    expect(linea).toEqual({
      ts: '2026-10-23T14:30:15+00:00',
      id: 'x-1',
      slug: 'revision-semanal',
      estado: 'AVISO_BRYAN',
      tipo: 'revision_semanal_sin_publicar',
      urgente: false,
      mensaje: 'No publicó',
    })
  })

  it('la ruta sale de ALPHA_NOTIFICACIONES_LOG, si no de ALPHA_ESTADO_DIR, si no de F:/alpha-corridas/_estado', () => {
    expect(rutaDeNotificaciones({ ALPHA_NOTIFICACIONES_LOG: 'C:/uno/n.log' })).toBe('C:/uno/n.log')
    expect(rutaDeNotificaciones({ ALPHA_ESTADO_DIR: 'C:/dos' }).replace(/\\/g, '/')).toBe('C:/dos/notificaciones.log')
    expect(rutaDeNotificaciones({}).replace(/\\/g, '/')).toBe('F:/alpha-corridas/_estado/notificaciones.log')
  })

  it('anexa una línea y es idempotente por id (repetir no duplica)', async () => {
    const ruta = join(carpeta, 'sub', 'notificaciones.log')
    const env = { ALPHA_NOTIFICACIONES_LOG: ruta }
    expect(await avisarABryan({ id: 'a', tipo: 't', mensaje: 'uno', ahora }, { env })).toBe(true)
    expect(await avisarABryan({ id: 'a', tipo: 't', mensaje: 'uno otra vez', ahora }, { env })).toBe(false)
    expect(await avisarABryan({ id: 'b', tipo: 't', mensaje: 'dos', ahora }, { env })).toBe(true)
    const lineas = (await readFile(ruta, 'utf8')).trim().split('\n').map((l) => JSON.parse(l))
    expect(lineas.map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('respeta lo que ya había en el archivo y tolera líneas que no son JSON', async () => {
    const ruta = join(carpeta, 'notificaciones.log')
    await writeFile(ruta, 'esto no es json\n{"id":"viejo","mensaje":"de antes"}\n')
    const env = { ALPHA_NOTIFICACIONES_LOG: ruta }
    expect(await avisarABryan({ id: 'viejo', tipo: 't', mensaje: 'repetido', ahora }, { env })).toBe(false)
    expect(await avisarABryan({ id: 'nuevo', tipo: 't', mensaje: 'x', ahora }, { env })).toBe(true)
    const texto = await readFile(ruta, 'utf8')
    expect(texto.startsWith('esto no es json\n')).toBe(true)
    expect(texto).toContain('"id":"nuevo"')
  })

  it('si no puede escribir NO revienta la cadena: devuelve false', async () => {
    // Un archivo donde debería ir la carpeta: mkdir falla.
    const bloqueo = join(carpeta, 'bloqueo')
    await writeFile(bloqueo, 'soy un archivo')
    const env = { ALPHA_NOTIFICACIONES_LOG: join(bloqueo, 'n.log') }
    expect(await avisarABryan({ id: 'a', tipo: 't', mensaje: 'x', ahora }, { env, errores: () => {} })).toBe(false)
  })
})
