import { SECCIONES, aplica, estaLleno, idDetalle, tieneDetalle, type Valores } from '../../../domain/praxis/ingreso/prueba'
import { campoPorId, type CampoIngreso } from '../../../domain/praxis/ingreso/guion'

/**
 * El formulario del ingreso. Sirve para las dos cosas: ESCRIBIR todo a mano (vacío) y REVISAR lo que salió de
 * hablar y tocar (lleno, editable). Es el mismo en los dos modos, para que la comparación solo mida hablar contra
 * escribir. Controles de verdad: etiquetas, foco visible, objetivos táctiles de 44 px.
 */
interface Props {
  valores: Readonly<Valores>
  alCambiar: (id: string, valor: string) => void
  t: (tu: string, usted: string) => string
  /** En la revisión, lo que viene vacío se marca para que se vea qué falta. */
  marcarVacios?: boolean
}

const ABIERTOS = new Set(['parte_a_mejorar', 'dia_tipo_alimentacion', 'marcas_fuerza'])

function Etiqueta({ c, unidad }: { c: CampoIngreso; unidad?: boolean }) {
  return <>{c.etiqueta}{unidad && c.unidad ? ` (${c.unidad})` : ''}{c.opcional ? ' · opcional' : ''}</>
}

function Campo({ c, valores, alCambiar, t, marcarVacios }: { c: CampoIngreso } & Props) {
  const id = `ing-${c.id}`
  const valor = valores[c.id] ?? ''
  const vacio = marcarVacios && !c.opcional && !estaLleno(valores, c.id)
  const clase = `ing-campo${vacio ? ' ing-campo-vacio' : ''}`
  const pista = vacio ? <span className="ing-falta" id={`${id}-falta`}>{t('Sin dato: complétalo si quieres.', 'Sin dato: complételo si quiere.')}</span> : null
  const describe = vacio ? `${id}-falta` : undefined

  if (c.tipo === 'si_no') {
    return (
      <div className={clase} role="group" aria-label={c.etiqueta}>
        <span className="ing-etiqueta"><Etiqueta c={c} /></span>
        <div className="ing-opciones">
          {(c.opciones ?? []).map((o) => (
            <button key={o} type="button" className="ing-opcion" aria-pressed={valor === o} onClick={() => alCambiar(c.id, o)}>{o}</button>
          ))}
        </div>
        {valor === 'Sí' && tieneDetalle(c) && (
          <>
            <label className="ing-etiqueta" htmlFor={`${id}-detalle`}>{t('¿Cuál? Escríbelo', '¿Cuál? Escríbalo')}</label>
            <textarea id={`${id}-detalle`} className="ing-entrada" rows={2} value={valores[idDetalle(c.id)] ?? ''} onChange={(e) => alCambiar(idDetalle(c.id), e.target.value)} />
          </>
        )}
        {pista}
      </div>
    )
  }
  if (c.tipo === 'opcion') {
    return (
      <div className={clase}>
        <label className="ing-etiqueta" htmlFor={id}><Etiqueta c={c} /></label>
        <select id={id} className="ing-entrada" value={valor} aria-describedby={describe} onChange={(e) => alCambiar(c.id, e.target.value)}>
          <option value="">{t('Elegir…', 'Elegir…')}</option>
          {(c.opciones ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {pista}
      </div>
    )
  }
  const abierto = ABIERTOS.has(c.id)
  return (
    <div className={clase}>
      <label className="ing-etiqueta" htmlFor={id}><Etiqueta c={c} unidad /></label>
      {abierto ? (
        <textarea id={id} className="ing-entrada" rows={3} value={valor} aria-describedby={describe} onChange={(e) => alCambiar(c.id, e.target.value)} />
      ) : (
        <input
          id={id} className="ing-entrada" type="text" value={valor} aria-describedby={describe}
          inputMode={c.tipo === 'numero' ? 'decimal' : 'text'} autoComplete="off"
          onChange={(e) => alCambiar(c.id, e.target.value)}
        />
      )}
      {pista}
    </div>
  )
}

export function FormularioIngreso(props: Props) {
  const { valores, t } = props
  return (
    <div className="ing-formulario">
      {SECCIONES.map((s) => {
        const campos = s.campos.map((id) => campoPorId(id)).filter((c): c is CampoIngreso => !!c && aplica(c, valores))
        return (
          <fieldset key={s.id} className="ing-seccion">
            <legend>{t(s.titulo.tu, s.titulo.usted)}</legend>
            {campos.map((c) => <Campo key={c.id} c={c} {...props} />)}
          </fieldset>
        )
      })}
    </div>
  )
}
