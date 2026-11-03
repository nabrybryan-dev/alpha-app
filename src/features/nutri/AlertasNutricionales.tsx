import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../data/dbInstance'
import { ETIQUETA_ALERTA, traerAlertasNutricion, type AlertaNutricion } from '../../data/nube/alertasNutricion'

/**
 * Alertas nutricionales abiertas, para Manuela (H-02). El aviso del teléfono es neutro («Tienes una
 * alerta nueva de un asesorado»); aquí, con sesión de nutricionista, está el detalle: quién, qué y por qué.
 *
 * Apagado por defecto: mientras la nutricionista no firme cada alerta (tabla alertas_nutricion_ajustes,
 * migración 0148) no hay filas y esto no pinta nada. Si la lectura falla tampoco pinta ni rompe.
 */
export function AlertasNutricionales() {
  const [alertas, setAlertas] = useState<AlertaNutricion[]>([])

  useEffect(() => {
    let vivo = true
    traerAlertasNutricion()
      .then((a) => {
        if (vivo) setAlertas(a)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  if (alertas.length === 0) return null

  return (
    <section aria-label="Alertas nutricionales" className="flex flex-col gap-2 rounded-tarjeta border border-rojo bg-surface-1 p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">Alertas nutricionales</p>
      <ul className="flex flex-col gap-3">
        {alertas.map((a) => {
          const nombre = db.usuarios.byId(a.asesoradoId)?.nombre ?? 'Persona no disponible'
          return (
            <li key={a.id} className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-texto">
                {nombre} · {ETIQUETA_ALERTA[a.clave] ?? a.clave}
              </span>
              <span className="text-sm text-tenue">{a.detalle}</span>
              <Link
                to={`/equipo-nutricion?persona=${encodeURIComponent(a.asesoradoId)}`}
                className="press inline-flex min-h-[44px] items-center text-sm font-semibold underline"
              >
                Ver a {nombre.split(' ')[0]}
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-tenue">El tablero no decide qué hacer: te toca a ti.</p>
    </section>
  )
}
