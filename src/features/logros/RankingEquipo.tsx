import { Card } from '../../components/ui/Card'
import { db, useDbVersion } from '../../data/dbInstance'

/**
 * Ranking de disciplina del Equipo Alpha (diseño Stitch "Comunidad"): tabla
 * de cumplimiento puro. Aquí se felicita al más juicioso; los datos
 * personales de cada asesorado (ánimo, cargas, notas) nunca se muestran.
 */
export function RankingEquipo({ usuarioActualId }: { usuarioActualId: string }) {
  useDbVersion()
  const filas = db.ranking.list()
  if (filas.length < 2) return null

  const [lider, ...resto] = filas

  return (
    <Card aria-label="Ranking del Equipo Alpha">
      <div className="flex flex-col items-center pb-4 pt-2 text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 text-ambar"
        >
          <path d="M4 8l4 4 4-6 4 6 4-4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        </svg>
        <div
          className="mt-2 grid h-16 w-16 place-items-center rounded-full border-2 border-rojo font-display text-xl text-rojo"
          style={{ boxShadow: 'var(--halo-rojo)' }}
        >
          {lider.iniciales}
        </div>
        <p className="mt-2 font-display text-lg leading-none text-texto">{lider.nombre}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-rojo">
          El más juicioso del equipo
        </p>
        <p className="cifras mt-2 font-display text-3xl leading-none text-texto">
          {lider.puntos}
          <span className="ml-1 text-xs font-normal text-tenue">pts</span>
        </p>
      </div>

      <div className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {resto.map((fila, i) => {
          const propia = fila.usuarioId === usuarioActualId
          return (
            <div key={fila.usuarioId} className="flex items-center gap-3 py-2.5">
              <p className="cifras w-5 shrink-0 text-center text-xs text-tenue">{i + 2}</p>
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                  propia ? 'border-rojo text-rojo' : 'border-hairline text-tenue'
                }`}
              >
                {fila.iniciales}
              </div>
              <p className={`min-w-0 flex-1 truncate text-sm ${propia ? 'font-bold text-texto' : 'text-texto/90'}`}>
                {fila.nombre}
                {propia && <span className="ml-1.5 text-[10px] font-normal text-rojo">tú</span>}
              </p>
              <p className="cifras shrink-0 text-sm font-bold text-texto">
                {fila.puntos}
                <span className="ml-0.5 text-[10px] font-normal text-tenue">pts</span>
              </p>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-[10px] text-tenue">
        Puntos por sesiones completas, nutrición cumplida y check-ins · últimos 30 días
      </p>
    </Card>
  )
}
