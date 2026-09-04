import type { EjercicioPrescrito } from '../../../../domain/types'
import {
  aspectoDeEstacion,
  estacionesDeLaSerie,
  type ClaveDeEstacion,
} from './estacionesDeLaSerie'

/**
 * LAS CUATRO ESTACIONES, DIBUJADAS: poste, base y cartel alrededor del sujeto.
 *
 * ## El cartel SIEMPRE mira a cámara
 *
 * Y no es una preferencia: un cartel plantado en el suelo que gire con el mundo queda de
 * canto la mitad de la vuelta, o sea ilegible justo cuando la estación está a un lado. El
 * poste y la base sí giran —son objetos del suelo—; el cartel contrarresta el giro.
 *
 * ## LA OPACIDAD VA EN EL CARTEL, NUNCA EN EL ENVOLTORIO
 *
 * Un `opacity` menor que 1 sobre un contenedor con `preserve-3d` lo APLANA: crea un grupo
 * de composición y los hijos dejan de vivir en el espacio 3D del padre. El cartel deja de
 * poder contrarrestar la rotación y se queda de canto. Es un fallo que no da error, no se
 * ve en el DOM y solo aparece al orbitar — el propio kit lo trae marcado como ya cometido
 * una vez.
 *
 * ## Por qué la cifra se retira sola
 *
 * Porque es lo que mantiene el salón despejado. La prescripción se lee una vez al llegar
 * al ejercicio; después queda el poste con su base, que no tapa nada. Cuatro números
 * permanentes alrededor del cuerpo serían otra vez el dashboard con un muñeco dentro, que
 * es de lo que este salón vino a salir.
 *
 * Al tocar una, esa se queda fija —`animation-play-state: paused`— y las otras tres se
 * atenúan: es la única forma de volver a mirar un dato sin esperar al siguiente ciclo.
 */

/** A cuántos píxeles del eje del cuerpo se plantan los postes. */
const RADIO = 138

/** Cuánto mide el poste, en píxeles. La base va abajo y el cartel encima. */
const POSTE = 120

export interface EstacionesDelSujetoProps {
  ejercicio: EjercicioPrescrito | undefined
  /** El azimut de la cámara del salón, en grados. Es lo que ata las estaciones a la sala. */
  azimut: number
  /** Dónde está el suelo bajo el sujeto, en píxeles desde arriba del salón. */
  suelo: number
  /** La estación que el asesorado dejó fija, si dejó alguna. */
  foco?: ClaveDeEstacion
  onEnfocar: (clave: ClaveDeEstacion) => void
}

export function EstacionesDelSujeto({
  ejercicio,
  azimut,
  suelo,
  foco,
  onEnfocar,
}: EstacionesDelSujetoProps) {
  const estaciones = estacionesDeLaSerie(ejercicio)
  if (estaciones.length === 0) return null

  return (
    <div
      data-hueco="estaciones"
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 'var(--z-contenido)' }}
    >
      {estaciones.map((e, i) => {
        const a = aspectoDeEstacion(e.angulo, azimut, RADIO)
        const enfocada = foco === e.clave
        return (
          <div
            key={e.clave}
            data-estacion={e.clave}
            data-enfocada={enfocada ? '' : undefined}
            className="absolute"
            style={{
              left: `calc(50% + ${a.x.toFixed(1)}px)`,
              top: `${suelo}px`,
              // Lo de delante, delante. Sin esto, la estación de la espalda se pinta
              // encima de la de enfrente cuando el azimut las cruza.
              zIndex: Math.round(500 + a.frente * 100),
            }}
          >
            {/* EL POSTE Y LA BASE: los dos objetos del suelo. No contrarrestan nada —giran
                con la sala, que es lo que hace que se lean como plantados en ella. */}
            <span
              aria-hidden="true"
              className="absolute bottom-0 left-[-1px] w-[2px]"
              style={{
                height: `${POSTE}px`,
                background: `linear-gradient(180deg, ${
                  enfocada ? 'var(--accion)' : 'rgb(var(--silver-300-rgb) / 0.55)'
                }, transparent)`,
                opacity: a.opacidad,
              }}
            />
            <span
              aria-hidden="true"
              className="absolute left-[-40px] top-[-20px] h-20 w-20 rounded-full border"
              style={{
                borderColor: enfocada
                  ? 'rgb(var(--accion-rgb) / 0.7)'
                  : 'rgb(var(--silver-300-rgb) / 0.3)',
                background: enfocada
                  ? 'rgb(var(--accion-rgb) / 0.1)'
                  : 'rgb(var(--silver-300-rgb) / 0.04)',
                transform: 'rotateX(90deg)',
                opacity: a.opacidad,
              }}
            />

            {/* EL CARTEL. La opacidad va AQUÍ y no en el contenedor de arriba: sobre un
                envoltorio con `preserve-3d` aplanaría el grupo y el cartel se quedaría de
                canto al orbitar. */}
            <button
              type="button"
              onClick={() => onEnfocar(e.clave)}
              className="estacion-cartel pointer-events-auto absolute w-[132px] text-center"
              style={{
                left: '-66px',
                bottom: `${POSTE + 4}px`,
                opacity: foco && !enfocada ? a.opacidad * 0.45 : a.opacidad,
                transform: `translateY(-${a.alza.toFixed(0)}px) scale(${a.escala.toFixed(3)})`,
                transformOrigin: '50% 100%',
              }}
            >
              <span
                className="estacion-cifra"
                data-anima
                style={{
                  animationDelay: `${80 + i * 100}ms`,
                  animationPlayState: enfocada ? 'paused' : 'running',
                }}
              >
                <span
                  className="muro-rotulo block text-[10.5px]"
                  style={{ color: enfocada ? 'var(--accion)' : 'var(--gris-marca)' }}
                >
                  {e.rotulo}
                </span>
                <span
                  className="estacion-numero mt-1 block"
                  style={{ color: enfocada ? 'var(--accion)' : 'var(--texto)' }}
                >
                  {e.cifra}
                </span>
                <span className="mt-1.5 block text-[11.5px] leading-tight text-tenue">{e.pie}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
