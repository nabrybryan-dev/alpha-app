import { useState, type KeyboardEvent } from 'react'
import { EmptyState } from '../../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../../data/dbInstance'
import { desviacionRirMedia, indiceRecuperacion } from '../../../domain/readiness'
import { CarteraSidebar } from './CarteraSidebar'
import { resumenAsesorado } from '../resumenAsesorado'
import { AgentesTab } from './tabs/AgentesTab'
import { CondicionSaludTab } from './tabs/CondicionSaludTab'
import { EstiloVidaTab } from './tabs/EstiloVidaTab'
import { FichaAsesoradoTab } from './tabs/FichaAsesoradoTab'
import { MicrociclosTab } from './tabs/MicrociclosTab'
import { RevisionSemanaTab } from './tabs/RevisionSemanaTab'
import { RevisionVideoTab } from './tabs/RevisionVideoTab'

/**
 * Consola del coach — primera entrega, SOLO LECTURA.
 *
 * Ninguna pestaña de aquí llama a un método que escriba (`guardarPropuesta`,
 * `activarPropuesta`, `registrarSerie`, `guardar*`, `marcar*`, `enviar`…):
 * abrir esta ruta no puede cambiar la base. Ver
 * `ConsolaCoachPage.test.tsx` para la prueba que lo comprueba con espías.
 *
 * Encaja como hija de `CoachLayout` (FASE0-COORDINACION.md §5): siete
 * pestañas ARIA con foco visible, y una cartera lateral que decide de QUIÉN
 * hablan las seis pestañas que necesitan una persona. La primera
 * ("Revisión de la semana") es de toda la cartera a la vez, y no depende de
 * la selección.
 */

const ORDEN_COLOR = { rojo: 0, ambar: 1, verde: 2 } as const

const PESTANAS = [
  { id: 'revision', etiqueta: 'Revisión de la semana' },
  { id: 'ficha', etiqueta: 'Ficha del asesorado' },
  { id: 'microciclos', etiqueta: 'Microciclos' },
  { id: 'agentes', etiqueta: 'Agentes' },
  { id: 'condicion', etiqueta: 'Condición y salud' },
  { id: 'estilo', etiqueta: 'Estilo de vida' },
  { id: 'video', etiqueta: 'Revisión en vídeo' },
] as const

type PestanaId = (typeof PESTANAS)[number]['id']

export default function ConsolaCoachPage() {
  useDbVersion()
  const hoy = hoyIso()

  const resumenes = db.usuarios
    .entrenan()
    .map((usuario) => {
      const r = resumenAsesorado(db, usuario)
      return {
        ...r,
        recuperacion: indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy),
        desvRir: desviacionRirMedia(r.microciclo ?? undefined),
      }
    })
    .sort((a, b) => ORDEN_COLOR[a.semaforo.color] - ORDEN_COLOR[b.semaforo.color])

  const [seleccionadoId, setSeleccionadoId] = useState<string | undefined>(resumenes[0]?.usuario.id)
  const [pestana, setPestana] = useState<PestanaId>('revision')

  const moverFoco = (e: KeyboardEvent<HTMLDivElement>) => {
    const indiceActual = PESTANAS.findIndex((p) => p.id === pestana)
    let siguiente: number
    if (e.key === 'ArrowRight') siguiente = (indiceActual + 1) % PESTANAS.length
    else if (e.key === 'ArrowLeft') siguiente = (indiceActual - 1 + PESTANAS.length) % PESTANAS.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = PESTANAS.length - 1
    else return
    e.preventDefault()
    const idSiguiente = PESTANAS[siguiente].id
    setPestana(idSiguiente)
    document.getElementById(`consola-tab-${idSiguiente}`)?.focus()
  }

  if (resumenes.length === 0) {
    return <EmptyState titulo="Sin cartera" detalle="Todavía no hay asesorados que entrenen." />
  }

  return (
    <div className="flex flex-col gap-3 entrada entrada-1 lg:grid lg:grid-cols-[240px_1fr] lg:items-start lg:gap-4">
      <p className="solo-lectura-nota sr-only">
        Consola del coach, solo lectura: ningún control de aquí escribe en la base.
      </p>

      <CarteraSidebar
        resumenes={resumenes}
        seleccionadoId={seleccionadoId}
        onSeleccionar={setSeleccionadoId}
      />

      <div className="min-w-0">
        <div
          role="tablist"
          aria-label="Pestañas de la consola del coach"
          onKeyDown={moverFoco}
          className="flex gap-1.5 overflow-x-auto pb-1"
        >
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`consola-tab-${p.id}`}
              aria-selected={pestana === p.id}
              aria-controls={`consola-panel-${p.id}`}
              tabIndex={pestana === p.id ? 0 : -1}
              onClick={() => setPestana(p.id)}
              className={`tecla-3d shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-wide ${
                pestana === p.id ? 'border-rojo bg-rojo/15 text-rojo' : 'border-linea bg-surface-2 text-tenue'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>

        <div
          id={`consola-panel-${pestana}`}
          role="tabpanel"
          aria-labelledby={`consola-tab-${pestana}`}
          tabIndex={0}
          className="entrada entrada-2 mt-3"
        >
          {pestana === 'revision' && <RevisionSemanaTab />}
          {pestana !== 'revision' && !seleccionadoId && (
            <EmptyState titulo="Elige a alguien de la cartera" detalle="Esta pestaña es por persona." />
          )}
          {pestana === 'ficha' && seleccionadoId && <FichaAsesoradoTab usuarioId={seleccionadoId} />}
          {pestana === 'microciclos' && seleccionadoId && <MicrociclosTab usuarioId={seleccionadoId} />}
          {pestana === 'agentes' && seleccionadoId && <AgentesTab />}
          {pestana === 'condicion' && seleccionadoId && <CondicionSaludTab usuarioId={seleccionadoId} />}
          {pestana === 'estilo' && seleccionadoId && <EstiloVidaTab usuarioId={seleccionadoId} />}
          {pestana === 'video' && seleccionadoId && <RevisionVideoTab usuarioId={seleccionadoId} />}
        </div>
      </div>
    </div>
  )
}
