import { MOTIVO_SIN_CONFIRMAR } from '../../domain/confirmacionSerie'

/**
 * «HECHO TAL CUAL»: el recibo firmado. Un toque guarda la serie con la carga y las reps de
 * la pauta y la marca como confirmada. Lo comparten la tarjeta de la sesión y el cajón del
 * salón, para que los dos digan lo mismo con las mismas palabras.
 *
 * Es un botón de verdad (teclado, foco visible, 44 px de alto como mínimo) y su nombre
 * accesible dice lo que firma, con los números: quien usa lector de pantalla oye «Hecho tal
 * cual: 40 kilos, 8 repeticiones», no solo «Hecho».
 */
interface HechoTalCualProps {
  cargaKg: number
  reps: number
  onConfirmar: () => void
  compacto?: boolean
}

export function HechoTalCual({ cargaKg, reps, onConfirmar, compacto = false }: HechoTalCualProps) {
  return (
    <button
      type="button"
      onClick={onConfirmar}
      aria-label={`Hecho tal cual: ${cargaKg} kilos, ${reps} repeticiones`}
      className={`press w-full rounded-boton border-2 border-accion bg-accion/10 font-display uppercase tracking-wide text-accion focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion ${
        compacto ? 'min-h-[44px] py-2.5 text-sm' : 'min-h-[48px] py-3 text-base'
      }`}
    >
      Hecho tal cual
    </button>
  )
}

/** Por qué «Guardar» está apagado. `id` para enlazarlo con `aria-describedby`. */
export function MotivoSinConfirmar({ id, className = '' }: { id?: string; className?: string }) {
  return (
    <p id={id} className={`text-center text-[11px] leading-snug text-tenue ${className}`}>
      {MOTIVO_SIN_CONFIRMAR}
    </p>
  )
}
