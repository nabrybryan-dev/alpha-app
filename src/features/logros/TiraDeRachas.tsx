import type { ComponentType } from 'react'
import { CifraAnimada } from '../../components/ui/CifraAnimada'
import { FondoLoop } from '../../components/ui/FondoLoop'
import { fraccionDeRacha, type Racha } from '../../domain/gamification'
import { direccion } from '../../lib/direccionesVisuales'
import { usePausaFueraDePantalla } from '../../lib/pausaFueraDePantalla'

export interface CeldaDeRacha {
  nombre: string
  racha: Racha
  /** El icono de SU pestaña. El trazo se pinta con `currentColor`. */
  Icono: ComponentType<{ className?: string }>
}

/**
 * Las tres rachas como TRES VENTANAS A LA MISMA CALLE.
 *
 * LA PIEZA. F «Proyección» —un sprint resistido de noche: el cuerpo empuja
 * contra la banda y la calle no se mueve—. Es la definición de una racha:
 * empujas todos los días y el paisaje no cambia. Ver
 * `docs/specs/2026-08-25-piezas-sin-colocar-diseno.md`.
 *
 * POR QUÉ NO SON TRES TARJETAS. Lo eran, tres cristales sueltos sobre el fondo
 * de la pantalla. Tres tarjetas idénticas en fila es la rejilla que el propio
 * encargo de la integración cinemática prohíbe, y además contaban tres historias
 * separadas cuando son la misma. Aquí la pieza corre entera por detrás de la
 * tira y cada celda descubre la parte que le toca.
 *
 * CUÁNTO SE DESCUBRE. `actual / record`: hasta donde ha llegado esta racha
 * contra tu propio máximo. Lo que no está descubierto es **negro puro**
 * (`--ink-1000`), opaco, no un velo — el velo está prohibido en este lenguaje.
 *
 * **Y tiene que ser negro puro, no `--ink-900`.** Esto se descubrió mirándolo,
 * no razonándolo: la calle de F está en 3,4 de luminancia y `--ink-900` en 8,9,
 * o sea que lo que se descubría salía MÁS OSCURO que lo que lo tapaba. El efecto
 * se invertía y la diferencia medida en pantalla era de 0,58 de luma: invisible.
 * Ninguna curva lo arregla —para subir la calle por encima de 8,9 hay que
 * levantar tanto la pieza que su propia banda pasa de 25 y el texto deja de
 * leerse—, así que lo que cambió fue la cortina. Ver el token en `tokens.css`.
 *
 * QUÉ PASA EN LOS BORDES, que es donde esto se decide:
 *   - Sin un solo registro (`record = 0`) no hay calle. Y como no hay ninguna
 *     que enseñar, tampoco se monta el vídeo: no se paga por lo que no se ve.
 *   - **El primer día se ve la calle entera**, y esto importa: `calcularRacha`
 *     devuelve `actual = record = 1`, o sea 1/1. A quien empieza no se le enseña
 *     una pantalla apagada.
 *   - Con la racha rota (`actual = 0`, `record > 0`) la calle se apaga. Es la
 *     pantalla diciendo con la pieza lo que ya dice con palabras más abajo, en
 *     el mensaje del récord.
 *
 * EL ENCAJE ES `object-cover` A SECAS. La tira mide ~3,5:1 y la pieza 16:9, así
 * que el recorte es solo vertical y el centro por defecto es justo el que se
 * quiere. Medido en las tres anclas: arriba 1,2 de media (cielo), centro 5,0
 * (el corredor y la farola), abajo 8,9 (la banda de tinta de la propia pieza).
 * Arriba y abajo la pieza no se ve.
 *
 * UN SOLO `<video>` PARA LAS TRES. Son ventanas a la misma calle. Tres vídeos
 * idénticos descomprimiendo a la vez es exactamente lo que
 * `usePausaFueraDePantalla` existe para evitar.
 */
export function TiraDeRachas({ celdas }: { celdas: CeldaDeRacha[] }) {
  const marco = usePausaFueraDePantalla<HTMLDivElement>()
  const pieza = direccion('F')
  const fracciones = celdas.map((celda) => fraccionDeRacha(celda.racha))
  const hayCalle = fracciones.some((fraccion) => fraccion > 0)

  return (
    <div
      ref={marco}
      className="relative overflow-hidden rounded-tarjeta border border-ink-500 bg-ink-900"
    >
      {hayCalle && (
        <FondoLoop
          poster={pieza.poster}
          video={pieza.video}
          preload="none"
          prioridad="auto"
          anchura={1280}
          altura={720}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      <div className="relative grid grid-cols-3">
        {celdas.map((celda, i) => (
          <div
            key={celda.nombre}
            className={`relative overflow-hidden px-2 py-3.5 text-center ${
              i > 0 ? 'border-l border-hairline' : ''
            }`}
          >
            {/* La calle sin recorrer: negro puro, opaco. No es una superficie —es
                que ahí no hay luz—, y por eso `--ink-1000` y no `--ink-900`. Va
                detrás del contenido y no encima, para que la cifra no dependa
                nunca de esta anchura. */}
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 bg-ink-1000"
              style={{ width: `${(1 - fracciones[i]) * 100}%` }}
              data-descubierto={fracciones[i]}
            />
            <div className="relative">
              <span className="mb-1 flex justify-center text-tenue">
                <celda.Icono className="h-[19px] w-[19px]" />
              </span>
              <p className="cifras font-display text-2xl text-rojo">
                <CifraAnimada valor={celda.racha.actual} duracionMs={700} />
              </p>
              <p className="text-[10px] uppercase tracking-wider text-tenue">{celda.nombre}</p>
              <p className="mt-0.5 text-[10px] text-tenue">Récord: {celda.racha.record}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
