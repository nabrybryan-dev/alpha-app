-- 0017 · Que el registro de comidas pueda subir desde el movil
--
-- POR QUE HACE FALTA. La 0015 dio a `registro_comida` y `registro_item` un id
-- `bigint generated always as identity`: lo pone el servidor al insertar. Eso
-- vale si el dispositivo esta conectado y puede esperar la respuesta, pero esta
-- app registra comida en el gimnasio y en la calle, con la conexion caida, y
-- guarda primero en local. Cuando un asesorado abre un almuerzo sin red y le
-- anade tres alimentos, esos tres items tienen que apuntar a un almuerzo que
-- TODAVIA NO EXISTE arriba. Sin un id puesto por el dispositivo no hay forma de
-- relacionarlos, y la comida subiria sin sus alimentos.
--
-- No se toca la 0015 -ya esta aplicada- ni se cambia la clave primaria: el
-- `bigint` sigue siendo la identidad dentro de la base. `cliente_id` es solo la
-- llave con la que el dispositivo reconoce lo que el mismo creo.
--
-- POR QUE BORRADO LOGICO Y NO DELETE. La cola de sync de la app solo sabe hacer
-- `upsert` y `update`. Anadirle un `delete` obliga a tocar el procesador, que
-- es la pieza donde un fallo no da error en pantalla: se encola en un sitio y
-- se drena de otro, y las escrituras desaparecen sin aviso. Un flag se marca
-- con el `update` que ya existe. Ademas deja rastro: el coach puede ver que un
-- alimento se anoto y se quito, que es informacion real sobre el dia.

begin;

-- ── Ids puestos por el dispositivo ───────────────────────────────────────────

alter table public.registro_comida add column if not exists cliente_id text;
alter table public.registro_item   add column if not exists cliente_id text;

-- El del item apunta a su comida por el id de cliente, no por el bigint: es lo
-- que permite subir una comida entera sin haber leido nunca lo que el servidor
-- le asigno.
alter table public.registro_item add column if not exists comida_cliente_id text;

-- Nulos a proposito: las filas que entren por SQL o desde el panel del coach no
-- tienen id de cliente y no lo necesitan. El indice es parcial para que esos
-- nulos no choquen entre si.
create unique index if not exists registro_comida_cliente_id_unico
  on public.registro_comida (cliente_id) where cliente_id is not null;

create unique index if not exists registro_item_cliente_id_unico
  on public.registro_item (cliente_id) where cliente_id is not null;

create index if not exists registro_item_por_comida_cliente
  on public.registro_item (comida_cliente_id) where comida_cliente_id is not null;

-- ── Borrado logico ───────────────────────────────────────────────────────────

alter table public.registro_comida add column if not exists borrado boolean not null default false;
alter table public.registro_item   add column if not exists borrado boolean not null default false;

-- Lo normal es leer solo lo vivo. El indice lo hace barato.
create index if not exists registro_comida_vivas
  on public.registro_comida (asesorado_id, momento desc) where not borrado;

-- ── Resolver la comida del item ──────────────────────────────────────────────

/*
 * Rellena `registro_id` a partir de `comida_cliente_id`.
 *
 * Corre BEFORE INSERT, y ese orden es lo que hace que funcione: en PostgreSQL
 * los triggers de fila se ejecutan ANTES de comprobar las restricciones, asi
 * que el `not null` de `registro_id` se valida ya con el valor puesto aqui. El
 * dispositivo puede entonces mandar el item sin conocer el bigint.
 *
 * NO es SECURITY DEFINER a proposito. Al consultar bajo el permiso de quien
 * inserta, las politicas RLS de `registro_comida` siguen aplicando: si el
 * `comida_cliente_id` es de otra persona, el select no la encuentra y el insert
 * falla. El aislamiento entre asesorados se sostiene solo, sin una comprobacion
 * aparte que alguien pueda olvidar.
 */
create or replace function public.resolver_comida_de_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.registro_id is null and new.comida_cliente_id is not null then
    select r.id into new.registro_id
      from public.registro_comida r
     where r.cliente_id = new.comida_cliente_id;

    if new.registro_id is null then
      raise exception 'no existe una comida con cliente_id %', new.comida_cliente_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists registro_item_resolver_comida on public.registro_item;
create trigger registro_item_resolver_comida
  before insert on public.registro_item
  for each row execute function public.resolver_comida_de_item();

-- `registro_id` se queda NOT NULL, sin tocar. No hace falta relajarlo: el
-- trigger corre antes de que la restriccion se compruebe, asi que para cuando
-- se valida el valor ya esta puesto. Debilitarlo "por si acaso" solo quitaria
-- la red de seguridad del dia que el trigger deje de estar.

commit;
