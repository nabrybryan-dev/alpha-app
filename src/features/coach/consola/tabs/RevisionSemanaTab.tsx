import { useEffect, useState, type CSSProperties } from 'react'
import { CifraAnimada } from '../../../../components/ui/CifraAnimada'
import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { corridasDeTodaLaCartera, type CadenaCorrida } from '../../../../data/consola/cadenaCorridas'
import { db, hoyIso } from '../../../../data/dbInstance'
import { ordenesRecientes, type Orden } from '../../../../data/consola/ordenes'
import {
  compararMicrociclos,
  type DiffMicrociclo,
} from '../../../../domain/consolaCoach/diffMicrociclo'
import { semanaObjetivoDeAcciones } from '../../../../domain/consolaCoach/semanaObjetivo'
import type { Microciclo } from '../../../../domain/types'
import { AccionesRevision } from '../AccionesRevision'
import { BandejaPrimerosPlanes } from '../BandejaPrimerosPlanes'
import { useDatoConsola } from '../datoConsola'
import { conclusion, revisarCartera, type EstadoActivacion, type FilaCartera } from '../../revisionCartera'

/**
 * Módulo 1 de la consola: la cartera entera, antes → después, ordenada por
 * atención. SOLO LECTURA: usa `revisarCartera`, que mira y no escribe —nunca
 * `activarAutomaticas` ni `barrerYActivar`, que sí escriben—.
 */

const ORDEN_ATENCION: Record<EstadoActivacion, number> = {
  revisar: 0,
  'sin-microciclo': 1,
  automatica: 2,
  'en-curso': 3,
}

const ETIQUETA_ESTADO: Record<EstadoActivacion, { texto: string; tono: 'rojo' | 'ambar' | 'verde' | 'azul' }> = {
  revisar: { texto: 'Para revisar', tono: 'ambar' },
  'sin-microciclo': { texto: 'Sin microciclo', tono: 'rojo' },
  automatica: { texto: 'Se activa sola', tono: 'azul' },
  'en-curso': { texto: 'En curso', tono: 'verde' },
}

function microcicloAnterior(historial: Microciclo[], activo: Microciclo | undefined): Microciclo | undefined {
  if (!activo) return undefined
  return historial.find((m) => m.numero === activo.numero - 1)
}

function DiaCelda({ dia }: { dia: DiffMicrociclo['dias'][number] }) {
  const estilos: Record<typeof dia.estado, string> = {
    igual: 'border-linea bg-surface-2 text-tenue',
    nueva: 'border-verde/50 bg-verde/10 text-verde',
    perdida: 'border-rojo/50 bg-rojo/10 text-rojo',
    vacio: 'border-dashed border-linea text-tenue/60',
  }
  return (
    <div className={`rounded-lg border px-1.5 py-1.5 text-center text-[10px] ${estilos[dia.estado]}`}>
      <p className="font-bold uppercase tracking-wide">{dia.dia.slice(0, 3)}</p>
      <p className="mt-0.5 truncate">{dia.despues?.nombre ?? dia.antes?.nombre ?? '—'}</p>
    </div>
  )
}

function FilaPersona({
  fila,
  semanaObjetivo,
  ordenes,
  onOrdenCreada,
  seleccionada,
  onVerPersona,
  i,
}: {
  seleccionada: boolean
  onVerPersona?: (usuarioId: string) => void
  i: number
  fila: FilaCartera
  /** La semana que se va a cargar para ESTA persona (`semanaObjetivoDeAcciones`), no el
   *  lunes de la semana en curso — ver `AccionesRevision`. */
  semanaObjetivo: string
  ordenes: Orden[]
  onOrdenCreada: (orden?: Orden) => void
}) {
  const historial = db.microciclos.byUsuario(fila.usuario.id)
  const activo = historial.find((m) => m.estado === 'activo')
  const anterior = microcicloAnterior(historial, activo)
  const diff = compararMicrociclos(anterior, activo)
  const etiqueta = ETIQUETA_ESTADO[fila.estado]

  return (
    <Card
      className={`consola-tarjeta flex flex-col gap-2.5 ${seleccionada ? 'glass-destacada' : ''}`}
      style={{ '--i': i } as CSSProperties}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onVerPersona ? (
          <button
            type="button"
            className="group flex items-baseline gap-2 text-left"
            onClick={() => onVerPersona(fila.usuario.id)}
            aria-label={`Ver la ficha de ${fila.usuario.nombre}`}
          >
            <span className="font-display text-base text-texto underline-offset-4 group-hover:underline">{fila.usuario.nombre}</span>
            <span className="text-[11px] font-bold text-rojo opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-visible:opacity-100">
              Ver ficha →
            </span>
          </button>
        ) : (
          <p className="font-display text-base text-texto">{fila.usuario.nombre}</p>
        )}
        <Badge tono={etiqueta.tono}>{etiqueta.texto}</Badge>
      </div>
      <p className="text-sm text-texto/90">{conclusion(fila)}</p>

      <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
        {diff.dias.map((dia) => (
          <DiaCelda key={dia.dia} dia={dia} />
        ))}
      </div>

      {(diff.ejerciciosAnadidos.length > 0 || diff.ejerciciosRetirados.length > 0 || diff.cargas.length > 0) && (
        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          {diff.ejerciciosAnadidos.length > 0 && (
            <p>
              <span className="font-bold text-verde">Añadidos: </span>
              {diff.ejerciciosAnadidos.join(', ')}
            </p>
          )}
          {diff.ejerciciosRetirados.length > 0 && (
            <p>
              <span className="font-bold text-rojo">Retirados: </span>
              {diff.ejerciciosRetirados.join(', ')}
            </p>
          )}
          {diff.cargas.length > 0 && (
            <p>
              {diff.cargas.map((c) => (
                <span key={c.nombre} className="mr-2 inline-block">
                  {c.nombre}{' '}
                  <span className={c.direccion === 'sube' ? 'font-bold text-verde' : 'font-bold text-rojo'}>
                    {c.direccion === 'sube' ? '▲' : '▼'} {c.cargaAntesKg}→{c.cargaDespuesKg}kg
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-tenue">
        Generado / firmado / publicado / visible: sin dato todavía (llega con la sincronización de la
        cadena).
      </p>

      <AccionesRevision
        usuarioId={fila.usuario.id}
        semanaObjetivo={semanaObjetivo}
        ordenes={ordenes}
        onOrdenCreada={onOrdenCreada}
      />
    </Card>
  )
}

// `reanudar` entra aquí también (0084): sin sus órdenes, `AccionesRevision` no podría
// calcular la detención VIGENTE (la más reciente entre `detener` y `reanudar`) y una
// persona ya reanudada se seguiría viendo detenida.
const TIPOS_ORDENES_DE_REVISION = ['detener', 'reportar_riesgo', 'reanudar'] as const

interface RevisionSemanaTabProps {
  seleccionadoId?: string
  /** Enlaza cada tarjeta con la persona: elegirla en la cartera y abrir su ficha. */
  onVerPersona?: (usuarioId: string) => void
}

export function RevisionSemanaTab({ seleccionadoId, onVerPersona }: RevisionSemanaTabProps = {}) {
  const hoy = hoyIso()
  const filas = revisarCartera(db, hoy)
  const ordenadas = [...filas].sort((a, b) => ORDEN_ATENCION[a.estado] - ORDEN_ATENCION[b.estado])

  const visibleHoy = filas.filter((f) => f.estado === 'en-curso' || f.estado === 'automatica').length
  const sinPlanLunes = filas.filter((f) => f.estado === 'sin-microciclo' || f.estado === 'revisar').length

  const [ordenes, setOrdenes] = useState<Orden[]>([])
  // Optimista: la orden recién creada entra YA en la lista (la tarjeta cambia en el sitio
  // donde se pulsó) y la relectura de la base la confirma o la corrige.
  const refrescarOrdenes = (nueva?: Orden) => {
    if (nueva) setOrdenes((previas) => [nueva, ...previas.filter((o) => o.id !== nueva.id)])
    ordenesRecientes(TIPOS_ORDENES_DE_REVISION).then(setOrdenes)
  }
  useEffect(() => {
    let vivo = true
    ordenesRecientes(TIPOS_ORDENES_DE_REVISION).then((lista) => {
      if (vivo) setOrdenes(lista)
    })
    return () => {
      vivo = false
    }
  }, [])

  // La semana que "Detener"/"Reportar" tienen que apuntar es la que SE VA A CARGAR para
  // cada persona, no el lunes en curso (ver `semanaObjetivoDeAcciones`) — hace falta
  // `cadena_corridas` de toda la cartera para saberlo.
  const estadoCorridas = useDatoConsola('corridas', corridasDeTodaLaCartera)
  const corridas: CadenaCorrida[] = estadoCorridas.estado === 'listo' ? estadoCorridas.valor : []

  return (
    <div className="flex flex-col gap-3">
      {/* Solo con `aprobar_primer_plan`: sin ella, la bandeja no pinta nada. */}
      <BandejaPrimerosPlanes onVerPersona={onVerPersona} />

      <Card destacada>
        <p className="kicker">La pregunta de Astra</p>
        <p className="mt-1 text-sm text-texto">
          ¿Quién tiene entrenamiento visible hoy y quién llegará al lunes sin plan?
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span>
            <span className="cifras text-2xl font-bold text-verde"><CifraAnimada valor={visibleHoy} /></span>{' '}
            <span className="text-tenue">con entrenamiento visible hoy</span>
          </span>
          <span>
            <span className="cifras text-2xl font-bold text-rojo"><CifraAnimada valor={sinPlanLunes} /></span>{' '}
            <span className="text-tenue">podrían llegar al lunes sin plan</span>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
        {ordenadas.map((fila, n) => (
          <FilaPersona
            key={fila.usuario.id}
            i={n}
            seleccionada={fila.usuario.id === seleccionadoId}
            onVerPersona={onVerPersona}
            fila={fila}
            semanaObjetivo={semanaObjetivoDeAcciones(fila.usuario.id, corridas, hoy)}
            ordenes={ordenes}
            onOrdenCreada={refrescarOrdenes}
          />
        ))}
      </div>
    </div>
  )
}
