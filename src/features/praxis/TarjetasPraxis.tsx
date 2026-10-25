import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tarjetasDe, type TarjetaPraxis } from '../../domain/praxis/tarjetas'

/**
 * Las tarjetas 3D de Praxis (paso 8 del rediseño).
 *
 * El motor de Praxis es imperativo y no comparte estado con React; el contrato entre los
 * dos es un evento: `praxis:frasa` cuando sale una frase de la persona y `praxis:quieta`
 * cuando se entra en la Quieta. Así las tarjetas no tocan el motor ni lo remontan.
 *
 * No hay ninguna al abrir. Como mucho tres, y cada una es un atajo a una pantalla que ya
 * existe. En crisis se retiran y no vuelven hasta una conversación nueva.
 */
export function TarjetasPraxis() {
  const navegar = useNavigate()
  const [tarjetas, setTarjetas] = useState<TarjetaPraxis[]>([])
  const quieta = useRef(false)

  useEffect(() => {
    const alDecir = (evento: Event) => {
      if (quieta.current) return
      const texto = (evento as CustomEvent<{ texto?: string }>).detail?.texto ?? ''
      setTarjetas(tarjetasDe(texto))
    }
    const alEntrarEnQuieta = () => {
      quieta.current = true
      setTarjetas([])
    }
    const alAbrirConversacion = () => {
      quieta.current = false
      setTarjetas([])
    }
    window.addEventListener('praxis:frasa', alDecir)
    window.addEventListener('praxis:quieta', alEntrarEnQuieta)
    window.addEventListener('praxis:abrir', alAbrirConversacion)
    return () => {
      window.removeEventListener('praxis:frasa', alDecir)
      window.removeEventListener('praxis:quieta', alEntrarEnQuieta)
      window.removeEventListener('praxis:abrir', alAbrirConversacion)
    }
  }, [])

  if (tarjetas.length === 0) return null

  return (
    <div className="px-tarjetas" role="group" aria-label="Atajos de Praxis">
      {tarjetas.map((tarjeta, i) => (
        <button
          key={tarjeta.id}
          type="button"
          className="px-t"
          style={{ animationDelay: `${i * 60}ms` }}
          onClick={() => navegar(tarjeta.destino)}
        >
          <span className="px-t-cara">
            <b>{tarjeta.titulo}</b>
            <small>{tarjeta.subtitulo}</small>
          </span>
        </button>
      ))}
    </div>
  )
}
