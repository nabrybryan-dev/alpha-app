# Recetas candidatas · 16 de agosto de 2026

Primera tanda sacada de Instagram con la cuenta `@alpha.marketing._`. **Nada de
esto está en la app todavía**: falta lo único que no puedo escribir yo, que son
tus notas de ajuste.

## Resumen de la búsqueda

Busqué por `#recetasfit`. Instagram devolvió **4 publicaciones** y nada más por
mucho que hiciera scroll — una cuenta recién creada, con 0 publicaciones y 1
seguido, recibe muy pocos resultados. Es el límite del que hablabas.

De esas 4:

| Cuenta | Receta | ¿Sirve? |
|--------|--------|---------|
| `@tasty_hunting` | Rollitos bajos en hidratos | **Sí** — ingredientes y preparación completos |
| `@paufeel` | Brownie sin harinas | **Casi** — falta una cantidad, ver abajo |
| `@habitofitness_` | — | No: pide comentar «RECETA» para mandar un PDF |
| `@marialebricenos` | — | No: el pie no lleva ingredientes |

**La mitad de los virales fit no publican la receta.** Unos la usan de gancho
para captar contactos y otros solo enseñan el plato. Para llenar la sección hay
que descartar bastantes, así que conviene mirar más de las cinco que necesitas.

---

## 1. Rollitos bajos en hidratos · `@tasty_hunting`

- **Enlace:** https://www.instagram.com/reel/DMyJZcUNxKC/
- **Rinde:** 2 porciones · **Antigüedad:** 54 semanas
- **Calculado:** **445 kcal** · 37 P · 15 C · 25 G por porción

Sale muy proteica y baja en hidratos — encaja bien como cena.

```ts
const ROLLITOS_DEL_REEL: IngredienteDelReel[] = [
  { nombre: 'Zanahoria',           enElReel: '2 zanahorias',      alimentoId: 'zanahoria-cruda',                                   gramosTotales: 120, estado: 'crudo' },
  { nombre: 'Huevo',               enElReel: '2 huevos',          alimentoId: 'huevo-de-gallina-entero-crudo',                     gramosTotales: 100, estado: 'crudo' },
  { nombre: 'Mozzarella',          enElReel: '100 g',             alimentoId: 'queso-fresco-semiduro-semigraso-tipo-mozzarella',   gramosTotales: 100 },
  { nombre: 'Atún al natural',     enElReel: '160 g',             alimentoId: 'atun-en-lata-en-agua-escurrido',                    gramosTotales: 160, estado: 'en_lata' },
  { nombre: 'Maíz tierno',         enElReel: '50 g',              alimentoId: 'mazorca-maiz-tierno-cocido-desgranado',             gramosTotales: 50,  estado: 'cocido' },
  { nombre: 'Queso crema',         enElReel: '2 cucharadas',      alimentoId: 'queso-crema-amarillo',                              gramosTotales: 30,  estado: 'listo' },
  { nombre: 'Aguacate',            enElReel: '1/2 pequeño',       alimentoId: 'aguacate-hass-crudo',                               gramosTotales: 50,  estado: 'crudo' },
]
```

Preparación, del propio reel:

1. Ralla la zanahoria cruda y mézclala con el queso, los huevos, la cebolla en polvo y la sal.
2. Engrasa una sartén a fuego medio, vierte la mezcla y extiéndela sin dejar agujeros.
3. Cocina tapado unos 8 minutos, hasta que esté firme.
4. Mezcla el relleno y extiéndelo sobre la base cuando esté lista.
5. Añade rúcula, enrolla y corta.

---

## 2. Brownie sin harinas · `@paufeel`

- **Enlace:** https://www.instagram.com/reel/DEh5vz3N4qg/
- **Rinde:** 2 porciones · **Antigüedad:** 83 semanas
- **Calculado:** **216 kcal** · 6 P · 16 C · 14 G por porción — *sin los chips*

```ts
const BROWNIE_DEL_REEL: IngredienteDelReel[] = [
  { nombre: 'Manzana',        enElReel: '1 manzana',         alimentoId: 'manzana-comun-cruda',            gramosTotales: 150, estado: 'crudo' },
  { nombre: 'Huevo',          enElReel: '1 huevo',           alimentoId: 'huevo-de-gallina-entero-crudo',  gramosTotales: 50,  estado: 'crudo' },
  { nombre: 'Nueces',         enElReel: '6 nueces',          alimentoId: 'nueces-nuez-de-nogal',           gramosTotales: 30,  estado: 'crudo' },
  { nombre: 'Cacao en polvo', enElReel: '2 cucharadas',      alimentoId: 'cacao-tostado-y-molido',         gramosTotales: 10,  estado: 'seco' },
  // FALTA: chips de chocolate sin azúcar. El reel no dice cuántos.
]
```

**Esta no se puede registrar tal cual.** El reel pone «chips de chocolate sin
azúcar» sin cantidad, y la regla es entera o nada: si los dejo fuera, el día se
queda corto y nadie se entera. Dos salidas, y la eliges tú:

- Fijas una cantidad (p. ej. 20 g) y entra completa.
- «Sin chips» pasa a ser el canje del ajuste Alfa, y entonces los 216 kcal son
  correctos y la receta ya es registrable.

Los polvos de hornear los dejé fuera: 4 g que no mueven ningún macro.

---

## Lo que puse yo y conviene que revises

**Los gramos de lo que el reel cuenta por unidades son estimaciones mías.** El
reel dice «2 zanahorias», no «120 g». Estos son los que asumí:

| Lo que dice el reel | Gramos que puse |
|---------------------|-----------------|
| 2 zanahorias | 120 g |
| 2 huevos | 100 g (50 g cada uno) |
| 1 manzana pelada | 150 g |
| 6 nueces | 30 g de grano |
| 2 cucharadas de queso crema | 30 g |
| 2 cucharadas de cacao | 10 g |
| 1/2 aguacate pequeño | 50 g |

Ninguna es descabellada, pero son mías y no del creador. Si alguna te chirría,
cámbiala y los macros se recalculan solos.

**Un dato del catálogo que no me cuadra:** `manzana-comun-cruda` está a
**72 kcal/100 g**. La manzana ronda las 52. Hay otra entrada,
`manzana-con-cascara`, que sí marca 52. Si la primera está mal, este brownie
sale inflado en unas 15 kcal por porción — poco, pero el error viaja a toda
receta que lleve manzana. Merece una mirada.

## Lo que falta antes de publicarlas

1. **Tus notas.** Dónde encaja hoy, el canje, el ojo con, el truco Alfa. Eso es
   criterio sobre una persona y no sale de ninguna tabla.
2. **La miniatura.** Las URLs de imagen de Instagram van firmadas y caducan, así
   que no sirven pegadas. O guardamos un fotograma en el repo, o usamos una
   tarjeta generada como la de la demo. Dime cuál prefieres.
3. **Decidir lo de los chips** del brownie.

El vídeo no se aloja: con `handle` y `instagramPermalink` la hoja cae al póster
con «Reel disponible en Instagram», que es el comportamiento correcto.

---

# Segunda tanda · barrido de cuentas

Cambio de método. Buscar por etiqueta daba 4 resultados; **entrar al perfil de
una cuenta da 12**, y recientes. Además los pies de foto se leen en bloque desde
la propia página con la sesión abierta, sin navegar post a post: mucho más
rápido y mucho más suave con el límite de Instagram.

Lo que el HTML del perfil NO trae es la rejilla —Instagram la pinta con
JavaScript—, así que hay que visitar cada cuenta. Una visita por cuenta, y de
ahí todo lo demás sale en una operación.

## Resultado del barrido

| Cuenta | Publicaciones | Con receta | ¿Trae gramos? |
|--------|--------------:|-----------:|---------------|
| `@paufeel` | 12 | 6 | **Sí** |
| `@tasty_hunting` | 12 | 8 | Parcial: la base sí, el relleno no |
| `@cocinarebeca` | 12 | 6 | **Sí**, exactos |
| `@tictacyummy` | 12 | 3 | No: «los ingredientes que prefieras» |

## El patrón que importa para elegir cuentas

**Las cuentas que dan gramos exactos son las de repostería y cocina general, no
las fit.** Y tiene una explicación: en repostería la cantidad es obligatoria
—80 g de galleta y 25 g de mantequilla o no cuaja—, mientras que en la cocina
fit todo es «al gusto».

El problema es que eso las cruza: `@cocinarebeca` da las cantidades al gramo,
pero su cheesecake lleva 90 g de azúcar y 140 g de nata. Precisión sin encaje.

Y al revés, `@tasty_hunting` es la que mejor encaja en el plan y es justo la que
deja el relleno suelto: «PARA EL RELLENO: jamón, rúcula, aguacate y tomate».

**Conclusión para elegir cuentas:** las que sirven son las fit que además miden,
que son las menos. `@paufeel` es la mejor de las cuatro por eso.

## Receta nueva, medida y lista

### Hamburguesas de pollo y brócoli · `@paufeel`

- **Enlace:** https://www.instagram.com/reel/DGsZWL8NZUH/
- **Rinde:** 2 porciones
- **Calculado:** **600 kcal** · 47 P · 3 C · 44 G por porción

```ts
const HAMBURGUESAS_DEL_REEL: IngredienteDelReel[] = [
  { nombre: 'Contramuslo de pollo', enElReel: '300 g', alimentoId: 'pollo-contramuslo-sin-piel-crudo',            gramosTotales: 300, estado: 'crudo' },
  { nombre: 'Brócoli rallado',      enElReel: '100 g', alimentoId: 'brocoli-crudo',                               gramosTotales: 100, estado: 'crudo' },
  { nombre: 'Queso rallado',        enElReel: '60 g',  alimentoId: 'queso-madurado-duro-semigraso-tipo-parmesano', gramosTotales: 60,  estado: 'listo' },
  { nombre: 'Huevo',                enElReel: '2 huevos', alimentoId: 'huevo-de-gallina-entero-crudo',            gramosTotales: 100, estado: 'crudo' },
  { nombre: 'Aceite de oliva',      enElReel: '3 cucharadas', alimentoId: 'aceite-de-oliva',                      gramosTotales: 39,  estado: 'listo' },
]
```

**Mira el aceite antes de publicarla.** Las 3 cucharadas son 39 g y se llevan
unas 350 kcal de las 600 — más de la mitad del plato, y casi toda la grasa. Es
el canje más evidente que he visto en las cuatro cuentas: bajarlo a una cucharada
deja el plato en torno a 400 kcal sin tocar la proteína. Pero esa decisión es
tuya.

## Y una advertencia sobre patrocinios

Una de las de `@tasty_hunting` (tosta de melocotón) empieza con **`Publi/`**: es
contenido pagado de una marca de aceite, y el pie es medio anuncio. Mandar a un
asesorado a un anuncio quizá no es lo que quieres. Conviene mirar esa marca en
el pie antes de subir cualquiera.

---

# Tercera tanda · las cinco cuentas de Bryan

| Cuenta | Publicaciones | Con receta | Con gramos | Veredicto |
|--------|--------------:|-----------:|-----------:|-----------|
| `@isabellarodriguezu` | 12 | **7** | 3 | **La mejor de las cinco** |
| `@healthylife_bymg` | 12 | 4 | 0 | Las coincidencias son de la preparación, no listas |
| `@nutrikrn` | 12 | 0 | 0 | Divulgación y promoción |
| `@rivas_nutricion` | 12 | 0 | 0 | Publicaciones de una línea |
| `@draisabelabelajllo` | — | — | — | **No existe** (¿errata en el usuario?) |

## Lo que separa a unas de otras

No es «nutricionista sí, nutricionista no»: `@isabellarodriguezu` y `@nutrikrn`
son las dos nutricionistas, y una sirve y la otra no. Lo que las separa es la
**estrategia de contenido**:

- `@isabellarodriguezu` publica **recetas**, con su lista y sus gramos.
- `@nutrikrn` publica **divulgación y captación**: «¿Quieres tomar magnesio?»,
  «Beneficios de esta sopita», «Mañana abrimos las inscripciones». Habla de
  comida sin dar la receta.
- `@rivas_nutricion` publica opinión en una línea: «📲🫡», «Nada más que decir».

`@healthylife_bymg` es el caso tramposo: parece que tiene recetas porque la
palabra «ingredientes» aparece, pero al leerlo es la **preparación** —«agrega los
ingredientes secos»— y la lista no está en el pie. Debe de ir en el vídeo o en
un comentario.

## De `@isabellarodriguezu`

Tres con cantidades de peso reales:

- **Torta de banano con frosting de yogur griego** — 120 g yogur, 200 g yogur
  para el frosting, 100 g chocolate oscuro
- **Limonada de fresa y menta con sandía** — 250 g fresas, 250 g sandía, 60 g
  jugo de limón, 500 ml
- **Cremoso de pollo con cebollín** — 1 pechuga, 1 taza de yogur griego

**Pero ninguna está medida del todo**, y aparece un obstáculo nuevo que no había
salido antes:

| Lo que dice | Problema |
|-------------|----------|
| `1 scoop de proteína` | Depende de la marca: entre 25 y 35 g, y los macros cambian mucho |
| `1/2 taza de avena` | Convertible (~45 g), pero es asunción mía |
| `mantequilla de frutos secos` | Sin cantidad |
| `1 de banano maduro` | Sin peso, y además parece una errata del pie |

El `scoop` es el peor de los cuatro: no es solo una cantidad que estimar, es un
alimento que ni siquiera sé cuál es. Sin saber la marca no se puede mapear al
catálogo.

## Recomendación

De las nueve cuentas revisadas ya, **`@paufeel` y `@isabellarodriguezu` son las
dos que valen la pena seguir minando**. Las dos publican recetas de verdad, con
listas, y al menos parte de las cantidades en peso.

Y confirma lo de la segunda tanda: el cuello de botella nunca fue el acceso a
Instagram. Es que **las recetas virales casi nunca están medidas del todo**, y
cerrar ese hueco es una decisión de nutrición, no de scraping.
# Cuarta tanda · las cantidades promediadas

Decisión de Bryan (2026-08-16): cuando el reel no da la cantidad, la pongo yo
por referencia en vez de dejar la receta bloqueada.

**Y se marca en el dato.** `RecetaIngrediente.estimado` viaja hasta la hoja, que
pinta un `*` junto a la cantidad y una nota al pie: «El reel no daba esta
cantidad. La calculó tu coach para que la receta cuadre con tu plan».

Sin esa marca, «100 g de mozzarella» —que lo dijo el creador— y «40 g de jamón»
—que lo puse yo— se leen igual de ciertas. Marcado se audita y se corrige; sin
marcar, se hereda para siempre.

## Las cuatro, ya completas

| Receta | Cuenta | Rinde | Por porción |
|--------|--------|------:|-------------|
| Brownie sin harinas | `@paufeel` | 2 | **279 kcal** · 7P 19C 19G |
| Wrap de papa | `@tasty_hunting` | 1 | **569 kcal** · 32P 33C 30G |
| Sándwich de pollo | `@tasty_hunting` | 1 | **260 kcal** · 32P 1C 13G |
| Carlota de mango | `@tasty_hunting` | 6 | **113 kcal** · 2P 16C 4G |

Con las tres anteriores ya son **siete** con sus números.

## Lo que promedié, y de dónde sale cada número

| Ingrediente | El reel decía | Puse | Referencia |
|-------------|---------------|-----:|-----------|
| Chips de chocolate | «chips sin azúcar» | 20 g | Cobertura típica de un molde de 2 raciones |
| Jamón (wrap) | «jamón» | 40 g | 2 lonchas de york |
| Aguacate (wrap) | «aguacate» | 50 g | Medio pequeño |
| Tomate (wrap) | «tomate» | 60 g | 1 mediano |
| Papa (wrap) | «½ papa grande» | 150 g | Papa grande ≈ 300 g |
| Queso (wrap) | «2 lonchas» | 40 g | 20 g por loncha |
| Queso crema (sándwich) | «2 cdas» | 30 g | 15 g por cucharada |
| Espinacas | «espinacas frescas» | 30 g | Un puñado |
| Tomate deshidratado | «tomates deshidratados» | 15 g | 3 mitades |
| Parmesano | «parmesano» | 10 g | Espolvoreado |
| Galletas (carlota) | «galletas» | 80 g | Capa de un molde de 6 |

Ninguna es descabellada. Todas son mías.

## Dos huecos del catálogo que sí te afectan

**1. No hay yogur griego.** Solo `yogur-natural-entero`, y la diferencia no es
menor:

| | Proteína /100 g |
|---|---:|
| Yogur natural (lo que hay) | **3,8 g** |
| Yogur griego (lo que pide la receta) | ~10 g |

Sustituir uno por otro **subestima la proteína casi tres veces**. La carlota
sale a 2 P por porción cuando con griego rondaría los 5. Y las recetas de
`@isabellarodriguezu` se apoyan mucho en él —una lleva 320 g entre masa y
frosting—, así que el error se multiplica ahí.

No lo maquillé: los 113 kcal de la carlota son con yogur natural. Si quieres las
de Isabella, hay que meter el yogur griego al catálogo primero.

**2. No hay rúcula ni queso de cabra.** Son de hoja y de guarnición, así que
mueven poco, pero no se pueden mapear y por tanto no se pueden registrar.

## Lo que sigue sin poder promediar

**`1 scoop de proteína`**, de las recetas de Isabella. No es una cantidad que
estimar: es un alimento que no sé cuál es. Entre 25 y 35 g según la marca, y
entre un aislado y un concentrado los macros cambian por completo. Estimar aquí
no sería promediar, sería inventar un alimento.

Para esas hace falta que digas qué proteína usas tú, o descartarlas.
