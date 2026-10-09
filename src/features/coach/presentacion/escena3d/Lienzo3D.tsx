import { PerformanceMonitor } from '@react-three/drei/core/PerformanceMonitor'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { FOV_3D } from '../../../../domain/escena3d'
import { COLORES } from './materiales'

interface Props {
  etiqueta: string
  /** Clases de Tailwind con el alto del lienzo. */
  claseAltura: string
  /** Solo se pinta mientras está a la vista; fuera de pantalla no gasta ni un fotograma. */
  enVista: boolean
  /** Hay algo vivo en reposo (balanceo, anillo que pulsa): se pide un fotograma ~30 veces por segundo. */
  animado: boolean
  alPerderContexto: () => void
  alTeclear?: (e: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}

/** El escenario de fondo: ni un color fuera de la marca. */
function Luces() {
  return (
    <>
      <ambientLight intensity={0.5} color="#aeb4c4" />
      {/* Luz clave: blanca y fría, desde arriba y a la izquierda. */}
      <directionalLight position={[-6, 10, 5]} intensity={2.6} color="#e9efff" />
      {/* Luz de contra: roja, desde atrás, recorta las siluetas. */}
      <directionalLight position={[5, 3.5, -7]} intensity={6.5} color={COLORES.rojo} />
      <directionalLight position={[-4, 2, -6]} intensity={1.2} color={COLORES.rojo} />
    </>
  )
}

/** Fotogramas a demanda: mientras `activo`, ~30 por segundo para lo que vive en reposo. */
function Latido({ activo }: { activo: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    if (!activo) return
    const id = window.setInterval(invalidate, 33)
    return () => window.clearInterval(id)
  }, [activo, invalidate])
  return null
}

/**
 * El lienzo WebGL de las dos escenas: el mismo escenario (fondo, luces, viñeta) y las mismas
 * reglas de rendimiento. `dpr` entre 1 y 2; `frameloop="demand"` mientras está a la vista y
 * "never" fuera de ella; sin postprocesado.
 */
export function Lienzo3D({ etiqueta, claseAltura, enVista, animado, alPerderContexto, alTeclear, children }: Props) {
  // Entre 1 y 2 píxeles por píxel de CSS; si el equipo no da los fotogramas, baja a 1 y se queda ahí.
  const [dpr, setDpr] = useState<[number, number]>([1, 2])
  return (
    <div
      role="group"
      aria-label={etiqueta}
      tabIndex={0}
      onKeyDown={alTeclear}
      className={`relative overflow-hidden rounded-2xl border border-linea bg-bg outline-none focus-visible:ring-2 focus-visible:ring-rojo ${claseAltura}`}
    >
      <Canvas
        dpr={dpr}
        frameloop={enVista ? 'demand' : 'never'}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ fov: FOV_3D, near: 0.1, far: 600, position: [0, 6, 12] }}
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', alPerderContexto)}
      >
        <color attach="background" args={[COLORES.fondo]} />
        <PerformanceMonitor onDecline={() => setDpr([1, 1])} />
        <Luces />
        {children}
        <Latido activo={enVista && animado} />
      </Canvas>
      {/* La viñeta: oscurece los bordes y lleva la mirada al centro. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 30,
          background:
            'radial-gradient(ellipse 85% 80% at 50% 46%, rgba(10,10,10,0) 55%, rgba(10,10,10,0.55) 100%)',
        }}
      />
    </div>
  )
}
