import { REGIONES, type IdDeRegion } from '../../sujeto/regiones'
import { cuentaDeRegion } from './cuentaDeRegion'
import type { SeriesPorRegion } from '../../sujeto/tinte'
import type { RangoDeLectura } from './PortadaDelCuerpo'

/**
 * LO QUE DICE EL MÚSCULO TOCADO (maqueta 7: «un toque elige región y la lectura dice su
 * cuenta»). Solo MUESTRA lo que `seriesPorRegion` ya cuenta; no cambia cómo se cuentan.
 *
 * Aquí hubo un botón por región, y con datos reales eran seis tapando las piernas (Bryan,
 * 30-oct: «veo muchos botones»). Se elige tocando el cuerpo, y la lista completa, también para
 * quien usa teclado o lector de pantalla, sigue en «Ver series por región».
 */
export function LecturaDeRegion({
  series,
  rango,
  elegida,
}: {
  series: SeriesPorRegion
  rango: RangoDeLectura
  elegida: IdDeRegion | null
}) {
  const conCuenta = elegida !== null && REGIONES.some((r) => r.id === elegida && (series[r.id] ?? 0) > 0)
  return (
    <p
      role="status"
      className="text-[12px] leading-tight"
      style={conCuenta ? { color: 'var(--texto)', fontWeight: 800 } : { color: 'var(--salon-3d-suelo-texto, var(--tenue))' }}
    >
      {conCuenta ? cuentaDeRegion(elegida, series, rango) : 'Toca un músculo para leer su cuenta'}
    </p>
  )
}
