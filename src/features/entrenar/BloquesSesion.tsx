import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import type { BloqueCardio, RegistroCardioEjecutado } from '../../domain/types'
import { separarNotas } from '../../domain/notasDeLaSemana'
import { ritmoLegible, velocidadKmH } from '../../domain/registroCardio'
import { CheckDibujado } from './CheckDibujado'
import { NotasDeLaSemana } from './NotasDeLaSemana'

interface BloquesSesionProps {
  bloques: BloqueCardio[]
  /** En una metabólica los bloques SON la sesión; en fuerza son un añadido. */
  esMetabolica: boolean
  onMarcar: (bloqueId: string) => void
  /** Ausente en pantallas que solo pintan (p. ej. una vista de solo lectura del coach):
   *  sin este callback, el bloque se marca pero no se puede anotar su ejecución. */
  onRegistrar?: (bloqueId: string, registro: RegistroCardioEjecutado) => void
}

function numeroDe(texto: string): number | undefined {
  if (texto.trim() === '') return undefined
  const valor = Number.parseFloat(texto.replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 ? valor : undefined
}

/**
 * Duración real, distancia y FC media de un bloque de cardio, una vez marcado.
 *
 * Los tres son opcionales y ritmo/velocidad no se piden: se derivan de duración y
 * distancia (`domain/registroCardio.ts`) y se enseñan solos en cuanto hay las dos.
 */
function RegistroDeCardio({
  bloque,
  onRegistrar,
}: {
  bloque: BloqueCardio
  onRegistrar: (registro: RegistroCardioEjecutado) => void
}) {
  const [duracion, setDuracion] = useState(bloque.duracionRealMin?.toString() ?? '')
  const [distancia, setDistancia] = useState(bloque.distanciaKm?.toString() ?? '')
  const [fc, setFc] = useState(bloque.fcMedia?.toString() ?? '')

  const guardar = () => {
    onRegistrar({
      duracionRealMin: numeroDe(duracion),
      distanciaKm: numeroDe(distancia),
      fcMedia: numeroDe(fc),
    })
  }

  const derivado = { duracionRealMin: numeroDe(duracion), distanciaKm: numeroDe(distancia) }
  const ritmo = ritmoLegible(derivado)
  const velocidad = velocidadKmH(derivado)

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[11px] text-tenue">
          Duración
          <input
            inputMode="decimal"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            onBlur={guardar}
            aria-label={`Duración real de ${bloque.titulo} (min)`}
            placeholder="min"
            className="w-14 rounded-md border border-hairline bg-surface-2 px-1.5 py-1 text-right text-xs text-texto focus:outline-none focus:border-rojo"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-tenue">
          Distancia
          <input
            inputMode="decimal"
            value={distancia}
            onChange={(e) => setDistancia(e.target.value)}
            onBlur={guardar}
            aria-label={`Distancia de ${bloque.titulo} (km)`}
            placeholder="km"
            className="w-14 rounded-md border border-hairline bg-surface-2 px-1.5 py-1 text-right text-xs text-texto focus:outline-none focus:border-rojo"
          />
        </label>
        <label className="flex items-center gap-1 text-[11px] text-tenue">
          FC media
          <input
            inputMode="decimal"
            value={fc}
            onChange={(e) => setFc(e.target.value)}
            onBlur={guardar}
            aria-label={`Frecuencia cardíaca media de ${bloque.titulo}`}
            placeholder="lpm"
            className="w-14 rounded-md border border-hairline bg-surface-2 px-1.5 py-1 text-right text-xs text-texto focus:outline-none focus:border-rojo"
          />
        </label>
      </div>
      {(ritmo || velocidad !== undefined) && (
        <p className="cifras text-[11px] text-tenue">
          {ritmo}
          {ritmo && velocidad !== undefined ? ' · ' : ''}
          {velocidad !== undefined ? `${velocidad} km/h` : ''}
        </p>
      )}
    </div>
  )
}

/** Bloques de cardio/metabólico que se marcan a mano, uno a uno. */
export function BloquesSesion({ bloques, esMetabolica, onMarcar, onRegistrar }: BloquesSesionProps) {
  // Las notas de la semana no son tareas: no llevan casilla y van aparte.
  const { notas, marcables } = separarNotas(bloques)

  return (
    <div className="flex flex-col gap-3">
      <NotasDeLaSemana notas={notas} />
      {marcables.length > 0 && (
    <Card>
      <p className="kicker">{esMetabolica ? 'Bloques de la sesión' : 'Bloques marcables'}</p>
      {/* La escena va en el `<ul>` y el `preserve-3d` en cada `<li>`, porque
          `perspective` solo alcanza a los HIJOS DIRECTOS: sin ese eslabón el
          `translateZ` de la casilla no produce escorzo —solo una capa de
          composición— y el relieve costaría sin verse. */}
      <ul className="escena-prof mt-2 flex flex-col gap-2">
        {marcables.map((bloque) => (
          <li key={bloque.id} className="flex flex-col gap-2 [transform-style:preserve-3d]">
            <div className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label={bloque.hechoEn ? `Desmarcar ${bloque.titulo}` : `Marcar ${bloque.titulo}`}
              onClick={() => onMarcar(bloque.id)}
              // `tecla-3d` SUSTITUYE a `press` —las dos escriben `transform`— y
              // también a `transition-colors`, que ya lleva dentro. La casilla sube a
              // relieve y baja al PLANO al pulsar, nunca por debajo: hundir encoge, y
              // una diana ya justa de tamaño no puede permitírselo.
              className={`tecla-3d mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold ${
                bloque.hechoEn ? 'border-logrado bg-logrado text-ink-900' : 'border-hairline-fuerte text-tenue'
              }`}
            >
              {bloque.hechoEn && <CheckDibujado className="h-5 w-5" />}
            </button>
            <div className={`transition-opacity duration-toque ease-salida ${bloque.hechoEn ? 'opacity-60' : ''}`}>
              <p className="text-sm font-bold text-texto">
                {bloque.titulo}
                {bloque.duracionMin ? (
                  <span className="cifras ml-1 text-xs font-normal text-tenue">· {bloque.duracionMin} min</span>
                ) : null}
              </p>
              <p className="text-xs text-tenue">{bloque.indicaciones}</p>
            </div>
            </div>
            {/* El registro de ejecución solo aparece una vez marcado el bloque: antes de
                eso no hay nada que anotar, y una asesorada podría llenar los campos y
                nunca marcarlo, dejando un registro huérfano sin `hechoEn`. */}
            {bloque.hechoEn && onRegistrar && (
              <RegistroDeCardio bloque={bloque} onRegistrar={(registro) => onRegistrar(bloque.id, registro)} />
            )}
          </li>
        ))}
      </ul>
    </Card>
      )}
    </div>
  )
}
