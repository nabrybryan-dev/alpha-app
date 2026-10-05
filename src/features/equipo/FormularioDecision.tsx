import { useId, useState } from 'react'
import type { Companero, EntradaDecision } from '../../data/consola/decisiones'
import {
  AREAS,
  AREAS_CON_TEXTO,
  DIRECCIONES,
  NOMBRE_AREA,
  NOMBRE_DIRECCION,
  NOMBRE_PALANCA,
  PALANCAS_CON_MONTO,
  PALANCAS_POR_AREA,
  PATRON_SUJETO,
  PERIODICIDADES,
  TABLAS_REFERENCIA,
  TAREAS_CLINICAS,
  soloElCoach,
  textoVetado,
  type Area,
  type Direccion,
  type Periodicidad,
} from '../../domain/decisionesCompartidas'

/**
 * El formulario para anotar una decisión (tarjeta «Decisiones compartidas»).
 *
 * Reglas que ya cumple ANTES de enviar (la base las vuelve a hacer cumplir): en entrenamiento
 * y nutrición NO hay texto libre ni dinero (solo palanca, dirección y un puntero al plan); en
 * creadores y finanzas el texto pasa por la lista de vetadas; finanzas y las altas de creadores
 * solo las anota el coach. Nunca datos de salud.
 */

const CLASE_CAMPO =
  'min-h-[44px] w-full rounded-xl border border-linea bg-bg px-3 text-sm text-texto placeholder:text-tenue'

export interface BorradorDecision {
  area: Area
  palanca: string
  direccion: Direccion
  sujetoTipo: 'negocio' | 'equipo' | 'seudonimo'
  sujetoEquipo: 'bryan' | 'manuela'
  seudonimo: string
  resumen: string
  monto: string
  periodicidad: Periodicidad | ''
  referenciaTabla: string
  referenciaId: string
  leTocaA: '' | 'bryan' | 'manuela'
  leTocaQue: string
  leTocaVence: string
  firmaDe: string
  firmaNivel: 'firma' | 'aviso'
  firmaVenceEn: string
}

export function borradorVacio(): BorradorDecision {
  const area: Area = 'creadores'
  return {
    area,
    palanca: PALANCAS_POR_AREA[area][0],
    direccion: 'cambia',
    sujetoTipo: 'negocio',
    sujetoEquipo: 'manuela',
    seudonimo: '',
    resumen: '',
    monto: '',
    periodicidad: '',
    referenciaTabla: '',
    referenciaId: '',
    leTocaA: '',
    leTocaQue: '',
    leTocaVence: '',
    firmaDe: '',
    firmaNivel: 'firma',
    firmaVenceEn: '',
  }
}

/** El borrador convertido en la entrada de la RPC, o el motivo por el que aún no se puede enviar. */
export function entradaDeBorrador(b: BorradorDecision): { ok: true; entrada: EntradaDecision } | { ok: false; error: string } {
  const sujeto =
    b.sujetoTipo === 'negocio' ? `negocio:${b.palanca}` : b.sujetoTipo === 'equipo' ? `equipo:${b.sujetoEquipo}` : b.seudonimo.trim()
  if (!PATRON_SUJETO.test(sujeto)) {
    return { ok: false, error: 'Sobre quién: un seudónimo como cli-12, ig:123 o ent-4. Nunca un nombre.' }
  }
  const conTexto = AREAS_CON_TEXTO.includes(b.area)
  const resumen = conTexto ? b.resumen.trim() : ''
  if (resumen.length > 140) return { ok: false, error: 'El resumen admite hasta 140 caracteres.' }
  const leToca = b.leTocaQue.trim()
  for (const [nombre, texto] of [['El resumen', resumen], ['La tarea', leToca]] as const) {
    const vetado = texto ? textoVetado(texto) : null
    if (vetado) return { ok: false, error: `${nombre} trae ${vetado}: aquí no entran datos de salud, contactos ni nombres.` }
  }
  let montoCop: number | null = null
  if (b.area === 'finanzas' && b.monto.trim() !== '') {
    montoCop = Number(b.monto.replace(/[.\s]/g, ''))
    if (!Number.isInteger(montoCop) || montoCop < 0) return { ok: false, error: 'El monto va en pesos enteros, sin decimales.' }
    if (!b.periodicidad) return { ok: false, error: 'Un monto pide su periodicidad (única, mensual o semanal).' }
  }
  if ((b.referenciaTabla !== '') !== (b.referenciaId.trim() !== '')) {
    return { ok: false, error: 'La referencia al plan pide las dos cosas: dónde vive y su clave.' }
  }
  if (b.referenciaId.trim() !== '' && !/^[a-z0-9-]{1,64}$/.test(b.referenciaId.trim())) {
    return { ok: false, error: 'La clave de la referencia lleva solo minúsculas, números y guiones.' }
  }
  if (b.leTocaA === '' && (leToca !== '' || b.leTocaVence !== '')) {
    return { ok: false, error: 'Si hay una tarea o un plazo, dime a quién le toca.' }
  }
  return {
    ok: true,
    entrada: {
      area: b.area,
      palanca: b.palanca,
      direccion: b.direccion,
      sujeto,
      resumen: resumen || null,
      montoCop,
      periodicidad: montoCop !== null ? (b.periodicidad as Periodicidad) : null,
      referenciaTabla: b.referenciaTabla || null,
      referenciaId: b.referenciaId.trim() || null,
      leTocaA: b.leTocaA || null,
      leTocaQue: leToca || null,
      leTocaVence: b.leTocaVence || null,
      firmaDe: b.firmaDe || null,
      firmaNivel: b.firmaDe ? b.firmaNivel : null,
      firmaVenceEn: b.firmaDe && b.firmaVenceEn ? b.firmaVenceEn : null,
    },
  }
}

export function FormularioDecision({
  esCoach,
  companeros,
  borrador,
  onCambio,
  enviando,
  error,
  onEnviar,
  onCancelar,
}: {
  esCoach: boolean
  companeros: Companero[]
  borrador: BorradorDecision
  onCambio: (b: BorradorDecision) => void
  enviando: boolean
  /** El motivo por el que la decisión NO quedó anotada (de la base o de la revisión previa). */
  error: string | null
  onEnviar: () => void
  onCancelar: () => void
}) {
  const id = useId()
  const [mostrarErrorLocal, setMostrarErrorLocal] = useState(false)
  const b = borrador
  const set = <K extends keyof BorradorDecision>(k: K, v: BorradorDecision[K]) => onCambio({ ...b, [k]: v })
  const areas = AREAS.filter((a) => esCoach || a !== 'finanzas')
  const palancas = PALANCAS_POR_AREA[b.area].filter((p) => esCoach || !soloElCoach(b.area, p))
  const conTexto = AREAS_CON_TEXTO.includes(b.area)
  const revision = entradaDeBorrador(b)
  const errorAMostrar = error ?? (mostrarErrorLocal && !revision.ok ? revision.error : null)

  const cambiarArea = (area: Area) => {
    const disponibles = PALANCAS_POR_AREA[area].filter((p) => esCoach || !soloElCoach(area, p))
    onCambio({ ...b, area, palanca: disponibles[0], resumen: '', monto: '', periodicidad: '', leTocaQue: '' })
  }

  return (
    <form
      aria-label="Anotar una decisión"
      className="flex flex-col gap-3 rounded-xl border border-linea p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!revision.ok) {
          setMostrarErrorLocal(true)
          return
        }
        setMostrarErrorLocal(false)
        onEnviar()
      }}
    >
      <label htmlFor={`${id}-area`} className="flex flex-col gap-1 text-xs text-tenue">
        Área
        <select id={`${id}-area`} className={CLASE_CAMPO} value={b.area} onChange={(e) => cambiarArea(e.target.value as Area)}>
          {areas.map((a) => (
            <option key={a} value={a}>{NOMBRE_AREA[a]}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-palanca`} className="flex flex-col gap-1 text-xs text-tenue">
          Qué se decide
          <select id={`${id}-palanca`} className={CLASE_CAMPO} value={b.palanca} onChange={(e) => set('palanca', e.target.value)}>
            {palancas.map((p) => (
              <option key={p} value={p}>{NOMBRE_PALANCA[p] ?? p}</option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-direccion`} className="flex flex-col gap-1 text-xs text-tenue">
          Hacia dónde lleva
          <select id={`${id}-direccion`} className={CLASE_CAMPO} value={b.direccion} onChange={(e) => set('direccion', e.target.value as Direccion)}>
            {DIRECCIONES.map((d) => (
              <option key={d} value={d}>{NOMBRE_DIRECCION[d]}</option>
            ))}
          </select>
        </label>
      </div>

      <label htmlFor={`${id}-sujeto`} className="flex flex-col gap-1 text-xs text-tenue">
        Sobre quién o qué
        <select id={`${id}-sujeto`} className={CLASE_CAMPO} value={b.sujetoTipo} onChange={(e) => set('sujetoTipo', e.target.value as BorradorDecision['sujetoTipo'])}>
          <option value="negocio">El negocio (la palanca)</option>
          <option value="equipo">Alguien del equipo</option>
          <option value="seudonimo">Un seudónimo (cli-12, ig:123, ent-4)</option>
        </select>
      </label>
      {b.sujetoTipo === 'equipo' && (
        <select aria-label="Quién del equipo" className={CLASE_CAMPO} value={b.sujetoEquipo} onChange={(e) => set('sujetoEquipo', e.target.value as 'bryan' | 'manuela')}>
          <option value="manuela">Manuela</option>
          <option value="bryan">Bryan</option>
        </select>
      )}
      {b.sujetoTipo === 'seudonimo' && (
        <input aria-label="Seudónimo" className={CLASE_CAMPO} value={b.seudonimo} onChange={(e) => set('seudonimo', e.target.value)} placeholder="cli-12" autoComplete="off" />
      )}

      {conTexto ? (
        <label htmlFor={`${id}-resumen`} className="flex flex-col gap-1 text-xs text-tenue">
          En una frase (hasta 140, sin datos de salud ni nombres)
          <input id={`${id}-resumen`} className={CLASE_CAMPO} value={b.resumen} maxLength={140} onChange={(e) => set('resumen', e.target.value)} placeholder="Entrenadores que venden coaching → oferta de alquiler" />
        </label>
      ) : (
        <p className="text-xs text-tenue">
          En entrenamiento y nutrición no se escribe texto: solo qué palanca, hacia dónde y el plan de la app al que apunta.
        </p>
      )}

      {b.area === 'finanzas' && (
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={`${id}-monto`} className="flex flex-col gap-1 text-xs text-tenue">
            Monto en pesos {PALANCAS_CON_MONTO.includes(b.palanca) ? '(si no se sabe, déjalo vacío)' : '(opcional)'}
            <input id={`${id}-monto`} inputMode="numeric" className={CLASE_CAMPO} value={b.monto} onChange={(e) => set('monto', e.target.value)} placeholder="400000" />
          </label>
          <label htmlFor={`${id}-periodicidad`} className="flex flex-col gap-1 text-xs text-tenue">
            Periodicidad
            <select id={`${id}-periodicidad`} className={CLASE_CAMPO} value={b.periodicidad} onChange={(e) => set('periodicidad', e.target.value as Periodicidad | '')}>
              <option value="">—</option>
              {PERIODICIDADES.map((p) => (
                <option key={p} value={p}>{p === 'unica' ? 'única' : p}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!conTexto && (
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={`${id}-reftabla`} className="flex flex-col gap-1 text-xs text-tenue">
            Plan al que apunta
            <select id={`${id}-reftabla`} className={CLASE_CAMPO} value={b.referenciaTabla} onChange={(e) => set('referenciaTabla', e.target.value)}>
              <option value="">Sin plan (queda incompleta)</option>
              {TABLAS_REFERENCIA.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-refid`} className="flex flex-col gap-1 text-xs text-tenue">
            Su clave
            <input id={`${id}-refid`} className={CLASE_CAMPO} value={b.referenciaId} onChange={(e) => set('referenciaId', e.target.value)} placeholder="mc-0001" autoComplete="off" />
          </label>
        </div>
      )}

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-xs text-tenue">A quién le toca</legend>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="A quién le toca" className={CLASE_CAMPO} value={b.leTocaA} onChange={(e) => set('leTocaA', e.target.value as BorradorDecision['leTocaA'])}>
            <option value="">A nadie todavía</option>
            <option value="bryan">Bryan</option>
            <option value="manuela">Manuela</option>
          </select>
          <input aria-label="Plazo de la tarea" type="date" className={CLASE_CAMPO} value={b.leTocaVence} onChange={(e) => set('leTocaVence', e.target.value)} />
        </div>
        {b.leTocaA !== '' &&
          (conTexto ? (
            <input aria-label="Qué le toca" className={CLASE_CAMPO} value={b.leTocaQue} maxLength={80} onChange={(e) => set('leTocaQue', e.target.value)} placeholder="preparar el mensaje" />
          ) : (
            <select aria-label="Qué le toca" className={CLASE_CAMPO} value={b.leTocaQue} onChange={(e) => set('leTocaQue', e.target.value)}>
              <option value="">Sin tarea</option>
              {TAREAS_CLINICAS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1 text-xs text-tenue">Firma del otro</legend>
        <select aria-label="Quién firma" className={CLASE_CAMPO} value={b.firmaDe} onChange={(e) => set('firmaDe', e.target.value)}>
          <option value="">No pide firma</option>
          {companeros.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        {b.firmaDe !== '' && (
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Nivel de la firma" className={CLASE_CAMPO} value={b.firmaNivel} onChange={(e) => set('firmaNivel', e.target.value as 'firma' | 'aviso')}>
              <option value="firma">Firma (decide)</option>
              <option value="aviso">Aviso (solo lo ve)</option>
            </select>
            <input aria-label="Plazo de la firma" type="date" className={CLASE_CAMPO} value={b.firmaVenceEn} onChange={(e) => set('firmaVenceEn', e.target.value)} />
          </div>
        )}
        {b.firmaDe !== '' && b.firmaNivel === 'firma' && b.firmaVenceEn === '' && (
          <p className="text-xs text-tenue">Sin plazo, la decisión queda incompleta: «FALTA: plazo de firma».</p>
        )}
      </fieldset>

      {errorAMostrar && (
        <p role="alert" className="text-sm font-semibold text-rojo">
          {error ? `NO ANOTADA: ${error}` : errorAMostrar}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={enviando} className="press min-h-[48px] flex-1 rounded-boton bg-texto px-4 font-display text-[13px] uppercase text-bg disabled:opacity-60">
          {enviando ? 'Anotando…' : error ? 'Reintentar' : 'Anotar decisión'}
        </button>
        <button type="button" onClick={onCancelar} className="press min-h-[48px] rounded-boton border border-linea px-4 text-sm text-texto">
          Cancelar
        </button>
      </div>
    </form>
  )
}
