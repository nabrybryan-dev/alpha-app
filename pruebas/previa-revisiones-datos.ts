import type { RevisionPendiente } from '../src/data/nube/revisiones'

const escenario = new URLSearchParams(location.search).get('escenario')
let pendientes: RevisionPendiente[] = [{
  usuario_id: 'persona-ficticia', semana: '2026-09-14', path: 'prueba', tipo: 'audio', version: 1,
  guion: 'Este es un guion ficticio para comprobar la revisión. El archivo contiene únicamente dos segundos de silencio, no la voz de una persona.',
  correccion_solicitada: null,
}]
export const db = { usuarios: { byId: () => ({ nombre: 'Persona de prueba' }) } }
export const useDbVersion = () => 0
export async function revisionesPendientes() {
  if (escenario === 'error') throw new Error('Prueba: no se pudo conectar con la bandeja.')
  return escenario === 'vacia' ? [] : [...pendientes]
}
export async function reproducirRevision() {
  if (escenario === 'archivo') throw new Error('Prueba: el archivo no está disponible.')
  // WAV silencioso de 2 segundos; no usa datos ni archivos de una persona.
  const bytes = new ArrayBuffer(44 + 8000 * 2 * 2)
  const vista = new DataView(bytes)
  const texto = (posicion: number, valor: string) => [...valor].forEach((letra, i) => vista.setUint8(posicion + i, letra.charCodeAt(0)))
  texto(0, 'RIFF'); vista.setUint32(4, bytes.byteLength - 8, true); texto(8, 'WAVEfmt ')
  vista.setUint32(16, 16, true); vista.setUint16(20, 1, true); vista.setUint16(22, 1, true)
  vista.setUint32(24, 8000, true); vista.setUint32(28, 16000, true); vista.setUint16(32, 2, true); vista.setUint16(34, 16, true)
  texto(36, 'data'); vista.setUint32(40, bytes.byteLength - 44, true)
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}
export async function decidirRevision(revision: RevisionPendiente, aprobar: boolean, correccion?: string) {
  if (escenario === 'conflicto') throw new Error('La revisión cambió. Actualiza la bandeja antes de decidir.')
  pendientes = aprobar ? [] : [{ ...revision, correccion_solicitada: correccion ?? '' }]
}
