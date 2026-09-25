import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { db, useDbVersion } from '../../../../data/dbInstance'
import { resumenSemanal } from '../../../../domain/resumenSemanal/calcular'
import { guionSemanal } from '../../../../domain/resumenSemanal/guion'
import { PendienteDeCadena } from '../PendienteDeCadena'

const PASOS = ['Guion', 'Voz', 'Imagen', 'Vídeo', 'Publicado'] as const

/**
 * Módulo 7: guion → voz → imagen → vídeo → publicado. Solo el primer paso
 * tiene datos reales hoy (`domain/resumenSemanal`, lo mismo que ya usa
 * `GuionDeLaSemana` en la ficha del asesorado); no existe en
 * `src/data/repos.ts` ninguna tabla de audio, imagen, render ni publicación
 * (`videos_semanales` no la escribe nadie todavía — ver
 * `src/domain/video/publicacion.ts`). El resto queda como vacío honesto.
 */
export function RevisionVideoTab({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const usuario = db.usuarios.byId(usuarioId)
  const microciclo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')
  const resumen = resumenSemanal({
    sesiones: microciclo?.sesiones ?? [],
    checkins: db.bienestar.byUsuario(usuarioId),
  })
  const guion = guionSemanal(resumen, usuario?.nombre ?? 'esta persona')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PASOS.map((paso, i) => (
          <Badge key={paso} tono={i === 0 ? 'verde' : 'neutro'}>
            {paso} {i === 0 ? '· real' : '· sin dato'}
          </Badge>
        ))}
      </div>

      <Card>
        <p className="kicker">Guion de la revisión semanal</p>
        <p className="mt-2 text-sm leading-relaxed text-texto">{guion.texto}</p>
        {guion.omitidas > 0 && (
          <p className="mt-2 text-[11px] text-tenue">
            {guion.omitidas} frase{guion.omitidas === 1 ? '' : 's'} sin decir por falta de dato.
          </p>
        )}
      </Card>

      <PendienteDeCadena
        titulo="Voz, imagen, vídeo y publicación"
        detalle="El render (voz clonada, cara, vídeo final) y su firma de publicación no tienen tabla que leer hoy: nadie escribe en videos_semanales todavía. Entrega privada por defecto, tal como fija el diseño; llega cuando la cadena sincronice."
      />
    </div>
  )
}
