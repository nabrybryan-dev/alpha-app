import type { Encuadre } from './nucleo/encuadre'

/**
 * Dónde está la cámara, en planta y en alzado.
 *
 * ## Por qué son dos vistas y no una
 *
 * Son **dos errores distintos**: el desvío del eje de la barra se ve desde arriba
 * y la altura de la lente se ve desde el lado. Con una sola vista la persona no
 * sabe cuál de los dos está cometiendo, y las dos correcciones son opuestas —una
 * es girar, la otra es subir el trípode—. Van apiladas, a la misma escala y en la
 * misma tarjeta.
 *
 * ## Por qué esto NO se anima
 *
 * Es la única pantalla que se mira de pie, con el trípode en una mano y el móvil
 * en la otra. El diagrama sigue al control **sin transición**: la geometría no
 * tarda en cambiar, y una interpolación de 200 ms aquí diría que sí. Lo único que
 * se mueve en esta pantalla es la placa del veredicto, que es lo que sí cambia de
 * estado.
 *
 * ## Y por qué es plano
 *
 * Una planta y un alzado ya son proyecciones. Ponerles perspectiva sería proyectar
 * una proyección: se vería más vistoso y se leería peor, justo en la pantalla que
 * se consulta con menos atención disponible.
 */

interface Props {
  e: Encuadre
  /** Altura de cadera del asesorado si se conoce; si no, la genérica del modelo. */
  alturaCaderaM?: number
}

const ROJO = 'var(--rojo)'
const PLATA = 'var(--placa)'
const MUERTA = 'var(--placa-muerta)'

/** Vista desde arriba: el cono de la lente contra la barra. */
function Planta({ e }: { e: Encuadre }) {
  const W = 320
  const H = 132
  const camX = W / 2
  const camY = H - 12
  // Metros a píxeles: la distancia de trabajo ocupa el alto útil, así que alejarse
  // encoge el dibujo del atleta igual que encoge al atleta en el encuadre.
  const escala = (H - 34) / Math.max(1.2, e.dist)
  const barraY = camY - e.dist * escala
  const medioFov = (e.fov * Math.PI) / 360
  const alcance = H
  const izq = { x: camX - Math.tan(medioFov) * alcance, y: camY - alcance }
  const der = { x: camX + Math.tan(medioFov) * alcance, y: camY - alcance }

  // La barra girada `desvio` grados sobre el plano de imagen. Media barra a cada
  // lado del centro; 2,2 m es la olímpica.
  const medio = (2.2 / 2) * escala
  const rad = (e.desvio * Math.PI) / 180
  const dx = Math.cos(rad) * medio
  const dy = Math.sin(rad) * medio

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Planta: cámara a ${e.dist.toFixed(1)} metros, barra desviada ${Math.round(e.desvio)} grados`}>
      <defs>
        <clipPath id="planta-marco">
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
      </defs>
      <g clipPath="url(#planta-marco)">
        {/* El cono de visión. Es lo que decide si el atleta cabe. */}
        <path
          d={`M ${camX} ${camY} L ${izq.x} ${izq.y} L ${der.x} ${der.y} Z`}
          fill={ROJO}
          fillOpacity={0.1}
          stroke={ROJO}
          strokeWidth={1}
          strokeOpacity={0.5}
        />
        {/* La barra. Girada, se acorta en el plano de imagen: eso ES el problema. */}
        <line
          x1={camX - dx} y1={barraY + dy} x2={camX + dx} y2={barraY - dy}
          stroke={PLATA} strokeWidth={3.2} strokeLinecap="round"
        />
        {/* Los dos discos, que son los que quedan a distinta profundidad. */}
        <circle cx={camX - dx} cy={barraY + dy} r={4} fill={PLATA} />
        <circle cx={camX + dx} cy={barraY - dy} r={4} fill={PLATA} />
        {/* La cámara. */}
        <rect x={camX - 7} y={camY - 5} width={14} height={10} rx={2} fill={PLATA} />
      </g>
      <text x={6} y={12} fontSize={9} fill={MUERTA} letterSpacing="0.08em">PLANTA</text>
      <text x={W - 6} y={12} fontSize={9} fill={MUERTA} textAnchor="end">
        {e.desvio > 0 ? `${Math.round(e.desvio)}° fuera del eje` : 'de lado'}
      </text>
    </svg>
  )
}

/** Vista desde el lado: la línea de la lente contra el eje de cadera. */
function Alzado({ e, alturaCaderaM }: { e: Encuadre; alturaCaderaM?: number }) {
  const W = 320
  const H = 132
  const suelo = H - 16
  const ejeM = alturaCaderaM ?? e.ejeM
  // Escala vertical: 2 m de alto ocupan el dibujo. Fija, para que subir el trípode
  // se vea moverse y no se reescale el dibujo entero bajo la mano.
  const porMetro = (suelo - 20) / 2
  const camX = 40
  const camY = suelo - e.altura * porMetro
  const atletaX = W - 70
  const ejeY = suelo - ejeM * porMetro

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`Alzado: lente a ${e.altura.toFixed(2)} metros, eje de cadera a ${ejeM.toFixed(2)} metros, inclinación ${Math.round(e.inclinacionGrados)} grados`}>
      <line x1={0} x2={W} y1={suelo} y2={suelo} stroke={MUERTA} strokeWidth={1} />
      {/* El atleta, como referencia de altura. Sin cara ni detalle: es una cota. */}
      <line x1={atletaX} y1={suelo} x2={atletaX} y2={suelo - 1.74 * porMetro}
        stroke={MUERTA} strokeWidth={2} strokeLinecap="round" />
      <circle cx={atletaX} cy={suelo - 1.74 * porMetro - 5} r={5} fill="none"
        stroke={MUERTA} strokeWidth={1.6} />
      {/* El eje de cadera: la cota que hay que igualar. */}
      <line x1={atletaX - 26} x2={atletaX + 26} y1={ejeY} y2={ejeY}
        stroke={PLATA} strokeWidth={1.6} strokeDasharray="4 3" />
      {/* La línea de la lente. Si no es horizontal, hay inclinación. */}
      <line x1={camX} y1={camY} x2={atletaX} y2={ejeY} stroke={ROJO} strokeWidth={1.6} />
      <rect x={camX - 8} y={camY - 6} width={16} height={12} rx={2} fill={PLATA} />
      {/* El trípode, que es lo que la persona tiene en la mano. */}
      <line x1={camX} y1={camY + 6} x2={camX - 9} y2={suelo} stroke={MUERTA} strokeWidth={1.2} />
      <line x1={camX} y1={camY + 6} x2={camX + 9} y2={suelo} stroke={MUERTA} strokeWidth={1.2} />

      <text x={6} y={12} fontSize={9} fill={MUERTA} letterSpacing="0.08em">ALZADO</text>
      <text x={W - 6} y={12} fontSize={9} fill={MUERTA} textAnchor="end">
        {Math.abs(e.inclinacionGrados) < 1
          ? 'a la altura del eje'
          : `${Math.round(Math.abs(e.inclinacionGrados))}° ${e.inclinacionGrados > 0 ? 'por debajo' : 'por encima'}`}
      </text>
    </svg>
  )
}

export function DiagramaEncuadre({ e, alturaCaderaM }: Props) {
  return (
    <div>
      <Planta e={e} />
      <div className="my-2 border-t border-hairline" />
      <Alzado e={e} alturaCaderaM={alturaCaderaM} />
    </div>
  )
}
