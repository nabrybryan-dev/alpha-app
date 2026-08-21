import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { Sheet } from '../../components/ui/Sheet'
import { db, useDbVersion } from '../../data/dbInstance'
import type { Contenido } from '../../domain/types'
import { direccion } from '../../lib/direccionesVisuales'
import { usePausaFueraDePantalla } from '../../lib/pausaFueraDePantalla'
import { FilaContenido } from './FilaContenido'
import { TarjetaPatron } from './TarjetaPatron'
import { VisorContenido } from './VisorContenido'

/**
 * La categoría que se pinta como rejilla de patrones y no como lista.
 *
 * Se compara por el valor que trae el contenido, no por posición: si mañana se
 * añade una categoría, esto sigue eligiendo bien.
 */
const PATRONES = 'Patrones de movimiento'

export default function ContenidosPage() {
  useDbVersion()
  const marco = usePausaFueraDePantalla<HTMLDivElement>()
  const [categoria, setCategoria] = useState<string>('Todos')
  const [abierto, setAbierto] = useState<Contenido | undefined>()

  const contenidos = db.contenidos.list()
  const categorias = ['Todos', ...new Set(contenidos.map((c) => c.categoria))]
  const visibles =
    categoria === 'Todos' ? contenidos : contenidos.filter((c) => c.categoria === categoria)

  const patrones = visibles.filter((c) => c.categoria === PATRONES && c.patronMovimiento)
  const resto = visibles.filter((c) => !patrones.includes(c))

  /** Las categorías del resto, en el orden en que aparecen. */
  const gruposDelResto = [...new Set(resto.map((c) => c.categoria))]

  return (
    <div className="flex flex-col gap-5">
      {/* LA PLANCHA MONTADA.
          Contenidos es superficie CLARA y se queda clara: meter una banda oscura a
          sangre en una pantalla clara es justo lo que se leía como copiar-pegar.
          Así que la pieza no invade la pantalla — se MONTA, como una lámina impresa
          sobre una cartulina: la tarjeta de cristal es el paspartú, el filete
          interior es el canto del papel, y el margen de 16 px de la propia Card es
          lo que la separa del borde.

          D mide 84,7 de luminancia media y no admite texto en ninguna parte, así
          que NO LLEVA NINGUNO: ni título, ni duración, ni marca de agua. El texto
          va debajo de la lámina, dentro de la misma tarjeta. Es la regla dura
          resuelta por composición y no por un velo. */}
      {/* El ref va en un envoltorio y no en la Card: `Card` no reenvía `ref` y
          añadirle `forwardRef` tocaría un primitivo que usa media app. */}
      <div ref={marco}>
      <Card>
        <div
          className="relative aspect-video w-full overflow-hidden rounded-[12px] bg-ink-900"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }}
        >
          <FondoLoop
            poster={direccion('D').poster}
            video={direccion('D').video}
            preload="none"
            prioridad="auto"
            anchura={1280}
            altura={720}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <p className="kicker mt-3.5">Biblioteca Alpha</p>
        <h2 className="font-display text-3xl text-texto">Contenidos</h2>
        <p className="mt-1 text-sm text-tenue">
          Técnica por patrón de movimiento, movilidad y educación del método.
        </p>
      </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {categorias.map((cat) => (
          <Chip
            key={cat}
            etiqueta={cat}
            seleccionado={categoria === cat}
            onSeleccionar={() => setCategoria(cat)}
          />
        ))}
      </div>

      {patrones.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <p className="kicker">Patrones de movimiento</p>
            <p className="cifras text-[11px] text-tenue">{patrones.length}</p>
          </div>
          <p className="mt-1 max-w-[46ch] text-xs leading-snug text-tenue">
            El vocabulario con el que está escrita tu programación. Estos nombres son los
            que verás en tu sesión y en el foco de la semana.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {patrones.map((contenido, i) => (
              <TarjetaPatron
                key={contenido.id}
                contenido={contenido}
                numero={i + 1}
                onAbrir={() => setAbierto(contenido)}
              />
            ))}
          </div>
        </section>
      )}

      {gruposDelResto.map((grupo) => (
        <section key={grupo}>
          <p className="kicker">{grupo}</p>
          <div className="mt-2 flex flex-col gap-2.5">
            {resto
              .filter((c) => c.categoria === grupo)
              .map((contenido) => (
                <FilaContenido
                  key={contenido.id}
                  contenido={contenido}
                  onAbrir={() => setAbierto(contenido)}
                />
              ))}
          </div>
        </section>
      ))}

      <Sheet
        abierto={abierto !== undefined}
        titulo={abierto?.titulo ?? ''}
        onCerrar={() => setAbierto(undefined)}
      >
        {abierto && <VisorContenido contenido={abierto} />}
      </Sheet>
    </div>
  )
}
