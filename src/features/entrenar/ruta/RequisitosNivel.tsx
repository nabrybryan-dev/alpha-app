import type { NivelAlfa, RequisitoNivel } from '../../../domain/rutaEntrenamiento'
import { CheckDibujado } from '../CheckDibujado'

interface Props {
  requisitos: readonly RequisitoNivel[]
  siguienteNivel?: NivelAlfa
}

/** Los requisitos medibles del siguiente nivel: qué falta y cuánto falta. */
export function RequisitosNivel({ requisitos, siguienteNivel }: Props) {
  if (!siguienteNivel) return null

  return (
    // Esta sección era la única superficie del área sin una sola línea de movimiento
    // ni de profundidad — se le pasó por alto a la auditoría, que construyó su
    // inventario desde lo que se mueve y por eso no ve lo que está quieto.
    <section
      className="escena-prof rounded-tarjeta border border-accion/30 px-4 py-3.5"
      style={{ background: 'color-mix(in srgb, var(--accion) 7%, var(--ink-700))' }}
    >
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-accion">
        Para subir a nivel {siguienteNivel.numero}
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {requisitos.map((r) => (
          <li key={r.id} className="escena-prof flex items-start gap-3">
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] ${
                r.cumplido ? 'border-accion bg-accion text-white' : 'pozo-3d border-ink-400 text-ink-400'
              }`}
              // El estado ya se decía con MATERIA —círculo lleno frente a círculo
              // hueco—, que es la regla de la marca y por eso aquí no hay semáforo.
              // La profundidad no cambia ese lenguaje: lo lleva al volumen. Lo
              // cumplido se queda en el plano; lo pendiente se hunde a
              // `--prof-hueco`, que es literalmente «materia que falta dentro de la
              // misma placa». Ninguno de los dos es tocable — la fila entera no lo
              // es —, así que hundir no roza el mínimo táctil.
              // Lo pendiente es un POZO —`.pozo-3d` trae escalon, sombra y cara— y lo
              // cumplido se queda en el plano, sin nada. La diferencia deja de ser
              // «relleno o vacio» y pasa a ser «materia o hueco», que es la regla.
            >
              {r.cumplido ? (
                <CheckDibujado className="h-3 w-3" />
              ) : (
                <span className="sr-only">Pendiente</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-snug text-silver-100">
                {r.texto}
              </span>
              <span className="cifras mt-1 block text-[11.5px] text-silver-400">{r.metrica}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
