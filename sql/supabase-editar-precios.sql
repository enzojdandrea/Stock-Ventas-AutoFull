-- Ejecutar en Supabase → SQL Editor → New query → Run (después de los demás archivos .sql).
-- Permite a administración corregir los precios de una venta ya registrada.
-- El total se recalcula solo y el stock no se modifica. No funciona en ventas anuladas.
create or replace function update_sale_prices(p_sale_id uuid, p_prices jsonb) returns void
language plpgsql as $$
declare s sales%rowtype; it jsonb;
begin
  if not is_admin() then raise exception 'Solo administración puede editar precios'; end if;
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if s.void then raise exception 'No se puede editar una venta anulada'; end if;
  for it in select * from jsonb_array_elements(p_prices) loop
    if (it->>'price')::numeric < 0 then raise exception 'Precio inválido'; end if;
    update sale_items set price = (it->>'price')::numeric
      where id = (it->>'item_id')::uuid and sale_id = p_sale_id;
  end loop;
  update sales set total = coalesce((select sum(qty * price) from sale_items where sale_id = p_sale_id), 0)
    where id = p_sale_id;
end $$;
