import { useState } from 'react'
import { db } from '../../../../../data/dbInstance'
import { preparacionDe } from '../../../../../data/plantillas/preparacionBase'
import type { Contenido, Microciclo, Sesion } from '../../../../../domain/types'
import { Sheet } from '../../../../../components/ui/Sheet'
import { VisorContenido } from '../../../../contenidos/VisorContenido'
import { PreparacionSesion } from '../../../PreparacionSesion'
import { SinDatos } from './Recuadro'

/**
 * ANTES DE ENTRENAR: calentamiento, movilidad y activación, en el panel verde.
 *
 * Es uno de los cuatro cuadros que Bryan marcó en verde —los que **solo** aparecen al
 * deslizar hacia abajo—. Y es el que faltaba: hasta hoy la preparación de la sesión solo
 * existía un nivel más abajo, dentro de `/entrenar/sesion/:id`. Con el salón abriéndose ya
 * en el ejercicio de hoy, quien entra a entrenar no pasa por esa pantalla, así que el
 * calentamiento se quedaba sin puerta.
 *
 * ## Es el MISMO bloque de la sesión, no una copia
 *
 * Monta `PreparacionSesion` tal cual, con las mismas partes que devuelve `preparacionDe()`
 * y el mismo `marcarParte` de la base. Marcar aquí el calentamiento lo deja marcado en la
 * sesión, porque es la misma marca: no hay dos listas ni dos estados. Una versión
 * «adaptada al panel» sería una segunda maqueta que se separa de la primera al primer
 * arreglo, y lo que se pierda en esa deriva no lo ve nadie.
 *
 * La hoja del vídeo viaja con él por el mismo motivo: el botón de demo de una parte de
 * preparación abre el contenido, y dejarlo sin destino sería un botón muerto en la
 * pantalla que más se usa.
 */
export function RecuadroAntes({
  microciclo,
  sesion,
}: {
  microciclo: Microciclo
  sesion: Sesion | undefined
}) {
  const [demo, setDemo] = useState<Contenido | undefined>()
  const partes = sesion ? preparacionDe(sesion) : []

  if (!sesion || partes.length === 0) {
    return (
      <SinDatos motivo="La sesión de hoy no trae calentamiento ni movilidad escritos, así que no hay nada que marcar antes de empezar." />
    )
  }

  return (
    <>
      {/* LA TARJETA DE LA SESIÓN, SIN SU TARJETA.
          =========================================================================
          `PreparacionSesion` es el MISMO bloque que corre en `/entrenar/sesion/:id` y
          ahí lleva su `Card` con marco y su título «Antes de entrenar» — bien puesto,
          porque allí es un bloque suelto en una columna. Dentro de la hoja del salón
          esos dos elementos sobran: el marco es la caja que la hoja acaba de quitar, y
          el título repite el rótulo del tramo, que ya dice «01 · ANTES DE ENTRENAR».

          Se apaga desde FUERA con variantes que alcanzan a los hijos, no tocando el
          componente: es el mismo truco que el cronómetro del muro, y por el mismo
          motivo — una versión «adaptada al panel» sería una segunda maqueta que se
          separa de la primera al primer arreglo, y lo que se pierda en esa deriva no lo
          ve nadie. El contador de partes (`Badge`) SÍ se queda: dice cuántas llevas. */}
      <div className="[&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 [&_.kicker]:sr-only">
      <PreparacionSesion
        partes={partes}
        onMarcar={(parteId) => db.microciclos.marcarParte(microciclo.id, sesion.id, parteId)}
        onVerDemo={setDemo}
      />
      </div>
      <Sheet abierto={demo !== undefined} titulo={demo?.titulo ?? ''} onCerrar={() => setDemo(undefined)}>
        {demo && <VisorContenido contenido={demo} />}
      </Sheet>
    </>
  )
}
