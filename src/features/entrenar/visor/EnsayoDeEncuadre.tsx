import { useState } from 'react'
import type { Colocacion } from '../escena/tripode'
import { juzgarColocacion, lecturasDeColocacion } from './juzgarColocacion'
import { SelloCalidad } from '../encoder/SelloCalidad'
import { textoDeMotivo } from '../encoder/motivosEncuadre'

/**
 * EL ENSAYO DE COLOCACIÓN: dónde plantar el móvil ANTES de grabar.
 *
 * ## Qué resuelve
 *
 * El encoder ya juzga la toma REAL en cuanto la cámara está abierta —mide el ángulo del
 * disco y avisa «endereza»—, pero eso es tarde: ya montaste el trípode y apuntaste. Esto
 * es el ensayo: mueves tres deslizadores —a qué lado del sujeto, a qué distancia, a qué
 * altura— y te dice si DESDE AHÍ saldrá una medida en la que se pueda confiar, sin haber
 * tocado el teléfono todavía.
 *
 * ## Por qué se puede fiar de lo que dice
 *
 * Porque no reimplementa la regla: `juzgarColocacion` traduce la colocación a la entrada
 * del núcleo y quien decide es `calificarEncuadre()`, **la misma función que juzga una
 * toma de verdad**, con sus mismos topes y sus mismos motivos. Un ensayo que aprobara lo
 * que la grabación descarta enseñaría a plantar el móvil donde no se puede medir — y ese
 * error saldría en el gimnasio, con la serie ya hecha.
 *
 * ## El veredicto se dice con MATERIA, no con verde y rojo
 *
 * Reutiliza el `SelloCalidad` del encoder: placa llena, hueca o hundida. Es la regla de
 * marca —no hay verde, y el rojo es color de marca, no de error— y además se lee a tres
 * metros y en escala de grises, que es como se mira un móvil en un trípode a la distancia
 * de una sentadilla.
 *
 * ## Por qué hacen falta las dos cosas, altura Y distancia
 *
 * Porque «la cámara está baja» no es una propiedad del móvil: es del PAR altura-distancia.
 * `camara_baja` es un tope angular, así que la distancia lo diluye —una lente a 15 cm a
 * 3 m queda apenas 15° bajo la cadera y pasa; los mismos 15 cm a 2 m saltan—. Un solo
 * deslizador no podría enseñar eso.
 */

/** Desde dónde arranca el ensayo: el perfil, a tres metros y a la altura de la cadera. */
const COLOCACION_INICIAL: Colocacion = { anguloGrados: 180, distancia: 3.0, altura: 1.0 }

/** La frase que acompaña a cada veredicto, dicha para ESTE juicio (dónde plantar), no
 *  para el de un resultado (qué número decide carga). */
const FRASE: Record<'buena' | 'dudosa' | 'descartada', string> = {
  buena: 'Desde aquí sale una medida fiable',
  dudosa: 'Desde aquí la medida es dudosa',
  descartada: 'Desde aquí la toma se descarta',
}

function Deslizador({
  etiqueta,
  min,
  max,
  value,
  onChange,
  lectura,
}: {
  etiqueta: string
  min: number
  max: number
  value: number
  onChange: (n: number) => void
  lectura?: string
}) {
  return (
    <label className="flex items-center gap-3 text-[11px] uppercase tracking-[0.1em] text-tenue">
      <span className="w-[68px] shrink-0">{etiqueta}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-surface-3 accent-rojo"
      />
      {lectura !== undefined && (
        <span className="w-[52px] shrink-0 text-right font-mono text-texto">{lectura}</span>
      )}
    </label>
  )
}

export function EnsayoDeEncuadre() {
  const [colocacion, setColocacion] = useState<Colocacion>(COLOCACION_INICIAL)
  const [hayDisco, setHayDisco] = useState(false)

  const veredicto = juzgarColocacion(colocacion, hayDisco)
  const lecturas = lecturasDeColocacion(colocacion)

  return (
    <div className="flex flex-col gap-3">
      {/* El sello da la MATERIA (llena, hueca, hundida) y la frase la lee para ESTE
          juicio. El sello inline enseña solo la palabra —el subtítulo es cosa del sello
          grande de un resultado—, así que la frase va a su lado, no dentro. */}
      <div className="flex items-center gap-3">
        <SelloCalidad nivel={veredicto.nivel} tamano="inline">
          {veredicto.motivos.length > 0 && (
            <p className="text-[12px] text-tenue">
              {veredicto.motivos.map(textoDeMotivo).join(' · ')}
            </p>
          )}
        </SelloCalidad>
        <span className="text-[13px] leading-snug text-texto">{FRASE[veredicto.nivel]}</span>
      </div>

      {/* Los números salen del MISMO cálculo que el veredicto (`lecturasDeColocacion`
          usa el mismo `encuadre()` que `juzgarColocacion`): ver un ancho de escena que
          la puerta no usa sería peor que no verlo. */}
      <p className="font-mono text-[12px] text-tenue">
        desvío <b className="text-texto">{lecturas.desvio.toFixed(0)}°</b>
        <span className="mx-1.5 text-linea">/</span>
        escena <b className="text-texto">{lecturas.anchoEscenaM.toFixed(1)} m</b>
        <span className="mx-1.5 text-linea">/</span>
        disco <b className="text-texto">{lecturas.discoPx.toFixed(0)} px</b>
      </p>

      <div className="flex flex-col gap-2.5">
        <Deslizador
          etiqueta="Ángulo"
          min={150}
          max={210}
          value={Math.round(colocacion.anguloGrados)}
          onChange={(n) => setColocacion((c) => ({ ...c, anguloGrados: n }))}
        />
        <Deslizador
          etiqueta="Distancia"
          min={16}
          max={45}
          value={Math.round(colocacion.distancia * 10)}
          onChange={(n) => setColocacion((c) => ({ ...c, distancia: n / 10 }))}
          lectura={`${colocacion.distancia.toFixed(1)} m`}
        />
        <Deslizador
          etiqueta="Altura"
          min={30}
          max={160}
          value={Math.round(colocacion.altura * 100)}
          onChange={(n) => setColocacion((c) => ({ ...c, altura: n / 100 }))}
          lectura={`${colocacion.altura.toFixed(2)} m`}
        />
      </div>

      {/* El núcleo no puede adivinar si el ejercicio lleva barra con discos, y la
          diferencia es el DOBLE de margen: 30° de desvío se admiten viendo un disco,
          contra 12 sin él —el disco deja medir φ y deshacer el escorzo—. Arranca en «no»
          porque dar por hecho el disco sería dar por hecha la corrección. */}
      <button
        type="button"
        onClick={() => setHayDisco((v) => !v)}
        aria-pressed={hayDisco}
        className={`press self-start rounded-lg border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] ${
          hayDisco ? 'border-texto text-texto' : 'border-linea text-tenue'
        }`}
      >
        {hayDisco ? 'Con disco a la vista' : 'Sin disco a la vista'}
      </button>
    </div>
  )
}
