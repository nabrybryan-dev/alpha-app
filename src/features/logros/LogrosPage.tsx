import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { CifraAnimada } from '../../components/ui/CifraAnimada'
import { Medalla } from '../../components/ui/Medalla'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Revelar } from '../../components/ui/Revelar'
import { db, useDbVersion } from '../../data/dbInstance'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'
import { ASESORADOS_DESTACADOS } from './asesoradosDestacados'
import { FichaPanini } from './FichaPanini'
import { RankingEquipo } from './RankingEquipo'
import { useGamificacion } from './useGamificacion'

export default function LogrosPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const juego = useGamificacion(usuario.id)
  const premiaciones = db.premiaciones.byUsuario(usuario.id)

  const rachas = [
    { nombre: 'Bienestar', racha: juego.rachaBienestar, icono: '♥' },
    { nombre: 'Entrenamiento', racha: juego.rachaEntrenamiento, icono: '🏋' },
    { nombre: 'Nutrición', racha: juego.rachaNutricion, icono: '🍽' },
  ]

  const rachaRota = juego.rachaBienestar.actual === 0 && juego.rachaBienestar.record > 0

  return (
    <div className="flex flex-col gap-4">
      <section
        className="entrada entrada-1 tarjeta-foto p-5 pt-24 text-center"
        style={{ '--foto': 'url(/fondos/atleta-sonrisa.jpeg)', '--foto-pos': 'center 25%' } as React.CSSProperties}
      >
        <div className="mb-2 flex justify-center">
          <AguilaInteractiva className="h-16 w-16" />
        </div>
        <p className="kicker">Tu nivel de disciplina</p>
        <h2 className="mt-1 font-display text-4xl">{juego.nivel.nombre}</h2>
        <p className="cifras mt-1 text-sm text-white/70">
          <CifraAnimada valor={juego.xp} /> XP acumulados
        </p>
        <div className="mt-3">
          <ProgressBar pct={juego.pctHaciaSiguiente} etiqueta="Progreso al siguiente nivel" />
          <p className="mt-1.5 text-xs text-white/70">
            {juego.siguiente
              ? `${juego.siguiente.xpMinimo - juego.xp} XP para ser ${juego.siguiente.nombre}`
              : 'Nivel máximo alcanzado: eres Heracles'}
          </p>
        </div>
      </section>

      <section className="entrada entrada-2 grid grid-cols-3 gap-2.5">
        {rachas.map((r) => (
          <Card key={r.nombre} className="text-center !p-3">
            <span className="text-lg" aria-hidden="true">{r.icono}</span>
            <p className="cifras font-display text-2xl text-rojo">
              <CifraAnimada valor={r.racha.actual} duracionMs={700} />
            </p>
            <p className="text-[10px] uppercase tracking-wider text-tenue">{r.nombre}</p>
            <p className="mt-0.5 text-[10px] text-tenue">Récord: {r.racha.record}</p>
          </Card>
        ))}
      </section>

      <section className="entrada entrada-3">
        <p className="kicker mb-2">Ranking Equipo Alpha</p>
        <RankingEquipo usuarioActualId={usuario.id} />
      </section>

      <section className="entrada entrada-3">
        <p className="kicker">Historias Alpha</p>
        <p className="mb-2 mt-0.5 text-xs text-tenue">
          Siempre hay un dónde, un cómo y un cuándo. Toca una ficha y muévela.
        </p>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {ASESORADOS_DESTACADOS.filter((a) => a.foto).map((a) => (
            <div key={a.id} className="snap-center">
              <FichaPanini ficha={a} />
            </div>
          ))}
        </div>
      </section>

      {rachaRota && (
        <Card>
          <p className="text-sm text-texto">
            Tu racha se reinició — le pasa a todos los grandes. Tu récord de{' '}
            <strong>{juego.rachaBienestar.record} días</strong> sigue ahí para que lo superes. Hoy es
            el día 1. 🔥
          </p>
        </Card>
      )}

      <section>
        <p className="kicker">Logros</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          {juego.logros.map((logro, i) => (
            <Revelar key={logro.id} retrasoMs={(i % 4) * 60}>
              <Medalla logro={logro} />
            </Revelar>
          ))}
        </div>
      </section>

      {premiaciones.length > 0 && (
        <section>
          <p className="kicker">Reconocimientos del coach</p>
          <div className="mt-2 flex flex-col gap-2">
            {premiaciones.map((premio) => (
              <Card key={premio.id} destacada className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">⭐</span>
                <div>
                  <h3 className="font-display text-base text-texto">{premio.titulo}</h3>
                  <p className="text-xs text-tenue">{premio.fecha}</p>
                  {premio.nota && <p className="mt-1 text-sm text-texto/90">{premio.nota}</p>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
