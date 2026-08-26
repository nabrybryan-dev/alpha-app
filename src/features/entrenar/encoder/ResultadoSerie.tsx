import { Card } from '../../../components/ui/Card'
import { COPY } from './copys'
import { GraficaVelocidad } from './GraficaVelocidad'
import { NumeroConError } from './NumeroConError'
import { PlacaHundida, SelloCalidad } from './SelloCalidad'
import type { ResultadoSerie as Resultado } from './nucleo/analisis'

/**
 * La lectura después de medir. Es la pantalla que más veces se va a ver.
 *
 * ## La regla que la ordena
 *
 * **El sello va antes que el número, no al lado.** Si la toma se descartó, nada
 * más debe competir por la atención — y en ese estado no se pinta ni una cifra de
 * velocidad en ningún sitio de la pantalla.
 *
 * No es celo: el caso `descartada` del corpus trae un `vPrimera` de 0,94 m/s
 * perfectamente creíble y **falso**, porque la escala salió de ajustar el círculo
 * a la pila de discos en vez de a la cara del primero. Un número así en gris
 * pequeñito lo acaba usando alguien.
 *
 * ## Por qué el índice de esfuerzo tiene tarjeta propia
 *
 * Porque no es un diagnóstico de la toma —como los fps o el ángulo— sino una
 * lectura del atleta que se compara semana a semana, igual que el %PV. Meterlo en
 * la lista de comprobaciones técnicas lo convertiría en otra cosa.
 */

const MOTIVO_CORTO: Record<string, string> = {
  pocos_fps: COPY.pocos_fps,
  marcador_perdido: COPY.marcador_perdido,
  angulo: COPY.angulo,
  pocas_reps: COPY.pocas_reps,
  sin_escala: COPY.sin_escala,
  inclinacion_no_medible: COPY.inclinacion_no_medible,
  referencia_torcida: COPY.referencia_torcida,
  contorno_parcial: COPY.contorno_parcial,
  sin_segmentar: COPY.sin_segmentar,
}

const MOTIVO_LARGO: Record<string, string | undefined> = {
  pocos_fps: COPY.pocos_fps_largo,
}

const MOTIVO_HACER: Record<string, string | undefined> = {
  pocos_fps: COPY.pocos_fps_hacer,
  marcador_perdido: COPY.marcador_perdido_hacer,
  angulo: COPY.angulo_hacer,
  sin_escala: COPY.sin_escala_hacer,
  inclinacion_no_medible: COPY.inclinacion_no_medible_hacer,
  referencia_torcida: COPY.referencia_torcida_hacer,
  contorno_parcial: COPY.contorno_parcial_hacer,
}

/** Un motivo con su explicación y su acción. En `descartada` ocupan el sitio que
 *  tendría el número, a cuerpo de titular: son lo único que hay que leer. */
function Motivo({ clave, grande = false }: { clave: string; grande?: boolean }) {
  const hacer = MOTIVO_HACER[clave]
  const largo = MOTIVO_LARGO[clave]
  return (
    <div className="border-l-2 border-[var(--placa-muerta)] pl-3">
      <p
        className={`font-display font-bold text-texto ${grande ? 'text-[17px]' : 'text-[13px]'}`}
      >
        {MOTIVO_CORTO[clave] ?? clave}
      </p>
      {grande && largo && <p className="mt-1 text-[12.5px] leading-snug text-tenue">{largo}</p>}
      {hacer && <p className="mt-1 text-[12.5px] leading-snug text-tenue">{hacer}</p>}
    </div>
  )
}

function Diagnostico({ r }: { r: Extract<Resultado, { ok: true }> }) {
  const filas: Array<[string, string]> = [
    ['fps', r.fpsReal.toFixed(1)],
    ['referencia vista', `${Math.round(r.deteccion * 100)} %`],
    ['giro', Number.isFinite(r.anguloMediana) ? `${r.anguloMediana.toFixed(1)}°` : '—'],
    ['concéntrica media', `${r.concSegMedia.toFixed(2)} s`],
    ['recorrido final', Number.isFinite(r.romRelativo) ? `${Math.round(r.romRelativo * 100)} %` : '—'],
  ]
  return (
    <dl className="divide-y divide-hairline">
      {filas.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between py-2">
          <dt className="text-[12.5px] text-tenue">{k}</dt>
          <dd className="font-mono text-[15px] tabular-nums text-texto">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

interface Props {
  resultado: Resultado
  ejercicio: string
  cargaKg?: number
  reps?: number
  onVerPalancas?: () => void
  onRepetir?: () => void
}

export function ResultadoSerie({
  resultado,
  ejercicio,
  cargaKg,
  reps,
  onVerPalancas,
  onRepetir,
}: Props) {
  const cabecera = (
    <p className="text-[12.5px] text-tenue">
      {ejercicio}
      {cargaKg != null && ` · ${cargaKg} kg`}
      {reps != null && ` · ${reps} reps`}
    </p>
  )

  // ── No hubo medición ──────────────────────────────────────────────────────
  // Misma superficie y mismo cuerpo que un resultado bueno. No es un hueco: es un
  // resultado con otro contenido, y cuenta lo que SÍ se sabe, que es lo útil para
  // la siguiente toma.
  if (!resultado.ok) {
    return (
      <div className="space-y-3">
        {cabecera}
        <PlacaHundida titulo="Sin medición">
          <p>{COPY.resultado_sin_medicion}</p>
        </PlacaHundida>
        <Card>
          <p className="text-[12.5px] leading-snug text-tenue">
            {COPY.resultado_sin_medicion_util}
          </p>
        </Card>
        {onRepetir && (
          <button
            type="button"
            onClick={onRepetir}
            className="min-h-11 w-full rounded-panel bg-rojo px-4 font-display font-bold text-white"
          >
            {COPY.resultado_repetir}
          </button>
        )}
      </div>
    )
  }

  const { calidad, pvPct, vPrimera, vUltima, unidad, ie, hayEscala } = resultado
  const descartada = calidad.nivel === 'descartada'
  const motivoQueContamina = calidad.motivos[0]

  return (
    <div className="space-y-3">
      {cabecera}

      {/* 1 · El veredicto, antes que nada. */}
      <SelloCalidad nivel={calidad.nivel}>
        {calidad.motivos.length > 0 && (
          <div className="space-y-2 bg-surface-2 px-3 py-3">
            {calidad.motivos.map((m) => (
              <Motivo key={m} clave={m} grande={descartada} />
            ))}
          </div>
        )}
      </SelloCalidad>

      {descartada ? (
        // En descartada NO se pinta ninguna cifra de velocidad. Ni en gris, ni
        // pequeña, ni detrás de un desplegable.
        <Card>
          <p className="text-[13px] leading-snug text-tenue">{COPY.calidad_descartada_sub}</p>
        </Card>
      ) : (
        <>
          {/* 2 y 3 · El %PV, con v primera y v última al pie: son su origen. */}
          <Card>
            <p className="text-[12.5px] text-tenue">Pérdida de velocidad</p>
            <p className="mt-1 font-mono text-[60px] font-bold leading-none tabular-nums text-texto">
              {pvPct.toFixed(1)}
              <span className="ml-1 text-[24px] text-tenue">%</span>
            </p>
            {calidad.nivel === 'dudosa' && motivoQueContamina === 'pocos_fps' && (
              <p className="mt-2 text-[12.5px] leading-snug text-tenue">{COPY.calidad_dudosa_sub}</p>
            )}
            {pvPct < 0 && (
              <p className="mt-2 text-[12.5px] leading-snug text-tenue">
                {COPY.resultado_pv_negativo}
              </p>
            )}
            <div className="mt-3 flex gap-6 border-t border-hairline pt-3">
              <div>
                <p className="text-[11.5px] text-tenue">primera</p>
                <NumeroConError valor={vPrimera} unidad={unidad} decimales={2} tamano="diagnostico" />
              </div>
              <div>
                <p className="text-[11.5px] text-tenue">última</p>
                <NumeroConError valor={vUltima} unidad={unidad} decimales={2} tamano="diagnostico" />
              </div>
            </div>
          </Card>

          {/* 4 · El índice de esfuerzo, en tarjeta propia. */}
          <Card>
            <p className="text-[12.5px] text-tenue">Índice de esfuerzo</p>
            {Number.isFinite(ie) ? (
              <>
                <p className="mt-1 font-mono text-[34px] font-bold leading-none tabular-nums text-texto">
                  {(ie as number).toFixed(1)}
                </p>
                <p className="mt-1 font-mono text-[11px] text-tenue">VMP₁ × %PV</p>
                <p className="mt-2 text-[12.5px] leading-snug text-tenue">{COPY.resultado_ie_nota}</p>
              </>
            ) : (
              // Un número presente y otro ausente en la misma pantalla, cada uno
              // explicado: el %PV sobrevive porque es un cociente, el IE no
              // porque es un producto y arrastra la unidad.
              <PlacaHundida titulo="No se puede dar" className="mt-2 !px-3 !py-2">
                <p className="text-[12.5px] leading-snug">{COPY.resultado_ie_ausente}</p>
              </PlacaHundida>
            )}
          </Card>

          {/* 5 · La serie entera. */}
          <Card>
            <GraficaVelocidad
              t={resultado.serie.t}
              v={resultado.serie.v}
              reps={resultado.reps}
              unidad={unidad}
            />
          </Card>

          {/* 6 · El diagnóstico, en lista y a cuerpo menor. */}
          <Card>
            <Diagnostico r={resultado} />
          </Card>

          {onVerPalancas && hayEscala && (
            <button
              type="button"
              onClick={onVerPalancas}
              className="min-h-11 w-full rounded-panel border border-hairline-fuerte px-4 font-display font-bold text-texto"
            >
              Ver quién llevó el peso
            </button>
          )}
        </>
      )}
    </div>
  )
}
