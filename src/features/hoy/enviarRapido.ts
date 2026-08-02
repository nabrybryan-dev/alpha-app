import { db, idCoach } from '../../data/dbInstance'
import { pathDeAdjunto } from '../../data/nube/adjuntos'
import { guardar } from '../../lib/depositoAdjuntos'
import { comprimirSiEsImagen } from '../../lib/comprimirImagen'
import type { EnvioRapido } from './BarraCoach'

/**
 * Escribe el mensaje en local YA —para que se vea con o sin señal— y deja el
 * archivo esperando en el depósito. Quien lo sube es la capa de sincronización,
 * cuando haya red.
 *
 * El path se anota después de crear el mensaje porque lleva su id, y ese id no
 * existe hasta haberlo creado.
 */
export async function enviarRapido(usuarioId: string, envio: EnvioRapido): Promise<void> {
  const { texto, archivo } = envio

  if (!archivo) {
    db.mensajes.enviar({ deId: usuarioId, paraId: idCoach(), texto })
    return
  }

  db.mensajes.enviar({
    deId: usuarioId,
    paraId: idCoach(),
    texto,
    adjuntoTipo: archivo.type.startsWith('video/') ? 'video' : 'imagen',
    adjuntoEstado: 'subiendo',
  })

  const hilo = db.mensajes.hilo(usuarioId, idCoach())
  const mensajeId = hilo[hilo.length - 1].id
  const reducido = await comprimirSiEsImagen(archivo)
  await guardar(mensajeId, reducido, usuarioId)
  db.mensajes.anotarPath(mensajeId, pathDeAdjunto(usuarioId, mensajeId, reducido.type))
}
