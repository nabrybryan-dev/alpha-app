import { useRef } from 'react'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, type IdDeRegion } from '../../sujeto/regiones'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { Opcion } from './OpcionDeTecla'
import { useToqueSobreElCuerpo } from './useToqueSobreElCuerpo'
import type { CamaraDelSalon } from '../paredes/geometriaDeCuadro'
import { HuecoDeDatos } from '../paredes/HuecoDeDatos'
import { relojEnMarcha, type AnclasDelReloj, type ModoDelReloj } from '../mando/relojDelMuro'
import { lecturaCorta, type SeriesPorRegion } from '../../sujeto/tinte'
import { GuiaDePraxis } from '../guia/GuiaDePraxis'
import { lineaDePraxis } from '../guia/zonasDePraxis'
import type { EstadoDeLaGuia } from '../guia/useZonaDePraxis'

/**
 * LA PORTADA DEL CUERPO: lo que se lee ENCIMA del sujeto de Blender.
 *
 * El centro es el cuerpo y UNA línea de Praxis (Bryan, 30-oct: «muy cargado de botones»). Tocar un
 * músculo o esa línea abre la guía, que trae lo que antes ocupaba los lados: capas, rango, movimiento
 * y la vuelta. Solo el dolor sigue a la vista siempre: es seguridad. La guía cuenta SERIES ANOTADAS,
 * no estímulo, y lo dice. Es el hueco `cuerpo` de `huecos.ts`.
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
  /** Hacia dónde mira la cámara (grados) y qué hace «Dar la vuelta»; sin lo segundo no hay botón. */
  azimutDelCuerpo?: number
  /** La cámara con la que se dibuja el cuerpo. Con ella, un toque corto SOBRE el sujeto abre esa zona. */
  camara?: CamaraDelSalon
  alDarLaVuelta?: (azimut: number) => void
  /** Lo abierto en la guía de Praxis y cómo moverse por ella. Lo guarda el salón: también pinta el cuerpo. */
  guia?: EstadoDeLaGuia
  alIrEnLaGuia?: (destino: EstadoDeLaGuia, azimutActual: number) => void
  alIrAlEjercicio?: (indice: number) => void
  sesion?: Sesion
  semana?: readonly Sesion[]
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

function ResumenDelEjercicio({ nombre, cifras }: { nombre: string; cifras: string }) {
  return (
    <div
      data-testigo="resumen-del-ejercicio"
      className="pointer-events-none absolute inset-x-0 flex flex-col items-center px-6 text-center"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8.4rem)' }}
    >
      <p
        className="max-w-full truncate text-[15px] leading-tight"
        style={{ color: 'var(--texto)', fontWeight: 800, textShadow: 'var(--salon-3d-sombra-portada)' }}
      >
        {nombre}
      </p>
      <p
        className="cifras max-w-full truncate text-[12px] leading-tight"
        style={{ color: 'var(--tenue)', textShadow: 'var(--salon-3d-sombra-portada)' }}
      >
        {cifras}
      </p>
    </div>
  )
}

/**
 * LA CUENTA: descanso, excéntrico o carga. El tiempo de sesión vive en la vista de movimiento; esto
 * sigue montado mientras la cuenta corre, para que avise al terminar.
 */
function CuentaDelCuerpo({ reloj }: { reloj: NonNullable<PortadaDelCuerpoProps['reloj']> }) {
  if (!relojEnMarcha(reloj.modo, reloj.cargaEnLaPared)) return null
  return (
    <div
      // `[&_button]:!text-texto`: el boton del cronometro no trae color y en tema claro el del navegador
      // (negro) caia sobre la sala oscura. `[&_button]:pointer-events-auto`: la franja no recibe toques
      // (taparía el cuerpo), pero sus botones sí (medido con elementFromPoint el 25-oct).
      className="muro-escena pointer-events-none absolute inset-x-0 flex justify-center [&_button]:pointer-events-auto [&_button]:!text-texto"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 11.6rem)', fontSize: '22px' }}
    >
      <HuecoDeDatos
        muestra={reloj.cargaEnLaPared ? 'carga' : 'reloj'}
        sesion={reloj.sesion}
        ejercicio={reloj.ejercicio}
        textoDeCarga={reloj.textoDeCarga}
        cargaPrevia={reloj.cargaPrevia}
        modo={reloj.modo}
        anclas={reloj.anclas}
        alTerminarLaCuenta={reloj.alTerminarLaCuenta}
      />
    </div>
  )
}

/** Qué dice la línea: lo que el cuerpo está pintando. En Piel lo pendiente no se pinta, así que no se nombra. */
function textoDeLaLinea(p: PortadaDelCuerpoProps, pendientes: readonly IdDeRegion[]): string {
  if (p.rango === 'hoy') return lineaDePraxis(p.capa === 'piel' ? [] : pendientes, p.series)
  const hecho = lecturaCorta(p.series)
  return hecho ? `Esta semana: ${hecho}` : 'Esta semana aún no hay series anotadas'
}

/** LA ÚNICA LÍNEA DEL CENTRO. `pointer-events-none` en la franja: de ancho completo, taparía el cuerpo. */
function LineaDePraxis({ linea, doloridas, alAbrir }: { linea: string; doloridas: readonly IdDeRegion[]; alAbrir: () => void }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1 px-4 text-center"
      style={{ bottom: 'calc(var(--tope-hoja) + 1rem)', zIndex: 'var(--z-elevado)' }}
    >
      {doloridas.length > 0 && (
        <p className="text-[13px]" style={{ color: 'var(--rojo)', fontWeight: 800 }}>
          Te duele (a rayas): {doloridas.map((id) => NOMBRE_DE_REGION[id]).join(' · ')}
        </p>
      )}
      <button
        type="button"
        aria-label={`Abrir Praxis. ${linea}`}
        onClick={alAbrir}
        className="press tecla-2 pointer-events-auto max-w-full !px-3 text-[13px] font-bold"
        style={{ color: 'var(--texto)' }}
      >
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--tenue)' }}>
          Praxis
        </span>
        <span className="truncate">{linea}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  )
}

export function PortadaDelCuerpo(p: PortadaDelCuerpoProps) {
  const enCuerpo = p.vista === 'cuerpo'
  const azimut = p.azimutDelCuerpo ?? 0
  const guia = enCuerpo ? (p.guia ?? null) : null
  const ir = (destino: EstadoDeLaGuia) => p.alIrEnLaGuia?.(destino, azimut)
  const ancla = useRef<HTMLDivElement>(null)
  // Sin el centro y el campo con que se dibuja (el primer fotograma) no hay cámara que invertir.
  const lente = p.camara?.centro && p.camara.campo ? { ...p.camara, centro: p.camara.centro, campo: p.camara.campo } : undefined
  // Tocar la zona ya abierta la suelta y vuelve al cuerpo entero.
  useToqueSobreElCuerpo(ancla, lente, enCuerpo, (id) => ir(id === guia ? null : id))
  const porTrabajar = p.porTrabajar ?? []
  // Lo pendiente que se nombra: lo que además duele va a rayas y no se llama «por trabajar» (N5).
  const pendientes = porTrabajar.filter((id) => !p.doloridas.includes(id))

  return (
    <>
      <div ref={ancla} data-hueco="cuerpo" className="pointer-events-none absolute inset-0">
        {enCuerpo && !guia && p.resumen && <ResumenDelEjercicio {...p.resumen} />}
        {enCuerpo && p.reloj && <CuentaDelCuerpo reloj={p.reloj} />}

        {/* En la vista de movimiento, la única tecla: volver al cuerpo. */}
        {!enCuerpo && (
          <div
            className="pointer-events-auto absolute"
            style={{ left: 'max(8px, env(safe-area-inset-left, 0px))', top: '42%', transform: 'translateY(-50%)' }}
          >
            <Opcion radio={false} activa={false} etiqueta="Ver el cuerpo" detalle="capas y series" onClick={() => p.alCambiarVista('cuerpo')}>
              Cuerpo
            </Opcion>
          </div>
        )}

        {enCuerpo && !guia && <LineaDePraxis linea={textoDeLaLinea(p, pendientes)} doloridas={p.doloridas} alAbrir={() => ir('indice')} />}
      </div>

      {/* El panel va FUERA del hueco: `pointer-events: none` se hereda y lo dejaría sordo. */}
      {guia && (
        <GuiaDePraxis
          estado={guia}
          sesion={p.sesion}
          semana={p.semana ?? []}
          series={p.series}
          doloridas={p.doloridas}
          porTrabajar={porTrabajar}
          capa={p.capa}
          rango={p.rango}
          azimut={p.azimutDelCuerpo}
          alIr={ir}
          alIrAlEjercicio={(i) => {
            p.alIrAlEjercicio?.(i)
            ir(null)
          }}
          alCambiarCapa={p.alCambiarCapa}
          alCambiarRango={p.alCambiarRango}
          alVerMovimiento={() => p.alCambiarVista('movimiento')}
          alDarLaVuelta={p.alDarLaVuelta}
        />
      )}
    </>
  )
}
