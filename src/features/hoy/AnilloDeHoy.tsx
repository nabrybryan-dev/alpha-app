import { AnilloDelDia } from '../../components/ui/AnilloDelDia'

// C1 (bandera apagada por defecto): el anillo del día y las tarjetas a 22 px, solo asesorado.
// DECISIÓN PENDIENTE DE BRYAN: no existe en Hoy un dato claro de «hecho del día» (lo que hay
// es el cumplimiento de la SEMANA, `cumplimientoSemana`, y `sesionHecha`, que es de una
// sesión). No se inventa una cuenta: el anillo queda con «sin dato» (raya, no cero) hasta
// que Bryan diga cuál es. Rojo y plata son los tokens existentes (`--rojo`, `--placa`).
// Vive aparte de HoyPage para no subir su complejidad (trinquete de calidad).

export function AnilloDeHoy({ visible }: { visible: boolean }) {
  if (!visible) return null
  const hecho: number | undefined = undefined
  return (
    <div className="entrada entrada-2 flex justify-center">
      <AnilloDelDia hecho={hecho} subtitulo="del día" etiqueta="Sin dato del día" />
    </div>
  )
}
