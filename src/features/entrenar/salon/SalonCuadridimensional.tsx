import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { patronDeCategoria } from '../../../domain/patrones/catalogo'
import { textoDeObjetivo } from '../../../domain/objetivoDeIntensidad'
import { personalizarBiomecanica } from '../../../domain/biomecanica/personalizacion'
import type { EjercicioPrescrito, PerfilAntropometrico, Sesion } from '../../../domain/types'
import { db } from '../../../data/dbInstance'
import { CronometroSesion } from '../CronometroSesion'
import {
  EncuestaPalancas,
} from '../antropometria/EncuestaPalancas'
import { capaTrasArrastre } from '../capas/gestoVertical'
import { NIVEL_POR_W } from '../capas/nivelesAnatomicos'
import { VisorPatron } from '../visor/VisorPatron'
import { CAPAS_W, type NivelW } from './huecos'
import { PanelPrescripcion } from './instrumentacion/PanelPrescripcion'
import { ArquitecturaSala } from './sala/ArquitecturaSala'

export type EstadoSalon = 'listo' | 'cargando' | 'error'

interface SalonCuadridimensionalProps {
  usuarioId: string
  microcicloNumero: number
  sesion: Sesion
  ejercicio?: EjercicioPrescrito
  indiceEjercicio: number
  totalEjercicios: number
  estado?: EstadoSalon
  detalleError?: string
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

/**
 * Ajuste visual conservador mientras el perfil viaja al rig individualizado.
 * No cambia la prescripción ni la cinemática: sólo evita que dos perfiles se
 * presenten como la misma silueta durante la carga del motor personalizado.
 */
function escalaDelPerfil(perfil: PerfilAntropometrico | null): CSSProperties {
  if (!perfil) return {}
  const alto = (perfil.tibiaPeroneCm + perfil.femurCm + perfil.torsoCm) / (42 + 46 + 52)
  // Los perímetros no son longitudes de palanca y no escalan segmentos.
  const ancho = perfil.anchoClavicularCm / 40
  return {
    '--escala-sujeto-x': limitar(ancho, 0.9, 1.1),
    '--escala-sujeto-y': limitar(alto, 0.9, 1.1),
  } as CSSProperties
}

function velocidadUltima(ejercicio: EjercicioPrescrito): string {
  const medida = [...ejercicio.series].reverse().find((serie) => serie.velocidad)?.velocidad
  if (medida) return `−${Math.round(medida.pvPct)} %`
  if (ejercicio.pvObjetivo !== undefined) return `objetivo −${ejercicio.pvObjetivo} %`
  return 'manda el RIR'
}

const VISOR_A_SANGRE = [
  'absolute inset-0 origin-center',
  '[transform:scale(var(--escala-sujeto-x,1),var(--escala-sujeto-y,1))]',
  '[&>div]:relative [&>div]:h-full [&>div]:gap-0',
  '[&>div>div:first-child]:h-full [&>div>div:first-child]:rounded-none',
  '[&_canvas]:h-full [&_canvas]:max-h-none [&_canvas]:min-h-0',
  '[&>div>div:nth-child(2)]:absolute [&>div>div:nth-child(2)]:inset-x-3',
  '[&>div>div:nth-child(2)]:bottom-[6.25rem] [&>div>div:nth-child(2)]:z-20',
  '[&>div>div:nth-child(2)]:rounded-xl [&>div>div:nth-child(2)]:border',
  '[&>div>div:nth-child(2)]:border-white/10 [&>div>div:nth-child(2)]:bg-black/65',
  '[&>div>div:nth-child(2)]:p-2',
  '[&_p.bottom-2]:hidden',
].join(' ')

function CargandoSalon() {
  return (
    <div className="absolute inset-0 grid place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="h-20 w-12 animate-pulse rounded-[50%] border border-accion/50 bg-accion/10" />
        <p className="cifras text-[10px] font-bold uppercase tracking-[0.18em] text-silver-300">
          Preparando sujeto anatómico
        </p>
      </div>
    </div>
  )
}

function EstadoCentral({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="absolute inset-x-[18%] top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/55 p-5 text-center">
      <p className="font-display text-lg text-white">{titulo}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-silver-300">{detalle}</p>
    </div>
  )
}

export function SalonCuadridimensional({
  usuarioId,
  microcicloNumero,
  sesion,
  ejercicio,
  indiceEjercicio,
  totalEjercicios,
  estado = 'listo',
  detalleError,
}: SalonCuadridimensionalProps) {
  const [w, setW] = useState<NivelW>(1)
  const [perfil, setPerfil] = useState<PerfilAntropometrico | null>(() =>
    db.antropometria.byUsuario(usuarioId) ?? null,
  )
  const [encuestaAbierta, setEncuestaAbierta] = useState(() => !db.antropometria.byUsuario(usuarioId))
  const patron = useMemo(
    () => (ejercicio ? patronDeCategoria(ejercicio.categoria, ejercicio.nombre) : undefined),
    [ejercicio],
  )
  const personalizacion = useMemo(
    () => (perfil && ejercicio ? personalizarBiomecanica(ejercicio.categoria, ejercicio.nombre, perfil) : null),
    [ejercicio, perfil],
  )
  const gesto = useRef({ vivo: false, x: 0, y: 0, capa: w })
  const nivel = NIVEL_POR_W[w]

  const alBajar = (evento: ReactPointerEvent<HTMLDivElement>) => {
    gesto.current = { vivo: true, x: evento.clientX, y: evento.clientY, capa: w }
  }
  const alMover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    const actual = gesto.current
    if (!actual.vivo) return
    const dx = evento.clientX - actual.x
    const dy = evento.clientY - actual.y
    if (Math.abs(dx) > Math.abs(dy)) {
      actual.vivo = false
      return
    }
    const siguiente = capaTrasArrastre(dy, actual.capa)
    if (siguiente === actual.capa) return
    actual.x = evento.clientX
    actual.y = evento.clientY
    actual.capa = siguiente
    setW(siguiente)
  }
  const terminarGesto = () => {
    gesto.current.vivo = false
  }

  return (
    <div className="mx-auto w-full max-w-[430px] xl:max-w-[460px]">
      <div
        data-salon="cuadridimensional"
        data-w={w}
        className="relative isolate aspect-[9/16] max-h-[82dvh] w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-ink-1000 shadow-2xl"
        style={escalaDelPerfil(perfil)}
      >
        <div
          data-hueco="centro"
          className="absolute inset-0"
          onPointerDown={patron ? alBajar : undefined}
          onPointerMove={patron ? alMover : undefined}
          onPointerUp={patron ? terminarGesto : undefined}
          onPointerCancel={patron ? terminarGesto : undefined}
        >
          {estado === 'cargando' && <CargandoSalon />}
          {estado === 'error' && (
            <EstadoCentral
              titulo="El sujeto no pudo cargar"
              detalle={detalleError ?? 'La prescripción sigue disponible debajo del salón. Inténtalo de nuevo.'}
            />
          )}
          {estado === 'listo' && patron && ejercicio && (
            <div data-testigo="sujeto" className={VISOR_A_SANGRE}>
              <VisorPatron
                patron={patron}
                w={w}
                datos={{
                  series: ejercicio.sets,
                  reps: ejercicio.repsDiana,
                  rir: ejercicio.rirObjetivo,
                }}
              />
            </div>
          )}
          {estado === 'listo' && !ejercicio && (
            <EstadoCentral
              titulo="Sala en pausa"
              detalle="Esta sesión no tiene un ejercicio de fuerza pendiente. El espacio queda disponible para el bloque prescrito."
            />
          )}
          {estado === 'listo' && ejercicio && !patron && (
            <EstadoCentral
              titulo="Movimiento sin sujeto disponible"
              detalle="El ejercicio y su prescripción se conservan. Este patrón todavía no tiene representación anatómica."
            />
          )}
          <ArquitecturaSala variante={patron ? 'conSujeto' : 'salaVacia'} />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="max-w-[62%] rounded-lg border border-white/10 bg-black/45 px-2.5 py-2">
              <p className="cifras text-[9px] font-bold uppercase tracking-[0.14em] text-accion">
                M{microcicloNumero} · Ejercicio {indiceEjercicio + 1}/{totalEjercicios}
              </p>
              <p className="mt-0.5 truncate font-display text-sm text-white">
                {ejercicio?.nombre ?? sesion.nombre}
              </p>
            </div>
            <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 text-right">
              <p className="mb-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-silver-400">Tiempo</p>
              <CronometroSesion sesionId={sesion.id} />
            </div>
          </div>
        </div>

        {ejercicio && (
          <>
            <div className="pointer-events-none absolute left-2 top-[22%] z-10 w-[29%] [perspective:620px]">
              <div className="[transform:rotateY(12deg)] [transform-origin:left_center]">
                <PanelPrescripcion
                  tecnica={ejercicio.cues}
                  series={ejercicio.sets}
                  repeticiones={ejercicio.rango}
                  velocidadUltima={velocidadUltima(ejercicio)}
                  descanso={`${ejercicio.descansoMin} min`}
                />
              </div>
            </div>
            <div className="pointer-events-none absolute right-2 top-[22%] z-10 w-[29%] [perspective:620px]">
              <div className="space-y-1.5 text-right [transform:rotateY(-12deg)] [transform-origin:right_center]">
                <DatoPared rotulo="RIR" valor={textoDeObjetivo(ejercicio.rirObjetivo).replace('RIR ', '')} />
                <DatoPared rotulo="Velocidad" valor={velocidadUltima(ejercicio)} />
                <DatoPared rotulo="Serie" valor={`${ejercicio.series.length + 1}/${ejercicio.sets}`} />
              </div>
            </div>
          </>
        )}

        {patron && (
          <div
            className="absolute right-1.5 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1"
            role="group"
            aria-label="Capas internas del cuerpo"
          >
            {CAPAS_W.map((capa) => (
              <button
                key={capa.id}
                type="button"
                aria-label={capa.nombre}
                aria-pressed={w === capa.w}
                onClick={() => setW(capa.w)}
                className={`press grid h-9 w-9 place-items-center rounded-full border ${
                  w === capa.w
                    ? 'border-accion bg-accion/25 text-white'
                    : 'border-white/15 bg-black/45 text-silver-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${w === capa.w ? 'bg-accion' : 'bg-current'}`} />
              </button>
            ))}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pb-3 pt-12">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-accion">Capa W{w}</p>
              <p className="truncate text-xs font-bold text-white">{nivel.nombre}</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-silver-400">{nivel.resumen}</p>
              {personalizacion?.aplicaciones.find((aplicacion) => aplicacion.aplica) && (
                <p className="mt-1 line-clamp-1 text-[8px] font-semibold text-silver-300">
                  Palancas · {personalizacion.aplicaciones.find((aplicacion) => aplicacion.aplica)?.lectura}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEncuestaAbierta(true)}
              className="press pointer-events-auto min-h-11 shrink-0 rounded-full border border-white/15 bg-white/5 px-3 text-[9px] font-bold uppercase tracking-wide text-white"
            >
              Mis 8 medidas
            </button>
          </div>
        </div>

        <EncuestaPalancas
          key={encuestaAbierta ? 'abierta' : 'cerrada'}
          perfil={perfil}
          abierta={encuestaAbierta}
          onCerrar={() => setEncuestaAbierta(false)}
          onGuardar={(siguiente) => {
            setPerfil(db.antropometria.guardar(usuarioId, siguiente))
            setEncuestaAbierta(false)
          }}
        />
      </div>
    </div>
  )
}
