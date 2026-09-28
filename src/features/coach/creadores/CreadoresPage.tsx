import { useCallback, useEffect, useState } from 'react'
import {
  NOMBRE_CARRIL,
  S_MINIMA,
  candidatosDelTablero,
  eventosDelTablero,
  mediaDimension,
  porCarril,
  resumenS,
  revisionesDe,
  urlHojaCuadros,
  vueltasDeRevision,
  type Candidato,
  type Carril,
  type Lectura,
} from '../../../data/consola/creadores'
import { Cifra3D } from '../../../components/ui/Cifra3D'
import { embudoDe, type Embudo } from './embudo'

/**
 * Tablero de CREADORES (fase F1 de `PLAN-CENTRALIZACION.md`): SOLO LECTURA.
 *
 * Pinta el embudo de la bola de nieve con los datos que sube el importador de casa
 * (migración 0090). Lo primero que se ve es «Tambaleando», con el motivo exacto, porque es
 * donde hace falta criterio humano; luego lo aprobado para contacto; luego el resto. Los
 * entrenadores-creadores van aparte (segmento de alquiler). No hay botones que escriban:
 * la firma llega en F2.
 */

const DIMENSIONES = ['H', 'C', 'P', 'T', 'CTA', 'S'] as const
const PRIMERO: Carril[] = ['tambaleando', 'aprobado_contacto']

/** Las filas del embudo, en el orden de la maqueta. Rojo solo el paso que pide criterio. */
const FILAS_EMBUDO: { clave: keyof Embudo; etiqueta: string; rojo?: boolean; tenue?: boolean }[] = [
  { clave: 'enTablero', etiqueta: 'Candidatos en el tablero' },
  { clave: 'esperanVideo', etiqueta: 'Esperan video' },
  { clave: 'tambaleando', etiqueta: 'Tambaleando', rojo: true },
  { clave: 'contactados', etiqueta: 'Contactados' },
  { clave: 'entrenadores', etiqueta: 'Entrenadores', tenue: true },
]

/**
 * Arriba del tablero: tres cifras en relieve y el embudo con sus barras, contado sobre los
 * carriles reales (`embudoDe`). Las barras se miden contra los candidatos en el tablero, que
 * es el total del que sale cada paso; con cero no hay barra que dibujar.
 */
function CabeceraEmbudo({
  embudo,
  falloHistoria,
  onReintentarHistoria,
}: {
  embudo: Embudo
  /** Motivo si la historia (`creadores_eventos`) no se pudo leer; «contactados» queda en «—». */
  falloHistoria: string | null
  onReintentarHistoria: () => void
}) {
  const total = embudo.enTablero
  const contactados = embudo.contactados
  return (
    <>
      <div role="group" aria-label="Cifras de la bola de nieve" className="entrada entrada-1 grid grid-cols-3 gap-2 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <div className="flex min-w-0 flex-col gap-1">
          <Cifra3D valor={embudo.enTablero} etiqueta={`${embudo.enTablero} candidatos en el tablero`} />
          <span className="text-xs text-tenue">candidatos en el tablero</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Cifra3D valor={embudo.tambaleando} rojo={embudo.tambaleando > 0} etiqueta={`${embudo.tambaleando} por decidir`} />
          <span className="text-xs text-tenue">por decidir</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Cifra3D
            valor={contactados ?? undefined}
            etiqueta={contactados === null ? 'contactados: sin la historia no se sabe' : `${contactados} contactados`}
          />
          <span className="text-xs text-tenue">contactados</span>
        </div>
      </div>

      <section aria-label="El embudo hoy" className="entrada entrada-2 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">El embudo hoy</p>
        {falloHistoria !== null && (
          // «Contactados» sale de la historia (E-05): si no se pudo leer, se dice, no se inventa.
          <FalloDeLectura pequeno texto={`No se pudo leer la historia de contactos (${falloHistoria}).`} onReintentar={onReintentarHistoria} />
        )}
        <ul className="flex flex-col gap-2.5">
          {FILAS_EMBUDO.map((f) => {
            const n = embudo[f.clave]
            const pct = n !== null && total > 0 ? Math.min(100, (n / total) * 100) : 0
            return (
              <li key={f.clave} className="grid grid-cols-[9rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-[13px]">
                <span className={f.rojo ? 'font-bold text-rojo' : 'text-texto'}>{f.etiqueta}</span>
                <div className="h-2.5 rounded-full bg-surface-2" aria-hidden="true">
                  {pct > 0 && (
                    <div
                      className={`barra-espacio h-2.5 rounded-full ${f.rojo ? 'bg-rojo' : f.tenue ? 'bg-tenue' : 'bg-texto'}`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
                <span className={`cifras text-right text-sm font-bold ${f.rojo ? 'text-rojo' : 'text-texto'}`}>{n ?? '—'}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function formatoSeguidores(n: number | null): string {
  if (n === null) return '—'
  return n.toLocaleString('es-CO')
}

function HojaCuadros({ ruta }: { ruta: string | null }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    void urlHojaCuadros(ruta).then((u) => {
      if (vivo) setUrl(u)
    })
    return () => {
      vivo = false
    }
  }, [ruta])
  if (!ruta) return null
  if (!url) return <p className="text-xs text-tenue">Hoja de cuadros no disponible.</p>
  return <img src={url} alt="Cuadros del reel en 0,3 / 1 / 2 / 4 s y a lo largo del video" className="mt-2 w-full rounded-md border border-linea" loading="lazy" />
}

/** Un fallo de lectura se dice como fallo y se puede reintentar (E-01). */
function FalloDeLectura({ texto, onReintentar, pequeno }: { texto: string; onReintentar: () => void; pequeno?: boolean }) {
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-2 ${pequeno ? 'mt-2 text-xs' : 'text-sm'} text-rojo`}>
      <span>{texto}</span>
      <button type="button" onClick={onReintentar} className="press rounded-full border border-rojo px-3 py-1 text-xs font-bold text-rojo">
        Reintentar
      </button>
    </div>
  )
}

/** Una lectura con sus tres estados: `null` = cargando; luego los datos o el fallo. */
function useLectura<T>(leer: () => Promise<Lectura<T>>): { lectura: Lectura<T> | null; reintentar: () => void } {
  const [lectura, setLectura] = useState<Lectura<T> | null>(null)
  const [vuelta, setVuelta] = useState(0)
  useEffect(() => {
    let vivo = true
    void leer().then((r) => {
      if (vivo) setLectura(r)
    })
    return () => {
      vivo = false
    }
  }, [leer, vuelta])
  const reintentar = useCallback(() => {
    setLectura(null)
    setVuelta((v) => v + 1)
  }, [])
  return { lectura, reintentar }
}

/**
 * Reels y evaluaciones son unidades distintas (N-02): «reels» cuenta `media_id` distintos;
 * «evaluaciones», las filas (un revisor sobre un reel). El mínimo es sobre todas las notas.
 */
function textoS(s: ReturnType<typeof resumenS>): string {
  const minimo = s.minimo === null ? 'S mínima sin nota' : `S mínima ${s.minimo.toLocaleString('es-CO')}`
  const reels = `${s.reelsConS} de ${s.reels} ${s.reels === 1 ? 'reel' : 'reels'} con S`
  const evaluaciones = `${s.total} ${s.total === 1 ? 'evaluación' : 'evaluaciones'}`
  const sinS = s.pendientes > 0 ? ` (${s.pendientes} sin S)` : ''
  return `${minimo} · ${reels} · ${evaluaciones}${sinS}`
}

function DetalleRevisiones({ creadorId }: { creadorId: string }) {
  const leer = useCallback(() => revisionesDe(creadorId), [creadorId])
  const { lectura, reintentar } = useLectura(leer)
  const [elegida, setElegida] = useState<string | null>(null)

  if (lectura === null) return <p className="text-xs text-tenue" aria-busy="true">Cargando revisiones…</p>
  if (!lectura.ok) {
    return <FalloDeLectura pequeno texto={`No se pudieron leer las revisiones (${lectura.error}).`} onReintentar={reintentar} />
  }
  const vueltas = vueltasDeRevision(lectura.datos)
  if (vueltas.length === 0) return <p className="text-xs text-tenue">Sin revisión de video todavía.</p>

  // Por defecto, la vuelta más reciente; nunca una mezcla de vueltas (E-02).
  const vuelta = vueltas.find((v) => v.revisionId === elegida) ?? vueltas[0]
  const revisiones = vuelta.filas
  const revisores = [...new Set(revisiones.map((r) => r.revisor))]
  // Un reel es su media_id dentro de la vuelta; el rol solo lo nombra.
  const reels = [...new Set(revisiones.map((r) => r.mediaId))]
    .map((mediaId) => ({ mediaId, filas: revisiones.filter((r) => r.mediaId === mediaId) }))
    .sort((a, b) => a.filas[0].rolReel.localeCompare(b.filas[0].rolReel) || a.mediaId.localeCompare(b.mediaId))
  const sVuelta = resumenS(revisiones)

  return (
    <div className="mt-3 flex flex-col gap-3">
      {vueltas.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-tenue">
          Vuelta de revisión
          <select
            value={vuelta.revisionId}
            onChange={(e) => setElegida(e.target.value)}
            className="rounded-md border border-linea bg-surface-1 px-2 py-1 text-xs text-texto"
          >
            {vueltas.map((v, i) => (
              <option key={v.revisionId} value={v.revisionId}>
                {`${v.revisionId} · ${new Date(v.fecha).toLocaleDateString('es-CO')}${i === 0 ? ' (la más reciente)' : ''}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* La seguridad no se promedia: su mínimo, con cobertura, y en rojo si alguna S < 2 (E-03). */}
      <p className={`text-xs ${sVuelta.bajo ? 'font-bold text-rojo' : 'text-texto'}`}>
        {textoS(sVuelta)}
        {sVuelta.bajo ? ` · alguna S por debajo de ${S_MINIMA}: veto de seguridad` : ''}
      </p>

      <table className="w-full text-left text-xs">
        <caption className="sr-only">Medias por revisor; la S es el mínimo</caption>
        <thead>
          <tr className="text-tenue">
            <th scope="col" className="py-1 pr-2">Revisor</th>
            {DIMENSIONES.map((d) => (
              <th key={d} scope="col" className="py-1 pr-2">{d === 'S' ? 'S (mín)' : d}</th>
            ))}
            <th scope="col" className="py-1 pr-2">Reels</th>
          </tr>
        </thead>
        <tbody>
          {revisores.map((rev) => {
            const suyas = revisiones.filter((r) => r.revisor === rev)
            const pendientes = suyas.reduce((n, r) => n + DIMENSIONES.filter((d) => typeof r.notas[d] !== 'number').length, 0)
            return (
              <tr key={rev} className="border-t border-linea text-texto">
                <th scope="row" className="py-1 pr-2 font-bold capitalize">{rev}</th>
                {DIMENSIONES.map((d) => {
                  if (d === 'S') {
                    const s = resumenS(suyas)
                    return (
                      <td key={d} className={`py-1 pr-2 ${s.bajo ? 'font-bold text-rojo' : ''}`}>
                        {s.minimo === null ? '—' : `mín ${s.minimo.toLocaleString('es-CO')}`}
                      </td>
                    )
                  }
                  const m = mediaDimension(suyas, d)
                  const bajo = m !== null && d !== 'CTA' && m < 2
                  return (
                    <td key={d} className={`py-1 pr-2 ${bajo ? 'font-bold text-rojo' : ''}`}>
                      {m === null ? '—' : m.toLocaleString('es-CO')}
                    </td>
                  )
                })}
                <td className="py-1 pr-2 text-tenue">
                  {suyas.length}
                  {pendientes > 0 ? ` · ${pendientes} ${pendientes === 1 ? 'nota pendiente' : 'notas pendientes'}` : ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {reels.map(({ mediaId, filas }) => {
        const primero = filas[0]
        const permalink = filas.find((r) => r.permalink)?.permalink ?? null
        const descripcion = filas.find((r) => r.descripcion)?.descripcion ?? null
        const hoja = filas.find((r) => r.hojaCuadros)?.hojaCuadros ?? null
        return (
          <details key={mediaId} className="rounded-md border border-linea p-2">
            <summary className="cursor-pointer text-xs font-bold text-texto">
              {primero.rolReel.replace('_', ' ')}
              {descripcion ? ` · ${descripcion}` : ''}
            </summary>
            {permalink && (
              <a href={permalink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
                Ver el reel con sonido
              </a>
            )}
            <ul className="mt-1 text-xs text-tenue">
              {filas.map((r) => (
                <li key={r.id}>
                  <span className="capitalize">{r.revisor}</span>:{' '}
                  {DIMENSIONES.map((d) => `${d} ${r.notas[d] ?? 'pendiente'}`).join(' · ')}
                  {r.sinAudio ? ' · sin audio' : ''}
                </li>
              ))}
            </ul>
            <HojaCuadros ruta={hoja} />
          </details>
        )
      })}
    </div>
  )
}

function TarjetaCandidato({ candidato }: { candidato: Candidato }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <li className="rounded-tarjeta border border-linea bg-surface-1 p-3">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
      >
        <span className="font-bold text-texto">@{candidato.usuarioIg}</span>
        <span className="text-xs text-tenue">
          {formatoSeguidores(candidato.seguidores)} seguidores
          {candidato.notaA !== null ? ` · A ${candidato.notaA.toLocaleString('es-CO')}` : ''}
          {candidato.senalColombia ? ' · Colombia' : ''}
        </span>
      </button>
      {candidato.motivos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Motivos">
          {candidato.motivos.map((m) => (
            <li key={m} className="rounded-full border border-linea px-2 py-0.5 text-xs text-texto">{m}</li>
          ))}
        </ul>
      )}
      {abierta && <DetalleRevisiones creadorId={candidato.creadorId} />}
    </li>
  )
}

export default function CreadoresPage() {
  const { lectura, reintentar } = useLectura(candidatosDelTablero)
  const { lectura: historia, reintentar: reintentarHistoria } = useLectura(eventosDelTablero)

  if (lectura === null) {
    return <p className="text-sm text-tenue" aria-busy="true">Cargando el tablero de creadores…</p>
  }
  if (!lectura.ok) {
    // Un fallo NO es «todavía no hay creadores» (E-01): se dice y se puede reintentar.
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-none text-texto">Bola de nieve</h1>
        <FalloDeLectura texto={`No se pudo leer el tablero de creadores (${lectura.error}).`} onReintentar={reintentar} />
      </div>
    )
  }
  const candidatos = lectura.datos

  const grupos = porCarril(candidatos)
  const orden = [
    ...grupos.filter((g) => PRIMERO.includes(g.carril)),
    ...grupos.filter((g) => !PRIMERO.includes(g.carril) && g.carril !== 'entrenador'),
    ...grupos.filter((g) => g.carril === 'entrenador'),
  ]
  const ultimaRecepcion = candidatos.map((c) => c.fechaRecepcion).sort().at(-1)
  // Mientras la historia llega, o si falló, «contactados» es desconocido (E-05).
  const embudo = embudoDe(candidatos, historia?.ok ? historia.datos : null)
  const falloHistoria = historia !== null && !historia.ok ? historia.error : null

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="kicker">Estrategia · creadores</p>
        <h1 className="font-display text-3xl leading-none text-texto">Bola de nieve</h1>
        <p className="mt-1 text-sm text-tenue">
          Solo lectura. Lo sube el radar de casa; la firma de contactos llega en la siguiente fase.
          {ultimaRecepcion ? ` Último dato recibido: ${new Date(ultimaRecepcion).toLocaleString('es-CO')}.` : ''}
        </p>
      </header>

      <nav aria-label="Embudo" className="flex flex-wrap gap-2">
        {grupos
          .filter((g) => g.candidatos.length > 0)
          .map((g) => (
            <a key={g.carril} href={`#carril-${g.carril}`} className="rounded-full border border-linea px-3 py-1 text-xs text-texto">
              {NOMBRE_CARRIL[g.carril]} · {g.candidatos.length}
            </a>
          ))}
      </nav>

      {candidatos.length === 0 ? (
        <p className="text-sm text-tenue">Todavía no hay creadores en el tablero.</p>
      ) : (
        <CabeceraEmbudo embudo={embudo} falloHistoria={falloHistoria} onReintentarHistoria={reintentarHistoria} />
      )}

      {orden
        .filter((g) => g.candidatos.length > 0)
        .map((g) => (
          <section
            key={g.carril}
            id={`carril-${g.carril}`}
            aria-labelledby={`titulo-${g.carril}`}
            // «Por decidir» va primero y en rojo (maqueta): es donde hace falta criterio humano.
            className={g.carril === 'tambaleando' ? 'rounded-tarjeta border border-rojo bg-surface-1 p-4' : undefined}
          >
            {g.carril === 'tambaleando' && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">
                Por decidir · escúchalos con sonido
              </p>
            )}
            <h2 id={`titulo-${g.carril}`} className="mb-2 font-display text-lg text-texto">
              {NOMBRE_CARRIL[g.carril]} <span className="text-sm text-tenue">({g.candidatos.length})</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {g.candidatos.map((c) => (
                <TarjetaCandidato key={c.creadorId} candidato={c} />
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
