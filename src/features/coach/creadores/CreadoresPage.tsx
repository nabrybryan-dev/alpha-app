import { useEffect, useState } from 'react'
import {
  NOMBRE_CARRIL,
  candidatosDelTablero,
  mediaDimension,
  porCarril,
  revisionesDe,
  urlHojaCuadros,
  type Candidato,
  type Carril,
  type RevisionReel,
} from '../../../data/consola/creadores'

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

function DetalleRevisiones({ creadorId }: { creadorId: string }) {
  const [revisiones, setRevisiones] = useState<RevisionReel[] | null>(null)
  useEffect(() => {
    let vivo = true
    void revisionesDe(creadorId).then((r) => {
      if (vivo) setRevisiones(r)
    })
    return () => {
      vivo = false
    }
  }, [creadorId])

  if (revisiones === null) return <p className="text-xs text-tenue" aria-busy="true">Cargando revisiones…</p>
  if (revisiones.length === 0) return <p className="text-xs text-tenue">Sin revisión de video todavía.</p>

  const revisores = [...new Set(revisiones.map((r) => r.revisor))]
  const reels = [...new Set(revisiones.map((r) => r.rolReel))].sort()

  return (
    <div className="mt-3 flex flex-col gap-3">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Medias por revisor</caption>
        <thead>
          <tr className="text-tenue">
            <th scope="col" className="py-1 pr-2">Revisor</th>
            {DIMENSIONES.map((d) => (
              <th key={d} scope="col" className="py-1 pr-2">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {revisores.map((rev) => {
            const suyas = revisiones.filter((r) => r.revisor === rev)
            return (
              <tr key={rev} className="border-t border-linea text-texto">
                <th scope="row" className="py-1 pr-2 font-bold capitalize">{rev}</th>
                {DIMENSIONES.map((d) => {
                  const m = mediaDimension(suyas, d)
                  const bajo = m !== null && d !== 'CTA' && m < 2
                  return (
                    <td key={d} className={`py-1 pr-2 ${bajo ? 'font-bold text-rojo' : ''}`}>
                      {m === null ? '—' : m.toLocaleString('es-CO')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {reels.map((rol) => {
        const delReel = revisiones.filter((r) => r.rolReel === rol)
        const primero = delReel[0]
        return (
          <details key={rol} className="rounded-md border border-linea p-2">
            <summary className="cursor-pointer text-xs font-bold text-texto">
              {rol.replace('_', ' ')}
              {primero?.descripcion ? ` · ${primero.descripcion}` : ''}
            </summary>
            {primero?.permalink && (
              <a href={primero.permalink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">
                Ver el reel con sonido
              </a>
            )}
            <ul className="mt-1 text-xs text-tenue">
              {delReel.map((r) => (
                <li key={r.id}>
                  <span className="capitalize">{r.revisor}</span>:{' '}
                  {DIMENSIONES.map((d) => `${d} ${r.notas[d] ?? 'pendiente'}`).join(' · ')}
                  {r.sinAudio ? ' · sin audio' : ''}
                </li>
              ))}
            </ul>
            <HojaCuadros ruta={primero?.hojaCuadros ?? null} />
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
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null)

  useEffect(() => {
    let vivo = true
    void candidatosDelTablero().then((c) => {
      if (vivo) setCandidatos(c)
    })
    return () => {
      vivo = false
    }
  }, [])

  if (candidatos === null) {
    return <p className="text-sm text-tenue" aria-busy="true">Cargando el tablero de creadores…</p>
  }

  const grupos = porCarril(candidatos)
  const orden = [
    ...grupos.filter((g) => PRIMERO.includes(g.carril)),
    ...grupos.filter((g) => !PRIMERO.includes(g.carril) && g.carril !== 'entrenador'),
    ...grupos.filter((g) => g.carril === 'entrenador'),
  ]
  const ultimaRecepcion = candidatos.map((c) => c.fechaRecepcion).sort().at(-1)

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="kicker">Bola de nieve</p>
        <h1 className="font-display text-2xl text-texto">Creadores</h1>
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

      {candidatos.length === 0 && (
        <p className="text-sm text-tenue">Todavía no hay creadores en el tablero.</p>
      )}

      {orden
        .filter((g) => g.candidatos.length > 0)
        .map((g) => (
          <section key={g.carril} id={`carril-${g.carril}`} aria-labelledby={`titulo-${g.carril}`}>
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
