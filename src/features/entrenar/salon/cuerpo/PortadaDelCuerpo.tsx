import { useState, type ReactNode } from 'react'
import { Boton3D } from '../../../../components/ui/Boton3D'
import { Sheet } from '../../../../components/ui/Sheet'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, REGIONES, type IdDeRegion } from '../../sujeto/regiones'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { HuecoDeDatos } from '../paredes/HuecoDeDatos'
import type { AnclasDelReloj, ModoDelReloj } from '../mando/relojDelMuro'
import { lecturaCorta, type SeriesPorRegion } from '../../sujeto/tinte'

/**
 * LA PORTADA DEL CUERPO: lo que se lee ENCIMA del sujeto de Blender.
 *
 * Capas (Piel · Músculo · Hueso) a un lado, la lectura corta de las series anotadas, el dolor
 * del check-in en rojo, y el paso a la vista de movimiento (la escena vieja del salón,
 * entera). Es el hueco `cuerpo` de `huecos.ts`. Aspecto de la maqueta 7: teclas alzadas con
 * `--relleno-alzado` y `--sombra-alzado` (claro y oscuro salen del tema), la lectura en luz y
 * sin caja, el dolor en `--rojo`.
 *
 * Cuenta SERIES ANOTADAS, no estímulo: lo dice debajo de la lectura, como la maqueta 7.
 */

export type VistaDelSalon = 'cuerpo' | 'movimiento'
export type RangoDeLectura = 'hoy' | 'semana'

export interface PortadaDelCuerpoProps {
  vista: VistaDelSalon
  capa: CapaDelCuerpo
  rango: RangoDeLectura
  series: SeriesPorRegion
  doloridas: readonly IdDeRegion[]
  alCambiarCapa: (capa: CapaDelCuerpo) => void
  alCambiarRango: (rango: RangoDeLectura) => void
  alCambiarVista: (vista: VistaDelSalon) => void
  /** Lo que toca, para la linea de arriba: nombre y cifras. Sin nada que decir no hay linea. */
  resumen?: { nombre: string; cifras: string }
  /**
   * EL RELOJ DE LA PARED, que la portada no puede perder: el cronometro de la sesion, la cuenta
   * atras del descanso (con su aviso de fin: `alTerminarLaCuenta`) y la carga. Es el mismo
   * `HuecoDeDatos` del muro, montado aqui porque la portada no monta las paredes.
   */
  reloj?: {
    sesion?: Sesion
    ejercicio?: EjercicioPrescrito
    textoDeCarga: string
    cargaPrevia?: number
    modo: ModoDelReloj
    anclas: AnclasDelReloj
    alTerminarLaCuenta: () => void
    cargaEnLaPared: boolean
  }
}

const CAPAS: readonly { id: CapaDelCuerpo; nombre: string }[] = [
  { id: 'piel', nombre: 'Piel' },
  { id: 'musculo', nombre: 'Músculo' },
  { id: 'hueso', nombre: 'Hueso' },
]

/**
 * LA TECLA ALZADA de la maqueta 7 (`.sl-capas button`): 44 px de alto, 12 px de radio, 12 px
 * en negrita. La elegida lleva un aro de 1,5 px en el color del texto.
 */
const COMPACTO = '!min-h-[44px] !min-w-[58px] !px-2 !py-0 !text-xs'

/**
 * Una opcion de un grupo: la elegida es el boton 3D (`Boton3D`, el del PR #379) y las demas la
 * tecla secundaria `.tecla-2`, las dos de `tokens.css`. Mismo tamano para que no salten.
 */
function Opcion({
  activa,
  onClick,
  children,
  radio = true,
  etiqueta,
}: {
  activa: boolean
  onClick: () => void
  children: ReactNode
  radio?: boolean
  etiqueta?: string
}) {
  const aria = radio ? { role: 'radio' as const, 'aria-checked': activa } : {}
  if (activa) {
    return (
      <Boton3D {...aria} aria-label={etiqueta} onClick={onClick} className={COMPACTO}>
        {children}
      </Boton3D>
    )
  }
  return (
    <button
      type="button"
      {...aria}
      aria-label={etiqueta}
      onClick={onClick}
      className={`press tecla-2 ${COMPACTO}`}
      style={{ color: 'var(--tenue)' }}
    >
      {children}
    </button>
  )
}

/** «3 series · 9 reps · 3 min · RIR 2»: las cuatro cifras de la pared, en una linea. */
export function cifrasEnUnaLinea(
  e: Pick<EjercicioPrescrito, 'sets' | 'repsDiana' | 'descansoMin' | 'rirObjetivo'>,
): string {
  const descanso = Number.isInteger(e.descansoMin) ? `${e.descansoMin} min` : `${String(e.descansoMin).replace('.', ',')} min`
  const rir = e.rirObjetivo === 'FALLO' ? 'fallo' : String(e.rirObjetivo)
  return `${e.sets} series · ${e.repsDiana} reps · ${descanso} · RIR ${rir}`
}

function cifra(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

export function PortadaDelCuerpo(p: PortadaDelCuerpoProps) {
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const enCuerpo = p.vista === 'cuerpo'
  const lectura = lecturaCorta(p.series)

  return (
    <>
      <div data-hueco="cuerpo" className="pointer-events-none absolute inset-0">
        {/* ARRIBA, EN PEQUENO: que ejercicio toca y sus cifras (decision de Bryan). Los cuadros
            grandes de la pared y el reloj son de la vista de movimiento. */}
        {enCuerpo && p.resumen && (
          <div
            data-testigo="resumen-del-ejercicio"
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-4 text-center"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8.4rem)' }}
          >
            <p
              className="max-w-full truncate text-[15px] leading-tight"
              style={{ color: 'var(--texto)', fontWeight: 800, textShadow: '0 1px 6px rgb(0 0 0 / 0.55)' }}
            >
              {p.resumen.nombre}
            </p>
            <p
              className="cifras max-w-full truncate text-[12px] leading-tight"
              style={{ color: 'var(--tenue)', textShadow: '0 1px 6px rgb(0 0 0 / 0.55)' }}
            >
              {p.resumen.cifras}
            </p>
          </div>
        )}

        {/* EL RELOJ: cronometro de la sesion, cuenta atras del descanso o carga. */}
        {enCuerpo && p.reloj && (
          <div
            className="muro-escena pointer-events-none absolute inset-x-0 flex justify-center"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 11.6rem)', fontSize: '22px' }}
          >
            <HuecoDeDatos
              muestra={p.reloj.cargaEnLaPared ? 'carga' : 'reloj'}
              sesion={p.reloj.sesion}
              ejercicio={p.reloj.ejercicio}
              textoDeCarga={p.reloj.textoDeCarga}
              cargaPrevia={p.reloj.cargaPrevia}
              modo={p.reloj.modo}
              anclas={p.reloj.anclas}
              alTerminarLaCuenta={p.reloj.alTerminarLaCuenta}
            />
          </div>
        )}

        {/* A la derecha, las capas: el cuerpo ocupa el centro y los lados quedan libres. */}
        {enCuerpo && (
          <div
            role="radiogroup"
            aria-label="Capas del cuerpo"
            className="pointer-events-auto absolute grid gap-2"
            style={{ right: 'max(8px, env(safe-area-inset-right, 0px))', top: '42%', transform: 'translateY(-50%)' }}
          >
            {CAPAS.map((c) => (
              <Opcion key={c.id} activa={c.id === p.capa} onClick={() => p.alCambiarCapa(c.id)}>
                {c.nombre}
              </Opcion>
            ))}
          </div>
        )}

        {/* A la izquierda, el rango de la lectura y el paso al movimiento. */}
        <div
          className="pointer-events-auto absolute grid gap-2"
          style={{ left: 'max(8px, env(safe-area-inset-left, 0px))', top: '42%', transform: 'translateY(-50%)' }}
        >
          {enCuerpo && (
            <div role="radiogroup" aria-label="Rango de la lectura" className="grid gap-2">
              {(['hoy', 'semana'] as const).map((r) => (
                <Opcion key={r} activa={p.rango === r} onClick={() => p.alCambiarRango(r)}>
                  {r === 'hoy' ? 'Hoy' : 'Semana'}
                </Opcion>
              ))}
            </div>
          )}
          <Opcion
            radio={false}
            activa={false}
            etiqueta={enCuerpo ? 'Ver el movimiento' : 'Ver el cuerpo'}
            onClick={() => p.alCambiarVista(enCuerpo ? 'movimiento' : 'cuerpo')}
          >
            <span className="block max-w-[76px] text-center leading-tight">
              {enCuerpo ? 'Ver el movimiento' : 'Ver el cuerpo'}
            </span>
          </Opcion>
        </div>

        {/* La lectura va corta, encima de la hoja y debajo del cuerpo: no lo tapa. */}
        {enCuerpo && (
          <div
            // `pointer-events-none`: la franja es de ancho completo y, si recibiera toques, taparia el
            // joystick y la camara que viven en las esquinas. Solo el boton de la lectura los recibe.
            className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-4 text-center"
            style={{ bottom: 'calc(var(--tope-nav) + 5.4rem)' }}
          >
            {lectura ? (
              <button
                type="button"
                aria-label="Ver series por región"
                onClick={() => setHojaAbierta(true)}
                className="press pointer-events-auto max-w-full truncate text-[15px] leading-tight"
                style={{ color: 'var(--texto)', fontWeight: 800 }}
              >
                {lectura}
              </button>
            ) : (
              <p className="text-[15px] leading-tight" style={{ color: 'var(--tenue)' }}>
                Aún no hay series anotadas
              </p>
            )}
            <p className="text-[10.5px] opacity-85" style={{ color: 'var(--tenue)' }}>
              {p.rango === 'hoy' ? 'series hoy' : 'series de la semana'} · cuenta series anotadas, no el estímulo
            </p>
            {p.doloridas.length > 0 && (
              <p className="text-[13px]" style={{ color: 'var(--rojo)', fontWeight: 800 }}>
                Te duele: {p.doloridas.map((id) => NOMBRE_DE_REGION[id]).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* La hoja va FUERA del hueco: `pointer-events: none` se hereda y la dejaría sorda. */}
      <Sheet abierto={hojaAbierta} titulo="Series por región" onCerrar={() => setHojaAbierta(false)}>
        <ul className="flex flex-col divide-y divide-linea">
          {REGIONES.map((r) => {
            const n = p.series[r.id] ?? 0
            const duele = p.doloridas.includes(r.id)
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-texto">{r.nombre}</span>
                <span className="cifras text-tenue">
                  {duele && (
                    <span className="mr-2 font-bold" style={{ color: 'var(--rojo)' }}>
                      Te duele
                    </span>
                  )}
                  {cifra(n)}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-tenue">Cuenta series anotadas, no el estímulo.</p>
      </Sheet>
    </>
  )
}
