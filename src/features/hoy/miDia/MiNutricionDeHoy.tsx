import { Link } from 'react-router-dom'
import { catalogoRepo } from '../../../data/catalogo/catalogoRepo'
import { db } from '../../../data/dbInstance'
import { visibilidadDelAsesorado } from '../../../data/visibilidadDelAsesorado'
import { resumenDelDia } from '../../../domain/nutricion/resumen'
import { ResumenDia } from '../../nutricion/ResumenDia'

interface MiNutricionDeHoyProps {
  usuarioId: string
  hoy: string
}

/**
 * «Mi nutrición de hoy» en Mi día: lo comido hoy contra su objetivo, con la MISMA tarjeta
 * que abre el diario (`ResumenDia`) y la misma cuenta (`resumenDelDia`, meta del día ALTO,
 * que es la que usa `DiarioDia`). Así no hay dos números para el mismo día.
 *
 * La decisión de qué cifras ve la persona (`visibilidadDelAsesorado`, 0018) también manda
 * aquí: si tiene el contador apagado, la tarjeta se queda con el margen, como en el diario.
 *
 * Va en su propio módulo, cargado a demanda, porque arrastra el catálogo de alimentos
 * (1.195 filas): el asesorado que no ve esta tarjeta no tiene por qué descargarlo en Hoy.
 */
export default function MiNutricionDeHoy({ usuarioId, hoy }: MiNutricionDeHoyProps) {
  const plan = db.nutricion.planByUsuario(usuarioId)
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
        <ResumenDia total={total} meta={plan.macrosPorDia.ALTO} visibilidad={visibilidadDelAsesorado(usuarioId)} />
      ) : (
        <p className="text-sm text-tenue">
          Tu plan nutricional todavía no está cargado: sin él no hay objetivo contra el que medir el día.
        </p>
      )}
    </section>
  )
}
