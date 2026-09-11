import { db } from '../../data/dbInstance'
import { resumenSemanal } from '../../domain/resumenSemanal/calcular'
import { guionSemanal } from '../../domain/resumenSemanal/guion'

interface GuionDeLaSemanaProps {
  usuarioId: string
  nombre: string
}

/**
 * Lo que el vídeo del domingo le va a decir a esta persona, palabra por
 * palabra, para que el coach lo lea ANTES de que salga.
 *
 * Es la puerta que decidió Bryan: las veintitrés revisiones pasan por su
 * bandeja hasta que se ganen la salida sola. Y se lee aquí, en la ficha de la
 * persona, porque un guion sin la persona delante no se puede juzgar.
 *
 * El texto NO lo escribe un modelo: sale de los números ya calculados, con
 * huecos que se rellenan, y la frase a la que le falta su dato se cae entera.
 * Si aquí se lee algo raro, el fallo está en los datos, no en la redacción.
 */
export function GuionDeLaSemana({ usuarioId, nombre }: GuionDeLaSemanaProps) {
  const microciclo = db.microciclos.byUsuario(usuarioId).find((m) => m.estado === 'activo')
  const resumen = resumenSemanal({
    sesiones: microciclo?.sesiones ?? [],
    checkins: db.bienestar.byUsuario(usuarioId),
  })
  const guion = guionSemanal(resumen, nombre)

  return (
    <section
      aria-label="Guion de su revisión semanal"
      className="relieve rounded-tarjeta border border-linea bg-surface-1 px-4 py-3 shadow-sm"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">
        Lo que le dirá el vídeo del domingo
      </p>
      <p className="mt-2 text-sm leading-relaxed text-texto">{guion.texto}</p>
      {guion.omitidas > 0 && (
        <p className="mt-2 text-[11px] leading-snug text-tenue">
          {guion.omitidas === 1
            ? 'Una frase se cae por falta de dato'
            : `${guion.omitidas} frases se caen por falta de dato`}
          : el vídeo no las dice en vez de inventarlas.
        </p>
      )}
    </section>
  )
}
