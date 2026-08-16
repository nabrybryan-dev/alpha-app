-- 0024 · La despensa: lo que el asesorado tiene en casa.
--
-- Para que el motor recomiende SOLO con lo que hay, en vez de sugerir salmon a
-- quien compro huevos. Ver docs/specs/2026-08-03-motor-de-ajuste-nutricional-diseno.md
-- (§11) y src/domain/nutricion/despensa.ts, que es donde vive la regla.
--
-- GUARDA PRESENCIA, NO SALDO. No hay columna de "restante" y no la va a haber.
-- Un inventario que se descuenta se desincroniza en tres dias -nadie anota el
-- pollo que se comio su pareja- y a partir de ahi el motor recomienda comida
-- que no esta, o se niega a recomendar comida que si esta. Un dato que va
-- derivando es peor que no tenerlo, porque nadie sabe cuando dejo de ser
-- cierto.
--
-- `cantidad_g` es ORIENTATIVA: sirve para que la nutricionista vea si alguien
-- compro proteina para tres dias o para quince. No se resta de nada.
--
-- EL ALIMENTO PEDIDO ENTRA IGUAL. Cuando alguien busca algo que no esta en el
-- catalogo, la fila se guarda con `alimento_id` nulo y el texto en
-- `texto_pedido`. Se ve, y el staff lo ve, pero el motor lo deja fuera de todo
-- calculo: sin tabla nutricional, una cantidad recomendada seria un numero
-- inventado con pinta de medido. Esas filas son la cola de trabajo del staff.

create table if not exists public.despensa (
  id            uuid primary key default gen_random_uuid(),
  asesorado_id  uuid not null references public.usuarios_app (id) on delete cascade,

  -- Id del catalogo empaquetado. Nulo = pedido pendiente de que el staff le
  -- encuentre su tabla. No es una FK: el catalogo no vive en la base, va dentro
  -- del build.
  alimento_id   text,

  -- Lo que escribio la persona cuando no lo encontro. Solo en los pedidos.
  texto_pedido  text,

  -- Orientativa y opcional. NULL = no la dijo, que no es lo mismo que cero.
  cantidad_g    numeric check (cantidad_g is null or cantidad_g > 0),

  -- 'compra'    = entro al marcar la lista de compra de este ciclo.
  -- 'ya_tenia'  = lo anadio a mano porque ya estaba en la cocina.
  origen        text not null default 'compra'
    check (origen in ('compra', 'ya_tenia')),

  agregado_en   date not null default current_date,
  actualizado_en timestamptz not null default now(),

  -- Para que la app pueda subir con ON CONFLICT (cliente_id). NO PARCIAL: ver
  -- la 0023, donde un indice con `where` dejo el registro de comidas sin subir
  -- durante semanas porque ON CONFLICT no puede arbitrar sobre un indice
  -- parcial.
  cliente_id    text,

  -- O es un alimento del catalogo, o es un pedido con su texto. Ni las dos
  -- cosas ni ninguna: una fila sin ninguna de las dos no identifica nada.
  constraint despensa_alimento_o_pedido check (
    (alimento_id is not null and texto_pedido is null) or
    (alimento_id is null and texto_pedido is not null and length(trim(texto_pedido)) > 0)
  )
);

comment on table public.despensa is
  'Lo que el asesorado tiene en casa. Presencia, no saldo: aqui no se descuenta nada. Ver 0024.';
comment on column public.despensa.cantidad_g is
  'Orientativa. Para que el staff vea el volumen de la compra, nunca para restar.';
comment on column public.despensa.texto_pedido is
  'Alimento que no estaba en el catalogo. Con esto puesto, el motor no usa la fila para calcular.';

create unique index if not exists despensa_cliente_id_unico
  on public.despensa (cliente_id);
comment on index public.despensa_cliente_id_unico is
  'No parcial a proposito: ON CONFLICT (cliente_id) no puede inferir un indice con WHERE. Ver 0023.';

-- Un alimento, una vez por persona. Volver a comprarlo lo refresca, no lo
-- duplica: es la misma regla que `agregar()` aplica en el dominio.
create unique index if not exists despensa_asesorado_alimento_unico
  on public.despensa (asesorado_id, alimento_id)
  where alimento_id is not null;

-- La consulta caliente: la despensa de una persona.
create index if not exists despensa_por_asesorado
  on public.despensa (asesorado_id, agregado_en desc);

-- ── Seguridad ────────────────────────────────────────────────────────────────

alter table public.despensa enable row level security;

revoke all on public.despensa from anon;

-- Aqui lectura y escritura SI son simetricas, al reves que en la 0018: la
-- despensa es de la persona y es ella quien mejor sabe lo que tiene en la
-- cocina. El staff la ve entera porque de eso depende lo que recomienda.
create policy despensa_cada_uno_la_suya on public.despensa
  for all to authenticated
  using (asesorado_id = (select auth.uid()) or (select public.es_staff()))
  with check (asesorado_id = (select auth.uid()) or (select public.es_staff()));

-- ── La cola de alimentos pedidos ─────────────────────────────────────────────

/*
 * Lo que falta por anadir al catalogo, agrupado.
 *
 * `security_invoker = true` NO es opcional: por defecto una vista corre con los
 * permisos de su duenio y se salta el RLS de la tabla de debajo, asi que esta
 * habria expuesto lo que come cada persona a cualquiera que la consultara. Con
 * el invoker activado, las politicas se aplican a quien pregunta.
 *
 * Agrupa por texto normalizado para que "Kefir" y "kefir " sean una peticion y
 * no dos, igual que `claveDe()` en el dominio.
 */
create or replace view public.alimentos_pedidos
  with (security_invoker = true) as
  select lower(trim(texto_pedido))          as pedido,
         count(*)                           as cuantos_lo_piden,
         min(agregado_en)                   as pedido_desde
    from public.despensa
   where alimento_id is null
     and texto_pedido is not null
   group by lower(trim(texto_pedido))
   order by count(*) desc, min(agregado_en);

comment on view public.alimentos_pedidos is
  'Cola de trabajo del staff: alimentos que alguien tiene y el catalogo no conoce.';
