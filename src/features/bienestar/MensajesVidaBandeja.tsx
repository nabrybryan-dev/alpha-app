import { useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { mensajesVidaDe, type MensajeVida } from '../../data/vida/mensajesVida'

/**
 * LA BANDEJA DE MENSAJES DE ESTILO DE VIDA.
 *
 * Lo que la cola del agente (`cola_mensajes_vida.py`, `cerebro-alpha`) encoló para esta
 * persona y ya toca mostrar — la RLS de `mensajes_vida` (migración 0088) ya hizo el
 * filtrado (dueño, ventana cumplida, no detenido); este componente solo pinta lo que
 * llegó. Sin nada que mostrar, no se pinta nada: no hay bandeja vacía con un texto de
 * "no tienes mensajes" ocupando espacio en una pantalla que ya tiene bastante.
 */
export function MensajesVidaBandeja({ usuarioId }: { usuarioId: string }) {
  const [mensajes, setMensajes] = useState<MensajeVida[] | null>(null)

  useEffect(() => {
    let vivo = true
    void mensajesVidaDe(usuarioId).then((m) => {
      if (vivo) setMensajes(m)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  if (!mensajes || mensajes.length === 0) return null

  return (
    <Card>
      <p className="text-sm font-bold text-texto">Mensajes de tu coach</p>
      <ul className="mt-2 flex flex-col gap-2">
        {mensajes.map((m) => (
          <li key={m.id} className="flex flex-col gap-1 border-t border-hairline pt-2 first:border-0 first:pt-0">
            <div className="flex items-center gap-1.5">
              {m.tipo === 'ayuda_animo' && <Badge tono="rojo">Ayuda</Badge>}
              <span className="text-xs text-tenue">{new Date(m.enviarDespuesDe).toLocaleDateString('es-CO')}</span>
            </div>
            <p className="text-sm text-texto">{m.texto}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
