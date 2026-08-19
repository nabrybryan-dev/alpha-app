interface MarcaAguilaProps {
  /** Clase de tamaño y color. El águila se pinta con `currentColor`. */
  className?: string
}

/**
 * El águila de Alpha, en vector.
 *
 * Antes esto era `public/marca/icono-aguila.jpeg`: 1254x1254 y 45 KB para
 * pintar 32 px en la barra superior. Un JPEG no tiene transparencia, así que
 * traía el fondo negro cocido y en tema claro la barra mostraba una pastilla
 * negra — de ahí venían el `rounded-lg` y el borde, que estaban ahí para
 * disimular el recuadro, no porque el diseño los pidiera.
 *
 * En vector el problema desaparece por construcción: `fill="currentColor"`
 * hace que la marca tome el color del texto, así que el conmutador de tema la
 * invierte sola. Y son 3 KB de trazado en vez de 45 KB de imagen.
 *
 * El `viewBox` va **ceñido al trazado**, no a la caja del original. El export
 * traía 1254x1254 con casi un 30% de aire alrededor: con `h-8 w-8` el águila
 * se habría visto a 22 px, más pequeña que el JPEG que sustituye, que iba a
 * sangre. Ceñida, el tamaño que pide quien la usa es el que se ve. Los números
 * salen de medir el trazado renderizado a escala 1:1; cambiarlos descentra el
 * águila sin dar ningún error, por eso hay una prueba que los fija.
 */
export function MarcaAguila({ className = '' }: MarcaAguilaProps) {
  return (
    <svg
      viewBox="206 200 871 922"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(0,1254) scale(0.1,-0.1)" fill="currentColor" stroke="none">
        <path
          d="M10660 10515 c-52 -12 -288 -66 -525 -120 -236 -53 -486 -109 -555 -125 -69 -16 -267 -61 -440 -100 -360
          -81 -911 -209 -1595 -368 -1690 -396 -2778 -690 -3145 -852 -211 -93 -520 -293 -980 -634 -138 -102 -434
          -336 -504 -397 l-39 -35 77 -81 c43 -45 93 -92 111 -103 l34 -21 -122 -63 c-409 -210 -719 -478 -842 -730
          -181 -369 -5 -874 448 -1291 45 -41 84 -75 87 -75 3 0 -20 52 -51 115 -157 318 -129 559 91 774 237 230 652
          382 1210 443 164 18 662 15 884 -5 99 -9 182 -15 184 -13 3 3 -566 330 -898 516 -217 121 -516 293 -523 299
          -4 4 29 15 73 25 99 21 167 47 775 291 797 321 1080 430 1529 591 290 105 696 244 696 240 0 -2 -48 -32
          -107 -67 -774 -451 -1073 -668 -1325 -961 -233 -271 -363 -336 -702 -347 l-189 -6 469 -232 c258 -127 530
          -261 604 -296 198 -95 673 -327 678 -331 6 -7 -12 -37 -186 -311 -144 -227 -385 -618 -537 -870 -26 -44 -49
          -82 -51 -83 -1 -2 -33 25 -71 61 -265 252 -606 439 -984 541 -52 13 -87 20 -79 15 8 -5 58 -34 110 -63 346
          -196 584 -467 690 -784 130 -391 54 -973 -222 -1707 -59 -155 -310 -750 -350 -828 -36 -71 -12 -48 42 41 29
          48 246 407 480 797 418 695 683 1131 1120 1845 119 195 298 488 397 650 99 162 271 443 382 623 110 181 201
          332 201 336 0 19 -264 246 -442 379 -128 96 -507 360 -548 382 -59 32 2 27 355 -26 365 -55 1317 -262 1348
          -293 5 -5 41 -80 81 -167 750 -1637 1134 -2324 1883 -3374 268 -375 675 -920 688 -920 3 0 -7 26 -21 58
          -149 329 -324 761 -564 1387 -216 564 -354 912 -506 1282 -69 168 -123 308 -120 310 24 24 758 -276 1199
          -491 109 -53 200 -96 203 -96 6 0 -161 249 -279 415 -190 266 -430 572 -643 820 -316 367 -750 806 -1130
          1141 -55 49 -133 117 -172 152 -40 35 -72 67 -72 72 0 15 231 216 352 308 161 121 458 317 633 416 82 48
          145 86 139 86 -6 0 -164 -29 -350 -64 -624 -119 -1825 -334 -2124 -381 -58 -9 -118 -19 -135 -22 -44 -8 -29
          4 150 113 362 220 889 530 1445 849 382 220 650 374 995 575 193 112 580 336 860 497 281 161 517 297 525
          302 21 14 7 12 -100 -14z m-7028 -3197 c27 -17 46 -33 44 -35 -2 -2 -102 12 -222 32 -121 20 -245 39 -277
          42 -70 7 -70 7 73 88 l112 63 111 -79 c62 -43 133 -93 159 -111z"
        />
        <path
          d="M4878 7944 c-88 -38 -109 -51 -119 -75 -21 -51 -82 -104 -182 -154 -109 -56 -116 -65 -53 -65 130 0 234 45
          331 145 64 65 156 195 138 195 -5 0 -56 -21 -115 -46z"
        />
        <path
          d="M3405 6499 c-240 -63 -409 -155 -550 -300 -38 -39 -63 -69 -55 -66 8 4 66 27 128 52 331 134 794 210 1329
          217 101 2 183 6 183 9 0 6 -196 37 -435 70 -174 23 -537 34 -600 18z"
        />
        <path
          d="M7360 5562 c-264 -366 -540 -755 -540 -762 0 -4 24 -6 53 -5 201 9 612 5 609 -7 -12 -47 -239 -608 -250
          -620 -9 -8 -569 -143 -867 -209 -49 -11 -107 -24 -127 -30 -30 -8 -209 -183 -1050 -1026 -557 -559 -1143
          -1147 -1303 -1307 -159 -159 -283 -285 -274 -280 8 5 123 86 255 180 369 263 667 470 1599 1111 264 181 710
          489 990 683 281 195 579 402 662 460 601 415 902 626 903 632 1 28 -555 1298 -569 1298 -3 -1 -44 -53 -91
          -118z"
        />
      </g>
    </svg>
  )
}
