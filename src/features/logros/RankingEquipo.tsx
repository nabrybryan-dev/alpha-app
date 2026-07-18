import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { CifraAnimada } from '../../components/ui/CifraAnimada'
import { Revelar } from '../../components/ui/Revelar'
import { db, useDbVersion } from '../../data/dbInstance'
import {
  CATEGORIAS,
  ordenarPorCategoria,
  valorDeCategoria,
  type CategoriaRanking,
  type FilaRanking,
} from '../../domain/ranking'

const UNIDAD: Record<CategoriaRanking, string> = {
  general: 'pts',
  disciplina: 'reg',
  sesiones: 'ses',
  cargas: 'series',
  progresion: 'ej',
  preguntas: 'msj',
}

function Podio({
  fila,
  puesto,
  categoria,
  propia,
}: {
  fila: FilaRanking
  puesto: 1 | 2 | 3
  categoria: CategoriaRanking
  propia: boolean
}) {
  const primero = puesto === 1
  const medalla = puesto === 1 ? 'text-ambar' : puesto === 2 ? 'text-texto/80' : 'text-rojo-osc'
  return (
    <div className={`flex flex-col items-center gap-1 ${primero ? '' : 'mt-6'}`}>
      <div
        className={`grid place-items-center rounded-full border-2 font-display ${
          primero ? 'h-16 w-16 border-ambar text-xl' : 'h-12 w-12 text-sm'
        } ${propia ? 'border-rojo text-rojo' : primero ? 'text-texto' : 'border-hairline-fuerte text-tenue'}`}
        style={primero ? { boxShadow: '0 0 24px rgba(245, 166, 35, 0.25)' } : undefined}
      >
        {fila.iniciales}
      </div>
      <p className={`cifras font-display leading-none ${medalla} ${primero ? 'text-base' : 'text-xs'}`}>
        {puesto}º
      </p>
      <p className={`max-w-20 truncate text-center ${primero ? 'text-sm font-bold text-texto' : 'text-xs text-texto/90'}`}>
        {fila.nombre.split(' ')[0]}
        {propia && <span className="ml-1 text-[9px] text-rojo">tú</span>}
      </p>
      <p className="cifras text-xs font-bold text-texto">
        <CifraAnimada valor={valorDeCategoria(fila, categoria)} duracionMs={700} />
        <span className="ml-0.5 text-[9px] font-normal text-tenue">{UNIDAD[categoria]}</span>
      </p>
    </div>
  )
}

/**
 * Ranking multi-categoría del Equipo Alpha. Cada categoría premia una virtud
 * distinta para que cada asesorado pueda brillar en la suya, con podio para
 * los tres primeros y auto-comparación para el resto. Solo muestra
 * rendimiento agregado: nunca estados de ánimo, cargas concretas ni datos
 * personales.
 */
export function RankingEquipo({ usuarioActualId }: { usuarioActualId: string }) {
  useDbVersion()
  const [categoria, setCategoria] = useState<CategoriaRanking>('general')
  const filas = ordenarPorCategoria(db.ranking.list(), categoria)
  if (filas.length < 2) return null

  const activa = CATEGORIAS.find((c) => c.id === categoria) ?? CATEGORIAS[0]
  const podio = filas.slice(0, 3)
  const resto = filas.slice(3)
  const miPuesto = filas.findIndex((f) => f.usuarioId === usuarioActualId)
  const miFila = miPuesto >= 0 ? filas[miPuesto] : undefined
  const tercerValor = podio[2] ? valorDeCategoria(podio[2], categoria) : 0
  const brecha =
    miFila && miPuesto > 2 ? tercerValor - valorDeCategoria(miFila, categoria) : 0

  return (
    <Card aria-label="Ranking del Equipo Alpha">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CATEGORIAS.map((c) => (
          <Chip
            key={c.id}
            etiqueta={c.etiqueta}
            seleccionado={categoria === c.id}
            onSeleccionar={() => setCategoria(c.id)}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-tenue">
        {activa.titulo}
      </p>

      <div key={categoria} className="entrada mt-4 flex items-start justify-center gap-5">
        {podio[1] && (
          <Podio fila={podio[1]} puesto={2} categoria={categoria} propia={podio[1].usuarioId === usuarioActualId} />
        )}
        {podio[0] && (
          <Podio fila={podio[0]} puesto={1} categoria={categoria} propia={podio[0].usuarioId === usuarioActualId} />
        )}
        {podio[2] && (
          <Podio fila={podio[2]} puesto={3} categoria={categoria} propia={podio[2].usuarioId === usuarioActualId} />
        )}
      </div>

      {miFila && miPuesto > 2 && brecha > 0 && (
        <p className="mt-3 rounded-xl border border-hairline bg-surface-2/50 px-3 py-2 text-center text-xs text-texto/90">
          Vas <span className="cifras font-bold text-rojo">{miPuesto + 1}º</span> — estás a{' '}
          <span className="cifras font-bold text-texto">{brecha}</span> {UNIDAD[categoria]} del podio 💪
        </p>
      )}

      {resto.length > 0 && (
        <div className="mt-3 flex flex-col divide-y divide-hairline border-t border-hairline">
          {resto.map((fila, i) => {
            const propia = fila.usuarioId === usuarioActualId
            return (
              <Revelar key={fila.usuarioId} retrasoMs={(i % 6) * 40}>
                <div className="flex items-center gap-3 py-2.5">
                  <p className="cifras w-5 shrink-0 text-center text-xs text-tenue">{i + 4}</p>
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                      propia ? 'border-rojo text-rojo' : 'border-hairline text-tenue'
                    }`}
                  >
                    {fila.iniciales}
                  </div>
                  <p className={`min-w-0 flex-1 truncate text-sm ${propia ? 'font-bold text-texto' : 'text-texto/90'}`}>
                    {fila.nombre}
                    {propia && <span className="ml-1.5 text-[10px] font-normal text-rojo">tú</span>}
                  </p>
                  <p className="cifras shrink-0 text-sm font-bold text-texto">
                    {valorDeCategoria(fila, categoria)}
                    <span className="ml-0.5 text-[10px] font-normal text-tenue">{UNIDAD[categoria]}</span>
                  </p>
                </div>
              </Revelar>
            )
          })}
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-tenue">
        Solo cumplimiento y rendimiento · últimos 30 días · nada personal se comparte
      </p>
    </Card>
  )
}
