import { textoCifra } from '../../../domain/adminTablero'
import {
  NOMBRE_CLASE_RIESGO,
  SECCION_DE_RIESGO,
  contarRiesgos,
  riesgosDeSecciones,
  type GrupoRiesgo,
} from '../../../domain/riesgosAdmin'
import { CLASE_ETIQUETA } from '../../plan/comun'
import { TarjetaPendiente, TarjetaPlegable } from './TarjetaPlegable'
import type { TableroAdmin } from './useTableroAdmin'

/**
 * Riesgos financieros, operativos y de estrategia (Administración). El tablero 0102 no tiene una
 * sección de riesgos: se muestran las filas ROJAS de finanzas, desvíos y plan (ver
 * `domain/riesgosAdmin.ts`). Sin corte = FALTA en gris; nunca «sin riesgos» por ausencia de dato.
 */

function Grupo({ g }: { g: GrupoRiesgo }) {
  const nombre = NOMBRE_CLASE_RIESGO[g.clase]
  const fuente = SECCION_DE_RIESGO[g.clase]
  return (
    <section aria-label={nombre} className="flex flex-col gap-2">
      <h4 className={CLASE_ETIQUETA}>{nombre}</h4>
      {g.estado === 'falta' && (
        <p className="text-sm font-bold text-tenue">FALTA: el corte de «{fuente}» que carga Bryan; sin él no se sabe si hay riesgos.</p>
      )}
      {g.estado === 'invalida' && (
        <p role="alert" className="text-sm text-rojo">
          Los datos de «{fuente}» llegaron en un formato que la app no entiende ({g.motivo}). No se muestran a medias.
        </p>
      )}
      {g.estado === 'sin_rojos' && <p className="text-sm text-tenue">Ninguna fila en rojo en el corte del {g.corte}.</p>}
      {g.estado === 'con_riesgos' && (
        <ul className="flex flex-col gap-2">
          {g.riesgos.map((r) => {
            const c = textoCifra(r.cifra)
            return (
              <li key={r.id} aria-label={r.titulo} className="flex flex-col gap-0.5 rounded-tarjeta border border-linea p-3 text-[13px]">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-texto">{r.titulo}</span>
                  <span className={`cifras shrink-0 font-bold ${c.falta ? 'text-tenue' : 'text-rojo'}`}>{c.texto}</span>
                </span>
                {r.detalle !== '' && <span className="text-xs text-tenue">{r.detalle}</span>}
                <span className="text-xs text-tenue">
                  {r.queHacer !== '' ? `Qué hacer: ${r.queHacer}` : 'Qué hacer: FALTA'} · Dueño: {r.dueno}
                  {r.fuente ? ` · Fuente: ${r.fuente}` : ' · Fuente: FALTA'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function RiesgosAdmin({ t }: { t: TableroAdmin }) {
  if (t.estado.tipo === 'pendiente') return <TarjetaPendiente nombre="Riesgos" motivo={t.estado.motivo} />
  if (t.estado.tipo !== 'ok') return null
  const grupos = riesgosDeSecciones(t.estado.secciones)
  const n = contarRiesgos(grupos)
  const sinNada = grupos.every((g) => g.estado === 'falta')
  const frase = sinNada
    ? 'FALTA: ninguna sección con cifras (finanzas, desvíos, plan) tiene corte cargado.'
    : n > 0
      ? `${n} ${n === 1 ? 'riesgo en rojo' : 'riesgos en rojo'} entre financieros, operativos y de estrategia.`
      : 'Ninguna fila en rojo en los cortes cargados; lo que no tiene corte dice FALTA.'
  return (
    <TarjetaPlegable nombre="Riesgos" frase={frase}>
      <p className="text-[12.5px] text-tenue">
        Salen de las filas en rojo de finanzas, desvíos y plan. Si un corte no está cargado, no se asume que no haya riesgo.
      </p>
      {grupos.map((g) => (
        <Grupo key={g.clase} g={g} />
      ))}
    </TarjetaPlegable>
  )
}
