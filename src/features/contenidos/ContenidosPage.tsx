import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import type { Contenido } from '../../domain/types'
import { VisorContenido } from './VisorContenido'

const iconos = { video: '🎬', imagen: '🖼', articulo: '📄' } as const

export default function ContenidosPage() {
  useDbVersion()
  const [categoria, setCategoria] = useState<string>('Todos')
  const [abierto, setAbierto] = useState<Contenido | undefined>()

  const contenidos = db.contenidos.list()
  const categorias = ['Todos', ...new Set(contenidos.map((c) => c.categoria))]
  const visibles =
    categoria === 'Todos' ? contenidos : contenidos.filter((c) => c.categoria === categoria)

  return (
    <div className="flex flex-col gap-4">
      <section>
        <p className="kicker">Biblioteca Alpha</p>
        <h2 className="font-display text-3xl text-texto">Contenidos</h2>
        <p className="mt-1 text-sm text-tenue">
          Técnica por patrón de movimiento, movilidad y educación del método.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {categorias.map((cat) => (
          <Chip key={cat} etiqueta={cat} seleccionado={categoria === cat} onSeleccionar={() => setCategoria(cat)} />
        ))}
      </div>

      <section className="grid grid-cols-1 gap-2.5">
        {visibles.map((contenido) => (
          <button key={contenido.id} type="button" onClick={() => setAbierto(contenido)} className="text-left">
            <Card className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface-3 text-xl" aria-hidden="true">
                {iconos[contenido.tipo]}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base text-texto">{contenido.titulo}</h3>
                <p className="mt-0.5 line-clamp-2 text-xs text-tenue">{contenido.descripcion}</p>
                {contenido.patronMovimiento && (
                  <div className="mt-1.5">
                    <Badge tono="rojo">{contenido.patronMovimiento}</Badge>
                  </div>
                )}
              </div>
            </Card>
          </button>
        ))}
      </section>

      <Sheet abierto={abierto !== undefined} titulo={abierto?.titulo ?? ''} onCerrar={() => setAbierto(undefined)}>
        {abierto && <VisorContenido contenido={abierto} />}
      </Sheet>
    </div>
  )
}
