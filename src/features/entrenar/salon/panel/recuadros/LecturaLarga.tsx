import type { LecturaDePrescripcion } from '../lecturaDeLaPrescripcion'

/**
 * LA LECTURA LARGA, MAQUETADA: una fila por prescripción, tres niveles dentro.
 *
 * ## La forma es la que dice de dónde sale cada cosa
 *
 * A la izquierda, la CIFRA —la misma que está escrita en el muro, al mismo cuerpo
 * relativo y con el mismo relieve—. A la derecha, el texto. Puestas así, bajar el panel se
 * lee como acercarse a lo que ya estaba arriba, no como abrir otra pantalla con otros
 * datos: la columna de cifras es la costura entre el salón y su lectura.
 *
 * ## Sin cajas, y la señal con filete
 *
 * Ni una tarjeta. Las filas se separan con una línea de arriba —el canto de la anterior—
 * y dentro, los tres niveles se distinguen por color y peso: el QUÉ en texto, el POR QUÉ
 * en tenue, y la SEÑAL con un filete a la izquierda.
 *
 * El filete no es decoración: es lo único que cambia de NATURALEZA en la fila. Los dos
 * primeros párrafos explican; el tercero es lo que hay que mirar en el gimnasio para saber
 * si se está cumpliendo. Marcarlo distinto es lo que impide que se lea como la tercera
 * frase de una explicación y se salte.
 *
 * ## Y por qué el foco reordena
 *
 * Si el asesorado ha tocado una de las cuatro cifras del salón, esa fila sube a primera.
 * No se resalta ni se abre sola: se pone donde se lee primero. Es lo que hace que el panel
 * conteste a la pregunta con la que se bajó, en vez de obligar a buscarla entre cuatro.
 */

/**
 * EL CUERPO DE LA CIFRA, en píxeles, según lo larga que sea.
 *
 * La columna son 86 px fijos. Un número de una o dos cifras entra a cuerpo entero; a
 * partir de ahí baja, porque lo que no puede pasar es que parta. `FALLO` son cinco
 * letras en una tipografía expandida: a 30 px se sale, a 20 entra.
 */
export function cuerpoDeLaCifra(cifra: string): number {
  if (cifra.length <= 2) return 30
  if (cifra.length <= 3) return 26
  return 20
}

export interface LecturaLargaProps {
  lecturas: readonly LecturaDePrescripcion[]
  /** La prescripción que el asesorado tocó en el salón, si tocó alguna. */
  foco?: LecturaDePrescripcion['id']
}

export function LecturaLarga({ lecturas, foco }: LecturaLargaProps) {
  if (lecturas.length === 0) return null

  // Se ordena SIN mutar: `lecturas` viene del módulo puro y lo comparten otras piezas.
  const ordenadas = foco
    ? [...lecturas].sort((a, b) => Number(b.id === foco) - Number(a.id === foco))
    : lecturas

  return (
    <div data-lectura-larga className="flex flex-col">
      {ordenadas.map((l) => (
        <article
          key={l.id}
          data-prescripcion={l.id}
          data-enfocada={l.id === foco ? '' : undefined}
          className="grid grid-cols-[86px_1fr] items-start gap-4 border-t border-white/[0.08] py-5 first:border-t-0 first:pt-0"
        >
          <div>
            <p
              className={`text-[9.5px] font-bold uppercase leading-none tracking-[0.18em] ${
                l.id === foco ? 'text-accion' : 'text-silver-500'
              }`}
            >
              {l.rotulo}
            </p>
            {/* LA MISMA CIFRA QUE EL MURO, con el mismo relieve. Es la costura: si aquí
                se escribiera en otra letra, el panel dejaría de ser el mismo salón visto
                de cerca y volvería a ser una pantalla aparte.

                EL CUERPO SALE DE LO LARGA QUE ES, y no es un adorno: la columna mide 86
                px y `FALLO` a 30 px no cabe. Sin esto, una prescripción al fallo partiría
                la palabra en dos renglones —el mismo fallo que ya se corrigió en el muro—
                y ninguna prueba lo diría. */}
            <p
              className="muro-cifra-panel mt-1"
              style={{ fontSize: `${cuerpoDeLaCifra(l.cifra)}px` }}
            >
              {l.cifra}
            </p>
            {l.matiz && <p className="muro-cifra-matiz">{l.matiz}</p>}
          </div>
          <div>
            <p className="text-[14.5px] leading-[1.55] text-texto">{l.que}</p>
            <p className="mt-2.5 text-[13px] leading-[1.55] text-tenue">{l.porque}</p>
            {/* LA SEÑAL. Lo único de la fila que no explica: lo que se mira. */}
            <p className="mt-2.5 border-l border-silver-500/60 pl-3 text-[13px] leading-[1.5] text-silver-200">
              {l.senal}
            </p>
          </div>
        </article>
      ))}
    </div>
  )
}
