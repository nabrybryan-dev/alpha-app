import { useMemo, useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import type { AlimentoIndice } from '../../domain/nutricion/busqueda'

/**
 * Hoja de búsqueda del catálogo.
 *
 * NO FILTRA POR PERFIL, y es deliberado: la regla R6 separa recomendar de
 * registrar. Las sugerencias respetan alergias, creencias y gustos; el buscador
 * no. Si alguien se comió algo que su perfil desaconseja, el sistema tiene que
 * poder anotarlo — un registro que esconde lo que de verdad pasó no sirve para
 * decidir nada.
 *
 * Y por eso el estado vacío nunca es un callejón sin salida: si el alimento no
 * está, se le dice a quién pedírselo, no "no encontrado".
 */

const TOPE_RESULTADOS = 60

/** Los grupos del catálogo con el nombre que usa el asesorado, no el interno. */
const FILTROS: { etiqueta: string; grupo?: string; recientes?: boolean }[] = [
  { etiqueta: 'Recientes', recientes: true },
  { etiqueta: 'Proteína', grupo: 'proteinas' },
  { etiqueta: 'Carbos', grupo: 'carbohidratos' },
  { etiqueta: 'Grasas', grupo: 'grasas' },
  { etiqueta: 'Verduras', grupo: 'vegetales' },
  // Los tres siguientes no están en el diseño. Sin ellos, 225 alimentos -entre
  // ellos el fríjol y la lenteja, que son media cocina colombiana- solo se
  // alcanzarían escribiendo el nombre exacto.
  { etiqueta: 'Frutas', grupo: 'frutas' },
  { etiqueta: 'Lácteos', grupo: 'lacteos' },
  { etiqueta: 'Legumbres', grupo: 'leguminosas' },
]

const FUENTES: Record<string, string> = {
  tcac: 'TCAC 2018',
  usda: 'USDA',
  receta: 'Receta',
}

interface SheetBuscarAlimentoProps {
  abierto: boolean
  /** Ids de lo que ya registró antes, de lo más reciente a lo más viejo. */
  recientes?: string[]
  onCerrar: () => void
  onElegir: (alimento: AlimentoIndice) => void
}

const cifra = (valor: number | null) => (valor === null ? '—' : Math.round(valor))

/**
 * Cada apertura empieza en blanco.
 *
 * El cuerpo se desmonta al cerrar, y con el se va lo escrito. Sin esto el
 * componente se queda montado -solo el `Sheet` de dentro devuelve null- y la
 * siguiente vez que el asesorado abre el buscador se encuentra la busqueda
 * anterior todavia escrita, con sus resultados. Lo mismo que garantiza el `key`
 * de la hoja de cantidad, por la misma razon: lo que arrastra la pantalla no lo
 * escribio nadie.
 */
export function SheetBuscarAlimento(props: SheetBuscarAlimentoProps) {
  if (!props.abierto) return null
  return <CuerpoBuscar {...props} />
}

function CuerpoBuscar({
  abierto,
  recientes = [],
  onCerrar,
  onElegir,
}: SheetBuscarAlimentoProps) {
  const [consulta, setConsulta] = useState('')
  const [filtro, setFiltro] = useState(FILTROS[0].etiqueta)

  const activo = FILTROS.find((f) => f.etiqueta === filtro) ?? FILTROS[0]

  const resultados = useMemo(() => {
    if (activo.recientes && !consulta.trim()) {
      // Lo reciente no se busca, se recuerda: mantiene el orden en que se
      // registró y no el alfabético.
      return recientes
        .map((id) => catalogoRepo.porId(id))
        .filter((a): a is AlimentoIndice => a !== undefined)
        .slice(0, TOPE_RESULTADOS)
    }
    return catalogoRepo.buscar(
      consulta,
      activo.recientes ? {} : { grupo: activo.grupo },
      TOPE_RESULTADOS,
    )
  }, [consulta, activo, recientes])

  const total = catalogoRepo.total()

  return (
    <Sheet abierto={abierto} titulo="Buscar alimento" onCerrar={onCerrar}>
      <input
        type="search"
        autoFocus
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        placeholder="Busca un alimento…"
        aria-label="Nombre del alimento"
        className="w-full rounded-2xl border border-linea bg-surface-2 px-4 py-3 text-base text-texto placeholder:text-tenue focus:border-accion focus:outline-none"
      />

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.etiqueta}
            type="button"
            onClick={() => setFiltro(f.etiqueta)}
            aria-pressed={filtro === f.etiqueta}
            className={`press shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtro === f.etiqueta
                ? 'border-accion bg-accion/15 text-texto'
                : 'border-linea bg-surface-2 text-tenue'
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
        {resultados.length} de {total.toLocaleString('es-CO')} alimentos
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {resultados.map((alimento) => {
          const variantes = catalogoRepo.variantesDe(alimento)
          return (
            <button
              key={alimento.id}
              type="button"
              onClick={() => onElegir(alimento)}
              className="press flex items-center gap-3 rounded-2xl border border-linea bg-surface-2 p-3 text-left transition-colors hover:border-accion/50 active:bg-surface-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-texto">
                  {alimento.nombre}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-tenue">
                  {/* Solo cuando de verdad hay elección. En el resto sería ruido. */}
                  {variantes.length > 0 && (
                    <span className="rounded-full border border-azul/40 bg-azul/10 px-1.5 py-0.5 uppercase tracking-wide text-azul">
                      {alimento.estado}
                    </span>
                  )}
                  <span>{FUENTES[alimento.fuente] ?? alimento.fuente}</span>
                  <span className="cifras">
                    P {cifra(alimento.por100g.proteina_g)} · C {cifra(alimento.por100g.carbos_g)} ·
                    G {cifra(alimento.por100g.grasa_g)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="cifras block text-base font-bold text-texto">
                  {cifra(alimento.por100g.kcal)}
                </span>
                <span className="block text-[9px] uppercase tracking-wide text-tenue">
                  kcal/100 g
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {resultados.length === 0 && (
        <p className="mt-6 rounded-2xl border border-linea bg-surface-2 p-4 text-center text-sm leading-snug text-tenue">
          {activo.recientes && !consulta.trim() ? (
            <>
              Todavía no has registrado nada.
              <br />
              Escribe arriba para buscar en los {total.toLocaleString('es-CO')} alimentos.
            </>
          ) : (
            <>
              Sin coincidencias en el catálogo.
              <br />
              <span className="font-semibold text-texto">Pídele a tu coach que lo agregue</span> y no
              pierdas el registro.
            </>
          )}
        </p>
      )}
    </Sheet>
  )
}
