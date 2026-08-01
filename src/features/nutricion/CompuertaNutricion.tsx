import type { ReactNode } from 'react'
import { useSesion } from '../../app/SessionProvider'
import { db, useDbVersion } from '../../data/dbInstance'
import { encuestaCompleta, type Respuestas } from '../../domain/nutricion/encuesta'
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
  const abierta = Boolean(perfil?.completadaEn) && encuestaCompleta(respuestas)

  if (abierta) return <>{children}</>

  return (
    <EncuestaNutricion
      yaSabidos={{}}
      enCurso={respuestas}
      onGuardarAvance={(nuevas) => db.perfilNutricion.guardar(usuario.id, nuevas, false)}
      onTerminar={(nuevas) => db.perfilNutricion.guardar(usuario.id, nuevas, true)}
    />
  )
}
