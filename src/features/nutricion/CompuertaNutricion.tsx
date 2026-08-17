import { useState, type ReactNode } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { encuestaPendiente, type Respuestas } from '../../domain/nutricion/encuesta'
import { EncuestaNutricion } from './EncuestaNutricion'

/**
 * Sin la encuesta no hay Nutrición. Ninguna pantalla del apartado.
 *
 * Está aquí y no dentro de cada página a propósito: cuando la compuerta vivía
 * solo en el diario, se podía llegar a "Mi plan" por la URL y saltársela. Un
 * bloqueo con una puerta lateral abierta no es un bloqueo — y esa puerta no
 * habría dado un error, habría dado unas cifras vacías con aspecto de cifras.
 *
 * POR QUÉ BLOQUEO COMPLETO Y NO DEGRADADO. Todo lo que hay detrás —las
 * calorías, los macros, el margen de cada registro— se calcula CON esos datos.
 * Sin ellos la pantalla no enseñaría un poco menos: enseñaría números sin
 * respaldo, y un número sin respaldo se lee igual que uno bueno.
 */
export function CompuertaNutricion({ children }: { children: ReactNode }) {
  const { usuario } = useSesion()
  useDbVersion()

  const perfil = db.perfilNutricion.byUsuario(usuario.id)
  const respuestas = (perfil?.respuestas ?? {}) as Respuestas
  const abierta = !encuestaPendiente(perfil)

  /**
   * Lo que ya se sabía de esta persona ANTES de abrir la encuesta.
   *
   * Aquí iba `{}`, y con eso `camposAPreguntar` volvía a preguntarlo todo aunque
   * el perfil ya trajera dieciséis respuestas de la encuesta de captación. No se
   * notó hasta que hubo altas cargadas de antemano: hasta entonces, quien llegaba
   * a esta pantalla no sabía nada de sí mismo y las dos formas daban lo mismo.
   *
   * Y tiene que ser una FOTO, no el dato vivo: cada respuesta se guarda al vuelo,
   * así que si el listado siguiera a `respuestas`, cada campo desaparecería de la
   * pantalla justo al contestarlo.
   */
  const [sabidoAlAbrir] = useState<Respuestas>(() => respuestas)

  if (abierta) return <>{children}</>

  return (
    <EncuestaNutricion
      yaSabidos={sabidoAlAbrir}
      enCurso={respuestas}
      onGuardarAvance={(nuevas) => db.perfilNutricion.guardar(usuario.id, nuevas, false)}
      onTerminar={(nuevas) => db.perfilNutricion.guardar(usuario.id, nuevas, true)}
    />
  )
}
