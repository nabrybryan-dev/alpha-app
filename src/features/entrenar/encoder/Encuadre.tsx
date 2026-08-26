import { useMemo, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { COPY } from './copys'
import { DiagramaEncuadre } from './DiagramaEncuadre'
import { textoDeMotivo } from './motivosEncuadre'
import { PlacaHundida, SelloCalidad } from './SelloCalidad'
import { calificarEncuadre, encuadre as calcular } from './nucleo/encuadre'

/**
 * Dónde plantar la cámara, decidido **antes** de grabar.
 *
 * Es la única pantalla del encoder que se usa de pie, con el trípode en una mano,
 * antes de que exista ningún dato. Por eso manda el diagrama y no el número: la
 * persona está resolviendo un problema físico, no leyendo un informe.
 *
 * ## El par de errores va siempre, en los tres estados
 *
 * «Sin corregir» y «corrigiendo» se enseñan juntos y a la misma escala. Sueltos no
 * dicen nada; enfrentados son la cifra que convence —29 % contra 11 % en la mala
 * conocida del corpus—. Y hay una razón más para que estén incluso cuando el sello
 * dice `buena`: el núcleo aprueba 22° de desvío, que llevan el error sin corregir
 * al 14,7 %. Mientras esa puerta no se decida, la cifra a la vista es lo que impide
 * que un sello llano se lea como una promesa. Ver `motivosEncuadre.ts`.
 *
 * ## Y la nota del pie no es letra pequeña
 *
 * Esto es trigonometría: sirve para **descartar** colocaciones, no para garantizar
 * precisión. No modela la lente ni la compresión del vídeo.
 */

interface Props {
  /** Estatura del asesorado, si el perfil la tiene: afina la cota del alzado. */
  alturaCaderaM?: number
  onConfirmar?: (entrada: { dist: number; altura: number; desvio: number }) => void
  inicial?: { dist?: number; altura?: number; desvio?: number; fov?: number }
}

interface ControlProps {
  etiqueta: string
  valor: number
  min: number
  max: number
  paso: number
  formato: (v: number) => string
  onCambio: (v: number) => void
}

/** Fila de 56 px. Se manipula de pie, así que el pomo es el objetivo táctil. */
function Control({ etiqueta, valor, min, max, paso, formato, onCambio }: ControlProps) {
  return (
    <label className="flex h-14 items-center gap-3">
      <span className="w-[104px] shrink-0 text-[12.5px] text-tenue">{etiqueta}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(ev) => onCambio(Number(ev.target.value))}
        className="h-11 flex-1 accent-[var(--rojo)]"
        aria-label={etiqueta}
      />
      <span className="w-[68px] shrink-0 text-right font-mono text-[13px] tabular-nums text-texto">
        {formato(valor)}
      </span>
    </label>
  )
}

/** Los dos errores, enfrentados. La barra da la escala que el número solo no da. */
function ParDeErrores({ sinCorregir, corregido }: { sinCorregir: number; corregido: number }) {
  const tope = Math.max(0.3, sinCorregir * 1.15)
  const pct = (x: number) => `${(100 * x).toFixed(1)} %`
  const ancho = (x: number) => `${Math.min(100, (100 * x) / tope)}%`

  return (
    <Card>
      <div className="grid grid-cols-2 gap-4">
        {[
          { rotulo: 'sin corregir', v: sinCorregir, color: 'var(--rojo)' },
          { rotulo: 'corrigiendo', v: corregido, color: 'var(--placa)' },
        ].map((c, i) => (
          <div key={c.rotulo}>
            <p className="text-[11px] uppercase tracking-wide text-tenue">{c.rotulo}</p>
            <p className="mt-1 font-mono text-[27px] font-bold tabular-nums leading-none text-texto">
              {pct(c.v)}
            </p>
            <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[var(--hundido)]">
              {/* El stagger de 60 ms hace que se lean como comparación y no como
                  dos datos sueltos. Se anima el ancho una sola vez, a la entrada. */}
              <div
                className="h-full rounded-full motion-safe:animate-[crecer-barra_420ms_cubic-bezier(.16,1,.3,1)_both]"
                style={{
                  width: ancho(c.v),
                  background: c.color,
                  animationDelay: `${i * 60}ms`,
                  transformOrigin: "left",
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-hairline pt-2 text-[11.5px] leading-snug text-tenue">
        Corrigiendo nunca se llega a cero: lo que queda es el ruido de localizar el
        borde del disco.
      </p>
    </Card>
  )
}

export function Encuadre({ alturaCaderaM, onConfirmar, inicial }: Props) {
  const [dist, setDist] = useState(inicial?.dist ?? 2.5)
  const [altura, setAltura] = useState(inicial?.altura ?? 0.95)
  const [desvio, setDesvio] = useState(inicial?.desvio ?? 0)
  const fov = inicial?.fov ?? 70

  // El cálculo es la fuente de verdad y vive en el núcleo vendorizado, que es
  // donde lo cubren las pruebas. Aquí no se recalcula nada a mano.
  const e = useMemo(
    () => calcular({ dist, altura, desvio, fov, ejeM: alturaCaderaM }),
    [dist, altura, desvio, fov, alturaCaderaM],
  )
  const calidad = useMemo(() => calificarEncuadre(e), [e])

  const veredicto: Record<string, string> = {
    buena: COPY.encuadre_buena,
    dudosa: COPY.encuadre_dudosa,
    descartada: COPY.encuadre_descartada,
  }

  return (
    <div className="space-y-3 pb-24">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wide text-tenue">
          Antes de grabar
        </p>
        <h1 className="mt-1 font-display text-[27px] font-bold leading-tight text-texto">
          Dónde plantar
          <br />
          la cámara
        </h1>
      </header>

      {/* 1. El diagrama: es lo único que se mira de pie. */}
      <Card>
        <DiagramaEncuadre e={e} alturaCaderaM={alturaCaderaM} />
      </Card>

      {/* 2. La placa. Los motivos ocupan el sitio del veredicto cuando los hay. */}
      {calidad.nivel === 'descartada' ? (
        <PlacaHundida titulo={veredicto.descartada}>
          <p className="font-display text-[15px] font-bold text-texto">
            {calidad.motivos.map(textoDeMotivo).join(' · ')}
          </p>
        </PlacaHundida>
      ) : (
        <SelloCalidad nivel={calidad.nivel} subtitulo={veredicto[calidad.nivel]}>
          {calidad.motivos.length > 0 && (
            <div className="bg-surface-2 px-3 py-3">
              <p className="text-[12.5px] text-tenue">
                {calidad.motivos.map(textoDeMotivo).join(' · ')}
              </p>
            </div>
          )}
        </SelloCalidad>
      )}

      {/* 3. Los tres controles, en una sola tarjeta. */}
      <Card>
        <Control
          etiqueta="Distancia"
          valor={dist}
          min={1}
          max={5}
          paso={0.1}
          formato={(v) => `${v.toFixed(1)} m`}
          onCambio={setDist}
        />
        <Control
          etiqueta="Altura lente"
          valor={altura}
          min={0.05}
          max={1.6}
          paso={0.05}
          formato={(v) => `${v.toFixed(2)} m`}
          onCambio={setAltura}
        />
        <Control
          etiqueta="Desvío"
          valor={desvio}
          min={0}
          max={45}
          paso={1}
          formato={(v) => `${v.toFixed(0)}°`}
          onCambio={setDesvio}
        />
      </Card>

      {/* 4. El par de errores. */}
      <ParDeErrores sinCorregir={e.errorSinCorregir} corregido={e.errorCorregido} />

      {/* 5. La nota, que no es letra pequeña. */}
      <p className="px-1 text-[11.5px] leading-snug text-tenue">{COPY.encuadre_nota}</p>

      <button
        type="button"
        onClick={() => onConfirmar?.({ dist, altura, desvio })}
        className="min-h-11 w-full rounded-full bg-[var(--rojo)] py-3 font-display text-[15px] font-bold text-white"
      >
        {COPY.encuadre_cta}
      </button>
    </div>
  )
}
