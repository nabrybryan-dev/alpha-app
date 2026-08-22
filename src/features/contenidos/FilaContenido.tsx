import { Card } from '../../components/ui/Card'
import { IconoDocumento, IconoImagen, IconoVideo } from '../../components/ui/Icono'
import type { Contenido } from '../../domain/types'

const ICONO = { video: IconoVideo, imagen: IconoImagen, articulo: IconoDocumento } as const
const QUE_ES = { video: 'Vídeo', imagen: 'Imagen', articulo: 'Lectura' } as const

interface FilaContenidoProps {
  contenido: Contenido
  onAbrir: () => void
}

/**
 * Movilidad y educación: material para ver o para leer, no vocabulario del
 * método. Aquí una fila es la forma correcta — lo que importa es el título y
 * saber de un vistazo si es un vídeo o un texto, porque no cuesta lo mismo
 * abrir uno que otro en mitad del día.
 *
 * El tipo se dice con palabra además de con icono: un icono solo obliga a
 * aprenderse el vocabulario antes de poder decidir.
 */
// DECISIÓN PENDIENTE: el encargo pide que el cuadro de 44 px «que hoy lleva un
// emoji (🎬 🖼 📄)» pase a ser una miniatura de la pieza. Ese emoji YA NO EXISTE:
// lo sustituyó `6c0146c` por iconos vectoriales, y el cuadro mide 40, no 44.
// No se cambia, por dos razones que van contra el propio encargo si se hiciera:
//   1. El icono DICE ALGO —vídeo o lectura— y por eso está aquí; una miniatura de
//      D sería la misma imagen repetida en cada fila, sin informar de nada.
//   2. Repetir el mismo plano fila tras fila es exactamente la «rejilla de tarjetas
//      idénticas» que la sección 6 prohíbe.
// Si aun así se quiere, es cambiar `Icono` por la miniatura en este bloque.
export function FilaContenido({ contenido, onAbrir }: FilaContenidoProps) {
  const Icono = ICONO[contenido.tipo]

  return (
    <button type="button" onClick={onAbrir} className="press w-full text-left">
      <Card className="flex items-start gap-3.5">
        <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-linea bg-surface-3 text-tenue">
          <Icono className="h-[19px] w-[19px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="cifras block text-[10px] font-bold uppercase tracking-[0.16em] text-tenue">
            {QUE_ES[contenido.tipo]}
          </span>
          <span className="mt-1 block font-display text-[15px] leading-tight text-texto">
            {contenido.titulo}
          </span>
          <span className="mt-1 block line-clamp-2 text-xs leading-snug text-tenue">
            {contenido.descripcion}
          </span>
        </span>
      </Card>
    </button>
  )
}
