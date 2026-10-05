import { expect, it, vi } from 'vitest'
import { publicarUnaRevision } from './publicar-una-revision.mjs'
vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal()
  const dobles = { stat: async () => ({ size: 100 }), readFile: async () => new Uint8Array([1, 2, 3]) }
  return { ...original, ...dobles, default: { ...original, ...dobles } }
})

it('cada subida usa un objeto distinto y retira cualquier firma previa', async () => {
  const upload = vi.fn().mockResolvedValue({ error: null })
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const consulta = { select: () => consulta, eq: () => consulta, maybeSingle: async () => ({ data: null, error: null }), upsert }
  const supabase = { from: () => consulta, storage: { from: () => ({ upload }) } }
  const encargo = { supabase, usuarioId: '00000000-0000-4000-8000-000000000002', semana: '2026-09-14', archivo: 'prueba.mp4', guion: 'Guion ficticio' }
  const uno = await publicarUnaRevision(encargo)
  const dos = await publicarUnaRevision(encargo)
  expect(uno.path).not.toBe(dos.path)
  expect(upload.mock.calls[0][2].upsert).toBe(false)
  expect(upsert.mock.calls[0][0]).toMatchObject({ path: uno.path, aprobado_en: null })
})

it('una subida fallida no modifica la fila', async () => {
  const upsert = vi.fn()
  const consulta = { select: () => consulta, eq: () => consulta, maybeSingle: async () => ({ data: null, error: null }), upsert }
  const supabase = { from: () => consulta, storage: { from: () => ({ upload: async () => ({ error: { message: 'sin espacio' } }) }) } }
  await expect(publicarUnaRevision({ supabase, usuarioId: '00000000-0000-4000-8000-000000000002', semana: '2026-09-14', archivo: 'prueba.mp4', guion: 'Ficticio' })).rejects.toThrow('sin espacio')
  expect(upsert).not.toHaveBeenCalled()
})
