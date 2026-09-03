import type { MiniEstadistica, NivelAlfa } from '../../../domain/rutaEntrenamiento'

interface Props {
  pct: number
  nivelActual: NivelAlfa
  siguienteNivel?: NivelAlfa
  estadisticas: readonly MiniEstadistica[]
}

function nombreBonito(nombre: string): string {
  return nombre.charAt(0) + nombre.slice(1).toLowerCase()
}

/** Cuánto le falta para el siguiente nivel, con las tres cifras que lo sostienen. */
export function TarjetaProgresoNivel({ pct, nivelActual, siguienteNivel, estadisticas }: Props) {
  const seguro = Math.max(0, Math.min(100, Math.round(pct)))

  return (
    // La escena la abre el bloque y no la página: cada bloque de la Ruta trae la suya,
    // igual que hacen los rieles de la sesión. Así ningún ancestro común crea un bloque
    // contenedor para lo que pueda venir `fixed` desde dentro.
    //
    // El marco (`rounded-[18px] border bg-ink-700 shadow-brillo`) y la cabecera se
    // fueron el 2026-09-03: dentro de la hoja del salón eran una tarjeta dentro de otra
    // y un título repetido. El porcentaje no se perdió — está en el rótulo del tramo.
    <section className="escena-prof">
      <div
        role="progressbar"
        aria-valuenow={seguro}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          siguienteNivel ? `Progreso al nivel ${siguienteNivel.numero}` : 'Progreso de nivel'
        }
        className="pozo-3d h-2 overflow-hidden rounded-full bg-ink-500"
        // El halo se ha movido del relleno AL CARRIL. Estaba sobre el elemento que
        // recorre, así que había que volver a rasterizar un anillo de 3 px más una
        // sombra de 24 px en cada fotograma del recorrido; y una sombra sobre algo
        // que escala se deforma con él. En el carril es estable y no se repinta.
        //
        // Y el carril va HUNDIDO (`.pozo-3d`, `--prof-hueco`). No es adorno: lo que
        // le falta a una barra es literalmente materia que falta dentro de la misma
        // placa, que es la definición del escalón en `tokens.css:272`. El relleno se
        // queda en el plano, así que al crecer sube desde el surco.
        //
        // Las dos sombras se enumeran juntas porque el `box-shadow` en línea gana a
        // la clase: dejar solo el halo borraría el hundido, y dejar solo el hundido
        // devolvería el repintado del anillo al elemento que recorre.
        style={{ boxShadow: 'var(--glow-accion), var(--sombra-hundido)' }}
      >
        {/* `scaleX` y no `width`. Es la barra más grande de la Ruta y comparte
            pantalla con el scrub del lienzo cinemático: animar maquetación aquí
            hacía que las dos cosas se pelearan por el hilo principal. */}
        <span
          className="block h-full w-full origin-left rounded-full bg-accion transition-transform duration-base ease-salida"
          style={{ transform: `scaleX(${seguro / 100})` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[11.5px] text-silver-400">
        <span>{nombreBonito(nivelActual.nombre)}</span>
        {siguienteNivel && <span>{nombreBonito(siguienteNivel.nombre)}</span>}
      </div>

      {/* La escena va aqui y no solo en la seccion: `perspective` alcanza a los HIJOS
            DIRECTOS, y estas tres cifras son nietas. Sin esto el `translateZ` se
            aplica igual y no escorza — se ve exactamente plano, sin ningun aviso. */}
      {/* LAS TRES CIFRAS, ya sin caja.
          Eran tres recuadros hundidos con borde y fondo propios: tres objetos dentro de
          un bloque que a su vez estaba dentro de un tramo de la hoja: tres marcos para
          leer tres números. Ahora las separa una junta de luz —la misma que separa los
          tramos— y el hundido se va con la caja, porque `--prof-hueco` troquela SOBRE
          una placa y aquí ya no hay placa que troquelar. */}
      <div className="escena-prof mt-3.5 grid grid-cols-3 divide-x divide-white/10">
        {estadisticas.map((e) => (
          <div key={e.etiqueta} className="px-3 first:pl-0 last:pr-0">
            <p className="cifras text-base font-bold leading-none text-silver-100">{e.valor}</p>
            <p className="mt-1.5 text-[9.5px] font-bold uppercase leading-tight tracking-[0.12em] text-silver-500">
              {e.etiqueta}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
