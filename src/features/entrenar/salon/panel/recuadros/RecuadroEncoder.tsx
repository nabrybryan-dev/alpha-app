import { Link } from 'react-router-dom'
import { IconoCamara } from '../../../../../components/ui/Icono'

/**
 * LA PUERTA AL ENCODER, tal cual estaba en la Ruta.
 *
 * En `RutaPage` era un `Link` suelto entre bloques, con su icono de cámara y su etiqueta
 * «en pruebas». Baja al panel sin cambiar ni el destino ni el aviso: sigue siendo la mesa
 * de trabajo —la tanda entera, los criterios y el CSV—, y medir se sigue midiendo dentro
 * de la serie, no aquí.
 *
 * La etiqueta «en pruebas» viaja con él a propósito. Es lo único que separa una
 * herramienta terminada de una que puede dar un número raro, y quitarla al mudarse de
 * sitio sería subirle el rango a una pieza sin que nadie lo haya decidido.
 */
export function RecuadroEncoder() {
  return (
    <Link
      to="/entrenar/encoder"
      className="press flex items-center justify-between gap-3 rounded-bloque border border-white/10 bg-ink-700 px-3.5 py-3 text-sm text-tenue"
    >
      <span className="flex items-center gap-2">
        <IconoCamara className="h-[18px] w-[18px] shrink-0" />
        <span>
          <b className="text-texto">Encoder</b> · tanda y criterios
        </span>
      </span>
      <span className="shrink-0 rounded-tag bg-ambar/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ambar">
        en pruebas
      </span>
    </Link>
  )
}
