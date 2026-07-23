import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { XP_POR_ACCION } from '../../domain/gamification'
import type { Contenido, PartePreparacion, TipoPreparacion } from '../../domain/types'
import { CheckDibujado } from './CheckDibujado'

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
  const [detalles, setDetalles] = useState<Set<string>>(new Set())

  const alternarDetalle = (id: string) =>
    setDetalles((prev) => {
      const copia = new Set(prev)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })

  if (partes.length === 0) return null

  return (
    <Card className={completa ? 'opacity-75' : ''}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <p className="kicker">Antes de entrenar</p>
        <span className="flex items-center gap-2">
          {completa ? (
            <Badge tono="verde">✓ +{XP_POR_ACCION.preparacion} XP</Badge>
          ) : (
            <Badge>
              {hechas}/{partes.length}
            </Badge>
          )}
          <span aria-hidden="true" className="text-tenue">
            {abierta ? '▴' : '▾'}
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
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-tenue">{titulo}</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {grupo.map((parte) => {
                    const demo = parte.contenidoDemoId ? db.contenidos.byId(parte.contenidoDemoId) : undefined
                    const detalleAbierto = detalles.has(parte.id)
                    return (
                      <li key={parte.id} className="flex items-start gap-2.5 py-0.5">
                        <button
                          type="button"
                          aria-label={parte.hechoEn ? `Desmarcar ${parte.titulo}` : `Marcar ${parte.titulo}`}
                          onClick={() => onMarcar(parte.id)}
                          className={`press mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors duration-200 ease-salida ${
                            parte.hechoEn ? 'border-logrado bg-logrado text-ink-900' : 'border-hairline-fuerte text-tenue'
                          }`}
                        >
                          {parte.hechoEn && <CheckDibujado className="h-3.5 w-3.5" />}
                        </button>
                        <div className={`min-w-0 flex-1 transition-opacity duration-200 ${parte.hechoEn ? 'opacity-60' : ''}`}>
                          <button
                            type="button"
                            onClick={() => alternarDetalle(parte.id)}
                            aria-expanded={detalleAbierto}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <p className="text-sm font-bold leading-snug text-texto">
                              {parte.titulo}
                              {parte.duracionMin ? (
                                <span className="cifras ml-1 text-xs font-normal text-tenue">· {parte.duracionMin} min</span>
                              ) : null}
                            </p>
                            <span aria-hidden="true" className="text-[10px] text-tenue">
                              {detalleAbierto ? '▴' : '▾'}
                            </span>
                          </button>
                          {detalleAbierto && (
                            <div className="entrada">
                              <p className="mt-1 text-xs leading-snug text-tenue">{parte.indicaciones}</p>
                              {demo && (
                                <button
                                  type="button"
                                  onClick={() => onVerDemo(demo)}
                                  className="press mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-azul"
                                >
                                  🎬 Técnica
                                </button>
                              )}
                            </div>
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
