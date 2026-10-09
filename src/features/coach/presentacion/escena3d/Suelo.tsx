import { useEffect, useMemo } from 'react'
import { crearMaterialDelSuelo } from './materiales'

/** El suelo: una sola malla con la rejilla tenue que se pierde en la niebla. */
export function Suelo({ radio }: { radio: number }) {
  const material = useMemo(() => crearMaterialDelSuelo(radio), [radio])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={-2}>
      <planeGeometry args={[radio * 2.6, radio * 2.6]} />
    </mesh>
  )
}
