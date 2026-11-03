import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesionOpcional } from '../../app/SessionProvider'
import { buscarRuta, resolverAcceso } from '../../app/rutas'
import { tarjetasDe, type TarjetaPraxis } from '../../domain/praxis/tarjetas'

/**
 * Las tarjetas 3D de Praxis (paso 8 del rediseño).
 *
 * El motor de Praxis es imperativo y no comparte estado con React; el contrato entre los
 * dos es un evento: `praxis:frasa` cuando sale una frase de la persona (solo después del filtro
 * de riesgo), `praxis:quieta` cuando se entra en la Quieta, `praxis:cuidado` cuando hay que
 * preguntar por el daño, `praxis:sala-cerrada` al cerrar la sala y `praxis:abrir` al empezar
 * una conversación. Así las tarjetas no tocan el motor ni lo remontan.
 *
 * No hay ninguna al abrir. Como mucho tres, y cada una es un atajo a una pantalla que ya
 * existe. En crisis se retiran y no vuelven hasta una conversación nueva.
 */
export function TarjetasPraxis() {
  const navegar = useNavigate()
  const sesion = useSesionOpcional()
  const [tarjetas, setTarjetas] = useState<TarjetaPraxis[]>([])
  const quieta = useRef(false)

  // La tarjeta es un atajo, no una promesa: si la guarda real de esa ruta no deja entrar a
  // quien la está viendo —el coach no tiene /bienestar, /progreso ni /chat—, no se pinta.
  const rol = sesion?.usuario.rol ?? 'asesorado'
  const visibles = tarjetas.filter((tarjeta) => {
    const fila = buscarRuta(tarjeta.destino)
    return !!fila && resolverAcceso(fila, { rol, capacidades: new Set() }).tipo === 'entra'
  })

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
    const alCerrarSala = () => setTarjetas([])
    const alPedirCuidado = () => setTarjetas([])
    window.addEventListener('praxis:frasa', alDecir)
    window.addEventListener('praxis:quieta', alEntrarEnQuieta)
    window.addEventListener('praxis:abrir', alAbrirConversacion)
    window.addEventListener('praxis:sala-cerrada', alCerrarSala)
    window.addEventListener('praxis:cuidado', alPedirCuidado)
    return () => {
      window.removeEventListener('praxis:frasa', alDecir)
      window.removeEventListener('praxis:quieta', alEntrarEnQuieta)
      window.removeEventListener('praxis:abrir', alAbrirConversacion)
      window.removeEventListener('praxis:sala-cerrada', alCerrarSala)
      window.removeEventListener('praxis:cuidado', alPedirCuidado)
    }
  }, [])

  if (visibles.length === 0) return null

  return (
    <div className="px-tarjetas" role="group" aria-label="Atajos de Praxis">
      {visibles.map((tarjeta, i) => (
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
