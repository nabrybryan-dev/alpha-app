import { Link } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { Card } from '../../components/ui/Card'
import { CifraAnimada } from '../../components/ui/CifraAnimada'
import { IconoCorazon, IconoCubiertos, IconoEstrella, IconoPesa } from '../../components/ui/Icono'
import { Medalla } from '../../components/ui/Medalla'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Revelar } from '../../components/ui/Revelar'
import { ASESORADOS_DESTACADOS } from '../../data/contenido/asesoradosDestacados'
import { db, useDbVersion } from '../../data/dbInstance'
import { AguilaInteractiva } from '../entrenar/AguilaInteractiva'
import { FichaPanini } from './FichaPanini'
import { RankingEquipo } from './RankingEquipo'
import { TiraDeRachas } from './TiraDeRachas'
import { useGamificacion } from './useGamificacion'

export default function LogrosPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const juego = useGamificacion(usuario.id)
  const premiaciones = db.premiaciones.byUsuario(usuario.id)

  const rachas = [
    // Cada racha lleva el icono de SU pestaña: así el asesorado aprende un símbolo
    // por dominio en vez de tres vocabularios distintos.
    { nombre: 'Bienestar', racha: juego.rachaBienestar, Icono: IconoCorazon },
    { nombre: 'Entrenamiento', racha: juego.rachaEntrenamiento, Icono: IconoPesa },
    { nombre: 'Nutrición', racha: juego.rachaNutricion, Icono: IconoCubiertos },
  ]

  const rachaRota = juego.rachaBienestar.actual === 0 && juego.rachaBienestar.record > 0

  return (
    <div className="flex flex-col gap-4">
      <section
        className="entrada entrada-1 tarjeta-foto p-5 pt-24 text-center"
        // Los agujeros numerados del rack: la escalera que `DIRECCION-C-ASCENSO.md` llama
        // «los peldaños». Los logros de esta app son niveles, y la metáfora ya estaba en la
        // dirección visual. La foto anterior (`atleta-sonrisa.jpeg`) no fallaba por
        // resolución —iba a 1:1— sino por sistema: turquesa y amarillo cálido contra una
        // paleta de tinta y rojo, con focos de techo asomando bajo la tipografía blanca.
        // Medido en la zona del texto: 24,0 de media antes, 10,2 ahora, con un umbral de 18.
        style={{ '--foto': 'url(/fondos/logros-peldanos.jpg)', '--foto-pos': 'center 25%' } as React.CSSProperties}
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

      {/* Las tres rachas ya no son tres cristales sueltos: son tres ventanas a la
          misma calle, con la pieza F corriendo por detrás y cada celda
          descubriendo hasta donde llegó su racha. El porqué está en
          `TiraDeRachas.tsx` y en el spec del 25-08. */}
      <section className="entrada entrada-2">
        <TiraDeRachas celdas={rachas} />
      </section>

      {/* La evolución (peso, carga, volumen y medidas) vive en la pestaña
          Progreso: aquí solo se enlaza para no tener los mismos gráficos en
          dos pantallas. */}
      <Link
        to="/progreso"
        className="press entrada entrada-3 flex items-center justify-between gap-3 rounded-tarjeta border border-ink-500 bg-ink-800 px-4 py-3.5"
      >
        <span>
          <span className="block font-display text-sm text-silver-100">Tu evolución</span>
          <span className="block text-xs text-silver-400">Peso, carga, volumen y medidas</span>
        </span>
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accion/15 text-base text-accion">
          →
        </span>
      </Link>

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
                <IconoEstrella className="h-6 w-6 shrink-0 text-rojo" />
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
