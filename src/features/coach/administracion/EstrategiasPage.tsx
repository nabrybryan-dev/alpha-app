import { Link } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { Cargando, CLASE_ETIQUETA } from '../../plan/comun'
import { BuzonMercadeo } from '../creadores/BuzonMercadeo'
import { RotuloGrupo, TarjetaPlegable } from './TarjetaPlegable'
import { InvestigacionInteractiva } from './InvestigacionInteractiva'
import { InvestigacionMercadeo } from './InvestigacionMercadeo'
import { ObjetivosBola } from './ObjetivosBola'
import { SeccionTablero } from './SeccionTablero'
import { useTableroAdmin } from './useTableroAdmin'

/**
 * ESTRATEGIAS (orden pedido por Bryan el 30-sep), plegable de arriba abajo:
 *
 *   1. Mercadeo de lo macro a lo concreto: estrategias en uso, ganchos, loops, estructura de
 *      videos y tendencias (la sección «mercadeo» del tablero de la 0102), y debajo sus cuatro
 *      tarjetas de investigación: tendencias, videos, ganchos y diseños visuales.
 *   2. Investigación del agente: hallazgos (hook, loop, estructura, tendencia, gancho visual) que
 *      Manuela comenta y el agente responde (migración 0103), y debajo el buzón de preguntas
 *      (0096). Ambos se abren con `responder_mercadeo`.
 *   3. Influencers y creadores evaluados (el tablero de Creadores, con `revisar_creadores`).
 *   4. Bola de nieve: su embudo y, en «Objetivos de la bola de nieve», cada meta contra lo real
 *      (lo real sale FALTA mientras el tablero no lo traiga; cada meta cita su fuente).
 *
 * La entrada se abre con `responder_mercadeo` o `revisar_creadores` (ver `CoachLayout`). Las
 * secciones del tablero salen como «Pendiente de activar (migración 0102)» sin `ver_administracion`
 * o sin la tabla, nunca como un cero.
 */
function EnlaceCreadores() {
  return (
    <Link
      to="/coach/creadores"
      className="press inline-flex min-h-[48px] items-center justify-between gap-3 rounded-boton border border-texto px-4 text-[13px] font-bold text-texto"
    >
      <span>Abrir el tablero de creadores</span>
      <span aria-hidden="true">›</span>
    </Link>
  )
}

export default function EstrategiasPage() {
  const t = useTableroAdmin()
  const puedeCreadores = t.esCoach || t.tiene('revisar_creadores')
  const puedeMercadeo = t.esCoach || t.tiene('responder_mercadeo')

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex flex-col gap-1 pt-1">
        <p className={CLASE_ETIQUETA}>Mercadeo y bola de nieve</p>
        <h2 className="font-display text-2xl uppercase text-texto">Estrategias</h2>
        <p className="text-sm text-tenue">De lo general a lo concreto. Toca una tarjeta para ver el detalle.</p>
      </header>

      {t.estado.tipo === 'cargando' && <Cargando texto="Cargando las estrategias…" />}
      {t.estado.tipo === 'fallo' && (
        <FalloDeLectura texto={`No se pudo leer el tablero (${t.estado.error}).`} onReintentar={t.reintentar} />
      )}

      <RotuloGrupo
        titulo="Mercadeo, de lo macro a lo concreto"
        nota="Estrategias en uso, ganchos, loops, estructura de videos y tendencias."
      />
      <SeccionTablero t={t} seccion="mercadeo" />
      <InvestigacionMercadeo t={t} />

      <RotuloGrupo titulo="Investigación" />
      <TarjetaPlegable nombre="Investigación del agente" frase="Lo que investiga el agente: lo abres, lo comentas y el agente responde y lo fortalece.">
        {puedeMercadeo ? (
          <>
            <InvestigacionInteractiva puede />
            <div className="flex flex-col gap-2">
              <p className={CLASE_ETIQUETA}>Preguntas del agente para Manuela</p>
              <BuzonMercadeo />
            </div>
          </>
        ) : (
          <p className="text-sm text-tenue">
            El buzón se abre con el permiso de responder mercadeo, y todavía no lo tienes. Pídeselo al coach.
          </p>
        )}
      </TarjetaPlegable>

      <RotuloGrupo titulo="Influencers y creadores evaluados" />
      <TarjetaPlegable nombre="Creadores evaluados" frase="Los creadores que ya se revisaron, con sus notas de video y su carril.">
        {puedeCreadores ? (
          <EnlaceCreadores />
        ) : (
          <p className="text-sm text-tenue">
            El tablero se abre con el permiso de revisar creadores, y todavía no lo tienes. Pídeselo al coach.
          </p>
        )}
      </TarjetaPlegable>
      <SeccionTablero t={t} seccion="influencers" />

      <RotuloGrupo titulo="Bola de nieve" nota="Lo que falta para cumplir sus objetivos: la meta, lo real y de dónde sale cada cifra." />
      <TarjetaPlegable nombre="Bola de nieve" frase="Cómo va el piloto de creadores: del primer contacto a la firma.">
        {puedeCreadores ? (
          <EnlaceCreadores />
        ) : (
          <p className="text-sm text-tenue">El embudo se ve con el permiso de revisar creadores, y todavía no lo tienes.</p>
        )}
      </TarjetaPlegable>
      <ObjetivosBola t={t} />
    </div>
  )
}
