-- Ejecutar en Supabase → SQL Editor → New query → Run
-- (después de supabase.sql, supabase-roles.sql y supabase-marca-vehiculo.sql).
-- Cada venta guarda la descripción, la marca y el vehículo tal como estaban al vender.

alter table sale_items add column if not exists brand text not null default '';
alter table sale_items add column if not exists vehicle text not null default '';

-- Ventas anteriores: se completan con los datos actuales del producto (si todavía existe).
update sale_items si
set brand = p.brand, vehicle = p.vehicle
from products p
where si.product_id = p.id and si.brand = '' and si.vehicle = '';

create or replace function create_sale(p_items jsonb) returns uuid
language plpgsql as $$
declare sid uuid; it jsonb; p products%rowtype; q int; tot numeric := 0; nm text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'La venta está vacía'; end if;
  insert into sales(total, user_email) values (0, auth.jwt()->>'email') returning id into sid;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q <= 0 then raise exception 'Cantidad inválida'; end if;
    update products set stock = stock - q
      where id = (it->>'product_id')::uuid and stock >= q returning * into p;
    if not found then
      select name into nm from products where id = (it->>'product_id')::uuid;
      raise exception 'Stock insuficiente de %', coalesce(nm, 'un producto');
    end if;
    insert into sale_items(sale_id, product_id, name, brand, vehicle, qty, price)
      values (sid, p.id, p.name, p.brand, p.vehicle, q, p.price);
    tot := tot + q * p.price;
  end loop;
  update sales set total = tot where id = sid;
  return sid;
end $$;
