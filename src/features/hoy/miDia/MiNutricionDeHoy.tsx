import { Link } from 'react-router-dom'
import { catalogoRepo } from '../../../data/catalogo/catalogoRepo'
import { db } from '../../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../../data/visibilidadDelAsesorado'
import { AVISO_SIN_MACROS, macrosDelDia } from '../../../domain/nutricion/macrosDelDia'
import { resumenDelDia } from '../../../domain/nutricion/resumen'
import { etiquetaDelTipoDeDia, tipoDiaDeLaFecha } from '../../../domain/nutricion/tipoDiaDeLaFecha'
import type { EstadoAdherencia } from '../../../domain/types'
import { ResumenDia } from '../../nutricion/ResumenDia'

/** Las mismas palabras que usa el diario al confirmar lo marcado (`AdherenciaDia`). */
const ETIQUETA_DE_LO_MARCADO: Record<EstadoAdherencia, string> = {
  si: 'cumplido',
  parcial: 'parcial',
  no: 'no cumplido',
}

interface MiNutricionDeHoyProps {
  usuarioId: string
  hoy: string
  /**
   * `mini` es la fila delgada de la banda «Lo de hoy» del asesorado (maqueta v7): título,
   * una línea con lo registrado y el botón «Registrar». Las cifras salen de las MISMAS
   * cuentas de abajo; solo cambia cuánto se dibuja. Por omisión, la tarjeta completa.
   */
  variante?: 'completa' | 'mini'
}

/**
 * «Mi nutrición de hoy» en Mi día: lo comido hoy contra su objetivo, con la MISMA tarjeta
 * que abre el diario (`ResumenDia`) y la misma cuenta (`resumenDelDia`) con el MISMO tipo de
 * día que el diario (`tipoDiaDeLaFecha`, que lo lee de los menús del plan). Así no hay dos
 * números para el mismo día. Si el plan no dice qué tipo es hoy, cae en ALTO como el diario.
 *
 * La tarjeta DICE qué meta usa (E-10 de la revisión de Codex del 28-sep) en vez de callarlo.
 *
 * La decisión de qué cifras ve la persona (`visibilidadDelAsesorado`, 0018) también manda
 * aquí: si tiene el contador apagado, la tarjeta se queda con el margen, como en el diario.
 *
 * Va en su propio módulo, cargado a demanda, porque arrastra el catálogo de alimentos
 * (1.195 filas): así no pesa en la primera pintura de Hoy; llega justo después.
 */
export default function MiNutricionDeHoy({ usuarioId, hoy, variante = 'completa' }: MiNutricionDeHoyProps) {
  const plan = db.nutricion.planByUsuario(usuarioId)
  const tipoDia = tipoDiaDeLaFecha(plan, hoy)
  const meta = macrosDelDia(plan, tipoDia)
  const total = resumenDelDia(db.registroComidas.delDia(usuarioId, hoy), (id) => catalogoRepo.porId(id))

  if (variante === 'mini') {
    const comidas = new Set(db.registroComidas.delDia(usuarioId, hoy).map((r) => r.comida)).size
    const kcal = Math.round(total.porDia.kcal ?? 0)
    const { verContadorKcal } = visibilidadDelAsesorado(usuarioId)
    const registradas = `${comidas} ${comidas === 1 ? 'comida registrada' : 'comidas registradas'}`
    const marcada = db.nutricion.adherenciasByUsuario(usuarioId).find((a) => a.fecha === hoy)
    const lineaDelPlan = !plan
      ? 'Tu plan todavía no está cargado'
      : verContadorKcal && meta
        ? `${registradas} · ${kcal.toLocaleString('es-CO')} de ${meta.kcal.toLocaleString('es-CO')} kcal`
        : registradas
    // Quien marca «¿Cumpliste el plan hoy?» sin registrar comidas no debe leer solo «0 comidas».
    const linea = marcada ? `Hoy marcaste: ${ETIQUETA_DE_LO_MARCADO[marcada.estado]} · ${lineaDelPlan}` : lineaDelPlan
    return (
      <section
        aria-label="Nutrición de hoy"
        className="entrada entrada-5 hoy-tarjeta flex items-center justify-between gap-3 !py-3"
      >
        <div className="min-w-0">
          <p className="hoy-fila-titulo">Nutrición de hoy</p>
          <small className="text-xs text-tenue">{linea}</small>
        </div>
        <Link to="/nutricion" className="press tecla-2 shrink-0 text-sm font-semibold text-texto">
          Registrar
        </Link>
      </section>
    )
  }

  return (
    <section
      aria-label="Mi nutrición de hoy"
      className="entrada entrada-5 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-tenue">Mi nutrición de hoy</p>
        <Link
          to="/nutricion"
          className="press inline-flex min-h-[44px] items-center text-xs font-semibold text-texto underline underline-offset-2"
        >
          {plan ? 'Abrir mi diario' : 'Ir a nutrición'}
        </Link>
      </div>
      {plan ? (
        <>
          {meta ? (
            <ResumenDia total={total} meta={meta} visibilidad={visibilidadDelAsesorado(usuarioId)} />
          ) : (
            <p role="alert" className="text-xs text-tenue">
              {AVISO_SIN_MACROS}
            </p>
          )}
          {meta && (
          <p className="text-xs text-tenue">
            Meta de hoy ({etiquetaDelTipoDeDia(plan, tipoDia)}): la misma que usa tu diario.
          </p>
          )}
        </>
      ) : (
        <p className="text-sm text-tenue">
          Tu plan nutricional todavía no está cargado: sin él no hay objetivo contra el que medir el día.
        </p>
      )}
    </section>
  )
}
