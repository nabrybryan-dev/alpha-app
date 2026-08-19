import type { ReactNode } from 'react'

interface IconoProps {
  /** Clase de tamaño y color. El trazo se pinta con `currentColor`. */
  className?: string
}

interface EnvoltorioProps extends IconoProps {
  children: ReactNode
}

/**
 * Los iconos de la app, en un solo sitio.
 *
 * POR QUÉ EXISTE. Media docena de pantallas pintaban emojis donde va un icono:
 * la claqueta de Contenidos, la campana del recordatorio, la regla de «Mis
 * medidas», ♥/🏋/🍽 en las rachas, 🏅/🔒 en las medallas. Un emoji trae tres
 * problemas que no se ven hasta que se miran juntos:
 *
 *   1. No acepta `currentColor`. Da igual el tema, la clase o el estado: se
 *      pinta como quiera. En Logros, ♥ salía monocromo y 🏋 a todo color, uno
 *      al lado del otro.
 *   2. Lo dibuja el sistema operativo, no la app. El mismo emoji es distinto en
 *      Android, en iOS y en Windows, así que el diseño deja de ser tuyo.
 *   3. No hay control de trazo ni de caja, así que no casa con la barra
 *      inferior, que sí usa SVG.
 *
 * El lenguaje es el que ya existía en `BottomNav`: caja de 24, sin relleno,
 * trazo `currentColor` a 1,6 y extremos redondeados. No se inventa nada nuevo.
 *
 * LO QUE NO ESTÁ AQUÍ, A PROPÓSITO. Los emojis que viven DENTRO de una frase
 * —«¡Bien hecho! 💪», «Disciplina Alpha 🖤», el 😉 del coach— no son iconos,
 * son la voz del entrenador. Cambiarlos por un SVG le quitaría la calidez que
 * hace que un mensaje suene a persona. Se quedan donde están.
 */
export function Icono({ className = 'h-[18px] w-[18px]', children }: EnvoltorioProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/* ---------- Dominios: los mismos glifos que la barra inferior ----------
   Las rachas de Logros usan el icono de SU pestaña. Así el asesorado aprende
   un símbolo por dominio en vez de tres vocabularios distintos. */

/** Bienestar. Mismo trazo que la pestaña de Bienestar. */
export function IconoCorazon({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M12 20.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5c0 5.5-8 11-8 11Z" />
    </Icono>
  )
}

/** Entrenamiento. Mismo trazo que la pestaña de Entrenar. */
export function IconoPesa({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M6.5 6.5v11M17.5 6.5v11" />
      <path d="M3.5 9v6M20.5 9v6" />
      <path d="M6.5 12h11" />
    </Icono>
  )
}

/** Nutrición. Mismo trazo que la pestaña de Nutrición. */
export function IconoCubiertos({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M5 3v7a2.5 2.5 0 0 0 5 0V3" />
      <path d="M7.5 3v18" />
      <path d="M16.5 3c-1.7 1.2-2.5 3.4-2.5 6 0 2 1 3 2.5 3V21" />
    </Icono>
  )
}

/* ---------- Tipos de contenido ---------- */

/** Vídeo. Se usa también en «Técnica», que abre un vídeo. */
export function IconoVideo({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5Z" />
      <path d="m10 9.2 4.6 2.8-4.6 2.8Z" />
    </Icono>
  )
}

/** Imagen. */
export function IconoImagen({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" />
      <circle cx="8.5" cy="8.5" r="1.6" />
      <path d="m3.5 16.5 4.5-4.2 3.6 3.4L15 12l5.5 5.2" />
    </Icono>
  )
}

/** Artículo o documento. */
export function IconoDocumento({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h4" />
    </Icono>
  )
}

/* ---------- Estado y aviso ---------- */

/** Recordatorio o notificación. */
export function IconoCampana({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M18 9.5a6 6 0 1 0-12 0c0 4.2-1.5 5.5-1.5 5.5h15S18 13.7 18 9.5Z" />
      <path d="M10.3 18.5a2 2 0 0 0 3.4 0" />
    </Icono>
  )
}

/** Medidas corporales. */
export function IconoRegla({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M4 9h16a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 20 15H4a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 4 9Z" />
      <path d="M6.5 9v2.2M10 9v3.2M13.5 9v2.2M17 9v3.2" />
    </Icono>
  )
}

/** Logro conseguido. */
export function IconoMedalla({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M12 12.8l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2L9 15l2-.3Z" />
      <path d="M8.6 3.5 11 9.9M15.4 3.5 13 9.9" />
    </Icono>
  )
}

/** Logro todavía bloqueado. */
export function IconoCandado({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M6 10.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19v-7A1.5 1.5 0 0 1 6 10.5Z" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Icono>
  )
}

/** Premio o reconocimiento. */
export function IconoEstrella({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9Z" />
    </Icono>
  )
}

/* ---------- Panel del coach ---------- */

/** Consultas pendientes. */
export function IconoConsulta({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4v.5" />
      <path d="M12 16.8h.01" />
    </Icono>
  )
}

/** Bandeja de mensajes. */
export function IconoMensaje({ className }: IconoProps) {
  return (
    <Icono className={className}>
      <path d="M20.5 12.2a7.5 7.5 0 0 1-7.5 7.5H8.4L4 22.5v-4.7a7.5 7.5 0 0 1 4-13.6h5a7.5 7.5 0 0 1 7.5 8Z" />
    </Icono>
  )
}
