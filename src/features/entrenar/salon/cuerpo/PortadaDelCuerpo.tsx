import { useState, type CSSProperties } from 'react'
import { Sheet } from '../../../../components/ui/Sheet'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, REGIONES, type IdDeRegion } from '../../sujeto/regiones'
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
const TECLA = 'press min-h-[44px] min-w-[58px] rounded-[12px] px-2 text-xs font-extrabold'

function estiloTecla(activa: boolean): CSSProperties {
  return {
    color: activa ? 'var(--texto)' : 'var(--tenue)',
    backgroundColor: 'var(--surface-2)',
    backgroundImage: 'var(--relleno-alzado)',
    boxShadow: activa ? 'var(--sombra-alzado), inset 0 0 0 1.5px var(--texto)' : 'var(--sombra-alzado)',
  }
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
        {enCuerpo && (
          <div
            role="radiogroup"
            aria-label="Capas del cuerpo"
            className="pointer-events-auto absolute grid gap-1.5"
            style={{ right: 'max(8px, env(safe-area-inset-right, 0px))', top: '50%', transform: 'translateY(-50%)' }}
          >
            {CAPAS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === p.capa}
                onClick={() => p.alCambiarCapa(c.id)}
                className={TECLA}
                style={estiloTecla(c.id === p.capa)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        <div
          className="pointer-events-auto absolute inset-x-0 flex flex-col items-center gap-1 px-4 text-center"
          style={{ bottom: 'calc(var(--tope-nav) + 6.6rem)' }}
        >
          {enCuerpo && (
            <>
              <div role="radiogroup" aria-label="Rango de la lectura" className="flex gap-1.5">
                {(['hoy', 'semana'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={p.rango === r}
                    onClick={() => p.alCambiarRango(r)}
                    className={TECLA}
                    style={estiloTecla(p.rango === r)}
                  >
                    {r === 'hoy' ? 'Hoy' : 'Semana'}
                  </button>
                ))}
              </div>
              {lectura ? (
                <button
                  type="button"
                  aria-label="Ver series por región"
                  onClick={() => setHojaAbierta(true)}
                  className="press max-w-full truncate text-[15px] leading-tight"
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
            </>
          )}
          <button
            type="button"
            onClick={() => p.alCambiarVista(enCuerpo ? 'movimiento' : 'cuerpo')}
            className={TECLA}
            style={estiloTecla(false)}
          >
            {enCuerpo ? 'Ver el movimiento' : 'Ver el cuerpo'}
          </button>
        </div>
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
