import { useState, type ReactNode } from 'react'
import { Sheet } from '../../../../components/ui/Sheet'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, REGIONES, type IdDeRegion } from '../../sujeto/regiones'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { LecturaDeRegion } from './LecturaDeRegion'
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
  /** Lo que la sesión deja por trabajar (se pinta en rojo liso). Vacío = no se dice nada. */
  porTrabajar?: readonly IdDeRegion[]
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

/**
 * Cada tecla dice QUÉ ES y, debajo, QUÉ ENSEÑA (Bryan, 25-oct: «que los botones tengan más
 * detalle»). Con solo «Hoy» y «Semana» no se sabía si cambiaban de día o qué contaban.
 */
const CAPAS: readonly { id: CapaDelCuerpo; nombre: string; detalle: string }[] = [
  { id: 'piel', nombre: 'Piel', detalle: 'la silueta' },
  { id: 'musculo', nombre: 'Músculo', detalle: 'lo trabajado' },
  { id: 'hueso', nombre: 'Hueso', detalle: 'el esqueleto' },
]

const RANGOS: readonly { id: RangoDeLectura; nombre: string; detalle: string }[] = [
  { id: 'hoy', nombre: 'Hoy', detalle: 'series de hoy' },
  { id: 'semana', nombre: 'Semana', detalle: 'series de 7 días' },
]

/**
 * LA TECLA ALZADA de la maqueta 7 (`.sl-capas button`): 12 px de radio, nombre en negrita y
 * su detalle debajo, en tenue. Todas del mismo ancho para que la columna no baile. La elegida
 * lleva un aro de 1,5 px en el color del texto.
 */
const COMPACTO = '!min-h-[48px] !w-[86px] !px-1.5 !py-1 !text-xs'

/**
 * Una opcion de un grupo, con la tecla secundaria `.tecla-2` de `tokens.css` (la de la maqueta
 * 7). **El rojo es del dolor**: la elegida NO se pinta de rojo (no es `Boton3D`, que es la
 * accion principal y es roja); se marca con un aro del color del texto y el texto pleno, y las
 * demas quedan en tenue. Mismo tamano para que no salten.
 */
function Opcion({
  activa,
  onClick,
  children,
  radio = true,
  etiqueta,
  detalle,
}: {
  activa: boolean
  onClick: () => void
  children: ReactNode
  radio?: boolean
  etiqueta?: string
  /** Una línea corta debajo del nombre: qué enseña la tecla. */
  detalle?: string
}) {
  const aria = radio ? { role: 'radio' as const, 'aria-checked': activa } : {}
  return (
    <button
      type="button"
      {...aria}
      aria-label={etiqueta}
      onClick={onClick}
      className={`press tecla-2 ${COMPACTO}`}
      style={{
        color: activa ? 'var(--texto)' : 'var(--tenue)',
        boxShadow: activa ? '0 2px 0 var(--canto), var(--sombra-alzado), inset 0 0 0 1.5px var(--texto)' : undefined,
      }}
    >
      <span className="flex flex-col items-center leading-tight">
        <span>{children}</span>
        {detalle && (
          <span className="mt-0.5 text-[10px] font-medium" style={{ color: 'var(--tenue)' }}>
            {detalle}
          </span>
        )}
      </span>
    </button>
  )
}

function cifra(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r).replace('.', ',')
}

export function PortadaDelCuerpo(p: PortadaDelCuerpoProps) {
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const enCuerpo = p.vista === 'cuerpo'
  const lectura = lecturaCorta(p.series)
  // Lo pendiente que se ve en rojo LISO: las que además duelen van a rayas y no se nombran
  // como «por trabajar» (revisión ciega, N5).
  const rojasLisas = (p.porTrabajar ?? []).filter((id) => !p.doloridas.includes(id))

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
              style={{ color: 'var(--texto)', fontWeight: 800, textShadow: 'var(--salon-3d-sombra-portada)' }}
            >
              {p.resumen.nombre}
            </p>
            <p
              className="cifras max-w-full truncate text-[12px] leading-tight"
              style={{ color: 'var(--tenue)', textShadow: 'var(--salon-3d-sombra-portada)' }}
            >
              {p.resumen.cifras}
            </p>
          </div>
        )}

        {/* EL RELOJ: cronometro de la sesion, cuenta atras del descanso o carga. */}
        {enCuerpo && p.reloj && (
          <div
            // `[&_button]:!text-texto`: el boton del cronometro no trae color y en tema claro el del navegador
            // (negro) caia sobre la sala oscura; asi lo pone el token del salon (claro).
            // `[&_button]:pointer-events-auto`: la franja no recibe toques (taparía el cuerpo), pero
            // sus botones sí. Sin esto «Pausar cronómetro» heredaba el `none` y el dedo caía en el
            // modelo 3D de detrás (medido con elementFromPoint el 25-oct).
            className="muro-escena pointer-events-none absolute inset-x-0 flex justify-center [&_button]:pointer-events-auto [&_button]:!text-texto"
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
              <Opcion
                key={c.id}
                activa={c.id === p.capa}
                etiqueta={c.nombre}
                detalle={c.detalle}
                onClick={() => p.alCambiarCapa(c.id)}
              >
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
            <div role="radiogroup" aria-label="Qué series se cuentan" className="grid gap-2">
              {RANGOS.map((r) => (
                <Opcion
                  key={r.id}
                  activa={p.rango === r.id}
                  etiqueta={r.nombre}
                  detalle={r.detalle}
                  onClick={() => p.alCambiarRango(r.id)}
                >
                  {r.nombre}
                </Opcion>
              ))}
            </div>
          )}
          <Opcion
            radio={false}
            activa={false}
            etiqueta={enCuerpo ? 'Ver el movimiento' : 'Ver el cuerpo'}
            detalle={enCuerpo ? 'el ejercicio' : 'capas y series'}
            onClick={() => p.alCambiarVista(enCuerpo ? 'movimiento' : 'cuerpo')}
          >
            {enCuerpo ? 'Movimiento' : 'Cuerpo'}
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
              <p className="text-[15px] leading-tight" style={{ color: 'var(--salon-3d-suelo-texto, var(--tenue))' }}>
                Aún no hay series anotadas
              </p>
            )}
            {lectura && <LecturaDeRegion series={p.series} rango={p.rango} />}
            <p className="text-[10.5px]" style={{ color: 'var(--salon-3d-suelo-texto, var(--tenue))', opacity: 'var(--salon-3d-suelo-opacidad, 0.85)' }}>
              {p.rango === 'hoy' ? 'series hoy' : 'series de la semana'} · cuenta series anotadas, no el estímulo
            </p>
            {/* LA CLAVE DE LOS DOS ROJOS: el liso es lo que queda por trabajar; el de rayas,
                lo que duele. En Piel lo pendiente no se pinta, así que tampoco se dice. */}
            {rojasLisas.length > 0 && p.capa !== 'piel' && (
              <button
                type="button"
                onClick={() => setHojaAbierta(true)}
                data-testigo="por-trabajar"
                // Corta a propósito: la lista entera, en rojo sobre el suelo, no se leía y se metía
                // debajo del botón del reloj. Los nombres van en `aria-label` y en la hoja, que abre.
                aria-label={`En rojo, por trabajar: ${rojasLisas.map((id) => NOMBRE_DE_REGION[id]).join(', ')}`}
                className="press pointer-events-auto mt-0.5 flex min-h-[32px] items-center gap-1.5 text-[12px]"
                style={{ color: 'var(--texto)', fontWeight: 700, textShadow: 'var(--salon-3d-sombra-portada-fuerte)' }}
              >
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--rojo)' }} />
                Rojo: lo que falta por trabajar
              </button>
            )}
            {p.doloridas.length > 0 && (
              <p className="text-[13px]" style={{ color: 'var(--rojo)', fontWeight: 800 }}>
                Te duele (a rayas): {p.doloridas.map((id) => NOMBRE_DE_REGION[id]).join(' · ')}
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
            const falta = p.porTrabajar?.includes(r.id) ?? false
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-texto">{r.nombre}</span>
                <span className="cifras text-tenue">
                  {duele && (
                    <span className="mr-2 font-bold" style={{ color: 'var(--rojo)' }}>
                      Te duele
                    </span>
                  )}
                  {falta && !duele && (
                    <span className="mr-2 font-bold" style={{ color: 'var(--rojo)' }}>
                      Por trabajar
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
