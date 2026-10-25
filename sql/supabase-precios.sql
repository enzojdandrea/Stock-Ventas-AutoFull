-- Ejecutar en Supabase → SQL Editor → New query → Run (después de los demás archivos .sql).
-- Permite a administración cambiar el precio de varios productos a la vez.
-- Todos los cambios se aplican juntos o ninguno. Las ventas ya registradas no se modifican.
create or replace function update_prices(p_updates jsonb) returns integer
language plpgsql as $$
declare n integer;
begin
  if not is_admin() then raise exception 'Solo administración puede cambiar precios'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_updates) as x(id uuid, price numeric)
    where x.price is null or x.price < 0
  ) then raise exception 'Precio inválido'; end if;
  update products p set price = round(x.price, 2)
  from jsonb_to_recordset(p_updates) as x(id uuid, price numeric)
  where p.id = x.id;
  get diagnostics n = row_count;
  return n;
end $$;
