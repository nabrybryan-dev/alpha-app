// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it.each([{ args: [] }, { args: ['--forzar'] }])('la firma antigua se rechaza antes de pedir credenciales: $args', ({ args }) => {
  const resultado = spawnSync(process.execPath, [
    resolve('node_modules/vite-node/vite-node.mjs'), 'scripts/firmar-revisiones.mjs', ...args,
  ], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '' },
  })
  expect(resultado.error).toBeUndefined()
  expect(resultado.status).toBe(1)
  expect(resultado.stderr).toContain('/coach/revisiones')
  expect(resultado.stderr).not.toContain('Faltan SUPABASE_URL')
})
