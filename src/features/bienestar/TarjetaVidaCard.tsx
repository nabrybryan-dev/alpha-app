import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card'
import { hoyIso } from '../../data/dbInstance'
import { guardarTarjetaVida, semanasRespondidasDe } from '../../data/vida/tarjetasVida'
import {
  PREGUNTAS_VIDA,
  debeMostrarTarjeta,
  revisarRespuestasTarjetaVida,
  semanaAMostrar,
  type IdPreguntaVida,
  type RespuestasTarjetaVida,
} from '../../domain/tarjetaVida'
import { CheckDibujado } from '../entrenar/CheckDibujado'

/**
 * LA TARJETA SEMANAL DE ESTILO DE VIDA: 7 PREGUNTAS, DEL AGENTE DE ESTILO DE VIDA.
 *
 * Se ofrece el domingo (para revisar la semana que termina) o, si no se contestó, sigue
 * ofreciéndose después hasta que se responda —nunca sobre la semana en curso, que
 * `domain/tarjetaVida.ts::semanaAMostrar` nunca elige—. Una vez respondida esa semana, la
 * tarjeta desaparece de Bienestar hasta el domingo siguiente.
 *
 * Cada pregunta se contesta con botones, no con un campo de texto libre: las siete tienen
 * una escala CERRADA y numerada (`domain/tarjetaVida.ts`), así que no hay nada que
 * `revisarRespuestasTarjetaVida` vaya a rechazar en el uso normal — se llama de todos
 * modos antes de guardar, con el mismo criterio que `MedidasCard`: el dominio decide, la
 * pantalla solo pinta lo que dice.
 */
export function TarjetaVidaCard({ usuarioId }: { usuarioId: string }) {
  const hoy = hoyIso()
  const semana = semanaAMostrar(hoy)
  const [semanasRespondidas, setSemanasRespondidas] = useState<string[] | null>(null)
  const [respuestas, setRespuestas] = useState<RespuestasTarjetaVida>({})
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void semanasRespondidasDe(usuarioId).then((s) => {
      if (vivo) setSemanasRespondidas(s)
    })
    return () => {
      vivo = false
    }
  }, [usuarioId])

  // Cargando, o ya respondida esa semana (sin acabar de guardarla en esta misma
  // visita): no hay nada que ofrecer. Mejor no pintar nada que un formulario que luego
  // resulta que no tocaba.
  if (semanasRespondidas === null) return null
  if (guardado) {
    return (
      <Card>
        <p className="flex items-center gap-1.5 text-xs font-bold text-texto">
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-logrado text-ink-900">
            <CheckDibujado className="h-2.5 w-2.5" />
          </span>
          Tarjeta de la semana guardada. El coach ya la ve.
        </p>
      </Card>
    )
  }
  if (!debeMostrarTarjeta(hoy, semanasRespondidas)) return null

  const responder = (id: IdPreguntaVida, valor: number) => {
    setRespuestas((prev) => ({ ...prev, [id]: valor }))
    setError(null)
  }

  const guardar = async () => {
    const reparos = revisarRespuestasTarjetaVida(respuestas)
    if (reparos.length > 0) {
      setError(reparos[0].motivo)
      return
    }
    if (Object.keys(respuestas).length === 0) {
      setError('Contesta al menos una pregunta.')
      return
    }
    setGuardando(true)
    const resultado = await guardarTarjetaVida(usuarioId, semana, respuestas)
    setGuardando(false)
    if (resultado.ok) {
      setGuardado(true)
      return
    }
    if (resultado.motivo === 'ya_respondida') {
      // Otra pestaña o el móvil ya la mandó: no es un error de esta persona.
      setSemanasRespondidas((prev) => [...(prev ?? []), semana])
      return
    }
    setError('No se pudo guardar. Vuelve a intentarlo.')
  }

  return (
    <Card>
      <p className="text-sm font-bold text-texto">Tu semana en estilo de vida</p>
      <p className="mt-0.5 text-xs text-tenue">
        7 preguntas rápidas sobre sueño, pantallas y energía. Puedes saltarte las que no apliquen.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {PREGUNTAS_VIDA.map((p) => {
          const opciones = Array.from(
            { length: p.escala.maximo - p.escala.minimo + 1 },
            (_, i) => p.escala.minimo + i,
          )
          return (
            <div key={p.id}>
              <p className="text-xs text-tenue">{p.texto}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label={p.texto}>
                {opciones.map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={respuestas[p.id] === n}
                    onClick={() => responder(p.id, n)}
                    title={p.escala.etiquetas?.[n]}
                    className={`tecla-3d rounded-tag border px-2.5 py-1 text-xs font-bold ${
                      respuestas[p.id] === n
                        ? 'border-rojo/60 bg-rojo/15 text-rojo'
                        : 'border-linea bg-surface-2 text-tenue'
                    }`}
                  >
                    {p.escala.etiquetas?.[n] ?? n}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-snug text-rojo">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void guardar()}
        disabled={guardando}
        className="press btn-cristal-rojo mt-3 w-full rounded-full py-2.5 font-display text-xs disabled:opacity-40"
      >
        Guardar ✓
      </button>
    </Card>
  )
}
