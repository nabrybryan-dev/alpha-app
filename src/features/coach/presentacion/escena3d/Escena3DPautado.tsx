/* eslint-disable react-hooks/immutability --
   Esto es three.js: las mallas, los materiales y la cámara son objetos mutables que viven en la
   tarjeta gráfica, y un callback de `useFrame` los actualiza a propósito en cada fotograma
   (uniforms, posición, escala). No son estado de React ni se leen al pintar: reasignarlos aquí es
   lo único que hay que hacer, no un descuido. */
import { Html } from '@react-three/drei/web/Html'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  EdgesGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Shape,
  TubeGeometry,
  Vector3,
  type Camera,
  type Group,
  type Mesh,
  type Object3D,
} from 'three'
import {
  ALTO_TOPE,
  SEPARACION,
  alturaDeVistaPlana,
  disposicionDeBarras,
  pasoDeMuelle,
  poseEnfocada,
  poseGeneral,
  poseVistaPlana,
  puntosDeLaCinta,
  semanasVisibles,
  type BarraEscena,
} from '../../../../domain/escena3d'
import { numeroExacto, type MagnitudPautado, type PautadoVsHechoMicrociclo } from '../../../../domain/pautadoVsHecho'
import { nombreDelMicrociclo } from '../../../../domain/palabrasLlanas'
import { ALTURA_ESCENA_PAUTADO } from './alturas'
import { AnilloPulsante } from './AnilloPulsante'
import { Lienzo3D } from './Lienzo3D'
import { COLORES, crearMaterialDeCinta, useMaterialesDeBarras, type MaterialesDeBarras } from './materiales'
import { RigCamara } from './RigCamara'
import { Suelo } from './Suelo'
import { useEnVista } from './useEnVista'

export interface PropiedadesEscena3DPautado {
  filas: readonly PautadoVsHechoMicrociclo[]
  magnitud: MagnitudPautado
  seleccionadoId: string | undefined
  /** La persona tocó una semana (o usó ← →): la cámara se acerca a ella. */
  enfocado: boolean
  plana: boolean
  onSeleccionar: (id: string) => void
  alPerderContexto: () => void
  alTeclear: (e: KeyboardEvent<HTMLDivElement>) => void
}

const ANCHO_VIDRIO = 0.68
const ANCHO_SOLIDO = 0.4
const BISEL = 0.035
const ALTURA_LIENZO = ALTURA_ESCENA_PAUTADO

/** Geometrías unitarias compartidas por todas las barras. */
const CAJA_UNIDAD = new BoxGeometry(1, 1, 1)
const BORDES_UNIDAD = new EdgesGeometry(CAJA_UNIDAD)

// ── Una semana: el pautado en vidrio, el hecho sólido dentro ───────────────────────────

function Barra({
  b,
  orden,
  activa,
  m,
  onSeleccionar,
  tiempo,
  vivo,
  lejos,
  etiquetas,
}: {
  b: BarraEscena
  orden: number
  activa: boolean
  m: MaterialesDeBarras
  onSeleccionar: (id: string) => void
  tiempo: { current: number }
  vivo: { current: { azimut: number } }
  /** A cuántas semanas está de la elegida. */
  lejos: number
  etiquetas: boolean
}) {
  const escala = useRef<Group>(null)
  const tapa = useRef<Group>(null)
  const etiqueta = useRef<Group>(null)
  const cifras = useRef<HTMLDivElement>(null)
  const muelle = useRef({ x: 0, v: 0 })
  const retraso = 0.25 + orden * 0.06
  const conBarras = b.motivo === undefined
  const alto = Math.max(b.altoPauta, b.altoHecho)

  useFrame((estado, delta) => {
    const dt = Math.min(delta, 0.05)
    const t = tiempo.current
    const meta = t >= retraso ? 1 : 0
    muelle.current = pasoDeMuelle(muelle.current, meta, dt)
    const s = Math.max(0.0001, muelle.current.x)
    escala.current?.scale.setY(s)
    tapa.current?.position.setY(b.altoHecho * s)
    etiqueta.current?.position.setY(alto * s + (activa ? 0.78 : 0.5))
    // Con la escena muy girada las cifras de las semanas lejanas se apilan y no se leen: se apagan
    // poco a poco; las de la semana elegida y sus vecinas siempre se quedan.
    if (cifras.current && !activa) {
      const o = lejos <= 1 ? 1 : Math.max(0, Math.min(1, 1 - (Math.abs(vivo.current.azimut) - 28) / 22))
      cifras.current.style.opacity = String(o)
    }
    const quieto = meta === 1 && Math.abs(muelle.current.x - 1) < 0.0008 && Math.abs(muelle.current.v) < 0.002
    if (!quieto) estado.invalidate()
  })

  // El bisel va en la geometría (no en una escala): se extruye un cuadrado con borde redondeado.
  const hechoAlto = Math.max(0.02, b.altoHecho)
  const ladoSolido = ANCHO_SOLIDO - 2 * BISEL
  const forma = useMemo(() => {
    const h = ladoSolido / 2
    return new Shape().moveTo(-h, -h).lineTo(h, -h).lineTo(h, h).lineTo(-h, h).closePath()
  }, [ladoSolido])

  return (
    <group position={[b.x, 0, 0]}>
      {/* La sombra de contacto, suave, bajo la pareja. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={m.sombra}>
        <planeGeometry args={[ANCHO_VIDRIO * 2.3, ANCHO_VIDRIO * 2.3]} />
      </mesh>

      {conBarras && (
        <>
          <group ref={escala} scale={[1, 0.0001, 1]}>
            {/* EL PAUTADO: un prisma de vidrio con borde luminoso. */}
            <mesh
              position={[0, b.altoPauta / 2, 0]}
              scale={[ANCHO_VIDRIO, Math.max(0.02, b.altoPauta), ANCHO_VIDRIO]}
              geometry={CAJA_UNIDAD}
              material={activa ? m.vidrioActivo : m.vidrio}
              renderOrder={2}
            />
            <lineSegments
              position={[0, b.altoPauta / 2, 0]}
              scale={[ANCHO_VIDRIO, Math.max(0.02, b.altoPauta), ANCHO_VIDRIO]}
              geometry={BORDES_UNIDAD}
              material={activa ? m.bordeActivo : m.bordeVidrio}
              renderOrder={3}
            />
            {/* EL HECHO: un prisma sólido, rojo, con bisel. */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BISEL, 0]} material={activa ? m.hechoActivo : m.hecho}>
              <extrudeGeometry
                args={[
                  forma,
                  { depth: Math.max(0.001, hechoAlto - 2 * BISEL), bevelEnabled: true, bevelThickness: BISEL, bevelSize: BISEL, bevelSegments: 3, curveSegments: 1 },
                ]}
              />
            </mesh>
          </group>

          {/* La tapa del hecho: una placa que brilla por sí sola y su halo en el aire. */}
          <group ref={tapa} position={[0, 0.0001, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} material={m.tapa}>
              <planeGeometry args={[ladoSolido * 0.86, ladoSolido * 0.86]} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={m.halo} scale={activa ? 1.35 : 1}>
              <planeGeometry args={[1.05, 1.05]} />
            </mesh>
          </group>
        </>
      )}

      {b.actual && <AnilloPulsante tiempo={tiempo} />}

      {/* Las cifras: DOM encima de la escena, siempre de frente y siempre legibles. */}
      {!etiquetas ? null : conBarras ? (
        <group ref={etiqueta} position={[0, alto + 0.5, 0]}>
          <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <EtiquetaDeBarra b={b} activa={activa} orden={orden} refRaiz={cifras} />
          </Html>
        </group>
      ) : (
        <Html center position={[0, 0.6, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className="cifras pres-entra select-none whitespace-nowrap text-[12px] text-tenue"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', animationDelay: `${retraso * 1000}ms` }}
          >
            {b.motivo}
          </span>
        </Html>
      )}

      {/* El número de la semana, al pie. */}
      {etiquetas && (
        <Html center position={[0, 0, 0.68]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <span
            className={`cifras select-none text-[12px] font-bold ${activa ? 'text-rojo' : b.actual ? 'text-texto' : 'text-tenue'}`}
            style={{ textShadow: '0 1px 4px #0a0a0a' }}
          >
            {b.numero}
          </span>
        </Html>
      )}

      {/* Zona de toque amplia: la barra es fina y el dedo, no. Invisible, pero recibe el toque. */}
      <mesh
        position={[0, (ALTO_TOPE + 0.9) / 2, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSeleccionar(b.id)
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
        <boxGeometry args={[SEPARACION * 0.94, ALTO_TOPE + 0.9, 1.1]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

function EtiquetaDeBarra({
  b,
  activa,
  orden,
  refRaiz,
}: {
  b: BarraEscena
  activa: boolean
  orden: number
  refRaiz: RefObject<HTMLDivElement | null>
}) {
  const bajo = b.pct !== undefined && b.pct < 70
  const retraso = `${(0.25 + orden * 0.06 + 0.5) * 1000}ms`
  if (activa) {
    return (
      <div
        ref={refRaiz}
        className="pres-entra flex select-none flex-col items-center gap-0.5 whitespace-nowrap rounded-lg border border-rojo bg-bg/85 px-2 py-1 text-center leading-none"
        style={{ animationDelay: retraso }}
      >
        <span className="cifras text-[14px] font-bold text-texto">
          {numeroExacto(b.hecho)} <span className="font-normal text-tenue">de {numeroExacto(b.pautado)}</span>
        </span>
        <span className={`cifras text-[13px] font-bold ${bajo ? 'text-rojo' : 'text-silver-200'}`}>{b.pct ?? 0} %</span>
      </div>
    )
  }
  return (
    <div
      ref={refRaiz}
      className="pres-entra flex select-none flex-col items-center gap-px whitespace-nowrap text-center leading-none"
      style={{ animationDelay: retraso, textShadow: '0 1px 4px #0a0a0a, 0 0 10px #0a0a0a' }}
    >
      <span className="cifras text-[13px] font-bold text-texto">{numeroExacto(b.hecho)}</span>
      <span className={`cifras text-[12px] ${bajo ? 'text-rojo' : 'text-tenue'}`}>{b.pct ?? 0}%</span>
    </div>
  )
}

// ── La cinta de tendencia ──────────────────────────────────────────────────────────────

/** Une las tapas de «lo hecho» y se dibuja de izquierda a derecha: la tasa de progresión. */
function Cinta({ barras, retraso, tiempo }: { barras: readonly BarraEscena[]; retraso: number; tiempo: { current: number } }) {
  const puntos = useMemo(() => puntosDeLaCinta(barras), [barras])
  const curva = useMemo(
    () =>
      puntos.length >= 2
        ? new CatmullRomCurve3(puntos.map((p) => new Vector3(p.x, p.y + 0.05, p.z)), false, 'centripetal')
        : null,
    [puntos],
  )
  const tubo = useMemo(() => (curva ? new TubeGeometry(curva, Math.max(40, puntos.length * 24), 0.032, 8, false) : null), [curva, puntos.length])
  const halo = useMemo(() => (curva ? new TubeGeometry(curva, Math.max(40, puntos.length * 24), 0.075, 8, false) : null), [curva, puntos.length])
  const matTubo = useMemo(() => crearMaterialDeCinta(1, false), [])
  const matHalo = useMemo(() => crearMaterialDeCinta(0.2, true), [])
  const cabeza = useRef<Mesh>(null)
  const matCabeza = useMemo(() => new MeshBasicMaterial({ color: '#ffe3de', toneMapped: false }), [])
  useEffect(
    () => () => {
      tubo?.dispose()
      halo?.dispose()
      matTubo.dispose()
      matHalo.dispose()
      matCabeza.dispose()
    },
    [tubo, halo, matTubo, matHalo, matCabeza],
  )

  useFrame((estado) => {
    if (!curva) return
    const crudo = Math.min(1, Math.max(0, (tiempo.current - retraso) / 1.7))
    const p = 1 - Math.pow(1 - crudo, 3)
    matTubo.uniforms.uProgreso.value = p
    matHalo.uniforms.uProgreso.value = p
    if (cabeza.current) {
      cabeza.current.visible = p > 0.001 && p < 0.999
      if (cabeza.current.visible) cabeza.current.position.copy(curva.getPointAt(Math.min(0.999, p)))
    }
    if (crudo < 1) estado.invalidate()
  })

  if (!tubo || !halo) return null
  return (
    <group>
      <mesh geometry={halo} material={matHalo} renderOrder={5} />
      <mesh geometry={tubo} material={matTubo} renderOrder={6} />
      <mesh ref={cabeza} material={matCabeza} visible={false} renderOrder={7}>
        <sphereGeometry args={[0.06, 12, 12]} />
      </mesh>
    </group>
  )
}

// ── El eje desde cero, con marcas ──────────────────────────────────────────────────────

/**
 * Las cifras del eje van pegadas al borde izquierdo del lienzo (la altura sí sale de la
 * proyección de su marca), con la cámara general, acercada, girada o plana: así nunca quedan
 * encima de una barra.
 */
const PUNTO_DE_MARCA = new Vector3()
function enElBordeIzquierdo(objeto: Object3D, camara: Camera, tam: { width: number; height: number }): number[] {
  objeto.getWorldPosition(PUNTO_DE_MARCA)
  PUNTO_DE_MARCA.project(camara)
  return [20, (-PUNTO_DE_MARCA.y * 0.5 + 0.5) * tam.height]
}

function Eje({
  marcas,
  ancho,
  vivo,
}: {
  marcas: readonly { valor: number; y: number }[]
  ancho: number
  vivo: { current: { x: number } }
}) {
  const grupo = useRef<Group>(null)
  const lineas = useMemo(() => {
    const g = new BufferGeometry()
    const v: number[] = []
    const mitad = ancho / 2 + 0.9
    for (const mk of marcas) v.push(-mitad, mk.y, -0.8, mitad, mk.y, -0.8)
    g.setAttribute('position', new Float32BufferAttribute(v, 3))
    return g
  }, [marcas, ancho])
  const material = useMemo(() => new MeshBasicMaterial(), [])
  useEffect(
    () => () => {
      lineas.dispose()
      material.dispose()
    },
    [lineas, material],
  )
  useFrame(() => {
    // Las cifras del eje acompañan a la ventana que se mira, siempre a su izquierda.
    grupo.current?.position.setX(vivo.current.x)
  })
  return (
    <>
      <lineSegments geometry={lineas}>
        <lineBasicMaterial color={COLORES.plata} transparent opacity={0.16} />
      </lineSegments>
      <group ref={grupo} position={[0, 0, -0.8]}>
        {marcas.map((mk) => (
          <Html
            key={mk.valor}
            center
            position={[0, mk.y, 0]}
            calculatePosition={enElBordeIzquierdo}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <span className="cifras select-none rounded bg-bg/75 px-1 text-[12px] text-tenue">
              {numeroExacto(mk.valor)}
            </span>
          </Html>
        ))}
      </group>
    </>
  )
}

// ── La escena ──────────────────────────────────────────────────────────────────────────

function Contenido({
  filas,
  magnitud,
  seleccionadoId,
  enfocado,
  plana,
  onSeleccionar,
  alTocar,
}: PropiedadesEscena3DPautado & { alTocar: () => void }) {
  const size = useThree((s) => s.size)
  const aspecto = size.width / Math.max(1, size.height)
  const m = useMaterialesDeBarras()
  const disp = useMemo(() => disposicionDeBarras(filas, magnitud), [filas, magnitud])
  const vivo = useRef({ x: 0, azimut: 0, distancia: 10, fov: 34 })
  const tiempo = useRef(0)
  // Las cifras (DOM) se montan tras el primer fotograma, no en el mismo montaje que el lienzo.
  const [etiquetas, setEtiquetas] = useState(false)
  useFrame((estado, delta) => {
    tiempo.current += Math.min(delta, 0.05)
    if (!etiquetas) setEtiquetas(true)
    // Mientras algo no ha terminado de entrar, sigue pidiendo fotogramas.
    if (tiempo.current < 0.25 + disp.barras.length * 0.06 + 2.8) estado.invalidate()
  })

  const elegida = disp.barras.find((b) => b.id === seleccionadoId)
  const indiceElegida = disp.barras.findIndex((b) => b.id === seleccionadoId)
  const xs = useMemo(() => disp.barras.map((b) => b.x), [disp.barras])
  const xElegida = elegida?.x ?? xs[xs.length - 1] ?? 0
  const visibles = semanasVisibles(aspecto, disp.barras.length)

  const pose = useMemo(() => {
    if (plana) return poseVistaPlana({ xs, xElegida, aspecto })
    if (enfocado && elegida) {
      return poseEnfocada({ x: elegida.x, altoMax: Math.max(elegida.altoPauta, elegida.altoHecho) })
    }
    return poseGeneral({ xs, xElegida, aspecto })
  }, [plana, enfocado, elegida, xs, xElegida, aspecto])

  const ancho = Math.max(1, disp.barras.length) * SEPARACION
  const radio = Math.max(15, ancho * 0.85 + 7)

  return (
    <>
      <RigCamara
        pose={pose}
        plana={plana}
        alturaPlana={alturaDeVistaPlana(visibles, aspecto)}
        reinicio={`${seleccionadoId ?? ''}|${enfocado}|${plana}|${magnitud}`}
        balanceo
        onTocar={alTocar}
        vivo={vivo}
      />
      <Suelo radio={radio} />
      {etiquetas && <Eje marcas={disp.marcas} ancho={ancho} vivo={vivo} />}
      <group key={magnitud}>
        {disp.barras.map((b, i) => (
          <Barra
            key={b.id}
            b={b}
            orden={i}
            activa={b.id === seleccionadoId}
            m={m}
            onSeleccionar={onSeleccionar}
            tiempo={tiempo}
            vivo={vivo}
            lejos={Math.abs(i - indiceElegida)}
            etiquetas={etiquetas}
          />
        ))}
        <Cinta barras={disp.barras} retraso={0.25 + disp.barras.length * 0.06 + 0.35} tiempo={tiempo} />
      </group>
    </>
  )
}

/**
 * LA ESCENA 3D DE «LO QUE TE PEDIMOS Y LO QUE HICISTE». Este archivo es el trozo que se carga
 * a demanda (`React.lazy`): quien no abre la presentación no descarga three.js.
 */
export default function Escena3DPautado(props: PropiedadesEscena3DPautado) {
  const { ref, enVista } = useEnVista<HTMLDivElement>()
  const [tocado, setTocado] = useState(false)
  const hayAnillo = props.filas.some((f) => f.estado === 'activo')
  const nombre = props.filas.find((f) => f.id === props.seleccionadoId)
  const etiqueta = `Escena en tres dimensiones de ${props.magnitud === 'series' ? 'series' : 'kg·rep'} por semana${
    nombre ? `; semana elegida: ${nombreDelMicrociclo(nombre.numero, true)}` : ''
  }. Con las flechas del teclado pasas de una semana a otra.`

  return (
    <div ref={ref} data-testid="escena-webgl" data-plana={props.plana ? 'si' : 'no'}>
      <Lienzo3D
        etiqueta={etiqueta}
        claseAltura={ALTURA_LIENZO}
        enVista={enVista}
        animado={!tocado || hayAnillo}
        alPerderContexto={props.alPerderContexto}
        alTeclear={props.alTeclear}
      >
        <Contenido {...props} alTocar={() => setTocado(true)} />
      </Lienzo3D>
    </div>
  )
}
