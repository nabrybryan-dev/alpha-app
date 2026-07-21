/** Palomita que se dibuja sola al marcar un ítem como hecho. */
export function CheckDibujado({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path className="dibujar-check" d="M5 13l4 4L19 7" />
    </svg>
  )
}
