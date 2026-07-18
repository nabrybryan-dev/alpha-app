import { useContadorAnimado } from './useContadorAnimado'

interface CifraAnimadaProps {
  valor: number
  duracionMs?: number
}

/** Número entero que cuenta hasta su valor al montar o cambiar. */
export function CifraAnimada({ valor, duracionMs }: CifraAnimadaProps) {
  const animado = useContadorAnimado(valor, duracionMs)
  return <>{Math.round(animado)}</>
}
