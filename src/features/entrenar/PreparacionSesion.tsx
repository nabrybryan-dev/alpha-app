import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido, PartePreparacion, TipoPreparacion } from '../../domain/types'

const GRUPOS: { tipo: TipoPreparacion; titulo: string }[] = [
  { tipo: 'calentamiento', titulo: 'Calentamiento' },
  { tipo: 'movilidad', titulo: 'Movilidad y activación' },
]

interface Props {
  partes: PartePreparacion[]
  onMarcar: (parteId: string) => void
  onVerDemo: (contenido: Contenido) => void
}

export function PreparacionSesion({ partes, onMarcar, onVerDemo }: Props) {
  const hechas = partes.filter((p) => p.hechoEn).length
  const completa = partes.length > 0 && hechas === partes.length
  const [abierta, setAbierta] = useState(!completa)

  if (partes.length === 0) return null

  return (
    <Card className={completa ? 'opacity-75' : ''}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <div>
          <p className="kicker">Antes de entrenar</p>
          <p className="mt-0.5 text-xs text-tenue">
            Sube temperatura, lubrica articulaciones, activa. Nadie entrena en frío.
          </p>
        </div>
        <span className="flex items-center gap-2">
          {completa ? (
            <Badge tono="verde">✓ +{XP_POR_ACCION.preparacion} XP</Badge>
          ) : (
            <Badge>
              {hechas}/{partes.length}
            </Badge>
          )}
          <span aria-hidden="true" className="text-tenue">
            {abierta ? '▲' : '▼'}
          </span>
        </span>
      </button>

      {abierta && (
        <div className="mt-3 flex flex-col gap-3">
          {GRUPOS.map(({ tipo, titulo }) => {
            const grupo = partes.filter((p) => p.tipo === tipo)
            if (grupo.length === 0) return null
            return (
              <div key={tipo}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-tenue">{titulo}</p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {grupo.map((parte) => {
                    const demo = parte.contenidoDemoId ? db.contenidos.byId(parte.contenidoDemoId) : undefined
                    return (
                      <li key={parte.id} className="flex items-start gap-2.5">
                        <button
                          type="button"
                          aria-label={parte.hechoEn ? `Desmarcar ${parte.titulo}` : `Marcar ${parte.titulo}`}
                          onClick={() => onMarcar(parte.id)}
                          className={`press mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-sm font-bold transition-colors duration-200 ease-salida ${
                            parte.hechoEn ? 'border-verde bg-verde text-white' : 'border-hairline-fuerte text-tenue'
                          }`}
                        >
                          ✓
                        </button>
                        <div className={parte.hechoEn ? 'opacity-60' : ''}>
                          <p className="text-sm font-bold text-texto">
                            {parte.titulo}
                            {parte.duracionMin ? (
                              <span className="ml-1 text-xs font-normal text-tenue">· {parte.duracionMin} min</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-tenue">{parte.indicaciones}</p>
                          {demo && (
                            <button
                              type="button"
                              onClick={() => onVerDemo(demo)}
                              className="mt-0.5 text-xs font-bold text-azul"
                            >
                              🎬 Ver técnica
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
