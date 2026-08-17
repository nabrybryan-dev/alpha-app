import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSesion } from '../../app/SessionProvider'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { preguntasQueVuelven, type Respuestas } from '../../domain/nutricion/encuesta'
import { EncuestaNutricion } from './EncuestaNutricion'

/**
 * Las dos preguntas que vuelven cada quince días en embarazo y lactancia.
 *
 * POR QUÉ EXISTE. Manuela, 2026-08-09: antes de decidir nada hay que saber qué
 * le dijo SU médico en su caso. Mientras no conste nada, el sistema se pone en
 * el umbral mínimo de vitamina A; lo que conste manda sobre él. Un dato así no
 * se puede preguntar una vez al principio, porque cambia con cada control.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * AVISA, NO BLOQUEA. Decisión de Bryan, y es la correcta.
 * ─────────────────────────────────────────────────────────────────────────────
 * Está en una ruta propia y NO en la compuerta. La compuerta llama a la encuesta
 * sin fecha, así que las preguntas que vuelven no la cierran nunca: una
 * embarazada no puede quedarse sin sus cifras por no haber ido todavía al
 * médico. Ninguna otra pregunta de la encuesta bloquea, y esta es de las que
 * menos podría.
 *
 * Por eso el «Ahora no» es un enlace normal y no una trampa: se sale, y la
 * pregunta vuelve a asomar mañana desde «Hoy» y desde el diario.
 *
 * SI YA NO HAY NADA QUE PREGUNTAR, NO SE ENSEÑA UNA PANTALLA VACÍA. Se vuelve
 * al diario. Pasa al contestar la última, y pasaría también si alguien llega
 * por la URL sin tener ninguna pendiente.
 */
export default function AlDiaEmbarazo() {
  const { usuario } = useSesion()
  const navegar = useNavigate()
  useDbVersion()

  const hoy = hoyIso()
  const perfil = db.perfilNutricion.byUsuario(usuario.id)
  const respuestas = (perfil?.respuestas ?? {}) as Respuestas

  /**
   * Lo sabido se congela al abrir, igual que en la compuerta.
   *
   * Si siguiera al dato vivo, cada pregunta desaparecería justo al contestarla
   * —se guarda al vuelo— y la pantalla se vaciaría debajo de ella.
   */
  const [sabidoAlAbrir] = useState<Respuestas>(() => respuestas)
  const pendientes = preguntasQueVuelven(sabidoAlAbrir, hoy)

  if (pendientes.length === 0) {
    return (
      <div className="flex flex-col gap-4 pb-6">
        <header>
          <h1 className="font-display text-xl leading-tight text-texto">Todo al día</h1>
          <p className="mt-2 text-sm leading-snug text-tenue">
            No hay nada que preguntarte por ahora. Te avisamos en quince días.
          </p>
        </header>
        <button
          type="button"
          onClick={() => navegar('/nutricion')}
          className="press w-full rounded-2xl bg-accion py-4 font-display text-sm uppercase tracking-wide text-white"
        >
          Volver al diario
        </button>
      </div>
    )
  }

  return (
    <EncuestaNutricion
      yaSabidos={sabidoAlAbrir}
      enCurso={respuestas}
      hoy={hoy}
      titulo="¿Cómo vas con tu médico?"
      entradilla="Lo que te haya dicho tu médico manda sobre lo que calcule la app. Son dos preguntas y las volvemos a hacer en quince días."
      pie={
        <button
          type="button"
          onClick={() => navegar('/nutricion')}
          className="press w-full py-2 text-center text-xs font-semibold text-tenue"
        >
          Ahora no
        </button>
      }
      onGuardarAvance={(nuevas) => db.perfilNutricion.guardar(usuario.id, nuevas, false)}
      onTerminar={(nuevas) => {
        db.perfilNutricion.guardar(usuario.id, nuevas, true)
        navegar('/nutricion')
      }}
    />
  )
}
