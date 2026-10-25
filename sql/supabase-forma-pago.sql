-- Ejecutar en Supabase → SQL Editor → New query → Run (después de los demás archivos .sql).
-- Agrega la forma de pago a cada venta: efectivo, transferencia o tarjeta de crédito.
-- Las ventas anteriores quedan como "efectivo".
alter table sales add column if not exists payment_method text not null default 'efectivo';
alter table sales drop constraint if exists sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method in ('efectivo','transferencia','tarjeta'));

drop function if exists create_sale(jsonb);
create or replace function create_sale(p_items jsonb, p_payment text default 'efectivo') returns uuid
language plpgsql as $$
declare sid uuid; it jsonb; p products%rowtype; q int; tot numeric := 0; nm text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'La venta está vacía'; end if;
  if p_payment not in ('efectivo','transferencia','tarjeta') then raise exception 'Forma de pago inválida'; end if;
  insert into sales(total, user_email, payment_method)
    values (0, auth.jwt()->>'email', p_payment) returning id into sid;
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
