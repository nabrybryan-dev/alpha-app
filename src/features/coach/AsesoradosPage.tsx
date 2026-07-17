import { Link } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Semaforo } from '../../components/ui/Semaforo'
import { db, useDbVersion } from '../../data/dbInstance'
import { resumenAsesorado } from './resumenAsesorado'

const ordenColor = { rojo: 0, ambar: 1, verde: 2 } as const

export default function AsesoradosPage() {
  useDbVersion()

  const resumenes = db.usuarios
    .asesorados()
    .map((usuario) => resumenAsesorado(db, usuario))
    .sort((a, b) => ordenColor[a.semaforo.color] - ordenColor[b.semaforo.color])

  const pendientesChat = resumenes.reduce((suma, r) => suma + r.noLeidos, 0)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-end justify-between gap-3">
        <div>
          <p className="kicker">Cartera activa</p>
          <h2 className="font-display text-3xl text-texto">Asesorados</h2>
        </div>
        <Link
          to="/coach/chat"
          className="relative rounded-xl border border-linea bg-surface-2 px-4 py-2.5 text-sm font-bold text-texto"
        >
          💬 Bandeja
          {pendientesChat > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rojo px-1 text-[11px] font-bold text-white">
              {pendientesChat}
            </span>
          )}
        </Link>
      </section>

      <section className="flex flex-col gap-2.5">
        {resumenes.map((r) => (
          <Link key={r.usuario.id} to={`/coach/asesorado/${r.usuario.id}`}>
            <Card className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-bold text-texto">
                {r.usuario.avatarIniciales}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-display text-base text-texto">{r.usuario.nombre}</h3>
                  {r.microciclo && <Badge>M{r.microciclo.numero}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Semaforo datos={r.semaforo} />
                  <span className="text-xs text-tenue">Registro {r.pctRegistrado}%</span>
                  {r.noLeidos > 0 && <Badge tono="rojo">{r.noLeidos} 💬</Badge>}
                  {r.cuestionariosPendientes > 0 && (
                    <Badge tono="ambar">{r.cuestionariosPendientes} test</Badge>
                  )}
                </div>
              </div>
              <span className="text-tenue" aria-hidden="true">→</span>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  )
}
