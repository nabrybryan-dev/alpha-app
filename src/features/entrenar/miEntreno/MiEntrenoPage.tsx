import { Link, Navigate } from 'react-router-dom'
import { useSesion } from '../../../app/SessionProvider'
import { Cifra3D } from '../../../components/ui/Cifra3D'
import { EmptyState } from '../../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../../data/dbInstance'
import { datosRutaDe } from '../../../data/ruta/datosRuta'
import { separarNotas } from '../../../domain/notasDeLaSemana'
import { textoDeObjetivo } from '../../../domain/objetivoDeIntensidad'
import { armarSemana, sesionDestacada, type DiaRuta } from '../../../domain/rutaEntrenamiento'
import type { Sesion } from '../../../domain/types'
import { BuzonComentarios } from './BuzonComentarios'

/**
 * «Mi entreno», el espacio de entrenamiento del staff que también entrena (Manuela;
 * maqueta «Espacios de Alpha», aprobada por Bryan el 28-sep).
 *
 * No sustituye al salón: lo PRESENTA. Arriba la semana en siete casillas (hecha, por hacer,
 * hoy) salida del MISMO `armarSemana` que usan Hoy y el salón, para que las tres pantallas
 * digan lo mismo; luego la sesión que toca con sus ejercicios, series y RIR tal como están
 * prescritos; la tarjeta grande que entra al salón a pantalla completa (/entrenar, que no se
 * toca), y su progreso de fuerza si la app ya lo puede calcular.
 *
 * Cierra con el buzón de comentarios sobre la app (0095): enviar y ver el estado de los míos.
 */

/** «PIERNA (LUNES)» → «PIE»: la etiqueta corta de la casilla, como en la maqueta. */
function etiquetaCorta(titulo: string): string {
  const palabra = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().match(/[A-Z0-9]+/)
  return palabra ? palabra[0].slice(0, 3) : '—'
}

const ESTADO_LEIDO: Record<DiaRuta['estado'], string> = {
  completada: 'hecha',
  hoy: 'hoy',
  programada: 'por hacer',
  descanso: 'descanso',
}

function CasillaDia({ dia }: { dia: DiaRuta }) {
  const base = 'flex h-11 items-center justify-center rounded-[10px] text-[11px] font-extrabold'
  const estilo =
    dia.estado === 'completada'
      ? 'bg-texto text-bg'
      : dia.estado === 'hoy'
        ? 'border border-rojo text-rojo'
        : dia.estado === 'programada'
          ? 'border border-texto text-texto'
          : 'border border-linea font-semibold text-tenue'
  const texto = dia.sesionId ? etiquetaCorta(dia.titulo) : '—'
  const leido = `${dia.abreviatura} ${dia.numero}: ${dia.sesionId ? `${dia.titulo}, ${ESTADO_LEIDO[dia.estado]}` : 'descanso'}`

  return (
    <li className="flex min-w-0 flex-col gap-1 text-center">
      <span className="text-[11px] text-tenue" aria-hidden="true">
        {dia.abreviatura.charAt(0)}
      </span>
      {dia.sesionId ? (
        <Link to={`/entrenar/sesion/${dia.sesionId}`} aria-label={leido} className={`press ${base} ${estilo}`}>
          {texto}
        </Link>
      ) : (
        <span aria-label={leido} className={`${base} ${estilo}`}>
          {texto}
        </span>
      )}
    </li>
  )
}

function Barra({ pct }: { pct: number }) {
  const seguro = Math.max(0, Math.min(100, Math.round(pct)))
  return (
    <div className="h-1.5 rounded-full bg-surface-2" aria-hidden="true">
      {seguro > 0 && <div className="barra-espacio h-1.5 rounded-full bg-texto" style={{ width: `${seguro}%` }} />}
    </div>
  )
}

function SesionDeHoy({ sesion, esDeHoy }: { sesion: Sesion; esDeHoy: boolean }) {
  const cardio = separarNotas(sesion.bloquesCardio).marcables
  const piezas = sesion.ejercicios.length + cardio.length
  return (
    <section
      aria-label="Qué estás entrenando y cómo"
      className="entrada entrada-2 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">
          {esDeHoy ? 'Hoy' : 'Lo siguiente'} · {sesion.nombre}
        </p>
        <span className="shrink-0 text-xs font-semibold text-tenue">
          {piezas} {piezas === 1 ? 'ejercicio' : 'ejercicios'}
        </span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {cardio.map((b) => (
          <li key={b.id} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 font-semibold text-texto">{b.titulo}</span>
              {b.duracionMin !== undefined && <span className="cifras shrink-0 text-tenue">{b.duracionMin} min</span>}
            </div>
            <Barra pct={b.hechoEn ? 100 : 0} />
          </li>
        ))}
        {sesion.ejercicios.map((e) => (
          <li key={e.id} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-3 text-sm">
              <span className="min-w-0 font-semibold text-texto">{e.nombre}</span>
              <span className="cifras shrink-0 text-right text-tenue">
                {e.sets} × {e.rango || e.repsDiana} · {textoDeObjetivo(e.rirObjetivo)}
              </span>
            </div>
            <Barra pct={e.sets > 0 ? (e.series.length / e.sets) * 100 : 0} />
          </li>
        ))}
      </ul>
      {piezas === 0 && <p className="text-sm text-tenue">Esta sesión no trae ejercicios ni bloques que listar.</p>}
    </section>
  )
}

export default function MiEntrenoPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()

  // Es un espacio del staff: el asesorado sigue entrando por Entrenar, como siempre.
  if (usuario.rol !== 'nutricionista' && usuario.rol !== 'coach') return <Navigate to="/entrenar" replace />

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const semana = microciclo ? armarSemana(microciclo, hoy) : []
  const destacada = sesionDestacada(semana)
  const sesion = microciclo?.sesiones.find((s) => s.id === destacada?.sesionId)
  const fuerza = microciclo ? datosRutaDe(usuario.id, microciclo).progresoFuerza : undefined

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">
          {microciclo ? `Microciclo M${microciclo.numero} · cadencia ${microciclo.cadenciaDias} días` : 'Sin microciclo activo'}
        </p>
        <h2 className="font-display text-3xl leading-none text-texto">Mi entrenamiento</h2>
      </header>

      {microciclo ? (
        <section
          aria-label="Estructura de la semana"
          className="entrada entrada-1 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Estructura de la semana</p>
          <ol className="grid grid-cols-7 gap-1.5">
            {semana.map((d) => (
              <CasillaDia key={d.fechaIso} dia={d} />
            ))}
          </ol>
          <p className="text-xs text-tenue">Lleno = hecha · borde = por hacer · rojo = hoy</p>
        </section>
      ) : (
        <EmptyState
          titulo="Sin microciclo activo"
          detalle={
            usuario.rol === 'coach'
              ? 'Todavía no tienes un plan de entrenamiento propio cargado. Cuando lo tengas, aquí verás tu semana y lo que toca hoy.'
              : 'Cuando el coach te cargue la semana, aquí verás su estructura y lo que toca hoy.'
          }
        />
      )}

      {sesion && <SesionDeHoy sesion={sesion} esDeHoy={destacada?.esDeHoy ?? false} />}

      <section
        aria-label="El salón"
        className="entrada entrada-3 relative flex min-h-[200px] flex-col justify-end gap-2.5 overflow-hidden rounded-tarjeta border border-rojo p-4"
        style={{ background: 'radial-gradient(120% 90% at 50% 110%, #3a0606 0%, #141414 55%, #0a0a0a 100%)' }}
      >
        <svg viewBox="0 0 358 120" width="100%" height="120" aria-hidden="true" className="absolute inset-x-0 top-2" style={{ opacity: 0.55 }}>
          <g stroke="#f2f2f2" strokeWidth="1" fill="none">
            <path d="M0 118 L120 60 L238 60 L358 118" />
            <path d="M120 60 L120 4 M238 60 L238 4" />
            <path d="M40 118 L140 60 M318 118 L218 60 M90 118 L160 60 M268 118 L198 60 M179 118 L179 60" />
            <path d="M0 100 L120 52 L238 52 L358 100" strokeOpacity=".4" />
          </g>
          <rect x="160" y="30" width="38" height="6" rx="3" fill="#ff1e1e" />
          <rect x="150" y="26" width="8" height="14" rx="2" fill="#f2f2f2" />
          <rect x="200" y="26" width="8" height="14" rx="2" fill="#f2f2f2" />
        </svg>
        <div className="relative flex flex-col gap-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accion">
            El salón{sesion ? ` · ${destacada?.esDeHoy ? 'hoy' : 'lo siguiente'}: ${sesion.nombre}` : ''}
          </p>
          <p className="font-display text-2xl leading-none text-silver-100">Entra y entrena</p>
          <p className="text-[13px] leading-snug text-silver-400">
            La sesión a pantalla completa: ejercicio a ejercicio, cronómetro, series y tu RIR al terminar.
          </p>
        </div>
        <Link
          to="/entrenar"
          className="press relative flex min-h-[52px] items-center justify-center rounded-[14px] bg-accion font-display text-[15px] uppercase tracking-wide text-white"
        >
          Entrar al salón
        </Link>
      </section>

      {fuerza && (
        <section
          aria-label="Tu progreso"
          className="entrada entrada-4 flex flex-col gap-2.5 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Tu progreso · fuerza</p>
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <Cifra3D
              valor={fuerza.mejoraron}
              sufijo={`/${fuerza.comparados}`}
              tamano={48}
              etiqueta={`${fuerza.mejoraron} de ${fuerza.comparados} ejercicios subieron`}
            />
            <span className="pb-2 text-[13px] text-tenue">
              ejercicios subieron su 1RM estimado frente a M{fuerza.microcicloPrevio}
            </span>
          </div>
        </section>
      )}

      <BuzonComentarios />
    </div>
  )
}
