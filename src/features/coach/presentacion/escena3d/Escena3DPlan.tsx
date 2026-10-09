/* eslint-disable react-hooks/immutability --
   Esto es three.js: las mallas, los materiales y la cámara son objetos mutables que viven en la
   tarjeta gráfica, y un callback de `useFrame` los actualiza a propósito en cada fotograma
   (uniforms, posición, escala). No son estado de React ni se leen al pintar: reasignarlos aquí es
   lo único que hay que hacer, no un descuido. */
import { Html } from '@react-three/drei/web/Html'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  EdgesGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
  type Group,
} from 'three'
import {
  caminoDelPlan,
  pasoDeMuelle,
  poseDelCamino,
  poseEnNodo,
  type NodoCamino,
} from '../../../../domain/escena3d'
import type { CasillaMapa, SituacionCasilla } from '../../../../domain/presentacionAsesorado'
import { ALTURA_ESCENA_PLAN } from './alturas'
import { AnilloPulsante } from './AnilloPulsante'
import { Lienzo3D } from './Lienzo3D'
import { COLORES, crearMaterialDeCinta, texturaRadial } from './materiales'
import { RigCamara } from './RigCamara'
import { Suelo } from './Suelo'
import { useEnVista } from './useEnVista'

export interface PropiedadesEscena3DPlan {
  casillas: readonly CasillaMapa[]
  /** La semana tocada, o `null`. */
  abierta: number | null
  onElegir: (numero: number) => void
  alPerderContexto: () => void
  alTeclear: (e: KeyboardEvent<HTMLDivElement>) => void
}

const ALTURA_LIENZO = ALTURA_ESCENA_PLAN
const ALTO_NODO: Record<SituacionCasilla, number> = { hecha: 0.26, actual: 0.52, viene: 0.12 }

const NODO_UNIDAD = new CylinderGeometry(0.27, 0.31, 1, 6, 1)
const BORDE_NODO = new EdgesGeometry(NODO_UNIDAD)

function crearMaterialesDelCamino() {
  const halo = texturaRadial('255,255,255', 1)
  return {
    hecha: new MeshStandardMaterial({
      color: '#aab0b9',
      roughness: 0.38,
      metalness: 0.4,
      emissive: new Color(COLORES.plata),
      emissiveIntensity: 0.28,
    }),
    actual: new MeshStandardMaterial({
      color: COLORES.rojo,
      roughness: 0.3,
      metalness: 0.2,
      emissive: new Color(COLORES.rojo),
      emissiveIntensity: 0.75,
    }),
    viene: new MeshStandardMaterial({ color: '#25262a', roughness: 0.85, metalness: 0.1 }),
    tapaHecha: new MeshBasicMaterial({ color: '#e6eaef', toneMapped: false }),
    tapaActual: new MeshBasicMaterial({ color: '#ff7468', toneMapped: false }),
    tapaViene: new MeshBasicMaterial({ color: '#3c3e44' }),
    bordeViene: new MeshBasicMaterial({ color: COLORES.plataTenue, transparent: true, opacity: 0.4 }),
    haloRojo: new MeshBasicMaterial({
      map: halo,
      color: COLORES.rojo,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    haloBlanco: new MeshBasicMaterial({
      map: halo,
      color: '#ffffff',
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.8,
    }),
    pistaViene: new MeshStandardMaterial({ color: '#3a3d43', roughness: 0.8 }),
  }
}

type MaterialesDelCamino = ReturnType<typeof crearMaterialesDelCamino>

function Nodo({
  nodo,
  casilla,
  elegida,
  m,
  tiempo,
  onElegir,
  etiquetas,
}: {
  nodo: NodoCamino
  casilla: CasillaMapa
  elegida: boolean
  m: MaterialesDelCamino
  tiempo: { current: number }
  onElegir: (numero: number) => void
  etiquetas: boolean
}) {
  const grupo = useRef<Group>(null)
  const muelle = useRef({ x: 0, v: 0 })
  const { situacion } = casilla
  const alto = ALTO_NODO[situacion] * (elegida ? 1.5 : 1)
  const retraso = 0.2 + nodo.indice * 0.035

  useFrame((estado, delta) => {
    const meta = tiempo.current >= retraso ? 1 : 0
    muelle.current = pasoDeMuelle(muelle.current, meta, Math.min(delta, 0.05))
    grupo.current?.scale.setScalar(Math.max(0.0001, muelle.current.x))
    if (meta === 0 || Math.abs(muelle.current.x - 1) > 0.0008 || Math.abs(muelle.current.v) > 0.002) estado.invalidate()
  })

  const material = m[situacion]
  const tapa = situacion === 'hecha' ? m.tapaHecha : situacion === 'actual' ? m.tapaActual : m.tapaViene
  const etiquetaColor = elegida ? 'text-texto' : situacion === 'actual' ? 'text-rojo' : situacion === 'hecha' ? 'text-silver-200' : 'text-tenue'

  return (
    <group position={[nodo.x, 0, nodo.z]}>
      <group ref={grupo} scale={0.0001}>
        {(situacion === 'actual' || elegida) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={elegida ? m.haloBlanco : m.haloRojo} scale={elegida ? 1.5 : 1.2}>
            <planeGeometry args={[1.3, 1.3]} />
          </mesh>
        )}
        <mesh geometry={NODO_UNIDAD} material={material} position={[0, alto / 2, 0]} scale={[elegida ? 1.2 : 1, alto, elegida ? 1.2 : 1]} />
        {situacion === 'viene' && (
          <lineSegments geometry={BORDE_NODO} material={m.bordeViene} position={[0, alto / 2, 0]} scale={[1, alto, 1]} />
        )}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, alto + 0.004, 0]} material={tapa}>
          <circleGeometry args={[0.2 * (elegida ? 1.2 : 1), 6]} />
        </mesh>
        {etiquetas && (
          <Html center position={[0, alto + 0.34, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <span
              className={`cifras select-none text-[12px] font-bold ${etiquetaColor}`}
              style={{ textShadow: '0 1px 4px #0a0a0a, 0 0 8px #0a0a0a' }}
            >
              {casilla.numero}
            </span>
          </Html>
        )}
        {situacion === 'actual' && <AnilloPulsante tiempo={tiempo} radio={0.42} />}
      </group>
      {/* Zona de toque amplia, invisible. */}
      <mesh
        position={[0, 0.3, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onElegir(casilla.numero)
        }}
        onPointerOver={(e) => {
          const el = e.nativeEvent.target
          if (el instanceof HTMLElement) el.style.cursor = 'pointer'
        }}
        onPointerOut={(e) => {
          const el = e.nativeEvent.target
          if (el instanceof HTMLElement) el.style.cursor = ''
        }}
      >
        <cylinderGeometry args={[0.55, 0.55, 1, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

/** Una curva suave por los nodos `de`..`a`, o nada si no hay dos. */
function curvaPor(nodos: readonly NodoCamino[], de: number, a: number): CatmullRomCurve3 | null {
  const puntos = nodos.slice(de, a + 1).map((n) => new Vector3(n.x, 0.05, n.z))
  return puntos.length >= 2 ? new CatmullRomCurve3(puntos, false, 'centripetal') : null
}

/** La pista: lo recorrido se enciende de izquierda a derecha, lo que viene queda apagado. */
function Pista({ nodos, hasta, tiempo }: { nodos: readonly NodoCamino[]; hasta: number; tiempo: { current: number } }) {
  const m = useMemo(() => crearMaterialDeCinta(1, false), [])
  const mHalo = useMemo(() => crearMaterialDeCinta(0.18, true), [])
  const apagada = useMemo(() => new MeshStandardMaterial({ color: '#34373d', roughness: 0.85 }), [])

  const hecha = useMemo(() => curvaPor(nodos, 0, hasta), [nodos, hasta])
  const futura = useMemo(() => curvaPor(nodos, hasta, nodos.length - 1), [nodos, hasta])

  const geoHecha = useMemo(() => (hecha ? new TubeGeometry(hecha, Math.max(24, hasta * 20), 0.04, 8, false) : null), [hecha, hasta])
  const geoHalo = useMemo(() => (hecha ? new TubeGeometry(hecha, Math.max(24, hasta * 20), 0.11, 8, false) : null), [hecha, hasta])
  const geoFutura = useMemo(
    () => (futura ? new TubeGeometry(futura, Math.max(24, (nodos.length - hasta) * 12), 0.022, 6, false) : null),
    [futura, nodos.length, hasta],
  )

  useEffect(() => {
    m.uniforms.uColor.value.set('#dfe4ea')
    mHalo.uniforms.uColor.value.set('#c2c8cf')
  }, [m, mHalo])
  useEffect(
    () => () => {
      m.dispose()
      mHalo.dispose()
      apagada.dispose()
      geoHecha?.dispose()
      geoHalo?.dispose()
      geoFutura?.dispose()
    },
    [m, mHalo, apagada, geoHecha, geoHalo, geoFutura],
  )

  useFrame((estado) => {
    const crudo = Math.min(1, Math.max(0, (tiempo.current - 0.3) / 1.6))
    const p = 1 - Math.pow(1 - crudo, 3)
    m.uniforms.uProgreso.value = p
    mHalo.uniforms.uProgreso.value = p
    if (crudo < 1) estado.invalidate()
  })

  return (
    <group>
      {geoFutura && <mesh geometry={geoFutura} material={apagada} />}
      {geoHalo && <mesh geometry={geoHalo} material={mHalo} renderOrder={5} />}
      {geoHecha && <mesh geometry={geoHecha} material={m} renderOrder={6} />}
    </group>
  )
}

function Contenido({
  casillas,
  abierta,
  onElegir,
  alTocar,
}: PropiedadesEscena3DPlan & { alTocar: () => void }) {
  const size = useThree((s) => s.size)
  const aspecto = size.width / Math.max(1, size.height)
  const m = useMemo(() => crearMaterialesDelCamino(), [])
  const tiempo = useRef(0)
  const vivo = useRef({ x: 0, azimut: 0, distancia: 10, fov: 34 })

  useEffect(
    () => () => {
      for (const k of Object.keys(m) as (keyof typeof m)[]) {
        m[k].map?.dispose()
        m[k].dispose()
      }
    },
    [m],
  )

  const { nodos, ancho, fondo } = useMemo(() => caminoDelPlan(casillas.length), [casillas.length])
  const hasta = useMemo(() => {
    let ultimo = -1
    casillas.forEach((c, i) => {
      if (c.situacion !== 'viene') ultimo = i
    })
    return Math.max(0, ultimo)
  }, [casillas])

  // Las cifras (DOM) se montan tras el primer fotograma, no en el mismo montaje que el lienzo.
  const [etiquetas, setEtiquetas] = useState(false)
  useFrame((estado, delta) => {
    tiempo.current += Math.min(delta, 0.05)
    if (!etiquetas) setEtiquetas(true)
    if (tiempo.current < 0.2 + casillas.length * 0.035 + 2.6) estado.invalidate()
  })

  const nodoAbierto = abierta === null ? undefined : nodos[casillas.findIndex((c) => c.numero === abierta)]
  const pose = useMemo(
    () => (nodoAbierto ? poseEnNodo(nodoAbierto) : poseDelCamino({ ancho, fondo, aspecto })),
    [nodoAbierto, ancho, fondo, aspecto],
  )

  return (
    <>
      <RigCamara pose={pose} plana={false} alturaPlana={10} reinicio={String(abierta)} balanceo onTocar={alTocar} vivo={vivo} />
      <Suelo radio={Math.max(14, ancho + fondo + 6)} />
      <Pista nodos={nodos} hasta={hasta} tiempo={tiempo} />
      {casillas.map((c, i) => (
        <Nodo
          key={c.numero}
          nodo={nodos[i]}
          casilla={c}
          elegida={c.numero === abierta}
          m={m}
          tiempo={tiempo}
          onElegir={onElegir}
          etiquetas={etiquetas}
        />
      ))}
    </>
  )
}

/**
 * EL MAPA DEL PLAN COMO RECORRIDO 3D: la pista serpentea sobre el mismo escenario. Lo hecho,
 * encendido en plata; la semana de ahora, en rojo y pulsando; lo que viene, apagado. Este
 * archivo se carga a demanda (`React.lazy`).
 */
export default function Escena3DPlan(props: PropiedadesEscena3DPlan) {
  const { ref, enVista } = useEnVista<HTMLDivElement>()
  const [tocado, setTocado] = useState(false)
  const hayActual = props.casillas.some((c) => c.situacion === 'actual')
  return (
    <div ref={ref} data-testid="mapa-webgl">
      <Lienzo3D
        etiqueta="Mapa del plan en tres dimensiones: un camino con una parada por semana. Toca una parada para ver lo que dice el plan."
        claseAltura={ALTURA_LIENZO}
        enVista={enVista}
        animado={!tocado || hayActual}
        alPerderContexto={props.alPerderContexto}
        alTeclear={props.alTeclear}
      >
        <Contenido {...props} alTocar={() => setTocado(true)} />
      </Lienzo3D>
    </div>
  )
}

