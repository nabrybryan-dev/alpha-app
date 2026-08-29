# SEMANA-2 — bloque del 29 al 31 de agosto de 2026

Levantado por entrevista con Bryan el 29-ago-2026, después del reconocimiento de solo
lectura de cinco frentes. Dos pendientes.

---

## PENDIENTE 1 — El salón como interfaz principal de Entrenar

### 1. Qué se entrega y a quién le llega

Al tocar **ENTRENAR** (segunda pestaña de la barra) se abre **el salón directamente**, no
la pantalla de aterrizaje de hoy. El salón es la interfaz principal: ocupa la pantalla
entera en 9:16, con elementos de gimnasio y la cámara del encuadre dentro.

**En las paredes, en 3D y con movimiento dinámico** (lo que Bryan marcó en amarillo):

- microciclo y nombre del día
- cronómetro de sesión
- duración estimada, bloque en curso y ejercicio n/5
- la marquesina de avisos
- la tabla de series ya registradas
- la serie en curso con carga, reps y RIR
- «medir con la cámara»
- «guardar serie»
- «a continuación», con los ejercicios que faltan

**En cuadros abajo, que solo aparecen al deslizar hacia abajo** (lo marcado en verde):

- antes de entrenar: calentamiento, movilidad y activación
- notas de la semana
- prescripción del coach
- ver notas de ejecución, patrón 3D y técnica

**Se van a Progreso:** las competencias evaluadas y el diagrama de la Escala Alfa.

**El estándar visual deja de ser opinable** y sale del documento maestro que entregó
Bryan: entorno negro mate con acentos rojo profundo, iluminación de tres puntos con
contraluz que separa la silueta del fondo, claroscuro que esculpe el volumen muscular,
profundidad de campo, grano, formato 9:16 y composición por tercios con espacio libre en
la dirección del movimiento.

**A quién le llega:** primero a Bryan, que aprueba una versión. Aprobada, se fusiona y
sale a la app real para los asesorados.

### 2. Para cuándo

**Domingo 30 de agosto de 2026, por la noche.**

### 3. Qué ya existe y qué es desde cero

**Ya existe** (verificado con ruta y línea en el reconocimiento):

- El salón de `/entrenar` y su panel inferior — PR #193, cuatro commits, en verde.
- La sala y el trípode del #183: `src/features/entrenar/escena/{sala,tripode}.ts`.
  **La sala SÍ se monta**: `SalonEntrenar.tsx:242` le pasa `datos` al visor y
  `VisorPatron.tsx:255` enciende `conSala` con eso. No hay que construirla: hay que
  hacerla legible en el teléfono.
- El eje W anatómico, con test y conectado al modelo: `capas/nivelesAnatomicos.ts`,
  `capas/gestoVertical.ts`, `capas/mallaDelNivel.ts`.
- El registro de carga, reps y RIR, de punta a punta hasta Supabase.
- `calificarEncuadre()` — `encoder/nucleo/encuadre.js:179`.
- Los marcadores de siete segmentos del #183, que son «la máquina tragaperras».

**Desde cero:**

- **Los implementos.** Hoy el sujeto entrena con las manos vacías: no hay barra, ni
  mancuerna, ni máquina. Es lo que más delata al modelo.
- Que las paredes se lean en un iPhone: hoy se dibujan y no se ven.
- El reparto amarillo/verde, y que los verdes solo aparezcan al bajar.
- La cámara del encuadre dentro del salón.
- El traslado de competencias y Escala Alfa a Progreso.
- El acabado cinematográfico del documento maestro.

**Medir antes de decidir:** `Motor.subir()` se come 9,9 ms de los 16,7 de un fotograma
—el 59% del presupuesto— y eso ya lo paga producción. Con la estela y las luces encima
puede no caber. Bryan decidió **medir primero**.

### 4. Qué NO se toca

- **La base y los agentes que generan las prescripciones y recomendaciones.** Están bien
  estructurados y son automatización propia. No se tocan.
- Si hace falta **cortar o mejorar un texto** de esa información, se le comunica a Bryan
  antes y él decide.
- **Todo lo demás está autorizado**: el código de diseño, la visualización, los
  diagramas, los esquemas, y **la pantalla de Progreso**, que recibe lo que sale de
  Entrenar.

### 5. Qué significa "terminado" (comprobable)

Se abre ENTRENAR en el iPhone. **Sin hacer scroll y sin tocar nada**, tienen que verse
**las cinco cosas a la vez**:

1. El salón con sus paredes.
2. Las letras y los datos en interfaz dinámica 3D sobre esas paredes.
3. El sujeto en medio.
4. La cámara a un lado.
5. Los implementos necesarios para esa sesión, alrededor.

**Si falta una, no está.** Los cuadros verdes no se ven hasta deslizar hacia abajo.

### 6. TESTIGO

**Un script en Chrome con la pestaña VISIBLE que cuente píxeles y devuelva un número.**

Un test de vitest no cuenta: jsdom no tiene WebGL, y 3.016 tests en verde ya convivieron
con una pantalla negra en el iPhone de Bryan.

---

## PENDIENTE 2 — Las otras cuatro casillas, con movimiento

### 1. Qué se entrega y a quién le llega

**Hoy, Bienestar, Nutrición y Progreso**, rediseñadas con movimiento 3D en **todas** sus
casillas —cuadros, gráficas, letras y números— y con **transiciones animadas entre
pestañas**, en el lenguaje de animación de Emil Kowalski.

**Mismos datos: solo cambia cómo se ven.** No se mueve información de sitio, salvo lo que
Progreso recibe del pendiente 1.

Economía a aprovechar: la capa de transición entre pestañas se construye **una vez** y
sirve para las cinco. El rediseño de cada pantalla se paga cuatro veces.

**A quién le llega:** a Bryan primero, y después a producción.

### 2. Para cuándo

**Lunes 31 de agosto de 2026.**

### 3. Qué ya existe y qué es desde cero

**Ya existe:** las cuatro pantallas, con sus datos y su lógica; y un sistema de animación
en `src/styles/tokens.css` con sus propias reglas de la casa — el guardián que prohíbe
`backdrop-blur` suelto, el que exige que los colores con opacidad estén declarados, y
`prefers-reduced-motion` respetado en las nueve animaciones que ya hay.

**Desde cero:** el movimiento por casilla, la capa compartida de transición entre
pestañas, y el acabado cinematográfico de las gráficas. Progreso, además, tiene que
recibir las competencias evaluadas y la Escala Alfa que salen de Entrenar.

### 4. Qué NO se toca

La misma frontera que el pendiente 1: la base y los agentes de prescripciones y
recomendaciones no se tocan; cualquier recorte de texto se comunica antes.

### 5. Qué significa "terminado" (comprobable)

**Cero casillas quietas.** En las cuatro pantallas no queda ni un elemento sin movimiento
ni transición, y eso lo cuenta un script.

Más: las gráficas llevan efectos cinematográficos que den profundidad —profundidad de
campo, contraluz que separa del fondo, claroscuro y grano—, del mismo estándar que el
pendiente 1.

### 6. TESTIGO

**Script.** El mismo tipo que el del salón: Chrome, pestaña visible, un número.

---

## DECISIONES TOMADAS EN ESTA ENTREVISTA

**Los dos ejes W conviven así:** el arrastre **vertical sigue siendo la profundidad
anatómica** (piel → superficial → profundo → tendón → hueso), que ya está construida y
con test. **El tiempo no es un eje de arrastre: es una capa que se enciende desde la
pared** — la ejecución anterior aparece como estela translúcida junto al sujeto.

Razón: la profundidad es un *recorrido* y comparar con el pasado es un *estado*. Como
capa, las dos se componen — se puede estar en la capa de hueso **y** comparando, que es
donde la comparación más vale. Como eje, se excluirían.

Y la estela no habla en metros por segundo, porque la escala está muerta por los dos
anclajes: habla en **%PV** y en **diferencias de ángulo**, que no necesitan escala. Solo
se compara contra una sesión con el móvil en el mismo sitio, así que el trípode y
`calificarEncuadre()` son la puerta de entrada del historial, no decoración.

**`motor.ts`: se mide primero.** Milisegundos por fotograma hoy, y con la estela y las
luces encima. Bryan decide con el número delante.

---

## LO QUE EL RECONOCIMIENTO DESTAPÓ Y NO ENTRA EN ESTOS DOS PENDIENTES

Queda escrito para que no se pierda:

- **La app produce, muestra y GUARDA metros por segundo hoy.** `analisis.js:698`,
  `EncoderPage.tsx:785-787`, persistido en `tanda.ts:19-26`. La escala no sostiene ese
  número. El repo ya lo sabía y lo escribió en tres sitios —`types.ts:92-96`,
  `historial.ts:8-19`, `cifras.ts:5-23`— pero la regla se aplicó solo en el tipo que
  nadie escribe, no en la tabla que sí se escribe.
- **La ley del paralelogramo no existe**: cero código. Solo prosa y un spec que se abre
  diciendo «Estado: propuesta. No hay código escrito».
- **El contrato de equilibrio cubre 19 patrones de los 31**, no los 31.
- **La pista de pose se tira en la aduana**: `articulaciones.py` la produce y
  `exportar-medida.mjs:63-83`, el único puente a la app, no copia los puntos.
- **`pvObjetivo` no se escribe nunca**, así que la pared de velocidad dice «Sin objetivo:
  manda el RIR» para todos los asesorados.
- **`juzgarColocacion.ts` no está ni en `main` ni en la rama del salón**: vive solo en
  `escenario/el-laboratorio`. Es la pieza que juzga si el móvil estaba en el mismo sitio,
  o sea la precondición del historial.
- **Dónde va prescribir cambios de técnica:** NO con los C-1..C-65 —ninguno de los 65
  prescribe una corrección de técnica y el documento ni nombra el encoder—, sino en el
  **contrato de prescripción**, junto a B-7 «LA TÉCNICA MANDA»
  (`prescripcion.schema.json:240`), que es la única regla que ya convierte una medida en
  una decisión. Pendiente de confirmación de Bryan.
