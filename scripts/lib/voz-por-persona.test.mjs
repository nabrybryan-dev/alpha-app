// @vitest-environment node
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  codigoDeSalidaDeLasVoces,
  generarVocesDeLaTanda,
  REINTENTOS_DE_LA_VOZ,
  SILENCIO_PREVIO_MS,
} from './voz-por-persona.mjs'

// La voz es de alpha-estudio (`estudio.voz`): un proceso por persona que deja `voz.mp3` +
// `TERMINADO.json` (o `FALLO.json`) en la carpeta de trabajo. Aquí se SIMULA ese proceso; lo que
// se prueba es lo que decide ESTE lado: un proceso por persona, un reintento, el silencio previo,
// el testigo del guion y que una caída no tumbe a las demás.

const ANA = '00000000-0000-4000-8000-0000000000a1'
const BETO = '00000000-0000-4000-8000-0000000000b2'
const CARLA = '00000000-0000-4000-8000-0000000000c3'
const MOLDE = 'C:\\molde\\ficticio.wav'
const HUELLA_DEL_MOLDE = 'a'.repeat(64)
const OTRA_HUELLA = 'b'.repeat(64)
const ESTUDIO = 'C:\\estudio\\ficticio'

let carpeta
beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'voz-persona-'))
})
afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

const encargo = (id, guion = `Guion ficticio de ${id}.`, extra = {}) => ({
  usuarioId: id,
  nombre: `Persona ${id.slice(-2)}`,
  guion,
  audioEsperado: `${id}.mp3`,
  ...extra,
})

/** Un «estudio.voz» de mentira que escribe lo que escribiría el de verdad. */
function ioFalso({ fallos = {}, sinSalida = new Set() } = {}) {
  const llamadas = []
  const intentosPorPersona = {}
  return {
    llamadas,
    silencios: [],
    async correrVoz(rutaEncargo, cwd) {
      const pedido = JSON.parse(await readFile(rutaEncargo, 'utf8'))
      llamadas.push({ rutaEncargo, cwd, pedido })
      const id = pedido.texto.match(/de (\S+)\.$/)?.[1] ?? pedido.texto
      intentosPorPersona[id] = (intentosPorPersona[id] ?? 0) + 1
      const falla = fallos[id]?.[intentosPorPersona[id] - 1]
      await mkdir(pedido.destino, { recursive: true })
      if (falla) {
        if (falla.motivo) await writeFile(join(pedido.destino, 'FALLO.json'), JSON.stringify({ motivo: falla.motivo }))
        return { codigo: falla.codigo }
      }
      if (sinSalida.has(id)) return { codigo: 0 }
      await writeFile(join(pedido.destino, 'voz.mp3'), `audio de ${id}`)
      await writeFile(join(pedido.destino, 'TERMINADO.json'), '{}')
      return { codigo: 0 }
    },
    async anteponerSilencio(entrada, salida, ms) {
      this.silencios.push({ entrada, salida, ms })
      await writeFile(salida, `${await readFile(entrada, 'utf8')} + ${ms} ms de silencio`)
    },
    esperar: vi.fn(async () => {}),
  }
}

const correr = (encargos, io, extra = {}) =>
  generarVocesDeLaTanda({
    carpeta,
    manifiesto: { semana: '2026-10-19', encargos },
    molde: MOLDE,
    moldeSha256: HUELLA_DEL_MOLDE,
    estudio: ESTUDIO,
    io,
    log: () => {},
    ...extra,
  })

describe('la voz de la tanda, una persona por proceso', () => {
  it('deja <id>.mp3 y el testigo de cada persona, con UN proceso de voz por persona', async () => {
    const io = ioFalso()
    const r = await correr([encargo(ANA), encargo(BETO)], io)
    expect(io.llamadas).toHaveLength(2)
    expect(r.generadas.map((g) => g.usuarioId)).toEqual([ANA, BETO])
    expect(await readFile(join(carpeta, `${ANA}.mp3`), 'utf8')).toContain(`audio de ${ANA}`)
    expect(await readFile(join(carpeta, `${ANA}.guion.txt`), 'utf8')).toBe(`Guion ficticio de ${ANA}.`)
    // El proceso se lanza desde la carpeta de alpha-estudio, con el molde y el texto del manifiesto.
    expect(io.llamadas[0].cwd).toBe(ESTUDIO)
    expect(io.llamadas[0].pedido).toMatchObject({ texto: `Guion ficticio de ${ANA}.`, molde: MOLDE })
    expect(codigoDeSalidaDeLasVoces(r)).toBe(0)
  })

  it('antepone entre 100 y 150 ms de silencio antes de la primera palabra', async () => {
    expect(SILENCIO_PREVIO_MS).toBeGreaterThanOrEqual(100)
    expect(SILENCIO_PREVIO_MS).toBeLessThanOrEqual(150)
    const io = ioFalso()
    await correr([encargo(ANA)], io)
    expect(io.silencios).toHaveLength(1)
    expect(io.silencios[0].ms).toBe(SILENCIO_PREVIO_MS)
    expect(io.silencios[0].salida).toBe(join(carpeta, `${ANA}.mp3`))
  })

  it('un proceso que muere se reintenta UNA vez y la persona sale', async () => {
    expect(REINTENTOS_DE_LA_VOZ).toBe(1)
    // 0xC0000005 en decimal con signo, el código de la caída del 15-oct.
    const io = ioFalso({ fallos: { [ANA]: [{ codigo: -1073741819 }] } })
    const r = await correr([encargo(ANA)], io)
    expect(io.llamadas).toHaveLength(2)
    expect(io.esperar).toHaveBeenCalledTimes(1)
    expect(r.generadas).toHaveLength(1)
    expect(r.fallidas).toHaveLength(0)
    // El reintento empieza de cero: no hereda los trozos de la caída.
    expect(existsSync(join(carpeta, `${ANA}.mp3`))).toBe(true)
  })

  it('dos caídas seguidas dejan a esa persona sin audio y las demás salen', async () => {
    const io = ioFalso({
      fallos: { [BETO]: [{ codigo: 1, motivo: 'el modelo cortó trozo 2' }, { codigo: -1073741819 }] },
    })
    const r = await correr([encargo(ANA), encargo(BETO), encargo(CARLA)], io)
    expect(r.generadas.map((g) => g.usuarioId)).toEqual([ANA, CARLA])
    expect(r.fallidas).toHaveLength(1)
    expect(r.fallidas[0]).toMatchObject({ usuarioId: BETO, intentos: 2 })
    // Dice el código REAL del último intento, no «alguna voz salió corta».
    expect(r.fallidas[0].motivo).toContain('-1073741819')
    expect(existsSync(join(carpeta, `${BETO}.mp3`))).toBe(false)
    expect(codigoDeSalidaDeLasVoces(r)).toBe(1)
  })

  it('el motivo que dejó la voz en FALLO.json se conserva', async () => {
    const io = ioFalso({ fallos: { [ANA]: [{ codigo: 1, motivo: 'el modelo cortó trozo 2' }, { codigo: 1, motivo: 'el modelo cortó trozo 3' }] } })
    const r = await correr([encargo(ANA)], io)
    expect(r.fallidas[0].motivo).toContain('el modelo cortó trozo 3')
  })

  it('código 0 sin audio no es un éxito: se cuenta como fallo', async () => {
    const io = ioFalso({ sinSalida: new Set([ANA]) })
    const r = await correr([encargo(ANA)], io)
    expect(r.fallidas).toHaveLength(1)
    expect(r.fallidas[0].motivo).toMatch(/no dej[oó] el audio/)
    expect(existsSync(join(carpeta, `${ANA}.mp3`))).toBe(false)
  })

  it('un audio ya hecho con el MISMO guion no se rehace', async () => {
    const io = ioFalso()
    await correr([encargo(ANA)], io)
    const otra = ioFalso()
    const r = await correr([encargo(ANA)], otra)
    expect(otra.llamadas).toHaveLength(0)
    expect(r.yaEstaban.map((g) => g.usuarioId)).toEqual([ANA])
    expect(codigoDeSalidaDeLasVoces(r)).toBe(0)
  })

  it('un audio hecho con OTRO guion se rehace (si no, se publicaría el audio viejo con la letra nueva)', async () => {
    await correr([encargo(ANA, `Guion ficticio viejo de ${ANA}.`)], ioFalso())
    const otra = ioFalso()
    const r = await correr([encargo(ANA, `Guion ficticio nuevo de ${ANA}.`)], otra)
    expect(otra.llamadas).toHaveLength(1)
    expect(r.generadas).toHaveLength(1)
    expect(await readFile(join(carpeta, `${ANA}.guion.txt`), 'utf8')).toBe(`Guion ficticio nuevo de ${ANA}.`)
  })

  it('H8 · cada corrida deja en el log la huella sha256 del molde que usa', async () => {
    const lineas = []
    await correr([encargo(ANA)], ioFalso(), { log: (t) => lineas.push(t) })
    const linea = lineas.find((l) => /molde/i.test(l))
    expect(linea).toContain(MOLDE)
    expect(linea).toContain(HUELLA_DEL_MOLDE)
  })

  it('H8 · un audio hecho con OTRO molde se rehace aunque el guion sea el mismo (si no, se mezclan dos voces)', async () => {
    await correr([encargo(ANA)], ioFalso())
    const otra = ioFalso()
    const r = await correr([encargo(ANA)], otra, { moldeSha256: OTRA_HUELLA })
    expect(otra.llamadas).toHaveLength(1)
    expect(r.generadas).toHaveLength(1)
    expect(await readFile(join(carpeta, `${ANA}.molde.sha256`), 'utf8')).toBe(OTRA_HUELLA)
  })

  it('H8 · un audio sin constancia del molde no se da por bueno (se hizo antes de llevar la huella)', async () => {
    await correr([encargo(ANA)], ioFalso())
    await rm(join(carpeta, `${ANA}.molde.sha256`))
    const otra = ioFalso()
    await correr([encargo(ANA)], otra)
    expect(otra.llamadas).toHaveLength(1)
  })

  it('H8 · con el MISMO guion y el MISMO molde sigue sin rehacerse', async () => {
    await correr([encargo(ANA)], ioFalso())
    const otra = ioFalso()
    const r = await correr([encargo(ANA)], otra)
    expect(otra.llamadas).toHaveLength(0)
    expect(r.yaEstaban).toHaveLength(1)
  })

  it('un audio sin testigo no se da por bueno: no consta con qué guion se hizo', async () => {
    await writeFile(join(carpeta, `${ANA}.mp3`), 'audio huérfano')
    const io = ioFalso()
    const r = await correr([encargo(ANA)], io)
    expect(io.llamadas).toHaveLength(1)
    expect(r.generadas).toHaveLength(1)
  })

  it('quien el agente omitió no gasta una hora de máquina', async () => {
    const io = ioFalso()
    const r = await correr([encargo(ANA, undefined, { omitido: true }), encargo(BETO)], io)
    expect(io.llamadas).toHaveLength(1)
    expect(r.omitidas.map((g) => g.usuarioId)).toEqual([ANA])
  })

  it('con --persona solo se hace esa persona', async () => {
    const io = ioFalso()
    const r = await correr([encargo(ANA), encargo(BETO)], io, { soloUno: BETO })
    expect(io.llamadas).toHaveLength(1)
    expect(r.generadas.map((g) => g.usuarioId)).toEqual([BETO])
  })

  it('el molde sale de config.MOLDE_OFICIAL de alpha-estudio en cada corrida, no de una ruta fija', async () => {
    // Bryan cambia de molde en alpha-estudio (el 22-oct eligió a ciegas el de 21-OCT): la cadena tiene que
    // seguirlo sin tocar este repo. Una ruta .wav escrita aquí la dejaría con el molde viejo en silencio.
    const fuente = await readFile('scripts/generar-voces.mjs', 'utf8')
    expect(fuente).toContain('from estudio.config import MOLDE_OFICIAL')
    expect(fuente).not.toMatch(/molde-de-voz|medios-alpha|\.wav['"`]/i)
  })

  it('un guion vacío no se manda a la voz: fallo con motivo, sin gastar el proceso', async () => {
    const io = ioFalso()
    const r = await correr([encargo(ANA, '   ')], io)
    expect(io.llamadas).toHaveLength(0)
    expect(r.fallidas[0].motivo).toMatch(/guion vac[ií]o/)
  })
})
