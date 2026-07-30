import { Card } from '../../components/ui/Card'
import type { ItemMarcable } from '../../domain/types'
import { CheckDibujado } from './CheckDibujado'

interface BloquesSesionProps {
  bloques: ItemMarcable[]
  /** En una metabólica los bloques SON la sesión; en fuerza son un añadido. */
  esMetabolica: boolean
  onMarcar: (bloqueId: string) => void
}

/** Bloques de cardio/metabólico que se marcan a mano, uno a uno. */
export function BloquesSesion({ bloques, esMetabolica, onMarcar }: BloquesSesionProps) {
  return (
    <Card>
      <p className="kicker">{esMetabolica ? 'Bloques de la sesión' : 'Bloques marcables'}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {bloques.map((bloque) => (
          <li key={bloque.id} className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label={bloque.hechoEn ? `Desmarcar ${bloque.titulo}` : `Marcar ${bloque.titulo}`}
              onClick={() => onMarcar(bloque.id)}
              className={`press mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold transition-colors duration-200 ease-salida ${
                bloque.hechoEn ? 'border-logrado bg-logrado text-ink-900' : 'border-hairline-fuerte text-tenue'
              }`}
            >
              {bloque.hechoEn && <CheckDibujado className="h-5 w-5" />}
            </button>
            <div className={`transition-opacity duration-200 ${bloque.hechoEn ? 'opacity-60' : ''}`}>
              <p className="text-sm font-bold text-texto">
                {bloque.titulo}
                {bloque.duracionMin ? (
                  <span className="cifras ml-1 text-xs font-normal text-tenue">· {bloque.duracionMin} min</span>
                ) : null}
              </p>
              <p className="text-xs text-tenue">{bloque.indicaciones}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
