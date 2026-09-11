import { useEffect, useState } from 'react'
import { db } from '../../data/dbInstance'
import { traerDecisionesDeAviso } from '../../data/nube/avisos'
import {
  DIAS_PARA_SEGUIR_VIVO,
  embudoDeAvisos,
  MINIMO_PARA_CONSTRUIR_EL_EMPUJE,
  veredictoDelEmbudo,
  type EmbudoDeAvisos as Embudo,
} from '../../domain/avisos/embudo'

/**
 * Los tres números del permiso de avisos, para el coach.
 *
 * **Tres y no uno.** El que todo el mundo mira —cuántos aceptaron— es el que
 * menos dice: lo que se rompe de verdad no es el primer aviso, es el de la
 * tercera semana, cuando el navegador rotó la suscripción o la persona revocó
 * el permiso sin acordarse. El tercero es el que manda.
 *
 * Y el veredicto sale de una línea escrita ANTES de ver el número, para que el
 * resultado no se pueda interpretar a conveniencia.
 */
export function EmbudoDeAvisos() {
  const [embudo, setEmbudo] = useState<Embudo>()
  const [dias, setDias] = useState(0)

  useEffect(() => {
    let vigente = true
    traerDecisionesDeAviso()
      .then((decisiones) => {
        if (!vigente) return
        const cartera = db.usuarios.entrenan().length
        setEmbudo(embudoDeAvisos(decisiones, cartera))
        const primera = decisiones
          .map((d) => Date.parse(d.vioEn))
          .filter((t) => !Number.isNaN(t))
          .sort((a, b) => a - b)[0]
        setDias(primera ? Math.floor((Date.now() - primera) / 86_400_000) : 0)
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  if (!embudo) return null

  const veredicto = veredictoDelEmbudo(embudo, dias)
  const frase =
    veredicto === 'todavia-no-toca'
      ? `Aún no toca decidir: se lleva preguntando ${dias} de ${DIAS_PARA_SEGUIR_VIVO} días.`
      : veredicto === 'construir'
        ? `Da para construir el empuje: ${embudo.dijeronSi} dijeron que sí, y la línea estaba en ${MINIMO_PARA_CONSTRUIR_EL_EMPUJE}.`
        : `Se aparca el empuje: ${embudo.dijeronSi} dijeron que sí y la línea estaba en ${MINIMO_PARA_CONSTRUIR_EL_EMPUJE}. Los recados buscan otra puerta.`

  return (
    <section
      aria-label="Permiso de avisos"
      className="relieve rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">
        Permiso de avisos
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="cifras text-lg font-semibold text-texto">
            {embudo.vieron}
            <span className="text-xs text-tenue">/{embudo.cartera}</span>
          </p>
          <p className="text-[10px] leading-tight text-tenue">lo vieron</p>
        </div>
        <div>
          <p className="cifras text-lg font-semibold text-texto">{embudo.dijeronSi}</p>
          <p className="text-[10px] leading-tight text-tenue">dijeron que sí</p>
        </div>
        <div>
          <p className="cifras text-lg font-semibold text-texto">{embudo.vivosALosSieteDias}</p>
          <p className="text-[10px] leading-tight text-tenue">siguen vivos a los 7 días</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-snug text-tenue">{frase}</p>
    </section>
  )
}
