import { useSesion } from '../../app/SessionProvider'
import { EmptyState } from '../../components/ui/EmptyState'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
import { indiceRecuperacion } from '../../domain/readiness'
import { calculosDeLaRuta } from './ruta/calculosDeLaRuta'
import { SalonEntrenar } from './salon/SalonEntrenar'

/**
 * La pestaña Entrenar. Tocar ENTRENAR abre EL SALÓN, sin pantalla de aterrizaje.
 *
 * Este archivo LEE y entrega; quien pinta es el salón. Antes era también la maqueta —doce
 * bloques en una columna con scroll, escritos aquí mismo— y después fue el sitio donde
 * vivían los cálculos de la Ruta. Ahora los cálculos están en `ruta/calculosDeLaRuta.ts`,
 * porque Progreso necesita los mismos y dos copias del mismo cálculo se separan sin que
 * nadie lo note.
 *
 * Lo que queda aquí es lo único que solo se puede decidir aquí: de quién es la sesión, si
 * hay microciclo activo y qué se le pasa al salón.
 *
 * La sesión sigue siendo el segundo nivel (`/entrenar/sesion/:id`) y su botón atrás vuelve
 * aquí.
 *
 * ## Los tres estados, y dónde vive cada uno
 *
 * - **Sin microciclo activo** — el `EmptyState` de abajo. Es de este archivo porque solo
 *   aquí se sabe: hay que leer los microciclos de la persona para descubrirlo. No es una
 *   urgencia; parte de la cartera está inactiva a propósito.
 * - **Carga** — el `Suspense` con el que el router envuelve esta página, que existe porque
 *   `RutaPage` se monta con `lazy()`. Sigue siendo el mismo, y por eso el salón se monta
 *   DENTRO de este componente y no como una ruta aparte: colgarlo del router por su cuenta
 *   lo habría dejado fuera de esa envoltura.
 * - **Error** — el `ErrorBoundary` de esa misma envoltura del router.
 */
export default function RutaPage() {
  const { usuario } = useSesion()
  useDbVersion()
  const hoy = hoyIso()

  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')
  const ruta = db.ruta.byUsuario(usuario.id)
  const recuperacion = indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)

  if (!microciclo) {
    return (
      <EmptyState
        titulo="Sin microciclo activo"
        detalle="El coach está preparando tu siguiente programación."
      />
    )
  }

  const calculos = calculosDeLaRuta(usuario.id, microciclo, hoy)

  return (
    <SalonEntrenar
      microciclo={microciclo}
      ruta={ruta}
      recuperacion={recuperacion}
      progresoPct={calculos.progresoPct}
      estadisticas={calculos.estadisticas}
      competencias={calculos.competencias}
      requisitos={calculos.requisitos}
      semana={calculos.semana}
      sesionCta={calculos.sesionCta}
      notas={notasDelMicrociclo(microciclo)}
      sesion={calculos.sesionDeHoy}
    />
  )
}
