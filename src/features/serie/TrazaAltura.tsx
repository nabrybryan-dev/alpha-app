/**
 * Altura del implemento contra el tiempo.
 *
 * Se dibuja aunque la serie no se haya podido medir, y por eso existe: **la
 * foto es la prueba**. Enseña qué ha entendido la app, así que si se equivoca
 * el asesorado lo ve al instante en vez de confiar a ciegas en un número.
 *
 * Los huecos no se cosen: cuando pasa más de un tercio de segundo sin ver el
 * implemento, la línea se corta. Unir esos puntos dibujaría un movimiento que
 * nadie ha medido.
 */
export function TrazaAltura({
  traza,
  alto = 120,
}: {
  traza: Array<{ t: number; alturaM: number }>
  alto?: number
}) {
  if (traza.length < 2) return null

  const ancho = 320
  const margen = 6
  const t0 = traza[0].t
  const t1 = traza[traza.length - 1].t
  const alturas = traza.map((p) => p.alturaM)
  const yMin = Math.min(...alturas)
  const yMax = Math.max(...alturas)
  const rango = yMax - yMin || 1
  const dur = t1 - t0 || 1

  const px = (t: number) => margen + ((t - t0) / dur) * (ancho - margen * 2)
  // La y de pantalla crece hacia abajo, y la altura hacia arriba: se invierte.
  const py = (m: number) => margen + (1 - (m - yMin) / rango) * (alto - margen * 2)

  const tramos: string[] = []
  let actual = ''
  for (let i = 0; i < traza.length; i++) {
    const hueco = i > 0 && traza[i].t - traza[i - 1].t > 0.34
    if (i === 0 || hueco) {
      if (actual) tramos.push(actual)
      actual = `M ${px(traza[i].t).toFixed(1)} ${py(traza[i].alturaM).toFixed(1)}`
    } else {
      actual += ` L ${px(traza[i].t).toFixed(1)} ${py(traza[i].alturaM).toFixed(1)}`
    }
  }
  if (actual) tramos.push(actual)

  const segundos = (s: number) => `${s.toFixed(2).replace('.', ',')} s`

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full"
        role="img"
        aria-label={`Altura del implemento entre ${segundos(t0)} y ${segundos(t1)}`}
      >
        {tramos.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-silver-300"
          />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] tabular-nums text-silver-500">
        <span>{segundos(t0)}</span>
        <span className="font-body text-[11px] tracking-wide">altura del implemento</span>
        <span>{segundos(t1)}</span>
      </figcaption>
    </figure>
  )
}
