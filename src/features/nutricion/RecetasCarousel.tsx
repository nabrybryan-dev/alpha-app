import { useEffect, useRef, useState } from 'react'
import type { Receta } from '../../data/recetas'
import type { TipoComida } from '../../domain/types'
import { useMovimientoReducido } from '../../components/ui/movimientoReducido'
import { RecetaSheet, type RecetaRegistro } from './RecetaSheet'

/**
 * «Recetas que sí encajan»: virales de Instagram que el asesorado ya conoce y
 * que le tientan. En vez de prohibírselas, la app le dice la porción exacta que
 * sí entra en su plan de hoy. El coach hace de traductor.
 *
 * EL FEED ES EL MISMO PARA TODOS, y es una decisión de alcance, no un descuido.
 *
 * Filtrar por objetivo y alergias pide dos cosas que la Fase 1 no tiene: el listado de
 * alergias de cada asesorado y una regla escrita de qué receta encaja con qué objetivo.
 * Inventar cualquiera de las dos aquí sería peor que no filtrar — una receta escondida
 * por una alergia que nadie declaró se parece mucho a una app que sabe algo que no sabe.
 * Mientras tanto sirve el archivo en su orden, que es lo que el coach ya revisó.
 */

const COLOR_CATEGORIA: Record<Receta['categoria'], string> = {
  Postre: 'text-oro',
  Desayuno: 'text-ambar',
  Snack: 'text-accion',
  Almuerzo: 'text-azul',
  Cena: 'text-logrado',
}

export interface RecetaCocinada {
  /** Id de la COMIDA registrada. Dos veces la misma receta son dos ids. */
  id: string
  receta: Receta
  kcal: number
  /** La comida real donde cayó: la que dice el registro, no la categoría. */
  comida: TipoComida
  /** Hora del registro, para distinguir dos veces la misma receta. */
  hora: string
}

export interface RecetasCarouselProps {
  recetas: Receta[]
  /** kcal restantes del día. Sin dato la hoja cambia el texto, no lo quita. */
  kcalRestantes?: number
  /**
   * Si el contador de kcal del día está encendido. Apagado no se enseña
   * ninguna cifra de kcal en el carrusel: ni las que quedan, ni las cocinadas.
   */
  verKcal?: boolean
  /** Mientras las recetas viajan: reserva el hueco exacto, sin salto. */
  cargando?: boolean
  registro?: RecetaRegistro
  /** Recetas distintas ya cocinadas y registradas. */
  cocinadas?: number
  /** Días seguidos cocinando alguna. */
  racha?: number
  /** Las que se cocinaron HOY, tal como quedaron registradas. Van debajo. */
  cocinadasHoy?: RecetaCocinada[]
}

export function RecetasCarousel({
  recetas,
  kcalRestantes,
  verKcal = true,
  cargando,
  registro,
  cocinadas = 0,
  racha = 0,
  cocinadasHoy = [],
}: RecetasCarouselProps) {
  const [abierta, setAbierta] = useState<Receta | null>(null)
  const carrusel = useRef<HTMLDivElement>(null)
  const reducido = useMovimientoReducido()

  /**
   * El relieve del carrusel: cada tarjeta gira en Y según su distancia al
   * centro (±16°) y se aleja un poco. Solo se toca `transform`, que no obliga
   * a repintar; con movimiento reducido no se gira nada.
   */
  useEffect(() => {
    const host = carrusel.current
    if (!host) return

    const aplicar = () => {
      const ancho = host.clientWidth
      if (!ancho) return
      const centro = host.scrollLeft + ancho / 2
      const tarjetas = Array.from(host.querySelectorAll<HTMLElement>('[data-receta]'))
      for (const tarjeta of tarjetas) {
        if (reducido) {
          tarjeta.style.transform = ''
          continue
        }
        const d = Math.max(
          -1,
          Math.min(1, (tarjeta.offsetLeft + tarjeta.offsetWidth / 2 - centro) / ancho),
        )
        tarjeta.style.transform = `perspective(700px) rotateY(${(-d * 16).toFixed(1)}deg) translateZ(${(-Math.abs(d) * 26).toFixed(1)}px)`
      }
    }

    aplicar()
    host.addEventListener('scroll', aplicar, { passive: true })
    return () => host.removeEventListener('scroll', aplicar)
  }, [recetas, reducido])

  if (cargando) return <CarruselFantasma />

  // Sin recetas la sección entera no existe: ni estado vacío, ni hueco.
  if (recetas.length === 0) return null

  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold text-texto">Recetas que sí encajan</h2>
        <span className="cifras shrink-0 text-xs text-tenue">
          {verKcal && kcalRestantes !== undefined
            ? kcalRestantes > 0
              ? `Te quedan ${kcalRestantes.toLocaleString('es-CO')} kcal hoy`
              : 'Ya llegaste a tu meta de hoy'
            : 'Según tu plan de hoy'}
        </span>
      </div>
      <p className="mt-0.5 text-[12.5px] leading-snug text-tenue">
        Virales de Instagram, revisadas por tu coach. Toca una y te decimos la porción exacta.
      </p>

      <Cocinadas cocinadas={cocinadas} racha={racha} />

      {cocinadasHoy.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5" aria-label="Recetas cocinadas hoy">
          {cocinadasHoy.map(({ id, receta, kcal, comida, hora }) => (
            <li
              key={id}
              className="flex items-baseline justify-between gap-2 border-b border-linea pb-1.5 text-sm last:border-b-0"
            >
              <span className="min-w-0 text-texto">
                {receta.nombre}
                <small className="block text-xs text-tenue">
                  {comida.charAt(0).toUpperCase() + comida.slice(1)} · {hora}
                </small>
              </span>
              {verKcal && <b className="cifras shrink-0 text-texto">{kcal} kcal</b>}
            </li>
          ))}
        </ul>
      )}

      {/* Sangrado a los bordes para que las tarjetas se asomen fuera del padding. */}
      <div
        ref={carrusel}
        data-carrusel-recetas=""
        className="mt-2.5 flex items-start gap-3 overflow-x-auto"
        style={{ margin: '10px -18px 0', padding: '6px 18px 18px', scrollSnapType: 'x mandatory' }}
      >
        {recetas.map((receta) => (
          <TarjetaReceta
            key={receta.id}
            receta={receta}
            verKcal={verKcal}
            onAbrir={() => setAbierta(receta)}
          />
        ))}
      </div>

      <p className="mt-1 text-xs leading-snug text-tenue">
        El feed es el mismo para todos: no se filtra por objetivo ni por alergias.
      </p>

      {abierta && (
        // La hoja NO se cierra al agregar: el aviso de «Deshacer» tiene que
        // seguir a la vista, y cerrar de golpe se lo lleva por delante.
        <RecetaSheet
          receta={abierta}
          kcalRestantes={kcalRestantes}
          onCerrar={() => setAbierta(null)}
          registro={registro}
        />
      )}
    </section>
  )
}

/**
 * El hueco antes de que lleguen las recetas.
 *
 * Mide exactamente lo mismo que las tarjetas de verdad —148 × 150 más el pie de
 * texto— porque un esqueleto que no coincide es peor que ninguno: el contenido
 * salta justo cuando el dedo ya iba a tocar.
 */
function CarruselFantasma() {
  return (
    <section className="mt-4" aria-hidden="true">
      <div className="h-[19px] w-[186px] rounded-[6px] bg-surface-2 brillo-carga" />
      <div className="mt-1.5 h-[13px] w-full max-w-[280px] rounded-[6px] bg-surface-2 brillo-carga" />
      <div
        className="mt-2.5 flex gap-3 overflow-hidden"
        style={{ margin: '10px -18px 0', padding: '6px 18px 18px' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[148px] shrink-0 overflow-hidden rounded-[18px] border border-linea bg-surface-2"
          >
            <div className="brillo-carga h-[150px] w-full bg-surface-3" />
            <div className="px-2.5 pb-2.5 pt-2">
              <div className="brillo-carga h-[10px] w-3/5 rounded-[4px] bg-surface-3" />
              <div className="brillo-carga mt-1.5 h-[11px] w-full rounded-[4px] bg-surface-3" />
              <div className="brillo-carga mt-1 h-[11px] w-4/5 rounded-[4px] bg-surface-3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Lo que lleva cocinado, y los días seguidos.
 *
 * Solo cuenta lo que quedó REGISTRADO con sus ingredientes: abrir una hoja no
 * suma. Hasta que cocine la primera no se pinta nada — un «0 recetas» de
 * bienvenida es un reproche, no un dato.
 */
function Cocinadas({ cocinadas, racha }: { cocinadas: number; racha: number }) {
  if (cocinadas === 0) return null

  return (
    <p className="mt-1.5 flex items-center gap-1.5">
      <span className="cifras rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-silver-200">
        {cocinadas} {cocinadas === 1 ? 'cocinada' : 'cocinadas'}
      </span>
      {racha > 1 && (
        <span className="cifras rounded-full bg-accion/15 px-2 py-0.5 text-xs font-bold text-accion">
          {racha} días seguidos
        </span>
      )}
    </p>
  )
}

function TarjetaReceta({
  receta,
  verKcal,
  onAbrir,
}: {
  receta: Receta
  verKcal: boolean
  onAbrir: () => void
}) {
  const kcal = receta.ajuste.kcal
  const etiqueta = verKcal
    ? `${receta.nombre}, de ${receta.handle}. Te entra ${kcal} kcal`
    : `${receta.nombre}, de ${receta.handle}`

  return (
    <button
      data-receta=""
      type="button"
      onClick={onAbrir}
      aria-label={etiqueta}
      style={{ scrollSnapAlign: 'center', transformOrigin: '50% 50%' }}
      className="w-[148px] shrink-0 text-left"
    >
      {/* `.relieve` da el canto de los botones 3D; la rotación la pone el
          carrusel sobre el botón, no sobre el cuerpo, para no pelearse con el
          hundido del toque. */}
      <span className="relieve block overflow-hidden rounded-[18px] border border-linea bg-surface-1">
        <span className="relative block h-[150px] w-full">
          <img
            src={receta.media.thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Protección de tinta: el texto se lee sobre cualquier imagen. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/5"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(8,9,10,.9))' }}
          />
          <span
            className={`absolute left-1.5 top-1.5 rounded-full bg-ink-900/80 px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] ${COLOR_CATEGORIA[receta.categoria]}`}
          >
            {receta.categoria}
          </span>
          <span className="cifras absolute right-1.5 top-1.5 rounded-full bg-ink-900/80 px-1.5 py-0.5 text-xs font-bold text-silver-100">
            {receta.media.duracion}
          </span>
          <span className="cifras absolute bottom-1.5 left-2 right-2 truncate text-xs font-bold text-silver-100">
            {receta.handle}
          </span>
          <span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink-900/70 text-silver-100">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-2.5 w-2.5" aria-hidden="true">
              <path d="m8 5 11 7-11 7Z" />
            </svg>
          </span>
        </span>
        <span className="block px-2.5 pb-2.5 pt-2">
          <span className="line-clamp-2 block text-sm font-bold leading-tight text-texto [text-wrap:pretty]">
            {receta.nombre}
          </span>
          <span className="mt-1 block text-xs text-tenue">
            {verKcal ? (
              <>
                Te entra <b className="text-texto">{receta.ajuste.kcal} kcal</b>
              </>
            ) : (
              'Ajustada a tu plan'
            )}
          </span>
        </span>
      </span>
    </button>
  )
}
