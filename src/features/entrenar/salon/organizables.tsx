import type { ComponentProps } from 'react'
import { PiezaOrganizable } from '../../../app/PiezaOrganizable'
import { CamaraDelSalon as Camara } from './camara/CamaraDelSalon'
import { TamborDeLaSemana as Tambor } from './rumbo/TamborDeLaSemana'

/**
 * El tambor y la cámara del salón, envueltos para que obedezcan lo que la persona escondió hablando con Praxis (0179).
 * Viven aquí y no en `SalonEntrenar.tsx` porque ese archivo está en el tope del trinquete de líneas: el salón los
 * importa de este archivo con el mismo nombre y no crece.
 */
export function TamborDeLaSemana(props: ComponentProps<typeof Tambor>) {
  return <PiezaOrganizable id="entrenar.tambor"><Tambor {...props} /></PiezaOrganizable>
}

export function CamaraDelSalon(props: ComponentProps<typeof Camara>) {
  return <PiezaOrganizable id="entrenar.camara"><Camara {...props} /></PiezaOrganizable>
}
