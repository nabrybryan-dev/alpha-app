import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import type { Mensaje, Usuario } from '../../domain/types'

/** "hace 2 h", "ayer", "hace 3 d" — lo que cabe al lado del badge. */
function haceCuanto(fechaIso: string, ahora: number): string {
  const minutos = Math.floor((ahora - new Date(fechaIso).getTime()) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} d`
}

interface Props {
  mensaje?: Mensaje
  coach?: Usuario
  noLeidos: number
}

/** Último mensaje del coach, con su texto a la vista. Toca y abre el chat. */
export function MensajeCoach({ mensaje, coach, noLeidos }: Props) {
  // Se fija al montar: leer el reloj en cada render hace que "hace 2 h" cambie
  // sin que nadie haya hecho nada, y React lo marca como impuro con razón.
  const [ahora] = useState(() => Date.now())

  if (!mensaje) return null

  return (
    <Link
      to="/chat"
      className="press block rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-texto">
          {coach?.avatarIniciales ?? 'AA'}
        </span>
        <Badge tono="neutro">Coach</Badge>
        <span className="text-[11px] text-tenue">{haceCuanto(mensaje.fechaIso, ahora)}</span>
        {noLeidos > 0 && (
          <span className="cifras ml-auto rounded-full bg-rojo px-2 py-0.5 text-[10px] font-bold text-white">
            {noLeidos}
          </span>
        )}
      </div>
      <p className="mt-2.5 text-[13.5px] leading-snug text-texto">{mensaje.texto}</p>
    </Link>
  )
}
