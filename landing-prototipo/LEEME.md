# Sujeto Alpha — prueba cinematográfica 02

## Versión vigente: microfibras y recorrido 180°

La portada de http://127.0.0.1:8769 ahora inicia un recorrido de **24 segundos**.
Tres órbitas de 180°: hombro (0–6.5 s), codo (6.5–13 s), rodilla (13–19.5 s),
seguidas de la vista general (19.5–24 s). El reloj del audio dirige la cámara.
Los botones de región saltan a la toma y la dejan pausada para inspeccionarla.

El relieve combina tres escalas de fibras, haces y filamentos. Las subdivisiones
del pectoral llevan un campo en abanico hacia el extremo lateral de cada pieza;
las demás siguen el eje principal de la geometría. Es ilustración procedural,
no una reconstrucción medida de cada fascículo ni una simulación de fuerzas.
El tendón usa la marca de la fuente y un relieve más fino.

La profundidad incorpora oclusión geométrica precalculada con 24 rayos por vértice
y 45 mm de alcance: 131 571 vértices de músculo y 45 105 de hueso. El cálculo óseo
considera los huesos entre sí, para que al revelar la capa ósea no queden sombras
de músculos ausentes. Es una aproximación estática de reposo: no recalcula sombras
de contacto durante los patrones animados o cambios de proporciones.

**Ver profundidad ósea** abre una ventana esférica de inspección en la región,
sin desplazar huesos ni afirmar que sea una disección real. **Microfibras: sí/no**
permite comparar el relieve; la oclusión permanece activa. Luz posterior reforzada
para leer la estructura también al final de la órbita.

Se revisaron visualmente hombro anterior/posterior, codo, rodilla, ventana ósea,
pausa y búsqueda en el audio; también la vista móvil a 390 × 844. Pruebas ejecutadas:
`python verificar_detalle.py` y `node verificar_recorrido.mjs`. Las notas de función
articular tienen enlaces a fuentes, pero el modelo no es una validación clínica ni
un cálculo biomecánico personalizado. Persisten limitaciones de resolución de las
mallas del atlas, especialmente en las superficies articulares.

Fuentes del contenido anatómico:
- https://openstax.org/books/anatomy-and-physiology-2e/pages/10-2-skeletal-muscle
- https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs
- https://openstax.org/books/anatomy-and-physiology-2e/pages/9-6-anatomy-of-selected-synovial-joints
- https://openstax.org/books/anatomy-and-physiology-2e/pages/11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems

La versión 1 está archivada en `comparacion-v1/`. El original exportado sigue en
`original-v10.html`. Para regenerar V2: `python preparar.py`. Para recalcular las
sombras: `.venv/Scripts/python.exe hornear_detalle.py` (numpy, scipy, trimesh y
embreex instalados en ese entorno local). Los archivos nuevos son `tejido.frag`,
`refinar.py`, `director-detalle.js`, `atlas.py`, `hornear_detalle.py` y `piezas/detalle-*`.

## Histórico: primera prueba

27 de septiembre de 2026. Copia independiente exportada desde el artefacto del usuario:
https://claude.ai/artifact/P5RPo5AP3fN7ckK3BLeY8D

## Abrir

En esta carpeta ejecutar `python servidor.py` y abrir http://127.0.0.1:8769.
La prueba está en `/`; la comparación intacta está en `/original-v10.html`.
No abrir el HTML con doble clic: los modelos requieren HTTP.
Three.js y las fuentes usan CDN y necesitan conexión a Internet.

## Implementado

- Paleta grafito, cobre, marfil y músculo terroso desaturado.
- Menor especular, luz principal cálida lateral, relleno frío moderado.
- Menor deformación del músculo y recálculo de normales.
- Entorno mineral geométrico, suelo y sombra de apoyo aproximada.
- Portada con jerarquía editorial y encuadre móvil propio.
- Entrada de 12 segundos: materia (0), mano (2.4), torso (4.5), revelación (6.7), cierre (9.2).
- Sonido estéreo original sintetizado para previsualización; no contiene audio de los reels.
- Cámara guiada por el tiempo del audio, pausa, búsqueda, silencio, salida y repetición.
- Las interacciones normales no activan sonido; el botón de entrada sí.
- Preferencia de movimiento reducido: sin desplazamiento dentro de cada toma ni destello.
- Se conservan exploración por capas, medidas, patrones, modelos, atribuciones y voces heredadas.

## Revisión

Verificado en Chrome: carga de las piezas, portada de escritorio, portada a 390 × 844,
reproducir, pausar, buscar en la pista, silenciar y saltar entrada.
Se corrigió el recorte de cabeza en móvil y se añadió servicio HTTP con rangos para
que la búsqueda de audio no volviera al principio.
El audio mide 12 s, estéreo, 48 kHz; pico medido -11.9 dBFS (sin saturación).
La mezcla no ha sido evaluada mediante escucha humana; es una propuesta provisional.

## Límites de esta entrega

Es una prueba del modelo anatómico existente, no un personaje nuevo ni el render
fotográfico del boceto. Persisten separaciones, simplificación geométrica y detalle
insuficiente en macros. Las fibras son procedurales; no son texturas escaneadas.
La luz del cuerpo usa el shader heredado ajustado, no transporte físico completo.
El ambiente es un estudio geométrico preliminar; la sombra de apoyo es aproximada.
La anatomía, cantidades, adaptación corporal y textos heredados no se validaron
científicamente en este pase de diseño.
No se ha publicado ni sustituido el artefacto original de Claude.

## Archivos

- `index.html`: copia modificada del prototipo.
- `original-v10.html`: exportación original intacta.
- `cine.js`, `cine.css`: dirección de cámara y presentación.
- `cine-preview.wav`: sonido provisional original.
- `preparar.py`: reproduce la transformación desde el original y genera audio.
- `servidor.py`: servidor local limitado a 127.0.0.1, con soporte de rangos.
- `piezas/`, `motor-patrones.js`, `voz/`: recursos del prototipo exportado.

## Sujeto Alpha integrado (29-sep)

La página carga ahora el sujeto Alpha en lugar de Z-Anatomy:
- Escritorio (ancho ≥ 760): `piezas/atlas-musculos-alpha` (299 236 tri) + `atlas-esqueleto-alpha` (171 113 tri, esqueleto suave), con `detalle-musculo-alpha.bin` / `detalle-hueso-alpha.bin`.
- Celular (ancho < 760): `atlas-musculos-alpha-movil-200k` (197 396 tri) + `atlas-esqueleto-alpha-movil` (90 317 tri), con `detalle-*-alpha-movil.bin`.
- `#zanatomy` en el enlace carga el sujeto anterior, para comparar; `#bodyparts` sigue igual.
- Origen de los modelos: rama `landing/musculos-alpha` de alpha-app (commit f471f94), `public/piezas/landing/` (aquí en base64).
- El sombreado se hornea con `hornear_detalle_blender.py` (mismo algoritmo que `hornear_detalle.py`, con Blender porque aquí no hay trimesh; control sobre Z-Anatomy: correlación 0,97 con el original).
- Respaldo de la carpeta antes del cambio: `../sujeto-alpha-cine-20260927_respaldo_antes_alpha/`.
- Pendiente de medir: cuadros por segundo en un celular real de gama media (el paquete pasa del contrato: 477 059 tri escritorio, 294 423 celular).
