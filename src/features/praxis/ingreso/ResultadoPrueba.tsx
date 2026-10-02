import { useState } from 'react'
import {
  ROTULO_SEGMENTO, SEGMENTOS_DE, comparar, formatoTiempo, textoParaCopiar, type ResultadoModo,
} from '../../../domain/praxis/ingreso/prueba'

/**
 * El resultado de la prueba: tiempo total, tiempo por parte (voz), campos que la persona corrigió en la revisión y,
 * si hizo los dos modos, la comparación lado a lado. «Copiar resultado» copia un texto corto con SOLO tiempos y
 * conteos: nada del formulario. No se guarda en ningún sitio.
 */
interface Props {
  voz: ResultadoModo | null
  escribir: ResultadoModo | null
  t: (tu: string, usted: string) => string
  alProbarOtro: (modo: 'voz' | 'escribir') => void
  alReiniciar: () => void
}

function Tarjeta({ r, t }: { r: ResultadoModo; t: Props['t'] }) {
  const esVoz = r.modo === 'voz'
  return (
    <section className="ing-tarjeta" aria-label={esVoz ? t('Resultado hablando', 'Resultado hablando') : t('Resultado escribiendo', 'Resultado escribiendo')}>
      <h3 className="ing-h3">{esVoz ? 'Hablando' : 'Escribiendo'}</h3>
      <p className="ing-total" aria-label={`Tiempo total ${formatoTiempo(r.totalMs)}`}>{formatoTiempo(r.totalMs)}</p>
      {esVoz && (
        <dl className="ing-partes">
          {SEGMENTOS_DE.voz.map((s) => (
            <div key={s}><dt>{ROTULO_SEGMENTO[s]}</dt><dd>{formatoTiempo(r.segmentosMs[s] ?? 0)}</dd></div>
          ))}
        </dl>
      )}
      <p className="ing-dato">{t('Campos llenos', 'Campos llenos')}: {r.camposLlenos} de {r.camposTotales}</p>
      {r.corregidos && (
        <p className="ing-dato">
          {t('Corregiste en la revisión', 'Corrigió en la revisión')}: {r.corregidos.etiquetas.length + r.corregidos.deSalud}
          {r.corregidos.etiquetas.length + r.corregidos.deSalud > 0 && (
            <> · {[...r.corregidos.etiquetas, ...(r.corregidos.deSalud > 0 ? [`${r.corregidos.deSalud} de salud`] : [])].join(', ')}</>
          )}
        </p>
      )}
      {r.turnos && (
        <p className="ing-dato">
          {t('Turnos', 'Turnos')}: {r.turnos.porVoz} {t('por voz', 'por voz')}, {r.turnos.porTeclado} {t('escritos', 'escritos')}, {r.turnos.repetidos} {t('repetidos', 'repetidos')}, {r.turnos.detenidos} {t('detenidos por Praxis', 'detenidos por Praxis')}
        </p>
      )}
    </section>
  )
}

export function ResultadoPrueba({ voz, escribir, t, alProbarOtro, alReiniciar }: Props) {
  const [copia, setCopia] = useState<'nada' | 'copiado' | 'manual'>('nada')
  const [texto, setTexto] = useState('')

  async function copiar() {
    const contenido = textoParaCopiar({ voz, escribir }, new Date())
    setTexto(contenido)
    try {
      await navigator.clipboard.writeText(contenido)
      setCopia('copiado')
    } catch {
      setCopia('manual') // sin permiso del portapapeles: se enseña el texto para copiarlo a mano
    }
  }

  const comp = voz && escribir ? comparar(voz, escribir) : null
  return (
    <div className="ing-resultado">
      <h2 className="ing-h2">{t('Listo. Este es tu resultado', 'Listo. Este es su resultado')}</h2>
      <div className="ing-tarjetas">
        {voz && <Tarjeta r={voz} t={t} />}
        {escribir && <Tarjeta r={escribir} t={t} />}
      </div>

      {comp && voz && escribir && (
        <section className="ing-tarjeta ing-comparacion" aria-label={t('Comparación', 'Comparación')}>
          <h3 className="ing-h3">{t('Comparación', 'Comparación')}</h3>
          <div className="ing-lado">
            <div><span className="ing-rotulo">Hablando</span><span className="ing-total">{formatoTiempo(voz.totalMs)}</span></div>
            <div><span className="ing-rotulo">Escribiendo</span><span className="ing-total">{formatoTiempo(escribir.totalMs)}</span></div>
          </div>
          <p className="ing-dato">
            {comp.masRapido === 'igual'
              ? t('Tardaron lo mismo.', 'Tardaron lo mismo.')
              : `${comp.masRapido === 'voz' ? 'Hablando' : 'Escribiendo'} fue más rápido por ${formatoTiempo(comp.diferenciaMs)}${comp.veces !== null ? ` (${comp.veces.toFixed(1).replace('.', ',')} veces)` : ''}.`}
          </p>
        </section>
      )}

      <p className="ing-nota">
        {t(
          'La segunda vez ya sabes qué te piden y vas más rápido: para comparar bien, que cada persona alterne cuál hace primero.',
          'La segunda vez ya sabe qué le piden y va más rápido: para comparar bien, que cada persona alterne cuál hace primero.',
        )}
      </p>

      <div className="ing-botones">
        <button type="button" className="ing-boton ing-boton-primario" onClick={copiar}>{t('Copiar resultado', 'Copiar resultado')}</button>
        <p className="ing-estado" role="status">
          {copia === 'copiado' && t('Copiado. Solo lleva tiempos y conteos, nada de lo que escribiste.', 'Copiado. Solo lleva tiempos y conteos, nada de lo que escribió.')}
          {copia === 'manual' && t('No pude copiar solo. Selecciona el texto y cópialo:', 'No pude copiar solo. Seleccione el texto y cópielo:')}
        </p>
        {copia !== 'nada' && (
          <textarea className="ing-entrada ing-copia" readOnly rows={7} value={texto} aria-label={t('Texto para copiar', 'Texto para copiar')} onFocus={(e) => e.currentTarget.select()} />
        )}
        {!voz && <button type="button" className="ing-boton" onClick={() => alProbarOtro('voz')}>{t('Probar ahora hablando', 'Probar ahora hablando')}</button>}
        {!escribir && <button type="button" className="ing-boton" onClick={() => alProbarOtro('escribir')}>{t('Probar ahora escribiendo', 'Probar ahora escribiendo')}</button>}
        <button type="button" className="ing-boton ing-boton-suave" onClick={alReiniciar}>{t('Empezar de nuevo', 'Empezar de nuevo')}</button>
      </div>
    </div>
  )
}
