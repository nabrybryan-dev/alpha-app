import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { Cifra3D } from '../../../components/ui/Cifra3D'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Sheet } from '../../../components/ui/Sheet'
import { db, hoyIso, useDbVersion } from '../../../data/dbInstance'
import { desviacionRirMedia, indiceRecuperacion } from '../../../domain/readiness'
import { AvisosPraxis } from './AvisosPraxis'
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
import { usePuestoCoach } from './usePuestoCoach'
import { CLAVE_MEMORIA_CONSOLA } from './memoriaConsola'
import { ETIQUETA_SECCION } from './piezas'

/**
 * Consola del coach.
 *
 * Abrir la consola y navegarla NO escribe: ninguna pestaña llama al montar a un método
 * que escriba (`guardarPropuesta`, `activarPropuesta`, `registrarSerie`, `guardar*`,
 * `marcar*`, `enviar`…). Las únicas escrituras son los botones explícitos de
 * `AccionesRevision` y «Responder como coach», que piden motivo o confirmación. Ver
 * `ConsolaCoachPage.test.tsx` para la prueba que lo comprueba con espías.
 *
 * CONECTADA: la persona elegida en la cartera manda en todas las pestañas. Desde la zona 5
 * del rediseño, la persona y la pestaña viven en la URL (`?persona=…&pestana=…`): recargar
 * y el gesto de atrás devuelven exactamente a donde estaban. El `sessionStorage` se queda
 * como respaldo para cuando se entra sin parámetros (los enlaces viejos de Equipo).
 *
 * El lenguaje visual es el de Equipo y Empresa (zona 4): superficie plana, rótulos en
 * plata y el rojo reservado para lo que pide atención. En el teléfono la cartera lateral
 * pasa a una hoja; en escritorio sigue siendo la columna de 260 px.
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

const CLAVE_MEMORIA = CLAVE_MEMORIA_CONSOLA

interface Memoria {
  persona?: string
  pestana?: PestanaId
}

function esPestana(valor: unknown): valor is PestanaId {
  return PESTANAS.some((p) => p.id === valor)
}

/** sessionStorage puede no existir o lanzar (modo privado, datos bloqueados): nunca rompe. */
function leerMemoria(): Memoria {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_MEMORIA)
    if (!crudo) return {}
    const m = JSON.parse(crudo) as Memoria
    return {
      persona: typeof m.persona === 'string' ? m.persona : undefined,
      pestana: esPestana(m.pestana) ? m.pestana : undefined,
    }
  } catch {
    return {}
  }
}

function guardarMemoria(m: Memoria): void {
  try {
    window.sessionStorage.setItem(CLAVE_MEMORIA, JSON.stringify(m))
  } catch {
    // Sin almacenamiento, la selección vive solo en la URL mientras la página esté abierta.
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
  const [parametros, setParametros] = useSearchParams()
  const sesion = useSesionOpcional()
  const { esCoach, tiene } = usePuestoCoach(sesion?.usuario.rol)
  const soloTablero = tiene('solo_tablero')
  const [herramientasAbiertas, setHerramientasAbiertas] = useState(false)

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
  const pestanaUrl = parametros.get('pestana')
  const personaUrl = parametros.get('persona')
  // La URL manda; si no trae pestaña, se usa la última de esta pestaña del navegador.
  const pestana: PestanaId = esPestana(pestanaUrl) ? pestanaUrl : esPestana(memoria.pestana) ? memoria.pestana : 'revision'
  const elegidoId = personaUrl ?? memoria.persona
  const [direccion, setDireccion] = useState(0)

  // La memoria o la URL pueden apuntar a alguien que ya no está en la cartera: entonces, el primero.
  const seleccionadoId = resumenes.some((r) => r.usuario.id === elegidoId) ? elegidoId : resumenes[0]?.usuario.id

  const indiceDe = (id: PestanaId) => PESTANAS.findIndex((p) => p.id === id)

  /**
   * Escribe la dirección SIN perder los parámetros que ya había. `replace: false` para que
   * el gesto de atrás deshaga el último cambio de pestaña o de persona, que es lo que
   * promete la prueba «el gesto de atrás devuelve a la pestaña anterior».
   */
  const actualizarUrl = (cambios: { persona?: string; pestana?: PestanaId }) => {
    const siguiente = new URLSearchParams(parametros)
    if (cambios.persona) siguiente.set('persona', cambios.persona)
    if (cambios.pestana) siguiente.set('pestana', cambios.pestana)
    if (siguiente.toString() === parametros.toString()) return
    setParametros(siguiente)
  }

  const irA = (id: PestanaId) => {
    setDireccion(Math.sign(indiceDe(id) - indiceDe(pestana)))
    actualizarUrl({ persona: seleccionadoId, pestana: id })
    guardarMemoria({ persona: seleccionadoId, pestana: id })
  }

  const seleccionar = (usuarioId: string) => {
    setDireccion(0)
    actualizarUrl({ persona: usuarioId, pestana })
    guardarMemoria({ persona: usuarioId, pestana })
  }

  /** Desde la Revisión o los Agentes: elegir a la persona y abrir su ficha. */
  const verPersona = (usuarioId: string) => {
    setDireccion(Math.sign(indiceDe('ficha') - indiceDe(pestana)))
    actualizarUrl({ persona: usuarioId, pestana: 'ficha' })
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
    return (
      <div className="flex flex-col gap-3">
        <AvisosPraxis />
        <EmptyState titulo="Sin cartera" detalle="Todavía no hay asesorados que entrenen." />
      </div>
    )
  }

  const resumenElegido = resumenes.find((r) => r.usuario.id === seleccionadoId)
  const dePersona = PESTANAS_DE_PERSONA.has(pestana)
  const enRojo = resumenes.filter((r) => r.semaforo.color === 'rojo').length
  const pidenAtencion = resumenes.filter((r) => r.semaforo.color !== 'verde').length
  // Las mismas salidas que ofrecía la fila de enlaces del panel, ahora en una hoja para no
  // meter otra fila de texto suelto encima de la consola. Ninguna se pierde. La cuenta Alpha
  // (`solo_tablero`) no las lleva: su única pantalla es esta, y un enlace que devuelve aquí
  // sería una salida falsa.
  const herramientas = soloTablero
    ? []
    : esCoach
      ? [
          { titulo: 'Revisiones de voz y vídeo', nota: 'Lo que espera firma, con su guion.', a: '/coach/revisiones' },
          { titulo: 'Equipo', nota: 'La cartera única y la ficha de cada persona.', a: '/equipo' },
          { titulo: 'Tablero', nota: 'La consola a pantalla completa.', a: '/tablero' },
          { titulo: 'Creadores', nota: 'El embudo de la bola de nieve.', a: '/coach/creadores' },
          { titulo: 'Mi plan', nota: 'Tu agenda de 90 días.', a: '/coach/mi-plan' },
          { titulo: 'Praxis del equipo', nota: 'El cosmos; cerrada a asesorados.', a: '/praxis' },
        ]
      : [
          { titulo: 'Equipo', nota: 'La cartera única y la ficha de cada persona.', a: '/equipo' },
          { titulo: 'Praxis del equipo', nota: 'El cosmos; cerrada a asesorados.', a: '/praxis' },
        ]

  return (
    <div className="flex flex-col gap-4">
      {/* Arriba de todo: los avisos de Praxis (señales de riesgo) esperan aquí hasta que el coach los atiende.
          Solo lo ve quien ocupa el puesto de coach; para los demás no se pinta ni se consulta nada. */}
      <AvisosPraxis onVerPersona={verPersona} />

      <p className="solo-lectura-nota sr-only">
        Consola del coach: navegar no escribe en la base; solo escriben los botones de acción, con motivo o confirmación.
      </p>

      <header className="entrada entrada-1 flex flex-col gap-1 pt-1">
        <p className={ETIQUETA_SECCION}>Consola del coach</p>
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl leading-none text-texto">La cartera</h2>
          <div className="flex shrink-0 items-center gap-2">
            <Cifra3D
              valor={resumenes.length}
              tamano={34}
              rojo={enRojo > 0}
              etiqueta={`${resumenes.length} personas en la cartera`}
            />
            <button
              type="button"
              onClick={() => setHerramientasAbiertas(true)}
              className={`press inline-flex min-h-[44px] items-center rounded-full border border-linea bg-surface-1 px-3.5 text-xs font-bold text-tenue ${
                herramientas.length === 0 ? 'hidden' : ''
              }`}
            >
              Herramientas
            </button>
          </div>
        </div>
        <p className="text-sm text-tenue">
          {pidenAtencion === 0
            ? 'Todas al día. Abre a una persona para revisar su semana.'
            : `${pidenAtencion} de ${resumenes.length} piden atención; el resto va al día.`}
        </p>
      </header>

      <div className="entrada entrada-2 flex flex-col gap-4 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <CarteraSidebar resumenes={resumenes} seleccionadoId={seleccionadoId} onSeleccionar={seleccionar} />

        <div className="flex min-w-0 flex-col gap-4">
          {dePersona && seleccionadoId && (
            <div key={`cabecera-${seleccionadoId}`} className="consola-panel-entra" style={{ '--consola-dx': 0 } as CSSProperties}>
              <CabeceraDeLaPersona usuarioId={seleccionadoId} resumen={resumenElegido} />
            </div>
          )}

          <div className="sticky top-14 z-10 -mx-1 bg-bg/90 px-1 pb-1 pt-1 backdrop-blur-sm">
            <div
              ref={listaRef}
              role="tablist"
              aria-label="Pestañas de la consola del coach"
              onKeyDown={moverFoco}
              className="relative flex gap-1 overflow-x-auto rounded-tarjeta border border-linea bg-surface-1 p-1 [scrollbar-width:none]"
            >
              <span
                ref={indicadorRef}
                aria-hidden="true"
                className="consola-indicador pointer-events-none absolute bottom-1 left-0 top-1 rounded-boton bg-surface-3 opacity-0 shadow-[inset_0_-2px_0_var(--texto)]"
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
                  className={`relative min-h-[44px] shrink-0 rounded-boton px-3.5 text-xs font-bold uppercase tracking-wide transition-colors duration-base ${
                    pestana === p.id ? 'text-texto' : 'text-tenue hover:bg-surface-2 hover:text-texto'
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

      <Sheet abierto={herramientasAbiertas} titulo="Herramientas del equipo" onCerrar={() => setHerramientasAbiertas(false)}>
        <p className="text-sm text-tenue">Las otras pantallas del equipo, sin salir de la consola.</p>
        <ul className="mt-2 rounded-tarjeta border border-linea bg-surface-1 px-4">
          {herramientas.map((h) => (
            <li key={h.a}>
              <Link
                to={h.a}
                onClick={() => setHerramientasAbiertas(false)}
                className="press flex min-h-[56px] items-center justify-between gap-3 border-t border-linea first:border-t-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-texto">{h.titulo}</span>
                  <span className="text-xs text-tenue">{h.nota}</span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-tenue">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}
