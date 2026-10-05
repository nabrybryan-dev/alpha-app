import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FALTA_SECCION,
  PALABRA_SEMAFORO,
  filasQueRequierenAccion,
  nombreDueno,
  semaforoDe,
  textoCifra,
  type FilaDetalle,
  type Grafico,
  type SeccionLeida,
  type Semaforo,
} from '../../../domain/adminTablero'
import { CLASE_ETIQUETA } from '../../plan/comun'

export interface EnlaceSeccion {
  a: string
  texto: string
}

const COLOR_PUNTO: Record<Semaforo, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-ambar',
  rojo: 'bg-rojo',
  gris: 'border border-tenue bg-surface-3',
}
const COLOR_TEXTO: Record<Semaforo, string> = {
  verde: 'text-texto',
  amarillo: 'text-ambar',
  rojo: 'text-rojo',
  gris: 'text-tenue',
}

/** El semáforo dicho con color Y con palabra: nunca solo color. */
export function Semaforito({ semaforo }: { semaforo: Semaforo }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] ${COLOR_TEXTO[semaforo]}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${COLOR_PUNTO[semaforo]}`} />
      {PALABRA_SEMAFORO[semaforo]}
    </span>
  )
}

function CifraTexto({ cifra, grande = false }: { cifra: string; grande?: boolean }) {
  const { texto, falta } = textoCifra(cifra)
  return (
    <span className={`cifras font-bold ${grande ? 'text-xl' : 'text-sm'} ${falta ? 'text-tenue' : 'text-texto'}`}>{texto}</span>
  )
}

/** Gráfico simple: barras proporcionales o flujo (pasos con flecha). Sin serie no se dibuja nada. */
function GraficoSimple({ grafico }: { grafico: Grafico }) {
  if (grafico.series.length === 0) return null
  if (grafico.tipo === 'flujo') {
    return (
      <ol aria-label="Flujo" className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {grafico.series.map((p, i) => (
          <li key={`${p.etiqueta}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true" className="text-tenue">→</span>}
            <span className="rounded-full border border-linea bg-surface-2 px-2.5 py-1">
              <span className="text-tenue">{p.etiqueta}</span> <span className="cifras font-bold text-texto">{p.valor.toLocaleString('es-CO')}</span>
            </span>
          </li>
        ))}
      </ol>
    )
  }
  const maximo = Math.max(...grafico.series.map((p) => Math.abs(p.valor)), 0)
  return (
    <ul aria-label="Barras" className="flex flex-col gap-2">
      {grafico.series.map((p, i) => {
        const pct = maximo > 0 ? (Math.abs(p.valor) / maximo) * 100 : 0
        return (
          <li key={`${p.etiqueta}-${i}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[13px]">
            <span className="truncate text-texto">{p.etiqueta}</span>
            <div className="h-2.5 rounded-full bg-surface-2" aria-hidden="true">
              {pct > 0 && <div className="barra-espacio h-2.5 rounded-full bg-texto" style={{ width: `${pct}%` }} />}
            </div>
            <span className="cifras text-right text-sm font-bold text-texto">{p.valor.toLocaleString('es-CO')}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Capa 3: la fuente y qué hacer, al tocar una fila. */
function FilaDeDetalle({ fila }: { fila: FilaDetalle }) {
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  const sinFuente = fila.fuente.archivo.trim() === ''
  return (
    <li className="rounded-md border border-linea bg-surface-2">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((a) => !a)}
        className="press flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-texto">{fila.titulo}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-tenue">
            <Semaforito semaforo={fila.semaforo} />
            <span>{nombreDueno(fila.dueno)}</span>
          </span>
        </span>
        <CifraTexto cifra={fila.cifra} />
      </button>
      {abierta && (
        <div id={id} className="flex flex-col gap-2 border-t border-linea px-3 py-2.5 text-[13px]">
          {textoCifra(fila.cifra).falta && (
            <p className="font-bold text-tenue">FALTA: esta cifra no está cargada. {fila.dueno ? `Le toca a ${nombreDueno(fila.dueno)}.` : 'Nadie la tiene asignada.'}</p>
          )}
          {fila.detalle && <p className="text-texto">{fila.detalle}</p>}
          <p>
            <span className={CLASE_ETIQUETA}>Qué hacer</span>
            <br />
            <span className="text-texto">{fila.queHacer || 'Nada por ahora: no hay una acción escrita para esta fila.'}</span>
          </p>
          <p className="text-[11.5px] text-tenue">
            <span className={CLASE_ETIQUETA}>Fuente</span>
            <br />
            {sinFuente ? 'FALTA: la fila no dice de qué archivo sale.' : `${fila.fuente.archivo} · corte ${fila.fuente.corte || '—'} · huella ${fila.fuente.huella || '—'}`}
          </p>
        </div>
      )}
    </li>
  )
}

export function TarjetaSeccion({
  leida,
  nombre,
  abierta,
  soloAccion,
  enlace,
  onAlternar,
}: {
  leida: SeccionLeida
  nombre: string
  abierta: boolean
  soloAccion: boolean
  enlace: EnlaceSeccion | null
  onAlternar: () => void
}) {
  const idCuerpo = useId()
  const semaforo = semaforoDe(leida)

  let frase: string
  let cifra: { texto: string; falta: boolean }
  let etiquetaCifra = ''
  if (leida.estado === 'ok') {
    const t = leida.datos.tarjeta
    frase = t.frase || 'Sin frase cargada.'
    cifra = textoCifra(t.cifra)
    etiquetaCifra = t.cifraEtiqueta
  } else if (leida.estado === 'invalida') {
    frase = 'Los datos de esta sección no se pudieron leer.'
    cifra = { texto: 'FALTA', falta: true }
  } else {
    frase = `FALTA: ${FALTA_SECCION[leida.seccion]}.`
    cifra = { texto: 'FALTA', falta: true }
  }

  return (
    <section aria-label={nombre} className="entrada rounded-tarjeta border border-linea bg-surface-1 shadow-sm">
      {/* Capa 1: título, semáforo, una frase, una cifra. */}
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={idCuerpo}
        onClick={onAlternar}
        className="press flex min-h-[64px] w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="flex min-w-0 flex-col gap-1">
          <span className={CLASE_ETIQUETA}>{nombre}</span>
          <Semaforito semaforo={semaforo} />
          <span className={`text-sm ${cifra.falta && leida.estado !== 'ok' ? 'font-bold text-tenue' : 'text-texto'}`}>{frase}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={`cifras text-xl font-bold ${cifra.falta ? 'text-tenue' : 'text-texto'}`}>{cifra.texto}</span>
          {etiquetaCifra && <span className="text-[11px] text-tenue">{etiquetaCifra}</span>}
          <span aria-hidden="true" className="text-tenue">{abierta ? '▾' : '▸'}</span>
        </span>
      </button>

      {abierta && (
        <div id={idCuerpo} className="flex flex-col gap-3 border-t border-linea p-4">
          {leida.estado === 'sin_corte' && (
            <p className="text-sm text-tenue">
              Esta sección todavía no tiene ningún corte cargado. No hay cifras que mostrar; cuando se cargue aparecerán aquí.
            </p>
          )}
          {leida.estado === 'invalida' && (
            <p role="alert" className="rounded-md border border-rojo px-3 py-2 text-sm font-bold text-rojo">
              El corte {leida.corte} llegó con datos que la app no entiende ({leida.motivo}). No se muestra a medias: hay que
              corregir la carga.
            </p>
          )}
          {leida.estado === 'ok' && (
            <>
              {leida.datos.grafico && <GraficoSimple grafico={leida.datos.grafico} />}
              {(() => {
                const filas = soloAccion ? filasQueRequierenAccion(leida.datos.filas) : leida.datos.filas
                if (leida.datos.filas.length === 0) return <p className="text-sm text-tenue">Este corte no trae filas de detalle.</p>
                if (filas.length === 0) return <p className="text-sm text-tenue">Ninguna fila de esta sección pide acción.</p>
                return (
                  <ul className="flex flex-col gap-2">
                    {filas.map((f) => (
                      <FilaDeDetalle key={f.id} fila={f} />
                    ))}
                  </ul>
                )
              })()}
              <p className="text-[11.5px] text-tenue">
                Corte {leida.corte}
                {leida.fuente ? ` · ${leida.fuente}` : ''}
                {leida.huella ? ` · huella ${leida.huella}` : ''}
              </p>
            </>
          )}
          {enlace && (
            <Link
              to={enlace.a}
              className="press inline-flex min-h-[48px] items-center justify-between gap-3 rounded-boton border border-texto px-4 text-[13px] font-bold text-texto"
            >
              <span>{enlace.texto}</span>
              <span aria-hidden="true">›</span>
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
