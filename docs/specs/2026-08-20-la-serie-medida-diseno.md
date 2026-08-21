# La serie, medida — diseño

**2026-08-20**

Pantalla que ve el asesorado después de subir el vídeo de una serie. Implementa
la propuesta de diseño *«Alpha · Pantalla de serie medida»*, que hasta hoy
existía solo como artefacto.

Ruta: `/entrenar/serie`. Cuelga de Entrenar porque es lo que se mira justo
después de hacer la serie, no una sección aparte.

---

## Qué se ha construido, y qué no

| Pieza | Estado |
|---|---|
| `src/domain/serieMedida.ts` — decidir si la serie se midió y por qué no | **Hecho**, con 16 pruebas |
| `src/features/serie/` — la pantalla, sus dos estados | **Hecho**, con 11 pruebas |
| La tubería de visión que produce las muestras | **No conectada** |

La medición todavía no existe en la app. Vive fuera, en
`herramientas/encoder-camara/`, y aún no ha pasado su prueba de gravedad. El
enganche está escrito y probado: `interpretarSerie(entrada)` recibe muestras y
devuelve exactamente lo que la pantalla pinta. Lo único que falta es quien le dé
las muestras.

Mientras tanto la pantalla se alimenta de `seriesDeMuestra.ts`. **Las cifras de
la serie fallida son reales** —salen de un vídeo pasado por seguimiento de color
con la cabeza hexagonal como escala—; las de la serie válida son de ejemplo: esa
toma no existe todavía.

---

## Las tres reglas que sostienen la pantalla

Cada una responde a una forma concreta de mentirle al asesorado, y las tres
están convertidas en pruebas para que no se pierdan en el siguiente rediseño.

### 1 · El fallo va arriba, no oculto

Cuando la medida no vale, la pantalla lo dice en la primera tarjeta y con
**motivos concretos y numerados**, no con un «no se pudo procesar». Cada motivo
es una cifra que el asesorado puede comprobar en su propio vídeo: no vale «el
codo casi no se dobla», vale «161° de media».

El orden importa y se decide en el dominio, no en el componente: van del motivo
más determinante al menos. Quien lea solo el primero tiene que quedarse con la
causa principal. Por eso `un-solo-ciclo` va el último — cuando aparece junto a
los otros es su consecuencia, no la causa.

### 2 · Lo medido no se tira

Aunque no haya repeticiones, el recorrido, el pico y la traza **sí se midieron**.
Se muestran igual. El hueco de repeticiones se marca con una raya, nunca con un
cero: **un cero es un dato, una raya es una ausencia**. En el tipo esto es
`reps: number | null`, y hay una prueba en cada capa que lo protege.

### 3 · El rojo no puede avisar

En Alpha el rojo es la **marca**: está en el botón de acción, en la gráfica y en
el logo. Si además significara error, dejaría de significar nada. Los estados
usan el ámbar del sistema, y llevan también **punto y borde**, para leerse sin
depender del color.

---

## Decisiones de implementación que no conviene deshacer

**Los huecos de la traza no se cosen.** Cuando pasa más de un tercio de segundo
sin ver el implemento, la línea se corta. Unir esos puntos dibujaría un
movimiento que nadie ha medido — y esta gráfica existe precisamente para enseñar
qué ha entendido la app.

**La velocidad no se interpola sobre los fotogramas perdidos.** Si faltan, el
intervalo es más largo y la velocidad sale promediada sobre él. Inventar puntos
produciría una curva bonita y falsa.

**v₁ es la mejor de las dos primeras repeticiones.** Una primera repetición
dubitativa —se coloca, respira— es habitual y no debe fijar la referencia del
día. Es la misma regla que ya usa `analizarSerie` en la herramienta.

**El temblor no es una repetición.** `segmentarCiclos` exige un recorrido mínimo
de 8 cm, o contaría como serie la oscilación de quien sujeta la mancuerna
esperando.

---

## Lo que falta

1. **Conectar la tubería de visión.** Necesita entregar `MuestraDeVideo[]`:
   instante, altura y lateral en metros, y opcionalmente los ángulos de tronco
   y codo.
2. **La prueba de gravedad de la herramienta.** Es la puerta que decide si el
   método sirve, y sigue sin hacerse. Si la falla, la pantalla queda igual pero
   el motor cambia.
3. **Guardar la serie medida.** Hoy no se persiste nada. Cuando toque, va por
   `src/data/repos.ts` como todo lo demás, nunca hablando con Supabase desde la
   pantalla.
4. **El botón «Ver el vídeo con el trazado»** está pintado y no hace nada. No se
   puede implementar antes que la tubería.
