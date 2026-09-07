# Protocolo de pruebas con usuarios — el salón de /entrenar (2026-09)

## Objetivo

Comprobar si una persona que **nunca ha visto el salón 3D de `/entrenar`**
descubre, sola y con una sola mano, los seis gestos que hoy deciden qué hace el
dedo ahí dentro: orbitar la cámara, hundirse en el cuerpo, cambiar de ejercicio,
hacer zoom, mover el mando del reloj y abrir el panel de abajo. No se prueba si
el salón «gusta»: se prueba si **se entiende sin que nadie lo explique**, porque
en el gimnasio nadie va a leer un manual entre series.

Este protocolo no toca código ni corrige nada. Es observación pura: se lee un
guion, se cronometra, se anota lo que la persona dice y hace, y se entrega el
informe. No se le enseña el gesto si falla — se anota que falló y por qué, y se
sigue a la tarea siguiente.

## Quién

- **Perfil**: alguien que **no ha entrado nunca** al salón de `/entrenar` (ni
  como asesorado real ni en una demo previa). No hace falta que entrene con
  Alpha Athletics; hace falta que no conozca ya los gestos, porque lo que se
  mide es el primer contacto, no la memoria.
- **Cuántos**: mínimo 5 personas. Es el número donde la teoría de pruebas de
  usabilidad (Nielsen) dice que ya aparece la mayoría de los problemas de uso;
  con menos de 5, un tropiezo de una sola persona no se distingue de un
  despiste suyo.
- **Con una mano**: cada persona sostiene el teléfono con una mano y deja la
  otra ocupada (una mancuerna, una toalla, apoyada en el banco) durante las seis
  tareas. Es la condición real del gimnasio, no un capricho del protocolo: si
  hace falta la segunda mano para un gesto, esa es una falla, no un detalle.
- **Entre series**: cada tarea se lee y se cronometra dentro de una ventana de
  90 segundos — el descanso típico entre series —, no con tiempo libre. Si la
  persona no logra la tarea en esos 90 segundos, se anota como no lograda y se
  sigue; no se alarga la ventana porque en el gimnasio tampoco se alarga el
  descanso.
- **Dispositivo**: un móvil real, no un emulador — la app abierta en
  `http://localhost:5182` (o el enlace de demo que se les dé) con un usuario ya
  elegido, para no gastar tiempo de la prueba en el login.
- **Quién dirige la sesión**: una sola persona lee el guion, cronometra y
  anota. No corrige, no señala, no dice «prueba tocando ahí». Si preguntan qué
  hacer, la respuesta es siempre «hazlo como te parezca» — la ayuda cuenta
  como fallo del gesto, no de la persona.

## Tareas

Cada tarea se lee **tal cual está escrita**, sin añadir pistas. El cronómetro
arranca al terminar de leer y se para en el segundo exacto en que la persona
logra el objetivo (o cuando se cumplen los 90 segundos sin lograrlo).

### Tarea 1 — Girar la sala

**Enunciado literal**: «Este es el sitio donde vas a entrenar hoy. Antes de tu
próxima serie, quiero que veas este ejercicio desde otro ángulo — como si
caminaras alrededor de la persona. Tienes hasta que se acabe tu descanso.
Ve contándome en voz alta qué vas probando.»

**Qué se busca**: que toque con un dedo **fuera** del cuerpo del sujeto y
arrastre, lo que hoy orbita la cámara libremente (`dedoEnElCuerpo.ts`: el
gesto que nace fuera del cuerpo es «todo» — orbita en cualquier dirección).

**Éxito**: gira la cámara con un dedo, sin ayuda, en menos de 20 segundos.
Logro parcial: lo consigue pero solo después de tocar antes sobre el cuerpo (lo
que hunde capas en vez de girar) — se anota igual como logrado, con la nota de
que probó el sitio equivocado primero.

### Tarea 2 — Ver debajo de la piel

**Enunciado literal**: «Ahora quiero que descubras qué hay debajo de la piel de
esta persona — músculo, hueso — usando solo tu dedo encima de su cuerpo. Nada
de menús ni botones: solo el dedo sobre el cuerpo.»

**Qué se busca**: que **apoye y mantenga** el dedo sobre el cuerpo en vez de
tocarlo y soltarlo (`hundirEnElCuerpo.ts`: hace falta sostener la presión más
de 320 milisegundos para empezar a atravesar capas, y cada 450 ms adicionales
se pasa a la capa siguiente hasta llegar al hueso). Un toque breve no hace
nada, y eso es lo que hay que ver: ¿la persona insiste sosteniendo, o se rinde
tras un par de toques cortos?

**Éxito**: mantiene el dedo apoyado el tiempo suficiente para ver **al menos
una capa distinta de la piel** (músculo o más adentro) en menos de 15 segundos
sin ayuda. Si además llega hasta el hueso, se anota aparte como «llegó al
fondo» con su tiempo.

### Tarea 3 — Cambiar de ejercicio

**Enunciado literal**: «Se acabó este ejercicio por hoy. Sin abrir ningún menú
ni panel, pasa al siguiente ejercicio de tu sesión.»

**Qué se busca**: que encuentre la tira de puntos (`PuntosDeEjercicio.tsx`) y
la deslice de lado, o toque directamente el punto siguiente — desde el
2026-09-06 el gesto vive ahí y ya no sobre el cuerpo, así que un intento de
deslizar el cuerpo para cambiar de ejercicio es un tropiezo esperado, no un
error del protocolo.

**Éxito**: cambia de ejercicio deslizando o tocando la tira de puntos, sin
ayuda, en menos de 25 segundos. Se anota como fallo parcial si lo logra
deslizando el cuerpo por error antes de encontrar la tira (eso hoy no hace
nada: la sesión se queda igual y hay que verlo intentar otra vía).

### Tarea 4 — Acercarte a un detalle

**Enunciado literal**: «Quiero que te acerques bien de cerca a un detalle del
ejercicio — la mano, la rodilla, donde tú quieras — y que después vuelvas a
alejarte para ver a la persona entera otra vez.»

**Qué se busca**: que use **dos dedos** en pellizco (pinch) para acercar y
alejar la cámara — el gesto de dos dedos es siempre de cámara, incluso sobre
el cuerpo, y no se pelea con el de hundir capas porque ese es de un solo dedo.

**Éxito**: hace zoom con dos dedos y regresa a una distancia parecida a la
inicial, sin ayuda, en menos de 20 segundos.

### Tarea 5 — El mando de abajo

**Enunciado literal**: «Ahí abajo hay un mando pequeño y redondo. Tócalo con el
pulgar de la misma mano con la que sostienes el teléfono y tira de él hacia
donde quieras, sin soltar el teléfono con la otra mano.»

**Qué se busca**: que **encuentre** el disco del mando (`Joystick.tsx`, un
disco desnudo sin flechas ni etiquetas visibles — se descubre tirando, no
leyendo) y note que algo de la pared cambia al tirar de él en una dirección.
El mando no dice lo que hace: lo que hace se lee en la pared, así que aquí se
anota también si la persona **mira hacia la pared** después de soltar, o si
suelta y sigue mirando solo el mando.

**Éxito**: agarra el disco con el pulgar (una sola mano) y lo suelta hacia un
lado, sin ayuda, en menos de 20 segundos. Logro adicional, aparte: nota el
cambio en la pared sin que se le pregunte.

### Tarea 6 — Encontrar el peso y las repeticiones

**Enunciado literal**: «Se acabó tu serie. Antes de la siguiente, dime cuánto
peso y cuántas repeticiones te tocan ahora en este ejercicio, sin que yo te
diga dónde mirar.»

**Qué se busca**: que arrastre hacia arriba (o toque) la manija del panel de
abajo (`PanelInferior.tsx`) con una sola mano y encuentre el recuadro
`ejercicio` con la prescripción completa — es el panel pensado exactamente
para leerse «entre series», con el sujeto todavía delante y sin tapar la
pantalla entera de golpe.

**Éxito**: abre el panel con una mano y dice en voz alta el peso y las
repeticiones correctos, sin ayuda, en menos de 20 segundos.

## Éxito por tarea

| Tarea | Gesto que se busca | Criterio de éxito |
|---|---|---|
| 1 — Girar la sala | Un dedo, arrastre fuera del cuerpo | Orbita la cámara en menos de 20 s sin ayuda |
| 2 — Ver debajo de la piel | Un dedo, presión sostenida sobre el cuerpo | Ve al menos una capa bajo la piel en menos de 15 s sin ayuda |
| 3 — Cambiar de ejercicio | Deslizar o tocar la tira de puntos | Cambia de ejercicio en menos de 25 s sin ayuda |
| 4 — Acercarte a un detalle | Pellizco con dos dedos | Hace zoom y vuelve atrás en menos de 20 s sin ayuda |
| 5 — El mando de abajo | Agarrar y tirar el disco con el pulgar | Suelta el mando hacia un lado en menos de 20 s sin ayuda |
| 6 — Peso y repeticiones | Arrastrar o tocar la manija del panel | Lee peso y repeticiones en menos de 20 s sin ayuda |

Una tarea cuenta como **lograda** solo si se cumple dentro de los 90 segundos
del descanso Y sin que quien dirige la sesión haya dado ninguna pista. Una
pista dada a mitad de tarea convierte el resto de esa tarea en «no logrado»,
aunque termine antes de los 90 segundos: lo que se mide es si el salón se
explica solo, no si la persona termina consiguiéndolo con ayuda.

## Qué se apunta

Por cada tarea y cada participante, en la hoja de registro
(`docs/pruebas-de-uso/hoja-de-registro.md`):

- **Tiempo**: segundos desde que se termina de leer el enunciado hasta que se
  logra el objetivo, o `90+` si no se logró en la ventana.
- **Logro**: `sí`, `no`, o `parcial` (lo logró pero por el camino equivocado,
  como tocar el cuerpo para orbitar antes de encontrar la zona correcta).
- **Lo que dijo**: la frase textual de la persona mientras probaba, sobre todo
  la primera reacción («¿esto se toca?», «¿por qué no pasa nada?») y cualquier
  cosa que diga justo antes de lograrlo o de rendirse. No se resume ni se
  corrige la gramática: se cita tal cual.
- Además, libre en el margen: qué gesto probó primero aunque no fuera el
  correcto (por ejemplo, deslizar el cuerpo en la Tarea 3) — eso es lo que
  después distingue un gesto mal descubierto de un gesto mal diseñado.

No se apunta el nombre de la persona en ningún campo: cada participante es
`Participante 1`, `Participante 2`, etc., asignado antes de empezar. Ninguna
nota de esta prueba lleva nombres de asesorados reales de Alpha Athletics.

## Cómo se analiza

1. **Por tarea, no por persona.** Se calcula cuántas de las personas lograron
   cada tarea dentro de su criterio en segundos. Una tarea con menos de 4 de 5
   logros (80 %) es candidata a rediseño — el listón sale de Nielsen: un
   problema que ve el 60–80 % de los usuarios en una prueba de 5 ya no es
   ruido, es el gesto.
2. **El tiempo medio y el peor caso**, no solo si se logró. Una tarea que se
   logra siempre pero tarda 70 de los 90 segundos disponibles deja muy poco
   margen real en un descanso corto; se anota aparte de las que fallan del
   todo.
3. **Los `parcial` se leen aparte.** Un logro parcial (tocó el sitio
   equivocado primero) no cuenta como fallo del gesto pero sí como aviso: si
   tres de cinco personas prueban primero el camino que no es, ese primer
   intento equivocado es una señal sobre dónde busca la mano antes de
   encontrar el sitio correcto, y vale la pena leerlo aunque la tarea al final
   se haya logrado.
4. **Las frases textuales se agrupan por tarea**, no por persona, buscando
   palabras repetidas («no sé qué toqué», «se movió solo») que señalen
   confusión aunque el cronómetro haya dado un tiempo aceptable — un gesto
   puede lograrse por accidente y el comentario es lo único que lo delata.
5. El resultado de este análisis se entrega como hallazgo a quien tenga la
   capa de interfaz (`origin/capa/interfaz`): esta prueba no cambia ni un
   componente, solo reporta con qué tarea, qué tiempo y qué cita.
