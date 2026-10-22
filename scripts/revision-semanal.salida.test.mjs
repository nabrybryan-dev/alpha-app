// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// EL FALSO VERDE DEL 16-OCT. `revision-semanal --paso publicar` terminaba con código 0 aunque
// publicara 0 de 13, y el .ps1 escribía «LISTO». Aquí se corre el script de verdad, con una
// carpeta de juguete SIN audios y una clave falsa (no hay ninguna llamada a la red si no hay
// nada que subir), y se mira el código de salida.

const SEMANA = '2026-10-19'
let carpeta
beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'tanda-salida-'))
})
afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

const encargo = (n, extra = {}) => ({
  usuarioId: `00000000-0000-4000-8000-00000000000${n}`,
  nombre: `Persona ficticia ${n}`,
  semana: SEMANA,
  guion: `Guion ficticio ${n}.`,
  archivoGuion: `00000000-0000-4000-8000-00000000000${n}.txt`,
  audioEsperado: `00000000-0000-4000-8000-00000000000${n}.mp3`,
  ...extra,
})

async function correrPublicar(encargos, extra = []) {
  await writeFile(join(carpeta, 'manifiesto.json'), JSON.stringify({ semana: SEMANA, encargos }), 'utf8')
  return spawnSync(
    process.execPath,
    [resolve('node_modules/vite-node/vite-node.mjs'), 'scripts/revision-semanal.mjs', '--paso', 'publicar', '--semana', SEMANA, '--carpeta', carpeta, ...extra],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_KEY: 'clave-falsa-de-prueba' },
    },
  )
}

describe('el código de salida de «publicar»', () => {
  it('una tanda donde NADIE tiene audio sale con código 3 y lo dice (ya no «LISTO» con cero)', async () => {
    const r = await correrPublicar([encargo(1), encargo(2)])
    expect(r.error).toBeUndefined()
    expect(r.stdout, `estado ${r.status} `+ r.stderr).toContain('SIN AUDIO')
    expect(r.stdout).toContain('TANDA INCOMPLETA')
    expect(r.status).toBe(3)
  })

  it('quien el agente omitió no cuenta como esperado: una tanda solo de omitidos sale con 0', async () => {
    const r = await correrPublicar([encargo(1, { omitido: true })])
    expect(r.stdout, `estado ${r.status} `+ r.stderr).toContain('omitida')
    expect(r.status).toBe(0)
  })

  it('en ensayo no se exige haber publicado nada', async () => {
    const r = await correrPublicar([encargo(1)], ['--ensayo'])
    expect(r.status).toBe(0)
  })
})
