/**
 * El parte de novedades al abrir el panel: a quién se le activó el microciclo
 * siguiente y a quién hay que mirar antes.
 *
 * El barrido corre en el inicializador de `useState`, no en un `useEffect`: activar
 * cambia la base y eso ya re-renderiza vía `useDbVersion`; hacerlo desde un efecto
 * sería encadenar un `setState` a ese cambio.
 *
 * Lo que se enseña es la foto de ANTES de activar —«qué se hizo», no «cómo quedó»—
 * y esa foto la guarda `barrerYActivar`, no este componente. Tiene que guardarla
 * alguien: StrictMode corre el inicializador dos veces, y sin memo la segunda
 * pasada (que ya ve el microciclo nuevo) pisaba la primera y el resumen mentía.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL «TERCER ESCRITOR», APAGADO POR DEFECTO (decisión de Bryan, 24-sep-2026)
 * ────────────────────────────────────────────────────────────────────────────
 * `barrerYActivar` no solo mira: activa microciclos en la base cada vez que
 * alguien abre `/coach` con este panel montado. Eso compite con la cadena de
 * agentes, que carga sus propias semanas ya activas (`cargar.py`) sin esperar a
 * que nadie abra un panel. Con dos escritores sobre el mismo dato, el que entra
 * segundo pisa al primero sin avisar.
 *
 * Igual que `modoNube` en `data/supabase.ts`, la bandera decide en tiempo de
 * build (`import.meta.env`), no en runtime: sin `VITE_MOTOR_APP_ACTIVO=true` el
 * panel SOLO LEE (`revisarCartera`) y no escribe nada. Revertir es poner esa
 * variable en Vercel.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { db } from '../../data/dbInstance'
import { barrerYActivar, conclusion, revisarCartera, type FilaCartera } from './revisionCartera'

const motorActivo = import.meta.env.VITE_MOTOR_APP_ACTIVO === 'true'

export function PanelMicrociclos() {
  const [filas] = useState<FilaCartera[]>(() =>
    motorActivo ? barrerYActivar(db) : revisarCartera(db),
  )

  const activadas = filas.filter((f) => f.estado === 'automatica')
  const enEspera = filas.filter((f) => f.estado === 'revisar')
  // Sin nada vencido no se pinta nada: un panel que dice «0 novedades» todos los
  // días enseña a no mirarlo, y el día que traiga algo tampoco se mirará.
  if (activadas.length === 0 && enEspera.length === 0) return null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-base text-texto">Microciclos</h3>
        {activadas.length > 0 && (
          <Badge tono="verde">
            {activadas.length}{' '}
            {activadas.length === 1
              ? motorActivo
                ? 'activado'
                : 'listo'
              : motorActivo
                ? 'activados'
                : 'listos'}
          </Badge>
        )}
        {enEspera.length > 0 && <Badge tono="ambar">{enEspera.length} por revisar</Badge>}
      </div>

      {/* Con el motor apagado, nada de esto se activa solo: lo dice para no
          prometer algo que ya no hace este panel. */}
      {!motorActivo && (
        <p className="text-xs text-tenue">Las semanas nuevas las carga la cadena de agentes.</p>
      )}

      {enEspera.length > 0 && (
        <Grupo titulo="Te esperan a ti" filas={enEspera} />
      )}
      {activadas.length > 0 && (
        <Grupo
          titulo={motorActivo ? 'Se activaron solos' : 'Listos para la cadena'}
          filas={activadas}
        />
      )}
    </Card>
  )
}

/** Los de revisar van primero: son los únicos que piden una acción. */
function Grupo({ titulo, filas }: { titulo: string; filas: readonly FilaCartera[] }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="kicker">{titulo}</p>
      {filas.map((fila) => (
        <Link
          key={fila.usuario.id}
          to={`/coach/asesorado/${fila.usuario.id}`}
          className="flex flex-col gap-0.5 rounded-xl border border-linea bg-surface-2 px-3 py-2"
        >
          <span className="font-display text-sm text-texto">{fila.usuario.nombre}</span>
          <span className="text-xs leading-snug text-tenue">{conclusion(fila)}</span>
        </Link>
      ))}
    </section>
  )
}
