import { db, useDbVersion } from '../../data/dbInstance'
import { alarmasDeDolor } from '../../domain/equipo/seguridad'
import { Boton3D } from '../../components/ui/Boton3D'

/**
 * La seguridad del equipo, siempre visible (maqueta 7, paso 9; regla 2 del encargo).
 *
 * Reúne la derivación de alarmas que ya existía: el dolor de 4/10 o más del último check-in
 * de cada persona. El filtro de sombreros NO puede esconderla: por eso vive fuera de la
 * lista filtrada de cada pantalla. No valora nada ni decide nada —eso es del coach—, solo
 * pone delante a quién mirar y lleva a su ficha.
 */
export function AvisosDeSeguridad({ conNombres }: { conNombres: boolean }) {
  useDbVersion()
  const personas = conNombres ? db.usuarios.entrenan() : []
  const checkins = Object.fromEntries(
    personas.map((p) => [p.id, db.bienestar.byUsuario(p.id)]),
  )
  const alarmas = alarmasDeDolor(personas, checkins)

  return (
    <section
      aria-label="Seguridad"
      className={`flex flex-col gap-2 rounded-tarjeta border bg-surface-1 p-4 shadow-sm ${
        alarmas.length > 0 ? 'border-rojo' : 'border-linea'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">
        Seguridad · alerta del check-in
      </p>
      {!conNombres ? (
        <p className="text-sm text-tenue">
          Las alertas del check-in se ven con el permiso de leer el entrenamiento.
        </p>
      ) : alarmas.length === 0 ? (
        <p className="text-sm text-tenue">Sin alertas de dolor en los últimos check-ins.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alarmas.map((a) => (
            <li key={a.usuarioId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-texto">{a.nombre}</span>
              <span className="text-sm text-rojo">
                Dolor {a.dolor}/10{a.donde ? ` · ${a.donde}` : ''}
              </span>
              <span className="text-xs text-tenue">check-in del {a.fecha}</span>
              <Boton3D
                to={`/equipo/${encodeURIComponent(a.usuarioId)}`}
              >
                Abrir su ficha
              </Boton3D>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-tenue">
        El tablero no lo valora: te toca a ti. Abrir la ficha es el primer paso, no la decisión.
      </p>
    </section>
  )
}
