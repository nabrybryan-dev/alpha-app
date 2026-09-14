import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { modoNube } from '../../data/supabase'
import {
  agruparErrores,
  DIAS_VENTANA,
  leerErroresRecientes,
  TablaSinAplicar,
  type GrupoDeError,
} from './erroresNube'

type Estado =
  | { fase: 'cargando' }
  | { fase: 'listo'; grupos: GrupoDeError[] }
  | { fase: 'sin-tabla' }
  | { fase: 'error'; mensaje: string }

/** Cuántos grupos se enseñan. Más abajo ya no se leen; el resto se cuenta. */
const MAXIMO_VISIBLE = 15

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function cuando(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * ¿Qué le está fallando a la app en los teléfonos de la gente?
 *
 * Del 10 al 12-sep el cribado falló para todo el mundo y nadie lo supo hasta que llegaron quejas.
 * Esto lo habría dicho en una línea: el mensaje, a cuántas personas, cuántas veces y cuándo fue
 * la última. Se calla cuando no hay nada, y en modo demo.
 */
export function ErroresDelNavegador() {
  // `modoNube` se sabe antes del primer render: en demo no hay nada que cargar ni que pintar.
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })

  useEffect(() => {
    if (!modoNube) return
    let vivo = true
    leerErroresRecientes().then(
      (filas) => {
        if (vivo) setEstado({ fase: 'listo', grupos: agruparErrores(filas) })
      },
      (e: unknown) => {
        if (!vivo) return
        setEstado(
          e instanceof TablaSinAplicar
            ? { fase: 'sin-tabla' }
            : { fase: 'error', mensaje: e instanceof Error ? e.message : 'Error desconocido' },
        )
      },
    )
    return () => {
      vivo = false
    }
  }, [])

  if (!modoNube || estado.fase === 'cargando') return null
  if (estado.fase === 'listo' && estado.grupos.length === 0) return null

  if (estado.fase === 'sin-tabla' || estado.fase === 'error') {
    return (
      <Card>
        <p className="kicker">Errores del navegador</p>
        <p className="mt-1 text-xs leading-relaxed text-tenue">
          {estado.fase === 'sin-tabla'
            ? 'La recogida de errores todavía no está activa: falta aplicar la migración 0078 en Supabase.'
            : `No se pudieron leer los errores: ${estado.mensaje}`}
        </p>
      </Card>
    )
  }

  const visibles = estado.grupos.slice(0, MAXIMO_VISIBLE)
  const resto = estado.grupos.length - visibles.length

  return (
    <Card destacada>
      <div className="flex items-baseline justify-between gap-3">
        <p className="kicker">Errores del navegador</p>
        <span className="text-[11px] font-bold uppercase tracking-wide text-tenue">
          Últimos {DIAS_VENTANA} días
        </span>
      </div>

      <ul className="mt-2 flex flex-col divide-y divide-linea">
        {visibles.map((g) => (
          <li key={g.mensaje} className="py-2">
            <p className="break-words font-mono text-xs text-texto">{g.mensaje}</p>
            <p className="mt-0.5 text-[11px] text-tenue">
              <span className={g.personas > 1 ? 'font-bold text-rojo' : 'font-bold text-ambar'}>
                {plural(g.personas, 'persona', 'personas')} · {plural(g.veces, 'vez', 'veces')}
              </span>
              {' · última '}
              {cuando(g.ultimoVisto)}
            </p>
          </li>
        ))}
      </ul>

      {resto > 0 && (
        <p className="mt-2 text-xs text-tenue">Y {plural(resto, 'mensaje más', 'mensajes más')}.</p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-tenue">
        Cada teléfono manda cada mensaje una sola vez por sesión, así que «veces» cuenta sesiones
        con el fallo, no repeticiones. Lo que le pasa a varias personas suele ser una avería de la
        app; lo de una sola, su teléfono o su conexión.
      </p>
    </Card>
  )
}
