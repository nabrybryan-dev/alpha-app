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
