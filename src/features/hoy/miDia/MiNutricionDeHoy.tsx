import { Link } from 'react-router-dom'
import { catalogoRepo } from '../../../data/catalogo/catalogoRepo'
import { db } from '../../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../../data/visibilidadDelAsesorado'
import { AVISO_SIN_MACROS, macrosDelDia } from '../../../domain/nutricion/macrosDelDia'
import { resumenDelDia } from '../../../domain/nutricion/resumen'
import type { TipoDia } from '../../../domain/types'
import { ResumenDia } from '../../nutricion/ResumenDia'

/** Sin fuente del tipo de día, el mismo que fija `DiarioDia`. */
const TIPO_DIA_POR_DEFECTO: TipoDia = 'ALTO'

interface MiNutricionDeHoyProps {
  usuarioId: string
  hoy: string
}

/**
 * «Mi nutrición de hoy» en Mi día: lo comido hoy contra su objetivo, con la MISMA tarjeta
 * que abre el diario (`ResumenDia`) y la misma cuenta (`resumenDelDia`, meta del día ALTO,
 * que es la que usa `DiarioDia`). Así no hay dos números para el mismo día.
 *
 * La app todavía NO sabe qué tipo de día es hoy (ALTO, BAJO o CHEAT): el diario también lo
 * fija en ALTO. Coincidir con el diario no lo vuelve correcto, así que la tarjeta DICE qué
 * meta usa (E-10 de la revisión de Codex del 28-sep) en vez de callarlo. Cuando exista una
 * fuente común del tipo de día, esta línea se va y la meta sale de ella.
 *
 * La decisión de qué cifras ve la persona (`visibilidadDelAsesorado`, 0018) también manda
 * aquí: si tiene el contador apagado, la tarjeta se queda con el margen, como en el diario.
 *
 * Va en su propio módulo, cargado a demanda, porque arrastra el catálogo de alimentos
 * (1.195 filas): el asesorado que no ve esta tarjeta no tiene por qué descargarlo en Hoy.
 */
export default function MiNutricionDeHoy({ usuarioId, hoy }: MiNutricionDeHoyProps) {
  const plan = db.nutricion.planByUsuario(usuarioId)
  const meta = macrosDelDia(plan, TIPO_DIA_POR_DEFECTO)
  const total = resumenDelDia(db.registroComidas.delDia(usuarioId, hoy), (id) => catalogoRepo.porId(id))

  return (
    <section
      aria-label="Mi nutrición de hoy"
      className="entrada entrada-5 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Mi nutrición de hoy</p>
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
            Meta del día {TIPO_DIA_POR_DEFECTO}
            {plan.etiquetasDia?.[TIPO_DIA_POR_DEFECTO] ? ` («${plan.etiquetasDia[TIPO_DIA_POR_DEFECTO]}»)` : ''}: todavía no se
            elige el tipo de día, así que se mide contra esa, igual que el diario.
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
