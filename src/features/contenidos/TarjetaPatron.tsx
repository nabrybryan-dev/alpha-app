import { IconoVideo } from '../../components/ui/Icono'
import type { Contenido } from '../../domain/types'

interface TarjetaPatronProps {
  contenido: Contenido
  /** Posición dentro del bloque, para numerar del 01 en adelante. */
  numero: number
  onAbrir: () => void
}

/**
 * Un contenido de técnica, presentado por su patrón de movimiento.
 *
 * POR QUÉ NO ES UNA FILA MÁS. Los patrones no son «vídeos de la biblioteca»:
 * son el vocabulario con el que está escrita toda la programación. «Dominante
 * de rodilla» o «Empuje horizontal» es lo que el asesorado ve en su sesión, en
 * el foco de la semana y en el reparto de volumen. Antes ese nombre iba de
 * insignia pequeña al pie de una fila idéntica a las demás.
 *
 * QUÉ MANDA EN CADA LÍNEA. El patrón va arriba, en rojo, porque es la
 * clasificación; el titular es el movimiento concreto, porque es lo que la
 * persona busca. Se probó al revés —el patrón de titular— y salió mal: dos
 * contenidos comparten «Dominante de rodilla», así que dos tarjetas mostraban
 * el mismo titular y parecía un error aunque el dato fuera correcto.
 *
 * El «Patrón de » que abre casi todos los títulos se quita: ya lo dice el
 * antetítulo, y repetirlo se come el espacio del nombre útil.
 *
 * Y el antetítulo solo sale cuando AÑADE algo. En la mitad de los contenidos el
 * patrón y el movimiento son la misma cosa —«Empuje horizontal» es las dos—, así
 * que pintar los dos deja la tarjeta diciendo lo mismo dos veces. Que unas
 * tarjetas lleven antetítulo y otras no es variación de información, no
 * descuido: las que no lo llevan respiran más.
 */
export function TarjetaPatron({ contenido, numero, onAbrir }: TarjetaPatronProps) {
  const titular = contenido.titulo.replace(/^patrón de\s+/i, '')
  const patron = contenido.patronMovimiento ?? ''
  const aplanar = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
  const patronAporta = patron !== '' && aplanar(patron) !== aplanar(titular)

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="press group relative flex min-h-[138px] flex-col justify-between overflow-hidden rounded-panel border border-ink-600 bg-ink-900 p-4 text-left text-silver-100"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="cifras block text-[10px] font-bold tracking-[0.18em] text-rojo">
            {String(numero).padStart(2, '0')}
          </span>
          {patronAporta && (
            <span className="mt-1.5 block text-[10px] font-bold uppercase leading-tight tracking-[0.1em] text-rojo/85">
              {patron}
            </span>
          )}
        </span>
        <IconoVideo className="h-4 w-4 shrink-0 text-silver-500 transition-colors group-active:text-rojo" />
      </span>

      <span>
        <span className="mb-2 block h-px w-8 bg-rojo" aria-hidden="true" />
        <span className="block font-display text-[15px] font-black uppercase leading-[1.1] tracking-[-0.01em]">
          {titular}
        </span>
      </span>
    </button>
  )
}
