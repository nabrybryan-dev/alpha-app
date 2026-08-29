import {
  accionesPrincipales,
  fraseDelPatron,
  NOMBRE_DE_ROL,
  segmentosDe,
} from '../../../../../domain/patrones/acciones'
import { NOMBRE_DE_TIPO } from '../../../../../domain/patrones/articulaciones'
import type { Patron } from '../../../../../domain/patrones/catalogo'
import { SinDatos } from './Recuadro'

/**
 * EL PATRÓN, EXPLICADO: qué mueve y qué sujeta cada articulación.
 *
 * Es el cuarto de los cuadros verdes —«ver notas de ejecución, patrón 3D y técnica»— y la
 * casa nueva de un texto que estaba en el sitio equivocado. Bryan lo describió mirando el
 * iPhone: «DEBAJO del salón seguía habiendo una columna de texto: la explicación de la
 * articulación y la lista MUEVE/SUJETA». Estaba ahí porque el visor la pinta debajo de su
 * lienzo, y el visor se montaba dentro del salón: la columna de estudio venía de regalo.
 *
 * En el salón esa columna sobra —el centro es el cuerpo moviéndose, no un texto sobre el
 * cuerpo—, pero el texto NO sobra: es de lo mejor que dice la app sobre un ejercicio.
 * Así que baja aquí, íntegro, en el sitio donde el encargo lo pone.
 *
 * ## No es una copia del visor: los dos leen del mismo dominio
 *
 * Ni una frase de estas está escrita a mano ni copiada del visor. Salen de
 * `domain/patrones/acciones.ts`, que las CALCULA de las poses del patrón: qué articulación
 * mueve, cuánto recorre, qué segmento va sobre cuál y qué no puede hacer. Si mañana cambia
 * una pose, cambian las dos pantallas a la vez, porque las dos preguntan a la misma
 * función. Escribir aquí una versión resumida sería la forma de que el salón y el estudio
 * del patrón acabaran contando dos anatomías distintas del mismo gesto.
 *
 * Lo que este recuadro NO trae es el lienzo tridimensional: el modelo está a pantalla
 * completa un dedo más arriba, en el propio salón, y el estudio con sus mandos —fase,
 * órbita, capas— sigue abriéndose desde la tarjeta del ejercicio en la pantalla de sesión.
 * Montar aquí un segundo contexto de dibujo, encima del que ya corre detrás del panel,
 * serían dos escenas compitiendo por la misma tarjeta gráfica en un teléfono.
 */
export function RecuadroPatron({ patron }: { patron: Patron | undefined }) {
  if (!patron) {
    return (
      <SinDatos motivo="El ejercicio de hoy no tiene un patrón anatómico en el catálogo, así que no hay articulaciones que desglosar. Pasa con el cardio y con lo que no es un gesto resistido." />
    )
  }

  const acciones = accionesPrincipales(patron)

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] leading-relaxed text-silver-300">{patron.resumen}</p>

      {/* La frase corta primero: es lo que hay que poder leer de un vistazo antes de
          entrar en el desglose articulación por articulación. */}
      <p className="text-[12px] font-semibold leading-relaxed text-silver-100">
        {fraseDelPatron(patron)}.
      </p>

      <ul className="flex flex-col">
        {acciones.map((resumen) => {
          const segmentos = segmentosDe(patron, resumen.articulacion.id)
          return (
            <li key={resumen.articulacion.id} className="border-b border-white/5 py-1.5">
              <div className="flex items-baseline gap-2 text-[12px]">
                {/* MUEVE o SUJETA, con el nombre que le da el dominio. El que mueve va en
                    ámbar porque es el que hay que sentir; el que sujeta, en gris, porque
                    su trabajo es no moverse. */}
                <span
                  className={`w-[52px] shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] ${
                    resumen.rol === 'motor' ? 'text-ambar' : 'text-silver-500'
                  }`}
                >
                  {NOMBRE_DE_ROL[resumen.rol]}
                </span>
                <span className="flex-1 text-silver-200">{resumen.articulacion.nombre}</span>
                <span className="text-[10px] text-silver-500">
                  {resumen.acciones.length > 0
                    ? resumen.acciones.map((a) => a.accion.toLowerCase()).join(' · ')
                    : 'isometría'}
                </span>
              </div>

              <p className="mt-1 pl-[60px] text-[11px] leading-snug text-silver-400">
                {NOMBRE_DE_TIPO[resumen.articulacion.tipo]}. {segmentos.movil} sobre{' '}
                {segmentos.fijo.toLowerCase()}.
              </p>

              {/* Lo que la articulación NO puede hacer. Es la mitad que evita forzarla, y
                  la que nadie escribe en una ficha de ejercicio. */}
              {resumen.articulacion.noPuede.length > 0 && (
                <p className="mt-0.5 pl-[60px] text-[11px] leading-snug text-silver-500">
                  No puede: {resumen.articulacion.noPuede.join(' · ').toLowerCase()}.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
