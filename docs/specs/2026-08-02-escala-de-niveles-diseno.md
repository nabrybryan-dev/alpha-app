# Escala Alfa: siete peldaños, requisitos propios y ascenso automático

**Fecha:** 2026-08-02
**Estado:** propuesta, pendiente de revisión
**Proyecto 2 de 4** — le sigue el [ciclo de revisiones](2026-08-02-ciclo-de-revisiones-diseno.md),
que le añade el eje de conocimiento.

---

## 1. Qué está mal hoy

**El nivel no existe por persona.** `rutaPorDefecto()` recibe el `usuarioId` y lo ignora:
devuelve siempre el peldaño 03. Todos los asesorados ven "NIVEL 03 · RENDIMIENTO" el día
que entran y dos años después.

**Los requisitos son los mismos para los ocho peldaños.** `requisitosDeNivel()` no mira en
qué nivel está la persona. Subir de 01 a 02 pide exactamente lo mismo que subir de 07 a 08.

**Un requisito es inalcanzable.** Pide una desviación media de RIR **menor a 0,5**. La
literatura sitúa el error de un lifter experimentado en 1–2 repeticiones y el de un novato
en 4–5 ([clasificación de nivel y educación](../../../wiki/conocimiento/clasificacion-nivel-y-educacion.md)).
Es una puerta por debajo de la precisión humana documentada.

**Cuatro peldaños son decorado.** PRECISIÓN exige encoder y PICO exige fecha de
competencia. Para un asesorado de gimnasio la escalera termina en el 04.

---

## 2. Decisiones tomadas

| Qué | Decisión |
|---|---|
| Cuántos peldaños | **Siete**: 01–04 se quedan, dos altos nuevos, ÉLITE como cima |
| Cómo se diferencian | Núcleo fijo de cinco ejes con listón creciente, más ejes que aparecen al cambiar de etapa del método |
| Quién asciende | **La app, sola**, al cumplir todos los requisitos |
| Qué frena | La valoración de técnica del coach es uno de los requisitos |
| Equipamiento | Los peldaños altos se miden con lo que la app registra. La velocidad de barra se menciona, no es puerta |

**Por qué el ascenso automático es seguro hoy:** el nivel es *display*. No decide cargas ni
series. El día que decida programación, hay que volver a poner el visto bueno del coach en
medio — y dejarlo escrito aquí no es adorno: es la condición bajo la que se aprobó esto.

---

## 3. La escala

Cada peldaño declara a qué nivel del método pertenece (Pérez-Córdoba), que es lo que manda
de verdad sobre intensidad, esfuerzo, volumen y progresión.

| # | Nombre | Método | Qué se construye |
|---|---|---|---|
| 01 | FUNDAMENTO | principiante | Patrones básicos, rango completo, hábito de entrenar |
| 02 | ESTRUCTURA | principiante | Progresión lineal, registrar cargas, comer para crecer |
| 03 | RENDIMIENTO | intermedio | Periodización por bloques, volumen entre MEV y MRV |
| 04 | AVANZADO | avanzado | Autorregulación real: ajustar por fatiga y contexto |
| 05 | ESPECIALIZACIÓN | avanzado | Bloques ATR completos y ataque dirigido a puntos débiles |
| 06 | PICO | avanzado | Llevar el rendimiento a su punto más alto en una ventana elegida |
| 07 | ÉLITE | avanzado | Sostenerlo bloque tras bloque, decidiendo con sus propios datos |

**Los cambios frente a la escala de hoy:**
- Desaparece PRECISIÓN como peldaño. La regulación por velocidad de barra pasa a ser un
  refinamiento que se menciona en ESPECIALIZACIÓN, no una puerta: solo existe con encoder.
- PICO deja de exigir competencia. Se redefine como el taper hacia una ventana que la
  persona elige, y su señal es medible: **tras la descarga, el 1RM estimado sube**.
- ÉLITE deja de ser "monitorización completa" y pasa a ser **estabilidad sostenida**.
- Los rangos de meses salen de los requisitos y quedan como descripción. Ninguna de las
  tres referencias que clasifican —McKay, ACSM, Pérez-Córdoba— usa los años como criterio.

---

## 4. Los requisitos

### 4.1 El núcleo, con listón creciente

Cinco ejes en todos los peldaños. El umbral sube en cada uno.

| Para pasar a | Consistencia | Error RIR | Series/grupo | Fuerza al alza | Técnica |
|---|---|---|---|---|---|
| 02 | 60 % | — | ≥ 8 | — | ≥ 40 |
| 03 | 75 % | ≤ 2,0 | ≥ 12 | ≥ 30 % | ≥ 55 |
| 04 | 85 % | ≤ 1,5 | ≥ 16 | ≥ 50 % | ≥ 70 |
| 05 | 90 % | ≤ 1,2 | ≥ 18 | ≥ 50 % | ≥ 80 |
| 06 | 92 % | ≤ 1,0 | ≥ 20 | ≥ 60 % | ≥ 85 |
| 07 | 95 % | ≤ 0,8 | ≥ 20 | ≥ 60 % | ≥ 90 |

**El error de RIR no baja nunca de 0,8**, y esto es deliberado: por debajo está el error de
un lifter experimentado según la literatura. Un umbral más duro no mide dominio, mide
suerte. En el primer salto ni se pide: un novato se equivoca por 4–5 repeticiones y eso es
lo normal, no un defecto.

**El volumen se topa en 20 series** y no sube a 22 en los últimos peldaños. Vivir en MRV es
justo lo que el motor manda descargar; pedirlo como requisito empujaría contra la propia
regla del método.

**La técnica es el juicio del coach**, con la valoración que ya escribe en el panel. Es la
compuerta humana del ascenso automático: nadie sube sin que el coach le haya visto ejecutar.

> La valoración de técnica es hoy un deslizador de 0 a 100. La literatura dice que una
> medida así no es repetible —el modelo validado son criterios por patrón, marcados
> presentes o ausentes, con fiabilidad ICC 0,88—. Cambiarlo **no entra en este proyecto**,
> pero el umbral por peldaño lo hace más urgente: queda anotado en §8.

### 4.2 Los ejes que aparecen por etapa

No existen en los peldaños bajos, porque no aplican a esa etapa.

| Eje | Aparece en | Qué mide | Quién lo determina |
|---|---|---|---|
| Autorregulación real | 04 en adelante | Que baje la carga cuando entra con readiness baja, en vez de sostenerla igual | **El coach**, en su panel |
| Respuesta a la descarga | 06 en adelante | Que tras la descarga el 1RM estimado suba | La app: compara el microciclo posterior a la descarga con el previo |
| Estabilidad entre bloques | 07 | Que no se caiga: cumplir el resto de requisitos en dos bloques seguidos | La app: historial de microciclos |

**Por qué la autorregulación la valora el coach y las otras dos no** (decidido el
2026-08-02): las otras dos son comparaciones limpias entre microciclos, y el dato basta.
La autorregulación no: distinguir "bajó la carga porque venía cansado" de "bajó porque
tuvo un mal día" es lectura de contexto. La app ve el número, no el motivo.

Queda entonces junto a la técnica en el panel del coach: dos valoraciones por asesorado,
no una.

### 4.3 Los conocimientos

Los añade el [ciclo de revisiones](2026-08-02-ciclo-de-revisiones-diseno.md): cada peldaño
declara qué temas del temario le corresponden, y un tema sin comprender frena el ascenso.
Este proyecto deja el hueco previsto; no lo llena.

---

## 5. Cómo se asigna el nivel

**Al empezar.** Nadie arranca en el 03 por defecto. El nivel inicial se calcula con lo que
haya: sin historial, 01. Con microciclos registrados, el más alto cuyos requisitos ya
cumpla.

**Al avanzar.** Después de cerrar un microciclo se recalcula. Si cumple todos los requisitos
del siguiente peldaño, sube. Se le avisa en la Ruta.

**No se baja.** Un mes malo no devuelve a nadie a un peldaño anterior: el nivel describe lo
que la persona llegó a dominar, no cómo le fue esta semana. Lo que sí baja es el porcentaje
de progreso hacia el siguiente.

> Esta asimetría es intencionada. La alternativa —bajar de nivel tras un mal bloque— castiga
> justo cuando la persona más necesita quedarse, y choca con la adherencia, que en la
> jerarquía Heracles va por encima de la tensión mecánica.

---

## 6. Datos

En `perfiles.datos` (JSONB), como la valoración de competencias. Sin tabla nueva y sin
migración; hay que comprobar que el trigger `proteger_perfil` de la migración 0008 deje
pasar estos campos y solo estos.

| Dato | Para qué |
|---|---|
| Peldaño actual | Lo que se pinta y desde dónde se calculan los requisitos |
| Fecha del último ascenso | Avisar en la Ruta de que subió |

La escala en sí —los siete peldaños, sus umbrales y sus descripciones— es **contenido, no
dato de la persona**: vive en `data/ruta/` y se actualiza con la app.

La lógica va entera en `domain/rutaEntrenamiento.ts`, que ya tiene `requisitosDeNivel()`
y sus tests. Si el archivo pasa de 400 líneas, se parte: los umbrales por peldaño a un
módulo propio.

---

## 7. Casos borde

| Caso | Comportamiento |
|---|---|
| Sin microciclos todavía | Peldaño 01, requisitos visibles con "aún sin datos" en la métrica |
| Sin valoración de técnica | El requisito aparece sin cumplir, con "lo valora tu coach". No bloquea el resto |
| Cumple varios peldaños de golpe | Sube uno solo por microciclo cerrado. Subir tres de una vez no es una celebración, es un error de datos |
| Ya está en ÉLITE | La Ruta deja de pedir requisitos y pasa a mostrar el mantenimiento |
| El coach baja la técnica por debajo del umbral | No se baja de nivel. El requisito del siguiente peldaño vuelve a incumplirse |

---

## 8. Fuera de alcance

- **Convertir la valoración de técnica en criterios con casillas** (modelo RTSB).
  **Decidido el 2026-08-02: no se hace.** Se planteó que el deslizador de 0 a 100 no tiene
  la repetibilidad del modelo validado —ICC 0,88 frente a una impresión que varía entre dos
  días del mismo evaluador— y que ahora ese número decide ascensos. El coach lo asume y
  prefiere seguir con el deslizador. Queda escrito aquí para que quien lo lea después sepa
  que es una decisión tomada con el riesgo a la vista, y no un olvido.
- Que el nivel decida programación. Hoy es display, y ahí se queda.
- Bajar de nivel.
- Insignias o premios por ascender: eso vive en Logros, que es otra escala.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Todos los asesorados cambian de nivel el mismo día que esto salga | Es correcto —hoy todos están en un 03 falso— pero conviene avisarles antes por el chat |
| Alguien constante baja de 03 a 01 al recalcular y lo vive como castigo | El primer cálculo es el real; el 03 de hoy nunca significó nada. La Ruta tiene que explicarlo con esas palabras |
| Los umbrales son una propuesta, no están validados con la cartera | Antes de activarlos, correr el cálculo sobre los asesorados reales y mirar dónde cae cada uno |
| El listón de técnica hace que el ascenso dependa de un deslizador poco repetible | Anotado en §8; mientras tanto, el umbral es lo único que el coach controla y lo sabe |
