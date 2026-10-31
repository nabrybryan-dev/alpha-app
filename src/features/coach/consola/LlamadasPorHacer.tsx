import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { llamadasPorHacer, type LlamadaPorHacer, type ResultadoLlamadas } from '../../../data/consola/guionesLlamada'
import { fechaDeLlamada, horaDeLlamada } from '../../../data/consola/notasLlamada'
import { marcasDeSalud } from '../../../domain/consolaCoach/guionDeVenta'
import { VistaGuionDeVenta } from '../GuionDeVenta'
import { Esqueleto, FalloBandeja, Tarjeta } from './piezas'

/**
 * «Llamadas por hacer» (0151, decisión de Bryan del 30-oct-2026): los guiones de la landing de
 * quien reservó la llamada de venta y todavía no tiene cuenta en la app, o la tiene pero su llamada
 * es hoy o después. Sin cuenta no hay Ficha, así que el guion se abre aquí, con la MISMA tarjeta
 * (`VistaGuionDeVenta`). Cuando llega la cuenta, el guion sale también en su Ficha.
 *
 * Solo lectura; la puerta es la de la tabla (coach o `leer_entrenamiento`): quien no la pasa recibe
 * cero filas y aquí no se pinta nada. Sin llamadas tampoco: es una lista de trabajo, no un aviso.
 * Un fallo de carga sí se dice, con reintento.
 */
interface Props {
  /** De dónde salen las llamadas; por defecto, la base. Inyectable para pruebas y capturas. */
  cargar?: () => Promise<ResultadoLlamadas>
}

export function LlamadasPorHacer({ cargar = llamadasPorHacer }: Props) {
  /** `undefined` = cargando. */
  const [llamadas, setLlamadas] = useState<LlamadaPorHacer[] | undefined>(undefined)
  const [fallo, setFallo] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    cargar().then((r) => {
      if (!vivo) return
      setFallo(r.ok ? null : r.error)
      setLlamadas(r.ok ? r.llamadas : [])
    })
    return () => {
      vivo = false
    }
  }, [cargar, intento])

  if (fallo === null && llamadas?.length === 0) return null

  return (
    <Tarjeta titulo="Llamadas por hacer" extra={<span className="cifras text-lg font-bold text-texto">{llamadas && !fallo ? llamadas.length : '…'}</span>}>
      <p className="mb-2.5 text-[12.5px] text-tenue">
        Quien reservó la llamada en la landing. El guion está listo antes de que tenga cuenta; la hora es la de Colombia.
      </p>
      {fallo !== null ? (
        <FalloBandeja
          error={fallo}
          onReintentar={() => {
            setFallo(null)
            setLlamadas(undefined)
            setIntento((n) => n + 1)
          }}
        />
      ) : llamadas === undefined ? (
        <Esqueleto lineas={2} />
      ) : (
        <ul className="flex flex-col gap-2">
          {llamadas.map((l) => (
            <FilaLlamada
              key={l.personId}
              llamada={l}
              abierta={abierta === l.personId}
              onAlternar={() => setAbierta((a) => (a === l.personId ? null : l.personId))}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  )
}

function cuandoEnClaro(l: LlamadaPorHacer): string {
  const g = l.guardado
  const partes = [l.dia ? fechaDeLlamada(l.dia) : null, g.horaPreferida ? horaDeLlamada(g.horaPreferida) : null].filter(Boolean)
  return partes.length ? partes.join(' · ') : g.guion.reserva.enClaro || 'sin día'
}

interface FilaProps {
  llamada: LlamadaPorHacer
  abierta: boolean
  onAlternar: () => void
}

function FilaLlamada({ llamada, abierta, onAlternar }: FilaProps) {
  const g = llamada.guardado.guion
  const nombre = g.persona.nombre ?? 'Persona sin nombre'
  const salud = marcasDeSalud(g.alerta)
  const idGuion = `llamada-${llamada.personId}`
  return (
    <li className="min-w-0 rounded-lg border border-linea bg-surface-2">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idGuion}
        className="press flex min-h-[44px] w-full flex-wrap items-center gap-2 px-3 py-2 text-left"
        onClick={onAlternar}
      >
        <span className="text-sm font-bold text-texto">{nombre}</span>
        {llamada.usuarioId === null ? <Badge tono="ambar">Sin cuenta</Badge> : <Badge tono="verde">Ya tiene cuenta</Badge>}
        {salud.length > 0 && <Badge tono="rojo">{salud.join(' · ')}</Badge>}
        <span className="cifras ml-auto text-[12px] font-bold text-tenue">{cuandoEnClaro(llamada)}</span>
      </button>
      {abierta && (
        <div id={idGuion} className="border-t border-linea p-2">
          <VistaGuionDeVenta guardado={llamada.guardado} />
        </div>
      )}
    </li>
  )
}
