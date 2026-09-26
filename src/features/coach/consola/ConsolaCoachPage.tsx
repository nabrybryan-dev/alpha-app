import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { EmptyState } from '../../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../../data/dbInstance'
import { desviacionRirMedia, indiceRecuperacion } from '../../../domain/readiness'
import { CabeceraPersona } from './CabeceraPersona'
import { CarteraSidebar } from './CarteraSidebar'
import { ProveedorDatosConsola } from './ProveedorDatosConsola'
import { resumenAsesorado, type ResumenAsesorado } from '../resumenAsesorado'
import { AgentesTab } from './tabs/AgentesTab'
import { CondicionSaludTab } from './tabs/CondicionSaludTab'
import { EstiloVidaTab } from './tabs/EstiloVidaTab'
import { FichaAsesoradoTab } from './tabs/FichaAsesoradoTab'
import { MicrociclosTab } from './tabs/MicrociclosTab'
import { RevisionSemanaTab } from './tabs/RevisionSemanaTab'
import { RevisionVideoTab } from './tabs/RevisionVideoTab'
import { usePersona } from './usePersona'

/**
 * Consola del coach.
 *
 * Abrir la consola y navegarla NO escribe: ninguna pestaña llama al montar a un método
 * que escriba (`guardarPropuesta`, `activarPropuesta`, `registrarSerie`, `guardar*`,
 * `marcar*`, `enviar`…). Las únicas escrituras son los botones explícitos de
 * `AccionesRevision` y «Responder como coach», que piden motivo o confirmación. Ver
 * `ConsolaCoachPage.test.tsx` para la prueba que lo comprueba con espías.
 *
 * CONECTADA: la persona elegida en la cartera manda en todas las pestañas y sobrevive a
 * recargar (sessionStorage de esta pestaña del navegador); la Revisión y los Agentes
 * enlazan a la ficha de cada persona; la cabecera con sus cifras se queda fija mientras se
 * cambia de pestaña; y las lecturas asíncronas se comparten (`ProveedorDatosConsola`).
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

/** Las pestañas que hablan de UNA persona llevan su cabecera encima. */
const PESTANAS_DE_PERSONA = new Set<PestanaId>(['ficha', 'microciclos', 'condicion', 'estilo', 'video'])

const CLAVE_MEMORIA = 'consola-coach:seleccion'

interface Memoria {
  persona?: string
  pestana?: PestanaId
}

/** sessionStorage puede no existir o lanzar (modo privado, datos bloqueados): nunca rompe. */
function leerMemoria(): Memoria {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_MEMORIA)
    if (!crudo) return {}
    const m = JSON.parse(crudo) as Memoria
    return {
      persona: typeof m.persona === 'string' ? m.persona : undefined,
      pestana: PESTANAS.some((p) => p.id === m.pestana) ? m.pestana : undefined,
    }
  } catch {
    return {}
  }
}

function guardarMemoria(m: Memoria): void {
  try {
    window.sessionStorage.setItem(CLAVE_MEMORIA, JSON.stringify(m))
  } catch {
    // Sin almacenamiento, la selección vive solo mientras la página esté abierta.
  }
}

function CabeceraDeLaPersona({ usuarioId, resumen }: { usuarioId: string; resumen: ResumenAsesorado | undefined }) {
  const datos = usePersona(usuarioId)
  return <CabeceraPersona datos={datos} semaforo={resumen?.semaforo} />
}

export default function ConsolaCoachPage() {
  return (
    <ProveedorDatosConsola>
      <Consola />
    </ProveedorDatosConsola>
  )
}

function Consola() {
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

  const [memoria] = useState(leerMemoria)
  const [elegidoId, setElegidoId] = useState<string | undefined>(memoria.persona)
  const [pestana, setPestanaEstado] = useState<PestanaId>(memoria.pestana ?? 'revision')
  const [direccion, setDireccion] = useState(0)

  // La memoria puede apuntar a alguien que ya no está en la cartera: entonces, el primero.
  const seleccionadoId = resumenes.some((r) => r.usuario.id === elegidoId) ? elegidoId : resumenes[0]?.usuario.id

  const indiceDe = (id: PestanaId) => PESTANAS.findIndex((p) => p.id === id)

  const irA = (id: PestanaId) => {
    setDireccion(Math.sign(indiceDe(id) - indiceDe(pestana)))
    setPestanaEstado(id)
    guardarMemoria({ persona: seleccionadoId, pestana: id })
  }

  const seleccionar = (usuarioId: string) => {
    setDireccion(0)
    setElegidoId(usuarioId)
    guardarMemoria({ persona: usuarioId, pestana })
  }

  /** Desde la Revisión o los Agentes: elegir a la persona y abrir su ficha. */
  const verPersona = (usuarioId: string) => {
    setElegidoId(usuarioId)
    setDireccion(Math.sign(indiceDe('ficha') - indiceDe(pestana)))
    setPestanaEstado('ficha')
    guardarMemoria({ persona: usuarioId, pestana: 'ficha' })
  }

  const moverFoco = (e: KeyboardEvent<HTMLDivElement>) => {
    const indiceActual = indiceDe(pestana)
    let siguiente: number
    if (e.key === 'ArrowRight') siguiente = (indiceActual + 1) % PESTANAS.length
    else if (e.key === 'ArrowLeft') siguiente = (indiceActual - 1 + PESTANAS.length) % PESTANAS.length
    else if (e.key === 'Home') siguiente = 0
    else if (e.key === 'End') siguiente = PESTANAS.length - 1
    else return
    e.preventDefault()
    const idSiguiente = PESTANAS[siguiente].id
    irA(idSiguiente)
    document.getElementById(`consola-tab-${idSiguiente}`)?.focus()
  }

  // El indicador de la pestaña activa se desliza hasta ella. Se mueve el nodo por ref
  // (no con estado): es posición pura, y un setState aquí sería un render de más.
  const listaRef = useRef<HTMLDivElement | null>(null)
  const indicadorRef = useRef<HTMLSpanElement | null>(null)
  useLayoutEffect(() => {
    const lista = listaRef.current
    const indicador = indicadorRef.current
    if (!lista || !indicador) return
    const colocar = () => {
      const activa = lista.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!activa) return
      indicador.style.width = `${activa.offsetWidth}px`
      indicador.style.transform = `translateX(${activa.offsetLeft}px)`
      indicador.style.opacity = activa.offsetWidth > 0 ? '1' : '0'
    }
    colocar()
    window.addEventListener('resize', colocar)
    return () => window.removeEventListener('resize', colocar)
  }, [pestana])

  if (resumenes.length === 0) {
    return <EmptyState titulo="Sin cartera" detalle="Todavía no hay asesorados que entrenen." />
  }

  const resumenElegido = resumenes.find((r) => r.usuario.id === seleccionadoId)
  const dePersona = PESTANAS_DE_PERSONA.has(pestana)

  return (
    <div className="flex flex-col gap-4 entrada entrada-1 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-5">
      <p className="solo-lectura-nota sr-only">
        Consola del coach: navegar no escribe en la base; solo escriben los botones de acción, con motivo o confirmación.
      </p>

      <CarteraSidebar resumenes={resumenes} seleccionadoId={seleccionadoId} onSeleccionar={seleccionar} />

      <div className="flex min-w-0 flex-col gap-4">
        {dePersona && seleccionadoId && (
          <div key={`cabecera-${seleccionadoId}`} className="consola-panel-entra" style={{ '--consola-dx': 0 } as CSSProperties}>
            <CabeceraDeLaPersona usuarioId={seleccionadoId} resumen={resumenElegido} />
          </div>
        )}

        <div className="sticky top-0 z-10 -mx-1 bg-bg/85 px-1 pb-1 pt-1 backdrop-blur-sm">
          <div
            ref={listaRef}
            role="tablist"
            aria-label="Pestañas de la consola del coach"
            onKeyDown={moverFoco}
            className="relative flex gap-1 overflow-x-auto rounded-bloque border border-hairline bg-surface-1/80 p-1"
          >
            <span
              ref={indicadorRef}
              aria-hidden="true"
              className="consola-indicador pointer-events-none absolute bottom-1 left-0 top-1 rounded-boton bg-rojo/15 opacity-0 shadow-[inset_0_-2px_0_rgb(var(--rojo-rgb))]"
            />
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                id={`consola-tab-${p.id}`}
                aria-selected={pestana === p.id}
                aria-controls={`consola-panel-${p.id}`}
                tabIndex={pestana === p.id ? 0 : -1}
                onClick={() => irA(p.id)}
                className={`relative shrink-0 rounded-boton px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition-colors duration-base ${
                  pestana === p.id ? 'text-rojo' : 'text-tenue hover:bg-surface-2 hover:text-texto'
                }`}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div
          key={`${pestana}:${dePersona || pestana === 'agentes' ? seleccionadoId : ''}`}
          id={`consola-panel-${pestana}`}
          role="tabpanel"
          aria-labelledby={`consola-tab-${pestana}`}
          tabIndex={0}
          className="consola-panel-entra min-w-0 focus-visible:outline-none"
          style={{ '--consola-dx': direccion } as CSSProperties}
        >
          {pestana === 'revision' && <RevisionSemanaTab seleccionadoId={seleccionadoId} onVerPersona={verPersona} />}
          {pestana !== 'revision' && !seleccionadoId && (
            <EmptyState titulo="Elige a alguien de la cartera" detalle="Esta pestaña es por persona." />
          )}
          {pestana === 'ficha' && seleccionadoId && <FichaAsesoradoTab usuarioId={seleccionadoId} />}
          {pestana === 'microciclos' && seleccionadoId && <MicrociclosTab usuarioId={seleccionadoId} />}
          {pestana === 'agentes' && <AgentesTab seleccionadoId={seleccionadoId} onVerPersona={verPersona} />}
          {pestana === 'condicion' && seleccionadoId && <CondicionSaludTab usuarioId={seleccionadoId} />}
          {pestana === 'estilo' && seleccionadoId && <EstiloVidaTab usuarioId={seleccionadoId} />}
          {pestana === 'video' && seleccionadoId && <RevisionVideoTab usuarioId={seleccionadoId} />}
        </div>
      </div>
    </div>
  )
}
