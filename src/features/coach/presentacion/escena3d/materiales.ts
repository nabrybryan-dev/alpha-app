import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three'
import { useEffect, useMemo } from 'react'

/**
 * Los materiales y texturas de la escena, creados UNA vez y compartidos por todas las mallas
 * (24 semanas × 2 prismas no son 48 materiales, son los mismos pocos). Los colores son solo
 * los de la marca: fondo #0a0a0a, rojo #ff1e1e, plata/blanco.
 */

export const COLORES = {
  fondo: '#0a0a0a',
  rojo: '#ff1e1e',
  rojoOsc: '#8f1119',
  plata: '#c2c8cf',
  plataTenue: '#7d8189',
  blanco: '#f2f2f2',
} as const

/** Un degradado radial dibujado en un canvas: sirve para sombras de contacto y para el halo. */
export function texturaRadial(color: string, alfaCentro: number): CanvasTexture {
  const lienzo = document.createElement('canvas')
  lienzo.width = lienzo.height = 128
  const c = lienzo.getContext('2d')
  if (c) {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, `rgba(${color},${alfaCentro})`)
    g.addColorStop(0.45, `rgba(${color},${alfaCentro * 0.38})`)
    g.addColorStop(1, `rgba(${color},0)`)
    c.fillStyle = g
    c.fillRect(0, 0, 128, 128)
  }
  const t = new CanvasTexture(lienzo)
  t.colorSpace = SRGBColorSpace
  return t
}

const VERTICE_VIDRIO = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

// El vidrio: casi transparente de frente y más opaco y luminoso hacia el borde (Fresnel).
const FRAGMENTO_VIDRIO = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float uBorde;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
    float a = uBase + f * uBorde;
    gl_FragColor = vec4(uColor * (0.55 + 0.9 * f), a);
    #include <colorspace_fragment>
  }
`

function vidrio(color: string, base: number, borde: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uBase: { value: base }, uBorde: { value: borde } },
    vertexShader: VERTICE_VIDRIO,
    fragmentShader: FRAGMENTO_VIDRIO,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
}

export function crearMaterialesDeBarras() {
  const sombraTex = texturaRadial('0,0,0', 0.9)
  const haloTex = texturaRadial('255,255,255', 1)
  return {
    vidrio: vidrio(COLORES.plata, 0.07, 0.5),
    vidrioActivo: vidrio(COLORES.blanco, 0.12, 0.8),
    bordeVidrio: new LineBasicMaterial({ color: COLORES.plata, transparent: true, opacity: 0.55 }),
    bordeActivo: new LineBasicMaterial({ color: '#ffffff' }),
    hecho: new MeshStandardMaterial({
      color: '#e8161a',
      roughness: 0.38,
      metalness: 0.2,
      emissive: new Color(COLORES.rojo),
      emissiveIntensity: 0.16,
    }),
    hechoActivo: new MeshStandardMaterial({
      color: COLORES.rojo,
      roughness: 0.32,
      metalness: 0.2,
      emissive: new Color(COLORES.rojo),
      emissiveIntensity: 0.45,
    }),
    tapa: new MeshBasicMaterial({ color: '#ff7468', toneMapped: false }),
    halo: new MeshBasicMaterial({
      map: haloTex,
      color: COLORES.rojo,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    sombra: new MeshBasicMaterial({ map: sombraTex, transparent: true, depthWrite: false }),
  }
}

export type MaterialesDeBarras = ReturnType<typeof crearMaterialesDeBarras>

/** Libera lo que `crearMaterialesDeBarras` reservó en la tarjeta gráfica. */
function soltar(m: Record<string, { dispose: () => void; map?: { dispose: () => void } | null }>) {
  for (const k of Object.keys(m)) {
    m[k].map?.dispose()
    m[k].dispose()
  }
}

export function useMaterialesDeBarras(): MaterialesDeBarras {
  const m = useMemo(() => crearMaterialesDeBarras(), [])
  useEffect(() => () => soltar(m), [m])
  return m
}

const VERTICE_SUELO = /* glsl */ `
  varying vec3 vMundo;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vMundo = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

// El suelo: rejilla tenue (cada 1 y cada 5 unidades) que se pierde con la distancia, más un
// charco de luz fría bajo la escena. Todo en un solo plano y un solo shader.
const FRAGMENTO_SUELO = /* glsl */ `
  uniform float uRadio;
  uniform vec2 uCentro;
  varying vec3 vMundo;
  float rejilla(vec2 p, float paso, float grosor) {
    vec2 q = p / paso;
    vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), vec2(0.0001));
    return 1.0 - min(min(g.x, g.y) / grosor, 1.0);
  }
  void main() {
    float d = length(vMundo.xz - uCentro);
    float perdida = 1.0 - smoothstep(uRadio * 0.18, uRadio, d);
    float linea = max(rejilla(vMundo.xz, 1.0, 1.0) * 0.16, rejilla(vMundo.xz, 5.0, 1.4) * 0.32) * perdida;
    float charco = (1.0 - smoothstep(0.0, uRadio * 0.55, d)) * 0.5;
    vec3 base = vec3(0.095, 0.098, 0.108);
    vec3 trazo = vec3(0.76, 0.78, 0.81);
    float a = max(linea, charco);
    vec3 c = mix(base, trazo, clamp(linea * 1.6, 0.0, 1.0));
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }
`

export function crearMaterialDelSuelo(radio: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uRadio: { value: radio }, uCentro: { value: [0, 0] } },
    vertexShader: VERTICE_SUELO,
    fragmentShader: FRAGMENTO_SUELO,
    transparent: true,
    depthWrite: false,
  })
}

const FRAGMENTO_CINTA = /* glsl */ `
  uniform float uProgreso;
  uniform float uAlfa;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    if (vUv.x > uProgreso) discard;
    float cabeza = smoothstep(0.16, 0.0, uProgreso - vUv.x);
    vec3 c = mix(uColor, vec3(1.0, 0.86, 0.82), cabeza * 0.85);
    gl_FragColor = vec4(c, uAlfa);
    #include <colorspace_fragment>
  }
`

const VERTICE_CINTA = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** La cinta de tendencia: un tubo que se dibuja de izquierda a derecha, con la cabeza más brillante. */
export function crearMaterialDeCinta(alfa: number, aditivo: boolean): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: { uProgreso: { value: 0 }, uAlfa: { value: alfa }, uColor: { value: new Color('#ff3a34') } },
    vertexShader: VERTICE_CINTA,
    fragmentShader: FRAGMENTO_CINTA,
    transparent: aditivo || alfa < 1,
    depthWrite: !aditivo,
  })
  if (aditivo) m.blending = AdditiveBlending
  return m
}
