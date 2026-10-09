import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, MeshBasicMaterial, type Mesh } from 'three'
import { COLORES } from './materiales'

/**
 * El anillo que pulsa despacio en el suelo bajo «lo de ahora»: dos ondas desfasadas que se
 * abren y se apagan, una cada dos segundos. Su propio material (cada onda tiene su opacidad).
 */
export function AnilloPulsante({ tiempo, radio = 0.5 }: { tiempo: { current: number }; radio?: number }) {
  const a = useRef<Mesh>(null)
  const b = useRef<Mesh>(null)
  const [matA, matB] = useMemo(() => {
    const crear = () =>
      new MeshBasicMaterial({
        color: COLORES.rojo,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      })
    return [crear(), crear()]
  }, [])
  useEffect(
    () => () => {
      matA.dispose()
      matB.dispose()
    },
    [matA, matB],
  )
  useFrame(() => {
    const onda = (malla: Mesh | null, mat: MeshBasicMaterial, fase: number) => {
      if (!malla) return
      const p = (tiempo.current * 0.42 + fase) % 1
      const e = 1 - Math.pow(1 - p, 2)
      malla.scale.setScalar(0.85 + 0.75 * e)
      mat.opacity = 0.85 * (1 - p) * (1 - p)
    }
    onda(a.current, matA, 0)
    onda(b.current, matB, 0.5)
  })
  return (
    <>
      <mesh ref={a} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={matA}>
        <ringGeometry args={[radio, radio + 0.05, 64]} />
      </mesh>
      <mesh ref={b} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={matB}>
        <ringGeometry args={[radio, radio + 0.05, 64]} />
      </mesh>
    </>
  )
}
