import { useEffect, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { db, hoyIso } from '../../../../data/dbInstance'
import { ordenesRecientes, type Orden } from '../../../../data/consola/ordenes'
import {
  compararMicrociclos,
  type DiffMicrociclo,
} from '../../../../domain/consolaCoach/diffMicrociclo'
import { lunesDeLaSemana } from '../../../../domain/resumenSemanal/reparto'
import type { Microciclo } from '../../../../domain/types'
import { AccionesRevision } from '../AccionesRevision'
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
  semanaInicio,
  ordenes,
  onOrdenCreada,
}: {
  fila: FilaCartera
  semanaInicio: string
  ordenes: Orden[]
  onOrdenCreada: () => void
}) {
  const historial = db.microciclos.byUsuario(fila.usuario.id)
  const activo = historial.find((m) => m.estado === 'activo')
  const anterior = microcicloAnterior(historial, activo)
  const diff = compararMicrociclos(anterior, activo)
  const etiqueta = ETIQUETA_ESTADO[fila.estado]

  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-base text-texto">{fila.usuario.nombre}</p>
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
        semanaInicio={semanaInicio}
        ordenes={ordenes}
        onOrdenCreada={onOrdenCreada}
      />
    </Card>
  )
}

const TIPOS_ORDENES_DE_REVISION = ['detener', 'reportar_riesgo'] as const

export function RevisionSemanaTab() {
  const hoy = hoyIso()
  const semanaInicio = lunesDeLaSemana(hoy)
  const filas = revisarCartera(db, hoy)
  const ordenadas = [...filas].sort((a, b) => ORDEN_ATENCION[a.estado] - ORDEN_ATENCION[b.estado])

  const visibleHoy = filas.filter((f) => f.estado === 'en-curso' || f.estado === 'automatica').length
  const sinPlanLunes = filas.filter((f) => f.estado === 'sin-microciclo' || f.estado === 'revisar').length

  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const refrescarOrdenes = () => {
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

  return (
    <div className="flex flex-col gap-3">
      <Card destacada>
        <p className="kicker">La pregunta de Astra</p>
        <p className="mt-1 text-sm text-texto">
          ¿Quién tiene entrenamiento visible hoy y quién llegará al lunes sin plan?
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span>
            <span className="cifras text-lg font-bold text-verde">{visibleHoy}</span>{' '}
            <span className="text-tenue">con entrenamiento visible hoy</span>
          </span>
          <span>
            <span className="cifras text-lg font-bold text-rojo">{sinPlanLunes}</span>{' '}
            <span className="text-tenue">podrían llegar al lunes sin plan</span>
          </span>
        </div>
      </Card>

      <div className="flex flex-col gap-2.5">
        {ordenadas.map((fila) => (
          <FilaPersona
            key={fila.usuario.id}
            fila={fila}
            semanaInicio={semanaInicio}
            ordenes={ordenes}
            onOrdenCreada={refrescarOrdenes}
          />
        ))}
      </div>
    </div>
  )
}
