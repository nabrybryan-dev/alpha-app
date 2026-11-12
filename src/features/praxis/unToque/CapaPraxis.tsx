import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { piezasPara } from '../../../app/catalogoDePiezas'
import { navegarA } from '../../../app/navegarPraxis'
import {
  aplicarCambio,
  deshacerUltimo,
  ESTADO_INICIAL,
  type EstadoLocal,
} from '../../../app/organizacionLocal'
import type { PerfilAcceso } from '../../../app/rutas'
import { tituloDeRuta } from '../../../app/rutas'
import {
  descripcionDelCambio,
  resolverTurno,
  turnoDeEleccion,
  type AccionDeTarjeta,
  type ContextoDelTurno,
  type TurnoDePraxis,
} from '../../../app/unToquePraxis'
import { movimientoReducido } from '../../../components/ui/movimientoReducido'
import { PRAXIS_UN_TOQUE_CHARLA } from './banderas'
import { EsquemaDeOrden } from './EsquemaDeOrden'
import { engancheDeCharla, type RespuestaDeCharla } from './engancheDeCharla'
import { abrirCapa, cerrarCapa, useCapaAbierta } from './estadoCapa'
import { TEXTOS_APROBADOS as A, TEXTOS_PENDIENTES as P } from './textos'

/** La píldora se va sola a los 9 s (diseño); «Deshacer» sigue disponible por frase. */
export const MS_DE_LA_PILDORA = 9000
/** Tope de espera del enganche de la charla: pasado esto se trata como «sin respuesta». */
export const MS_TOPE_DE_CHARLA = 4000

export const ID_DE_LA_CAPA = 'capa-praxis'

interface Pildora {
  texto: string
  sub?: string
  conDeshacer: boolean
}

type Item =
  | { id: number; k: 'yo'; texto: string }
  | { id: number; k: 'px'; texto: string; rotulo?: string; respuesta?: RespuestaDeCharla }
  | { id: number; k: 'turno'; turno: TurnoDePraxis }
  | { id: number; k: 'pensando' }

type ItemSinId = Item extends infer T ? (T extends { id: number } ? Omit<T, 'id'> : never) : never

export interface CapaPraxisProps {
  perfil: PerfilAcceso
  /** Patrón de la pantalla donde está la persona. */
  pantallaActual: string
  navegar: (ruta: string) => void
  /** `PRAXIS_UN_TOQUE_CHARLA`; se pasa para poder probar los dos casos. */
  charlaActiva?: boolean
  /** Camino para dejarle al coach el aviso «te sobra esta parte» (sin la frase). Sin él, no se ofrece. */
  alAvisarCoachDePieza?: (piezaId: string) => void
  /** «Avisar a mi coach» de la tarjeta de salud. No escribe nada propio: lleva al camino que la app ya tiene. */
  alAvisarCoachDeSalud: () => void
  alAbrirCheckin: () => void
}

/**
 * LA CAPA DE PRAXIS A UN TOQUE: se abre con el botón de Praxis de la barra, sobre la pantalla donde estés, y otro
 * toque (o Escape, o tocar fuera) la cierra. Conecta la frase con la gramática real (`resolverTurno`) y pinta lo
 * que decide; no decide nada por su cuenta. NO llama a ningún modelo: las preguntas de conocimiento van al
 * enganche vacío (`engancheDeCharla.ts`) y solo con `PRAXIS_UN_TOQUE_CHARLA` encendida.
 */
export function CapaPraxis(props: CapaPraxisProps) {
  const { perfil, pantallaActual, navegar, charlaActiva = PRAXIS_UN_TOQUE_CHARLA, alAvisarCoachDePieza, alAvisarCoachDeSalud, alAbrirCheckin } = props
  const abierta = useCapaAbierta()
  const [items, setItems] = useState<Item[]>([])
  const [estado, setEstado] = useState<EstadoLocal>(ESTADO_INICIAL)
  const [pildora, setPildora] = useState<Pildora | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [entro, setEntro] = useState(false)
  /** Una frase que espera a que la capa esté abierta (el «Deshacer» de la píldora). */
  const pendiente = useRef<string | null>(null)
  const siguiente = useRef(1)
  const campo = useRef<HTMLInputElement>(null)
  const hilo = useRef<HTMLDivElement>(null)
  const quienAbrio = useRef<HTMLElement | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const ctx: ContextoDelTurno = useMemo(
    () => ({ perfil, estado, pantallaActual, charlaActiva, puedeAvisarAlCoach: Boolean(alAvisarCoachDePieza) }),
    [perfil, estado, pantallaActual, charlaActiva, alAvisarCoachDePieza],
  )
  const piezas = useMemo(() => piezasPara(perfil), [perfil])

  const poner = useCallback((i: ItemSinId): number => {
    const id = siguiente.current++
    setItems((l) => [...l, { ...i, id } as Item])
    return id
  }, [])

  // Foco: al abrir va al campo; al cerrar vuelve a quien abrió. Escape cierra.
  useEffect(() => {
    if (!abierta) return
    quienAbrio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const r = requestAnimationFrame(() => setEntro(true))
    campo.current?.focus({ preventScroll: true })
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrarCapa()
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      setEntro(false)
      cancelAnimationFrame(r)
      document.removeEventListener('keydown', alTeclear)
      const a = quienAbrio.current
      if (a && a.isConnected) a.focus({ preventScroll: true })
    }
  }, [abierta])

  useEffect(() => {
    hilo.current?.scrollTo?.({ top: hilo.current.scrollHeight, behavior: movimientoReducido() ? 'auto' : 'smooth' })
  }, [items])

  useEffect(() => () => clearTimeout(temporizador.current), [])

  const mostrarPildora = useCallback((p: Pildora) => {
    setPildora(p)
    clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setPildora(null), MS_DE_LA_PILDORA)
  }, [])

  const alListo = useCallback(
    (turno: TurnoDePraxis) => {
      if (!turno.traer) return
      const r = navegarA(turno.traer.pantalla, perfil, navegar)
      if (r.tipo === 'navego') {
        mostrarPildora({ texto: P.pildoraTraje(turno.traer.nombreHablado), sub: P.pildoraTrajeSub, conDeshacer: false })
        cerrarCapa()
      } else {
        poner({ k: 'px', texto: P.sinAcceso })
      }
    },
    [perfil, navegar, mostrarPildora, poner],
  )

  const ejecutarTarjeta = useCallback(
    (accion: AccionDeTarjeta) => {
      switch (accion.t) {
        case 'aplicar': {
          const pieza = piezas.find((p) => p.id === accion.piezaId)
          if (!pieza) return
          const nuevo = aplicarCambio(estado, accion.accion, pieza, descripcionDelCambio(accion.accion, pieza))
          setEstado(nuevo)
          poner({ k: 'px', texto: accion.accion === 'ocultar' ? A.hechoOcultar(nuevo.ocultas.length) : P.hechoMover })
          const nombre = pieza.nombreHablado
          mostrarPildora({
            texto: accion.accion === 'ocultar' ? P.pildoraOculte(nombre) : accion.accion === 'fijar' ? P.pildoraFije(nombre) : P.pildoraMovi(nombre),
            sub: accion.accion === 'ocultar' ? P.ocultasCuenta(nuevo.ocultas.length) : undefined,
            conDeshacer: true,
          })
          cerrarCapa()
          return
        }
        case 'deshacer':
          setEstado(deshacerUltimo(estado))
          poner({ k: 'px', texto: P.hechoDeshacer })
          mostrarPildora({ texto: P.pildoraDeshecho, conDeshacer: false })
          cerrarCapa()
          return
        case 'elegir': {
          const pieza = piezas.find((p) => p.id === accion.piezaId)
          if (pieza) poner({ k: 'turno', turno: turnoDeEleccion(accion.verbo, pieza, ctx) })
          return
        }
        case 'dejar':
          poner({ k: 'px', texto: accion.mensaje })
          return
        case 'avisar_coach_pieza':
          alAvisarCoachDePieza?.(accion.piezaId)
          poner({ k: 'px', texto: P.avisoCoachHecho })
          return
        case 'avisar_coach_salud':
          cerrarCapa()
          alAvisarCoachDeSalud()
          return
        case 'abrir_checkin':
          cerrarCapa()
          alAbrirCheckin()
          return
        case 'quitar_ultimo':
          poner({ k: 'px', texto: P.queQuitoUltimoRespuesta })
          return
      }
    },
    [piezas, estado, ctx, poner, mostrarPildora, alAvisarCoachDePieza, alAvisarCoachDeSalud, alAbrirCheckin],
  )

  const enviar = useCallback(
    async (crudo: string) => {
      const frase = crudo.trim()
      if (!frase || ocupado) return
      poner({ k: 'yo', texto: frase })
      const turno = resolverTurno(frase, ctx)
      if (!turno.pregunta) {
        poner({ k: 'turno', turno })
        return
      }
      // Pregunta de conocimiento, con la bandera de la charla encendida. La salud ya quedó descartada arriba.
      setOcupado(true)
      const idEspera = poner({ k: 'pensando' })
      let respuesta: RespuestaDeCharla | null = null
      const enganche = engancheDeCharla()
      if (enganche) {
        try {
          respuesta = await Promise.race([
            enganche.responder(frase),
            new Promise<null>((ok) => setTimeout(() => ok(null), MS_TOPE_DE_CHARLA)),
          ])
        } catch {
          respuesta = null
        }
      }
      setItems((l) => l.filter((i) => i.id !== idEspera))
      setOcupado(false)
      if (!enganche) poner({ k: 'px', texto: P.charlaSinConectar })
      else if (!respuesta) poner({ k: 'px', texto: P.charlaSinRespuesta })
      else poner({ k: 'px', texto: respuesta.texto, rotulo: A.rotuloProvisional, respuesta })
    },
    [ctx, ocupado, poner],
  )

  useEffect(() => {
    const frase = pendiente.current
    if (abierta && frase) {
      pendiente.current = null
      void enviar(frase)
    }
  }, [abierta, enviar])

  const [texto, setTexto] = useState('')
  const alEnviar = (e: FormEvent) => {
    e.preventDefault()
    const t = texto
    setTexto('')
    void enviar(t)
  }

  const hayDeshacer = estado.historial.length > 0
  const sugerencias = hayDeshacer ? [P.sugerenciaDeshacer, ...P.sugerencias] : P.sugerencias
  const titulo = tituloDeRuta(pantallaActual) ?? ''

  return (
    <>
      {abierta ? (
        <>
          {/* Tocar fuera cierra. No es un botón: el cierre accesible es el botón de la capa y la barra. */}
          <div aria-hidden="true" data-fuera onClick={() => cerrarCapa()} className="fixed inset-0 bg-black/55" style={{ zIndex: 'calc(var(--z-nav) - 2)' }} />
          <section
            id={ID_DE_LA_CAPA}
            role="dialog"
            aria-modal="false"
            aria-label={P.nombreDeLaCapa}
            className={`fixed inset-x-0 mx-auto flex h-[68dvh] w-full max-w-lg flex-col rounded-t-[26px] border border-b-0 border-hairline-fuerte bg-surface-1 shadow-[0_-10px_40px_rgba(0,0,0,0.45)] transition-all duration-panel ease-cajon motion-reduce:transition-none ${
              entro ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
            }`}
            style={{ bottom: 'var(--tope-nav)', zIndex: 'calc(var(--z-nav) - 1)' }}
          >
            <div className="flex flex-none items-center gap-2.5 px-4 pb-2 pt-3">
              <p className="flex items-center gap-2 whitespace-nowrap text-xs font-extrabold uppercase tracking-[0.14em] text-rojo">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-rojo motion-safe:animate-pulse" />
                {P.rotuloEn(titulo)}
              </p>
              <button
                type="button"
                onClick={() => cerrarCapa()}
                aria-label={P.cerrar}
                className="ml-auto grid h-11 w-11 place-items-center rounded-xl bg-surface-3 text-texto"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div ref={hilo} aria-live="polite" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-3.5 pb-3 pt-1">
              <div>
                <h2 className="font-display text-3xl font-black leading-none tracking-tight">{A.saludoTitulo}</h2>
                <p className="mt-2 text-[15px] text-tenue">{A.saludoLinea}</p>
              </div>
              {items.map((i) => (
                <Fila key={i.id} item={i} ejecutar={ejecutarTarjeta} alListo={alListo} />
              ))}
            </div>
            <div role="group" aria-label={P.frasesDeEjemplo} className="flex flex-none gap-2 overflow-x-auto px-3.5 pb-2 pt-1.5">
              {sugerencias.map((s) => (
                <button
                  key={s.frase}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void enviar(s.frase)}
                  className="min-h-[46px] max-w-[15rem] flex-none rounded-2xl bg-surface-3 px-3.5 py-1.5 text-left text-sm font-bold leading-tight text-texto"
                >
                  <small className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-rojo">{s.etiqueta}</small>
                  {s.frase}
                </button>
              ))}
            </div>
            <form onSubmit={alEnviar} autoComplete="off" className="mx-3 mb-3 flex flex-none items-center gap-2 rounded-full border border-hairline-fuerte bg-bg py-1 pl-3.5 pr-1 focus-within:border-rojo">
              <label htmlFor="campo-praxis" className="sr-only">
                {P.etiquetaDelCampo}
              </label>
              <input
                id="campo-praxis"
                ref={campo}
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={P.marcadorDelCampo}
                enterKeyHint="send"
                className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tenue"
              />
              <button type="submit" disabled={ocupado || !texto.trim()} className="min-h-11 rounded-full bg-rojo px-[18px] font-display text-sm font-black text-white disabled:opacity-50">
                {P.enviar}
              </button>
            </form>
          </section>
        </>
      ) : null}
      {!abierta && pildora ? (
        <div
          role="status"
          className="fixed inset-x-3 mx-auto flex max-w-md items-center gap-2.5 rounded-full border border-hairline-fuerte bg-surface-1 p-2 shadow-lg"
          style={{ bottom: 'calc(var(--tope-nav) + 0.75rem)', zIndex: 'calc(var(--z-nav) - 1)' }}
        >
          <p className="min-w-0 flex-1 pl-2 text-sm font-bold leading-tight">
            {pildora.texto}
            {pildora.sub ? <small className="block text-xs font-semibold text-tenue">{pildora.sub}</small> : null}
          </p>
          {pildora.conDeshacer ? (
            <button
              type="button"
              className="min-h-10 rounded-full bg-surface-3 px-3 text-[13px] font-extrabold"
              onClick={() => {
                setPildora(null)
                pendiente.current = P.sugerenciaDeshacer.frase
                abrirCapa()
              }}
            >
              {P.deshacer}
            </button>
          ) : null}
          <button type="button" className="min-h-10 rounded-full bg-surface-3 px-3 text-[13px] font-extrabold" onClick={() => abrirCapa()}>
            {P.abrirPraxis}
          </button>
        </div>
      ) : null}
    </>
  )
}

function Fila({ item, ejecutar, alListo }: { item: Item; ejecutar: (a: AccionDeTarjeta) => void; alListo: (t: TurnoDePraxis) => void }): ReactNode {
  if (item.k === 'yo') {
    return <div className="max-w-[88%] self-end rounded-[18px] border border-silver-500 bg-surface-1 px-3.5 py-2.5 text-[15px]">{item.texto}</div>
  }
  if (item.k === 'pensando') {
    return (
      <div role="status" className="flex items-center gap-2 self-start rounded-full border border-hairline bg-surface-2 px-3.5 py-1.5 text-sm font-bold">
        {P.pensando}
        <span aria-hidden="true" className="motion-safe:animate-pulse">…</span>
      </div>
    )
  }
  if (item.k === 'px') return <Mensaje texto={item.texto} rotulo={item.rotulo} respuesta={item.respuesta} />
  return <BloqueDeTurno turno={item.turno} ejecutar={ejecutar} alListo={alListo} />
}

function Mensaje({ texto, rotulo, respuesta }: { texto: string; rotulo?: string; respuesta?: RespuestaDeCharla }) {
  return (
    <div className="max-w-[88%] self-start rounded-[18px] border border-hairline bg-surface-2 px-3.5 py-2.5 text-[15px]">
      <small className="mb-0.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-tenue">{P.nombreDeLaCapa}</small>
      {texto}
      {rotulo ? <small className="mt-1 block text-xs text-tenue">{rotulo}</small> : null}
      {respuesta?.fichas.map((f) => (
        <article key={f.id} className="mt-2 grid gap-1.5 rounded-xl border border-hairline-fuerte bg-surface-1 p-2.5">
          <h4 className="text-base font-extrabold">{f.titulo}</h4>
          {/* Una ficha sin estudios no puede pintar el bloque de estudios (mitigación 2). */}
          {f.estudios ? (
            <div className="rounded-lg border-l-[3px] border-silver-500 bg-surface-2 px-2.5 py-2 text-sm">
              <b className="block text-[11px] uppercase tracking-[0.12em]">{P.fichaEstudios}</b>
              {f.estudios}
            </div>
          ) : null}
          <div className="rounded-lg border-l-[3px] border-rojo bg-rojo/10 px-2.5 py-2 text-sm">
            <b className="block text-[11px] uppercase tracking-[0.12em] text-rojo">{P.fichaCriterio}</b>
            {f.criterio}
          </div>
        </article>
      ))}
    </div>
  )
}

/** Un turno: el esquema por pasos y, cuando termina, el mensaje y la tarjeta. */
function BloqueDeTurno({ turno, ejecutar, alListo }: { turno: TurnoDePraxis; ejecutar: (a: AccionDeTarjeta) => void; alListo: (t: TurnoDePraxis) => void }) {
  const [listo, setListo] = useState(turno.pasos.length === 0)
  const [elegida, setElegida] = useState<number | null>(null)
  const avisado = useRef(false)

  useEffect(() => {
    if (listo && !avisado.current) {
      avisado.current = true
      alListo(turno)
    }
  }, [listo, turno, alListo])

  const t = turno.tarjeta
  return (
    <div className="grid gap-2.5">
      <EsquemaDeOrden pasos={turno.pasos} plano={turno.plano} alCompletar={() => setListo(true)} />
      {listo && turno.mensaje ? <Mensaje texto={turno.mensaje} /> : null}
      {listo && t ? (
        <div className={`grid gap-2.5 rounded-[20px] border-[1.5px] bg-surface-1 p-3.5 ${t.estilo === 'neutra' ? 'border-hairline-fuerte' : 'border-rojo'} ${elegida !== null ? 'opacity-60' : ''}`}>
          <p className={`text-xs font-extrabold uppercase tracking-[0.14em] ${t.estilo === 'neutra' ? 'text-tenue' : 'text-rojo'}`}>{t.etiqueta}</p>
          <p className="font-display text-xl font-extrabold leading-tight">{t.texto}</p>
          {t.antesDespues ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-2 px-2.5 py-2 text-[13px]">
                <b className="block text-[11px] uppercase tracking-[0.1em] text-tenue">{P.antes}</b>
                {t.antesDespues.antes}
              </div>
              <div className="rounded-xl bg-surface-2 px-2.5 py-2 text-[13px]">
                <b className="block text-[11px] uppercase tracking-[0.1em] text-tenue">{P.despues}</b>
                {t.antesDespues.despues}
              </div>
            </div>
          ) : null}
          {t.sub ? <p className="text-sm text-tenue">{t.sub}</p> : null}
          <div className="flex flex-wrap gap-2.5">
            {t.botones.map((b, i) => (
              <button
                key={b.etiqueta}
                type="button"
                disabled={elegida !== null}
                onClick={() => {
                  setElegida(i)
                  ejecutar(b.accion)
                }}
                className={`min-h-[50px] flex-1 rounded-[14px] px-5 py-3 font-display text-sm font-black ${
                  i === 0 && t.estilo === 'confirmar' ? 'bg-rojo text-white' : 'bg-surface-3 text-texto'
                }`}
              >
                {b.etiqueta}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
