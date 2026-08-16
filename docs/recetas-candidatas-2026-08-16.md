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
