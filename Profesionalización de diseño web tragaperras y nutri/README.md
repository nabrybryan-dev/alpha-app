# Profesionalización de diseño web — tragaperras y nutri

Estado de las dos superficies que se rediseñaron, tal como quedaron en la app.
Esto no es un prototipo: es lo que está construido, con tests, en la rama
`entrenamiento/taxonomia-de-categorias`.

Los prototipos originales siguen en `design_handoff_app_asesorado/` (Alfa App
Pro v2) y `design_handoff_nutricion/` (Registro de Comidas), como referencia
histórica de dónde salió esto.

---

## 1. Tragaperras — cinco máquinas, una por ejercicio

`src/features/entrenar/slotThemes.ts` · `ExerciseSlotMachine.tsx` · `SalonDeMaquinas.tsx`

La misma máquina repetida cinco veces dejaba de ser un juego a la tercera: el
ojo la reconoce y la deja de mirar. Cada ejercicio de la sesión monta la suya y
se reparten cíclicamente.

| # | Máquina | Fuente | Rasgo propio |
|---|---------|--------|--------------|
| 1 | LIBERTY BELL | Playfair Display | Corona de campana, hierro fundido |
| 2 | FRUIT MACHINE | Alfa Slab One | Marquesina de bombillas |
| 3 | SEVENS & BARS | Anton | Neón parpadeante |
| 4 | DIAMOND SALON | Cinzel | Cinta oscilante, latón, pomo de rombo |
| 5 | CASH BONANZA | Bungee | Barrido LED y bote que sube |

**No se diferencian solo en color.** Ni la tipografía, ni el acento, ni la
cadencia de giro (`step`) se repiten entre las cinco. Hay un test que lo
sostiene para que nadie las acerque sin querer al retocarlas.

**Física escalonada.** Los tres carretes paran a 0,72 · 0,88 · 1 del tiempo
base, no a la vez. Es lo que hace que la parada se sienta mecánica y no un
cambio de estado de React.

**No gira sola.** `autoSpin` nace en `false`. Un test avanza 20 s de reloj para
comprobar que la parada no cambia si nadie toca la palanca.

**Movimiento reducido.** Con `prefers-reduced-motion` se apagan el desenfoque y
el escalonado, pero el gabinete conserva su estética: se quita el movimiento, no
el diseño.

**Legal.** Los cinco son arquetipos históricos genéricos. Ni nombres comerciales
de fabricantes ni logotipos.

### Salón de máquinas

Tira de fichas sobre la sesión: cada una lleva el color de SU máquina, apagada
como silueta y encendida con su acento. Se abre **registrando las series**
(`ejercicioCompleto`), nunca mirando — si bastara con verlas, en diez segundos
de scroll estarían las cinco y el contador hablaría de navegación, no de
entrenamiento.

Con todas hechas aparece la insignia **SALÓN COMPLETO** y la opción de
compartir. Compartir es siempre un toque de la persona, abre la hoja del sistema
—donde ella elige destino y confirma— y **viaja el recuento, no qué ejercicios
hizo**: su programación es suya.

### Atrezo, y se dice

El contador de CRÉDITOS y el bote de la marquesina **no miden nada**: son parte
del gabinete, bajan al tirar de la palanca y se reinician. Decisión explícita
del 2026-08-16: se quedan porque le dan vida. Queda escrito aquí para que nadie
los confunda nunca con una métrica.

---

## 2. Nutri — la receta viral, traducida y registrable

`src/data/recetas.ts` · `RecetasCarousel.tsx` · `RecetaSheet.tsx` · `ReelPlayer.tsx`

En vez de prohibir el viral que el asesorado ya vio, se le dice la porción que
sí entra hoy.

**Ingredientes en dos columnas.** Lo que dice el reel (tachado) y lo que le toca
a esta persona. Van juntas a propósito: solo «tu cantidad» obliga a fiarse a
ciegas, solo la del reel lo deja donde estaba. Lo que vale es ver **la
traducción**.

**Línea contextual, nunca omitida.** «Te quedan {n} kcal hoy», o «Según tu plan
de hoy» si falta el dato. Es lo único que separa esto de un feed de recetas.

**Botón fijo al fondo del scroll**, 50 px, con degradado atado al token de
superficie para que funcione en claro y en oscuro. Con la receta larga el botón
quedaba a dos pantallas.

**Alta de un toque, sin confirmación.** La salida no es confirmar antes, es
deshacer después: aviso con lo registrado y «Deshacer» que se va solo a los 4 s.
La hoja **no** se cierra al agregar, porque cerrarla se llevaría esa salida.

**El «Deshacer» deshace de verdad.** `agregar` y `deshacer` viajan en un mismo
tipo (`RecetaRegistro`): no se puede cablear el alta sin su marcha atrás.

### Cómo se registra, y por qué así

`src/domain/nutricion/recetaAlRegistro.ts`

Se guardan **los ingredientes, no la ficha**. Lo cómodo sería un solo ítem con
las 180 kcal ya calculadas. No sirve: `resumenDelDia` deriva los macros del
catálogo por `alimentoId` y **se salta** los ítems que no encuentra. Una receta
guardada como bloque sumaría cero — el aviso diría «agregada», la comida
aparecería en la lista, y las kcal restantes no se moverían. Silencioso y
creíble, el peor fallo posible aquí.

Por ingredientes entra por la misma puerta que cualquier otra comida: cuadra el
día, cuadra la semana, sale en «Recientes», y el día que se corrija un valor del
catálogo esta comida se corrige sola.

**O entera o nada.** Si a un ingrediente le falta alimento o gramos, el botón se
desactiva y dice cuál. Registrar media receta dejaría el día corto sin avisar.

La receta entra como **comida propia**, no dentro del snack que ya hubiera: así
deshacer borra exactamente eso y un ingrediente repetido no se lleva por delante
lo que la persona ya tenía registrado.

### Recetas cocinadas

`src/domain/recetasProbadas.ts`

Cuenta **solo lo que quedó registrado**, y baja al deshacer. Una racha que sube
por abrir una hoja mide curiosidad, no cocina. Guarda fechas, no un contador:
así se puede auditar de dónde sale el número.

Hasta la primera receta no se pinta nada — un «0 recetas» de bienvenida es un
reproche, no un dato.

---

## 3. Lo que falta

- **Recetas reales.** `RECETAS` está vacía en producción y solo sirve datos de
  muestra en desarrollo. Faltan las de verdad: handle, permalink, ingredientes
  con su alimento del catálogo, y las notas del coach.

  El permiso receta por receta se retiró el 2026-08-16 — quien publica un reel
  busca alcance y esto se lo da. Lo que sigue en pie: el crédito es obligatorio
  y visible, y el vídeo **no se aloja**. Si el reel se viera sin salir de Alfa,
  el creador dejaría de recibir la visita que justifica todo, y el argumento del
  alcance se caería solo.
- **Ingredientes mapeados al catálogo.** Solo la receta de muestra 1 los tiene.
  Sin `alimentoId` y `gramosParaTi`, una receta se ve pero no se registra.
- **Esqueleto de carga**: construido y probado, pero hoy nadie pasa
  `cargando` porque las recetas son un archivo estático. Queda listo para cuando
  viajen por red.
