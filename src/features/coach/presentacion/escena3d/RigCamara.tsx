/* eslint-disable react-hooks/immutability --
   Esto es three.js: las mallas, los materiales y la cámara son objetos mutables que viven en la
   tarjeta gráfica, y un callback de `useFrame` los actualiza a propósito en cada fotograma
   (uniforms, posición, escala). No son estado de React ni se leen al pintar: reasignarlos aquí es
   lo único que hay que hacer, no un descuido. */
import { OrthographicCamera } from '@react-three/drei/core/OrthographicCamera'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  acotarAjuste,
  amortiguar,
  FOV_PLANO,
  poseConAjuste,
  posicionDeCamara,
  SIN_AJUSTE,
  type AjusteDeUsuario,
  type PoseCamara,
} from '../../../../domain/escena3d'

interface Props {
  /** La pose a la que toca ir (la elegida por la escena según la semana y la vista). */
  pose: PoseCamara
  /** Vista plana: cámara ortográfica de frente, sin órbita. */
  plana: boolean
  /** Cuánto del mundo, en altura, cubre la vista ortográfica. */
  alturaPlana: number
  /** Cuando cambia, lo que la persona había movido a mano se suelta y la cámara va a la pose. */
  reinicio: string
  /** Permitido el balanceo en reposo (se apaga solo en cuanto la persona toca). */
  balanceo: boolean
  onTocar: () => void
  /** Hacia dónde mira la cámara AHORA, por si algo de la escena (el eje) la sigue. */
  vivo: MutableRefObject<{ x: number; azimut: number; distancia: number; fov: number }>
}

/** Grados de órbita por píxel arrastrado. */
const GRADOS_POR_PX = 0.32
/** Qué tan rápido se acerca la cámara a su meta (mayor = más seca). */
const LAMBDA = 5.2

/**
 * LA CÁMARA CON OFICIO. Una pose objetivo (cámara de órbita esférica: azimut, polar,
 * distancia, objetivo, campo de visión) y una pose actual que la persigue con un amortiguador
 * exponencial, así que todo tiene inercia y nada salta.
 *
 *  - Órbita con el dedo o el ratón: con un dedo SOLO horizontal (el vertical es de la página);
 *    con ratón también inclina. Pellizco para el zoom; en escritorio, Ctrl + rueda.
 *    Todo dentro de `LIMITES_CAMARA` (±70°, nunca bajo el suelo, zoom acotado).
 *  - Balanceo lentísimo en reposo que se apaga para siempre en cuanto se toca la escena.
 *  - Vista plana: dolly-zoom (la cámara se aleja mientras el campo de visión se cierra, lo
 *    que aplana la perspectiva sin saltos) y, al llegar, cambio a una cámara ortográfica que
 *    se ve idéntica. La lectura es exacta, sin perspectiva.
 *  - Con `frameloop="demand"` solo pide fotogramas mientras algo se mueve.
 */
export function RigCamara({ pose, plana, alturaPlana, reinicio, balanceo, onTocar, vivo }: Props) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const [ortografica, setOrtografica] = useState(false)

  const actual = useRef<PoseCamara | null>(null)
  const ajuste = useRef<AjusteDeUsuario>({ ...SIN_AJUSTE })
  const tocado = useRef(false)
  const arrastrando = useRef(false)

  // Lo último que dijo el padre, sin re-suscribir los gestos en cada render.
  const poseRef = useRef(pose)
  const planaRef = useRef(plana)
  const onTocarRef = useRef(onTocar)
  useEffect(() => {
    poseRef.current = pose
    planaRef.current = plana
    onTocarRef.current = onTocar
    invalidate()
  }, [pose, plana, onTocar, invalidate])

  useEffect(() => {
    ajuste.current = { ...SIN_AJUSTE }
    invalidate()
  }, [reinicio, invalidate])

  // Los gestos: un dedo gira, dos dedos acercan.
  useEffect(() => {
    const el = gl.domElement
    // El vertical es del desplazamiento de la página; el pellizco lo hacemos nosotros.
    el.style.touchAction = 'pan-y'
    const punteros = new Map<number, { x: number; y: number }>()
    let distanciaAnterior = 0

    const entreDedos = () => {
      const [a, b] = [...punteros.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const acotar = () => {
      ajuste.current = acotarAjuste(ajuste.current, poseRef.current)
      invalidate()
    }

    const alBajar = (e: PointerEvent) => {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!tocado.current) {
        tocado.current = true
        onTocarRef.current()
      }
      if (punteros.size === 2) distanciaAnterior = entreDedos()
    }
    const alMover = (e: PointerEvent) => {
      const p = punteros.get(e.pointerId)
      if (!p || planaRef.current) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (punteros.size === 1) {
        if (!arrastrando.current && Math.abs(dx) + Math.abs(dy) > 1.5 && e.pointerType === 'mouse') {
          el.setPointerCapture?.(e.pointerId)
        }
        arrastrando.current = true
        ajuste.current.azimut -= dx * GRADOS_POR_PX
        if (e.pointerType !== 'touch') ajuste.current.polar -= dy * 0.22
        acotar()
      } else if (punteros.size === 2) {
        const d = entreDedos()
        if (distanciaAnterior > 0 && d > 0) ajuste.current.zoom *= distanciaAnterior / d
        distanciaAnterior = d
        acotar()
      }
    }
    const alSoltar = (e: PointerEvent) => {
      punteros.delete(e.pointerId)
      distanciaAnterior = 0
      if (punteros.size === 0) arrastrando.current = false
    }
    const alRodar = (e: WheelEvent) => {
      // Sin Ctrl la rueda es de la página: no se roba el desplazamiento.
      if (!e.ctrlKey || planaRef.current) return
      e.preventDefault()
      ajuste.current.zoom *= Math.exp(e.deltaY * 0.0025)
      acotar()
    }

    el.addEventListener('pointerdown', alBajar)
    el.addEventListener('pointermove', alMover)
    el.addEventListener('pointerup', alSoltar)
    el.addEventListener('pointercancel', alSoltar)
    el.addEventListener('wheel', alRodar, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', alBajar)
      el.removeEventListener('pointermove', alMover)
      el.removeEventListener('pointerup', alSoltar)
      el.removeEventListener('pointercancel', alSoltar)
      el.removeEventListener('wheel', alRodar)
    }
  }, [gl, invalidate])

  useFrame((estado, delta) => {
    const dt = Math.min(delta, 0.05)
    const base = poseRef.current
    if (!actual.current) {
      // La entrada: la cámara llega desde un poco más lejos, más arriba y de lado.
      actual.current = {
        ...base,
        azimut: base.azimut + 30,
        polar: base.polar - 10,
        distancia: base.distancia * 1.3,
        objetivo: { ...base.objetivo },
      }
    }
    const c = actual.current
    const quiereVerPlana = planaRef.current
    let meta = quiereVerPlana ? base : poseConAjuste(base, ajuste.current)
    const balanceando = balanceo && !tocado.current && !quiereVerPlana
    if (balanceando) meta = { ...meta, azimut: meta.azimut + Math.sin(estado.clock.elapsedTime * 0.27) * 4 }

    const antes = [c.azimut, c.polar, c.distancia, c.objetivo.x, c.objetivo.y, c.objetivo.z, c.fov]
    c.azimut = amortiguar(c.azimut, meta.azimut, LAMBDA, dt)
    c.polar = amortiguar(c.polar, meta.polar, LAMBDA, dt)
    c.distancia = amortiguar(c.distancia, meta.distancia, LAMBDA, dt)
    c.objetivo.x = amortiguar(c.objetivo.x, meta.objetivo.x, LAMBDA, dt)
    c.objetivo.y = amortiguar(c.objetivo.y, meta.objetivo.y, LAMBDA, dt)
    c.objetivo.z = amortiguar(c.objetivo.z, meta.objetivo.z, LAMBDA, dt)
    c.fov = amortiguar(c.fov, meta.fov, LAMBDA * 0.9, dt)
    const despues = [c.azimut, c.polar, c.distancia, c.objetivo.x, c.objetivo.y, c.objetivo.z, c.fov]
    const sigue = despues.some((v, i) => Math.abs(v - antes[i]) > 1e-4) || balanceando || arrastrando.current
    const cerca = Math.abs(c.fov - meta.fov) < 0.05 && Math.abs(c.distancia - meta.distancia) < 0.05

    const camara = estado.camera
    const pos = posicionDeCamara(c)
    camara.position.set(pos.x, pos.y, pos.z)
    camara.lookAt(c.objetivo.x, c.objetivo.y, c.objetivo.z)
    if ('fov' in camara && camara.type === 'PerspectiveCamera') {
      const p = camara as typeof camara & { fov: number; updateProjectionMatrix: () => void }
      if (Math.abs(p.fov - c.fov) > 1e-3) {
        p.fov = c.fov
        p.updateProjectionMatrix()
      }
    } else {
      const zoom = size.height / Math.max(0.5, alturaPlana)
      if (Math.abs(camara.zoom - zoom) > 1e-3) {
        camara.zoom = zoom
        camara.updateProjectionMatrix()
      }
    }

    vivo.current.x = c.objetivo.x
    vivo.current.azimut = c.azimut
    vivo.current.distancia = c.distancia
    vivo.current.fov = c.fov

    // De la perspectiva casi plana a la ortográfica (y de vuelta) sin que se note el cambio.
    if (quiereVerPlana && !ortografica && cerca && c.fov < FOV_PLANO + 0.5) setOrtografica(true)
    if (!quiereVerPlana && ortografica) setOrtografica(false)
    if (sigue || (quiereVerPlana !== ortografica && !cerca)) estado.invalidate()
  })

  return ortografica ? <OrthographicCamera makeDefault near={0.1} far={600} position={[0, 0, 100]} /> : null
}
