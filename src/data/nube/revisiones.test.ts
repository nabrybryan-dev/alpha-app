import { beforeEach, expect, it, vi } from 'vitest'
import { decidirRevision, reproducirRevision, type RevisionPendiente } from './revisiones'
const dobles = vi.hoisted(() => ({ rpc: vi.fn(), createSignedUrl: vi.fn() }))
vi.mock('../supabase', () => ({ modoNube: true, supabase: () => ({ rpc: dobles.rpc, storage: { from: () => ({ createSignedUrl: dobles.createSignedUrl }) } }) }))
const revision: RevisionPendiente = { usuario_id: 'prueba', semana: '2026-09-14', path: 'objeto', guion: 'Texto', tipo: 'video', version: 7, correccion_solicitada: null }
beforeEach(() => vi.resetAllMocks())
it('envía versión e identidad; propaga el rechazo de la base', async () => {
  dobles.rpc.mockResolvedValue({ error: { message: 'Versión antigua' } })
  await expect(decidirRevision(revision, true)).rejects.toThrow('Versión antigua')
  expect(dobles.rpc).toHaveBeenCalledWith('decidir_revision_semanal', { p_usuario: 'prueba', p_semana: '2026-09-14', p_version: 7, p_aprobar: true, p_correccion: null })
})
it('no devuelve una URL cuando el archivo es inaccesible', async () => {
  dobles.createSignedUrl.mockResolvedValue({ data: null, error: { message: '403' } })
  await expect(reproducirRevision(revision)).rejects.toThrow('No se pudo abrir')
})
