import { useEffect, useState } from 'react'
import { contactosDe, textoContacto, type ContactoCreador } from '../../../data/consola/creadoresContactos'

/**
 * El contacto más reciente que el creador dejó en la landing («WhatsApp · …» / «Correo · …»).
 * Se pide solo al abrir la tarjeta: es dato personal y no viaja con el tablero.
 *
 * Sin contacto, o si la lectura falla (p. ej. la 0178 aún no está aplicada y la tabla no
 * existe), no pinta nada: no hay contacto que mostrar y el resto del detalle sigue igual.
 */
export function ContactoReciente({ creadorId }: { creadorId: string }) {
  const [contacto, setContacto] = useState<ContactoCreador | null>(null)
  useEffect(() => {
    let vivo = true
    void contactosDe(creadorId).then((r) => {
      if (vivo) setContacto(r.ok ? (r.datos[0] ?? null) : null)
    })
    return () => {
      vivo = false
    }
  }, [creadorId])

  if (contacto === null) return null
  return (
    <p className="mt-2 text-xs text-texto">
      <span className="font-bold uppercase tracking-[0.14em] text-tenue">Contacto · </span>
      <span>{textoContacto(contacto)}</span>
    </p>
  )
}
