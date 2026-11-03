import { useSesion } from '../../app/SessionProvider'
import { BuzonComentarios } from '../entrenar/miEntreno/BuzonComentarios'
import { AvisosYo } from './AvisosYo'
import { CambiarClave } from './CambiarClave'

/**
 * YO (decisión de Bryan, 28-oct; H-01, H-03 y H-06 del inventario): lo que la persona controla de su cuenta —los avisos del
 * teléfono, el buzón de comentarios sobre la app y la clave—. NADA de salud: ni check-in, ni medidas, ni nutrición.
 *
 * Se llega desde el menú de cuenta de la cabecera (`TopBar`). El buzón es el mismo `BuzonComentarios` de Mi entreno, sin cambios.
 */
export default function YoPage() {
  const { usuario } = useSesion()
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">{usuario.nombre}</p>
        <h2 className="font-display text-3xl leading-none text-texto">Yo</h2>
        <p className="text-sm text-tenue">Tus avisos, tus comentarios sobre la app y tu clave.</p>
      </header>
      <AvisosYo usuarioId={usuario.id} />
      <BuzonComentarios />
      <CambiarClave />
    </div>
  )
}
