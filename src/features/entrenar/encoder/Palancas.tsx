import { Card } from '../../../components/ui/Card'
import { COPY } from './copys'
import { GraficaBrazo } from './GraficaBrazo'
import { IntervaloAEscala, NumeroConError } from './NumeroConError'
import { SelloCalidad, PlacaHundida } from './SelloCalidad'
import { causaDominante, sigmaDe, type MedidaDePalancas } from './medidaDePalancas'

/**
 * Quién llevó el peso: el brazo de momento en cada eje, con su barra de error.
 *
 * ## El orden, y no es negociable
 *
 * **Las negativas van arriba, antes de cualquier número.** Nunca plegadas, nunca
 * al pie, nunca en cuerpo menor que el de la pantalla. Es lo que separa este
 * producto de las apps que dan un número siempre, y por eso no se adorna ni se
 * anima: animar una advertencia la convierte en decoración.
 *
 * ## Los tres estados sin dato no se parecen entre sí
 *
 * `escala_dudosa` tiene número y no se sostiene. `no_medible` no tiene número.
 * `ejercicio_no_aplica` no es un veredicto sobre la toma sino un límite del
 * método — y por eso **no lleva placa**: dársela haría que la persona repitiera
 * la grabación buscando arreglar algo que no se arregla grabando.
 */

interface Props {
  medida: MedidaDePalancas
  /** Quién había en cuadro. Con `ambiguo` false la fila se queda callada. */
  seleccion?: { personas: number; ambiguo: boolean }
  onCambiarAtleta?: () => void
  /** La versión del asesorado: solo el eje protagónico y las negativas. */
  reducida?: boolean
}

/** El gesto de selección, con sus dos pesos.
 *
 *  Nueve de cada diez tomas no son ambiguas —medido sobre 28 vídeos: hay más de
 *  una persona en el 46 %, pero solo compite en el 7 %—, así que por defecto esto
 *  es una fila callada. Añadir un paso a todas las mediciones por un riesgo que no
 *  existe en el 93 % de los casos sería cobrarle a todos el error de unos pocos.
 */
/** El copy del diseño abre con «Dos personas en cuadro», que era el caso que se
 *  redactó, y el conteo real es dato. Aquí se descarta esa primera frase porque el
 *  titular ya la dice con el número de verdad: repetirla debajo diría dos veces lo
 *  mismo en la misma tarjeta. Lo que se conserva es el resto, que es donde está el
 *  argumento y no depende del número — si nos equivocamos, el esqueleto sale
 *  impecable y es de otro. */
function explicacionAmbigua(): string {
  const completo = COPY.palancas_senalar_atleta_ambiguo
  const corte = completo.indexOf('. ')
  return corte < 0 ? completo : completo.slice(corte + 2)
}

function Seleccion({
  personas,
  ambiguo,
  onCambiar,
}: {
  personas: number
  ambiguo: boolean
  onCambiar?: () => void
}) {
  if (!ambiguo) {
    return (
      <div className="flex min-h-11 items-center gap-2 text-[12.5px] text-tenue">
        <span className="h-[30px] w-[30px] shrink-0 rounded-sm bg-surface-3" aria-hidden="true" />
        <span className="flex-1">
          {personas === 1
            ? COPY.palancas_senalar_atleta_callado
            : `Atleta seleccionado · ${personas} en cuadro`}
        </span>
        {onCambiar && (
          <button type="button" onClick={onCambiar} className="underline-offset-2 hover:underline">
            Cambiar
          </button>
        )}
      </div>
    )
  }
  // El único caso en que esto sube de jerarquía: si el atleta está mal elegido,
  // todo lo que hay debajo es de otra persona.
  return (
    <Card destacada>
      <div className="flex gap-3">
        <div
          className="h-[78px] w-[104px] shrink-0 rounded-sm bg-surface-3 ring-2 ring-rojo"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="font-display text-[15px] font-bold text-texto">
            {personas} personas en cuadro
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-tenue">
            {explicacionAmbigua()}
          </p>
          {onCambiar && (
            <button
              type="button"
              onClick={onCambiar}
              className="mt-2 min-h-11 rounded-full border border-rojo px-4 text-[12.5px] font-bold text-rojo"
            >
              Cambiar de persona
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

/** «Lo que no se puede prometer». Arriba, en cuerpo pleno y quieto. */
function Negativas({ textos }: { textos: string[] }) {
  if (!textos.length) return null
  return (
    <Card>
      <p className="font-display text-[15px] font-bold text-texto">
        {COPY.palancas_negativas_titulo}
      </p>
      <ul className="mt-2 space-y-2">
        {textos.map((t) => (
          <li key={t} className="border-l-2 border-[var(--placa-muerta)] pl-3 text-[13px] leading-snug text-tenue">
            {t}
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function Palancas({ medida, seleccion, onCambiarAtleta, reducida = false }: Props) {
  const { ejeObjetivo, sigmaBrazoMm, escala, maximoEje, negativas, causas, medidos, total } = medida
  const escalaDudosa = medida.ok && !escala.fiable
  // Se compara por el arranque de la frase y no por igualdad: el análisis redacta
  // la negativa con la cifra real del vídeo («dispersa un 21 %»), que no coincide
  // con el copy de ejemplo salvo en ese vídeo.
  const yaEnNegativas = negativas.some((n) => n.includes('dispersa un'))

  const cabecera = (
    <div className="space-y-3">
      {seleccion && (
        <Seleccion
          personas={seleccion.personas}
          ambiguo={seleccion.ambiguo}
          onCambiar={onCambiarAtleta}
        />
      )}
      <Negativas textos={negativas} />
    </div>
  )

  // ── El ejercicio no entra en el modelo ────────────────────────────────────
  // SIN placa: no es un veredicto sobre la toma, es un límite del método.
  if (medida.motivo === 'ejercicio_no_aplica') {
    return (
      <div className="space-y-3">
        <div className="rounded-panel border border-dashed border-[var(--placa-muerta)] p-4">
          <p className="font-display text-[21px] font-bold text-tenue">{COPY.palancas_no_aplica}</p>
          <p className="mt-2 text-[13px] leading-snug text-tenue">
            {medida.explicacion ?? COPY.palancas_no_aplica_sub}
          </p>
        </div>
      </div>
    )
  }

  // ── No se puede medir ─────────────────────────────────────────────────────
  if (!medida.ok) {
    const dom = causaDominante(causas)
    // La frase depende de la causa: solo `sin_consenso` autoriza decir que
    // repetir no lo va a arreglar. Si el grueso es de encuadre, lo honesto es
    // exactamente lo contrario.
    const sub =
      dom?.remedio === 'encuadre'
        ? `${medidos} de ${total} fotogramas medibles. Vuelve a encuadrar y repite: la mayoría se cayeron porque no se veía lo que hacía falta.`
        : COPY.palancas_no_medible_sub

    return (
      <div className="space-y-3">
        {cabecera}
        <PlacaHundida titulo={COPY.palancas_no_medible}>
          <p>{sub}</p>
        </PlacaHundida>
        {/* Hace visible la escala del problema sin dar ni un número de brazo. */}
        <Card>
          <div className="flex flex-wrap gap-[3px]" aria-hidden="true">
            {Array.from({ length: Math.min(total, 120) }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-[1px] ${i < medidos ? 'bg-[var(--placa)]' : 'bg-[var(--hundido)]'}`}
              />
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-tenue">
            {medidos} de {total} fotogramas medibles
          </p>
        </Card>
      </div>
    )
  }

  const sigmaObjetivo = (() => {
    for (const f of medida.porFotograma) {
      const b = f.brazos?.[ejeObjetivo]
      if (b) return sigmaDe(b, sigmaBrazoMm)
    }
    return sigmaBrazoMm
  })()

  return (
    <div className="space-y-3">
      {cabecera}

      {/* El sello NO repite la razón si el análisis ya la puso arriba. El caso
          dudoso trae la frase de la dispersión dentro de `negativas`, así que
          pintarla otra vez aquí la decía dos veces en la misma pantalla — y una
          advertencia repetida se lee como plantilla, no como aviso. */}
      {escalaDudosa && (
        <SelloCalidad nivel="dudosa">
          {yaEnNegativas ? null : (
            <div className="bg-surface-2 px-3 py-3">
              <p className="text-[12.5px] leading-snug text-tenue">
                {COPY.palancas_escala_dudosa}
              </p>
            </div>
          )}
        </SelloCalidad>
      )}

      {/* El eje protagónico y su máximo. */}
      <Card>
        <p className="text-[12.5px] text-tenue">
          {medida.grupoObjetivoTexto
            ? `Trabaja ${medida.grupoObjetivoTexto}`
            : `Eje protagónico · ${ejeObjetivo}`}
        </p>
        {maximoEje && (
          <>
            <p className="mt-1 capitalize text-[12.5px] text-tenue">{ejeObjetivo}</p>
            <NumeroConError
              valor={Math.abs(maximoEje.mm)}
              sigma={sigmaObjetivo}
              unidad="mm"
              atenuado={escalaDudosa}
              className="mt-1"
            />
            {maximoEje.fraccion != null && (
              <p className="mt-1 font-mono text-[11.5px] tabular-nums text-tenue">
                máximo al {Math.round(maximoEje.fraccion * 100)} % de la repetición
              </p>
            )}
          </>
        )}
        {escalaDudosa && maximoEje && (
          <IntervaloAEscala
            valor={Math.abs(maximoEje.mm)}
            sigma={sigmaObjetivo}
            sigmaSana={15}
            max={400}
          />
        )}
        <p className="mt-3 border-t border-hairline pt-2 text-[11.5px] text-tenue">
          {medidos} de {total} fotogramas
          {medida.descartadosPorSalto > 0 && ` · ${medida.descartadosPorSalto} por salto imposible`}
        </p>
      </Card>

      {!reducida && (
        <Card>
          <GraficaBrazo
            fotogramas={medida.porFotograma}
            ejeObjetivo={ejeObjetivo}
            sigmaBrazoMm={sigmaBrazoMm}
            bandasDominantes={escalaDudosa}
          />
        </Card>
      )}
    </div>
  )
}
