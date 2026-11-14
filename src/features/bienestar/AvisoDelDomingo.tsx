import { useState } from 'react'
import { useDisenoFinal } from '../../app/organizacionViva'
import { Card } from '../../components/ui/Card'
import { Sheet } from '../../components/ui/Sheet'
import { sumarDias } from '../../domain/activacion'
import { rangoDeLaSemana } from '../../domain/semana/resumen'
import { PREGUNTAS_VIDA } from '../../domain/tarjetaVida'

/**
 * «Tu tarjeta del domingo» de «Alpha · Rediseño» (maqueta 7, Semana): los días en que la tarjeta de estilo de vida no se
 * puede contestar, se anuncia qué domingo se abre y se pueden LEER sus siete preguntas (los mismos textos de
 * `PREGUNTAS_VIDA`, sin botones de respuesta). Solo con el diseño final (13-nov-2026); para las demás cuentas, nada.
 */
export function AvisoDelDomingo({ hoy, disenoFinal }: { hoy: string; disenoFinal?: boolean }) {
  const final = useDisenoFinal(disenoFinal)
  const [abierta, setAbierta] = useState(false)
  if (!final) return null
  // Si hoy ya es domingo (y la tarjeta no toca, porque ya se respondió), el que viene es el de la semana siguiente.
  const fin = rangoDeLaSemana(hoy).fin
  const domingo = Number((fin === hoy ? sumarDias(fin, 7) : fin).slice(8, 10))
  return (
    <Card>
      <p className="text-sm font-bold text-texto">Tu tarjeta del domingo</p>
      <p className="mt-0.5 text-sm text-tenue">
        {PREGUNTAS_VIDA.length} preguntas cortas sobre tu semana. Se abre el domingo {domingo}; hoy puedes ver cuáles son.
      </p>
      <button type="button" onClick={() => setAbierta(true)} className="press tecla-2 mt-2.5 w-full text-sm font-semibold text-texto">
        Ver las preguntas
      </button>
      <Sheet abierto={abierta} titulo="Tu tarjeta del domingo" onCerrar={() => setAbierta(false)}>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-texto">
          {PREGUNTAS_VIDA.map((p) => (
            <li key={p.id}>{p.texto}</li>
          ))}
        </ol>
      </Sheet>
    </Card>
  )
}
