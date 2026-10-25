// Lógica de Stock y ventas (Supabase). Las credenciales están en js/config.js
(function(){
var S={products:[],sales:[],expenses:[]};
var role="viewer";
var sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
var fBrand="",fVeh="",fLow=false,fKind="";
var pmode="pct",pval="",cpct="20";
var pay="efectivo",PAYS=[["efectivo","Efectivo"],["transferencia","Transferencia"],["tarjeta","Tarjeta de crédito"]],PL={};
PAYS.forEach(function(m){PL[m[0]]=m[1]});
var tab="inv",q="",cart={},editId=null,restockId=null;
var $=function(s){return document.querySelector(s)};
var money=function(n){return "$"+Number(n).toLocaleString("es",{minimumFractionDigits:2,maximumFractionDigits:2})};
var uid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})};
var find=function(id){return S.products.find(function(p){return p.id===id})};
function toast(t){var d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(function(){d.remove()},2200)}
function qcls(p){return p.stock<=0?"zero":(p.stock<=p.min?"low":"")}
function cur(){
  if(tab==="inv")return S.products.filter(function(p){return p.kind==="equipamiento"});
  if(tab==="acc")return S.products.filter(function(p){return p.kind==="accesorios"});
  return fKind?S.products.filter(function(p){return p.kind===fKind}):S.products;
}
function vehs(p){return (p.veh||"").split(",").map(function(x){return x.trim()}).filter(Boolean)}
function uniq(a){var m={};a.forEach(function(x){x=(x||"").trim();if(x&&!m[x.toLowerCase()])m[x.toLowerCase()]=x});return Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return a.localeCompare(b,"es")})}
function opts(a,sel){return a.map(function(x){return '<option'+(x.toLowerCase()===(sel||"").toLowerCase()?' selected':'')+'>'+esc(x)+'</option>'}).join("")}
function tags(p){return [p.brand,p.veh].filter(Boolean).map(esc).join(" · ")}
function norm(x){return (x||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}
function filtered(){var words=norm(q).split(/\s+/).filter(Boolean);return cur().filter(function(p){
  var hay=norm(p.name+" "+(p.brand||"")+" "+(p.veh||""));
  if(!words.every(function(w){return hay.indexOf(w)>-1}))return false;
  if(fBrand&&(p.brand||"").toLowerCase()!==fBrand.toLowerCase())return false;
  if(fVeh&&vehs(p).map(function(x){return x.toLowerCase()}).indexOf(fVeh.toLowerCase())<0)return false;
  if(fLow&&p.stock>p.min)return false;
  return true}).sort(function(a,b){return a.name.localeCompare(b.name,"es")})}

function render(){
  document.querySelectorAll("nav button").forEach(function(b){b.setAttribute("aria-selected",b.dataset.tab===tab)});
  var v=$("#view");
  if(tab==="inv"||tab==="acc")v.innerHTML=inv();else if(tab==="sell")v.innerHTML=sell();else if(tab==="exp")v.innerHTML=exp();else if(tab==="price")v.innerHTML=prices();else v.innerHTML=hist();
  if(tab==="price")pvFill();var s=$("#search");if(s){s.value=q;s.oninput=function(){q=s.value;var pos=s.selectionStart;render();var n=$("#search");n.focus();n.setSelectionRange(pos,pos)}}
}
function fbar(list,low){
  var lowN=cur().filter(function(p){return p.stock<=p.min}).length;
  var allV=[];cur().forEach(function(p){allV=allV.concat(vehs(p))});
  var h='<div class="row" style="flex-wrap:wrap">'+(low?'':'<select id="fkind" aria-label="Filtrar por tipo" style="flex:1;min-width:130px"><option value="">Equipamiento y accesorios</option><option value="equipamiento"'+(fKind==="equipamiento"?" selected":"")+'>Equipamiento</option><option value="accesorios"'+(fKind==="accesorios"?" selected":"")+'>Accesorios</option></select>')+'<select id="fbrand" aria-label="Filtrar por marca" style="flex:1;min-width:130px"><option value="">Todas las marcas</option>'+opts(uniq(cur().map(function(p){return p.brand})),fBrand)+'</select><select id="fveh" aria-label="Filtrar por vehículo" style="flex:1;min-width:130px"><option value="">Todos los vehículos</option>'+opts(uniq(allV),fVeh)+'</select></div>';
  h+='<div class="row" style="align-items:center">'+(low?'<button class="chip" data-a="low" aria-pressed="'+fLow+'">Stock bajo ('+lowN+')</button>':'')+((fBrand||fVeh||fLow||fKind||q)?'<button class="btn sm" data-a="reset">Limpiar filtros</button>':'')+'<span class="meta" style="margin-left:auto">'+list.length+' de '+cur().length+'</span><button class="btn sm" data-a="refresh">Actualizar</button></div>';
  return h;
}
function inv(){
  var units=0,val=0,low=0;cur().forEach(function(p){units+=p.stock;val+=p.stock*p.price;if(p.stock<=p.min)low++});
  var list=filtered();
  var h='<div class="stats"><div class="stat"><b>'+cur().length+'</b><span>Productos</span></div><div class="stat"><b>'+units+'</b><span>Unidades</span></div><div class="stat"><b>'+money(val)+'</b><span>Valor al precio de venta</span></div><div class="stat"><b>'+low+'</b><span>Con stock bajo</span></div></div>';
  if(fBrand||fVeh||fLow||q){var fu=0,fv=0;list.forEach(function(p){fu+=p.stock;fv+=p.stock*p.price});h+='<div class="meta" style="margin:-4px 0 10px;color:var(--muted)">Según los filtros: '+list.length+' productos · '+fu+' unidades · '+money(fv)+'</div>';}
  h+='<div class="row"><input id="search" type="search" placeholder="Buscar por nombre, marca o vehículo" aria-label="Buscar producto"><button class="btn primary" data-a="new">Nuevo producto</button></div>';
  h+=fbar(list,true);
  if(!list.length)h+='<div class="empty">'+(cur().length?"Ningún producto coincide con la búsqueda.":"Todavía no cargaste productos. Toca «Nuevo producto» para empezar.")+'</div>';
  list.forEach(function(p){
    h+='<div class="card"><div class="item"><div><div class="name">'+esc(p.name)+'</div>'+(tags(p)?'<div class="meta">'+tags(p)+'</div>':'')+'<div class="meta">'+money(p.price)+' c/u'+(p.stock<=p.min&&p.stock>0?" · stock bajo":"")+(p.stock<=0?" · agotado":"")+'</div></div><div class="qty '+qcls(p)+'">'+p.stock+'</div></div>'+
    '<div class="actions"><button class="btn sm primary" data-a="restock" data-id="'+p.id+'">Agregar stock</button><button class="btn sm" data-a="edit" data-id="'+p.id+'">Editar</button><button class="btn sm danger" data-a="del" data-id="'+p.id+'">Eliminar</button></div></div>';
  });
  return h;
}
function newPrice(p){
  var v=parseFloat(pval);if(isNaN(v))return null;
  var n=pmode==="pct"?p.price*(1+v/100):(pmode==="add"?p.price+v:v);
  n=Math.round(n*100)/100;
  return n<0?null:n;
}
function prices(){
  var list=filtered();
  var h='<div class="row"><input id="search" type="search" placeholder="Buscar por nombre, marca o vehículo" aria-label="Buscar producto"></div>';
  h+=fbar(list,false);
  h+='<div class="card"><h2>Cambiar precios de los productos filtrados</h2><div class="row" role="group" aria-label="Tipo de cambio">'+
    [["pct","Subir %"],["add","Sumar monto"],["set","Fijar precio"]].map(function(m){return '<button class="chip pay" style="flex:1" data-a="pmode" data-v="'+m[0]+'" aria-pressed="'+(pmode===m[0])+'">'+m[1]+'</button>'}).join("")+'</div>';
  h+='<label for="pval">'+(pmode==="pct"?"Porcentaje (con número negativo baja el precio)":(pmode==="add"?"Monto a sumar a cada precio ($)":"Nuevo precio para todos ($)"))+'</label><input id="pval" type="number" step="0.01" inputmode="decimal" value="'+esc(pval)+'">';
  h+='<div id="pvbox"></div></div><div id="pvlist" style="margin-top:12px"></div>';
  return h;
}
function pvFill(){
  var b=$("#pvbox"),L=$("#pvlist");if(!b||!L)return;
  var list=filtered(),hasVal=!isNaN(parseFloat(pval));
  var rows=list.map(function(p){return {p:p,n:newPrice(p)}});
  var ok=rows.filter(function(r){return r.n!==null&&r.n!==r.p.price});
  var bad=hasVal?rows.filter(function(r){return r.n===null}).length:0;
  var h='<div class="meta" style="margin:12px 0 6px;color:var(--muted)">'+(hasVal?(ok.length?ok.length+" de "+list.length+" productos cambian de precio.":"Con ese valor ningún precio cambia."):"Escribe un valor para ver cómo quedarían los precios.")+'</div>';
  if(bad)h+='<div class="meta" style="margin-bottom:6px;color:var(--bad)">'+bad+' productos quedarían con precio negativo y no se modifican.</div>';
  if(ok.length)h+='<div class="actions"><button class="btn primary" data-a="applyprices" style="flex:1">Aplicar a '+ok.length+' productos</button></div>';
  b.innerHTML=h;
  if(!list.length){L.innerHTML='<div class="empty">Ningún producto coincide con la búsqueda.</div>';return}
  L.innerHTML='<h2>Productos filtrados ('+list.length+')</h2>'+rows.slice(0,300).map(function(r){
    var ch=r.n!==null&&r.n!==r.p.price;
    return '<div class="card item"><div><div class="name">'+esc(r.p.name)+'</div>'+(tags(r.p)?'<div class="meta">'+tags(r.p)+'</div>':'')+'<div class="meta">Stock: '+r.p.stock+'</div></div><div style="text-align:right;white-space:nowrap">'+(ch?'<span class="meta" style="text-decoration:line-through">'+money(r.p.price)+'</span><br><b>'+money(r.n)+'</b>':'<b>'+money(r.p.price)+'</b>')+'</div></div>';
  }).join("")+(rows.length>300?'<div class="meta" style="text-align:center">…y '+(rows.length-300)+' más. Usa los filtros para acotar la lista.</div>':'');
}
function pct(){var v=parseFloat(String(cpct).replace(",","."));return isNaN(v)||v<0?0:v}
function card(x){return Math.round(x*(1+pct()/100)*100)/100}
function cartCard(){var t=0;Object.keys(cart).forEach(function(id){var p=find(id);if(p)t+=card(p.price)*cart[id]});return t}
function cardNote(x){return pay==="tarjeta"?' <b style="color:var(--accent)">→ '+money(card(x))+' con tarjeta</b>':''}
function payBar(){
  var on=pay==="tarjeta";
  return '<div class="row" style="flex-wrap:wrap" role="group" aria-label="Forma de pago">'+
    PAYS.filter(function(m){return m[0]!=="tarjeta"}).map(function(m){return '<button class="chip pay" style="flex:1 1 40%" data-a="pay" data-v="'+m[0]+'" aria-pressed="'+(pay===m[0])+'">'+m[1]+'</button>'}).join("")+
    '<div class="chip pay cardchip" style="flex:1 1 100%" data-a="pay" data-v="tarjeta" data-on="'+on+'"><button type="button" aria-pressed="'+on+'">Tarjeta de crédito  +</button><input id="cpct" type="text" inputmode="decimal" value="'+esc(cpct)+'" aria-label="Porcentaje de recargo con tarjeta"'+(on?'':' readonly')+'><span>%</span></div></div>';
}
function cartTotal(){var t=0;Object.keys(cart).forEach(function(id){var p=find(id);if(p)t+=p.price*cart[id]});return t}
function sell(){
  var list=filtered();
  var h='<div class="row"><input id="search" type="search" placeholder="Buscar por nombre, marca o vehículo" aria-label="Buscar producto"></div>';
  h=payBar()+h;
  h+=fbar(list,false);
  if(!list.length)h+='<div class="empty">'+(S.products.length?"Ningún producto coincide.":"Primero carga productos en Equipamiento o Accesorios.")+'</div>';
  list.forEach(function(p){
    var inCart=cart[p.id]||0;
    h+='<div class="card item"><div><div class="name">'+esc(p.name)+'</div>'+(tags(p)?'<div class="meta">'+tags(p)+'</div>':'')+'<div class="meta">'+money(p.price)+cardNote(p.price)+' · disponibles: '+(p.stock-inCart)+'</div></div><button class="btn sm primary" data-a="add" data-id="'+p.id+'"'+(p.stock-inCart<=0?" disabled":"")+'>Agregar</button></div>';
  });
  var ids=Object.keys(cart).filter(function(id){return find(id)});
  if(ids.length){
    h+='<div class="cart"><h2>Venta actual</h2>';
    ids.forEach(function(id){var p=find(id);
      h+='<div class="line"><div><div class="name">'+esc(p.name)+'</div>'+(tags(p)?'<div class="meta">'+tags(p)+'</div>':'')+'<div class="meta">'+money(p.price*cart[id])+(pay==="tarjeta"?' <b style="color:var(--accent)">→ '+money(card(p.price)*cart[id])+'</b>':'')+'</div></div><div class="step"><button data-a="dec" data-id="'+id+'" aria-label="Quitar uno">−</button><b>'+cart[id]+'</b><button data-a="inc" data-id="'+id+'" aria-label="Agregar uno"'+(cart[id]>=p.stock?" disabled":"")+'>+</button></div></div>'});
    h+='<div class="meta" style="margin-top:8px">Forma de pago: <b>'+PL[pay]+(pay==="tarjeta"?' (+'+pct()+'%)':'')+'</b></div>';
    h+='<div class="total"><span>Total</span><span>'+money(cartTotal())+'</span></div>'+(pay==="tarjeta"?'<div class="total" style="margin:-4px 0 6px;font-size:17px;color:var(--accent)"><span>Total con tarjeta (+'+pct()+'%)</span><span>'+money(cartCard())+'</span></div><div class="meta" style="margin-bottom:8px">El recargo solo se muestra: la venta se registra al precio normal.</div>':'')+'<div class="actions"><button class="btn primary" data-a="checkout" style="flex:1">Registrar venta</button><button class="btn" data-a="clear">Vaciar</button></div></div>';
  }
  return h;
}
function hist(){
  var tot=0,n=0,by={};S.sales.forEach(function(s){if(!s.void){tot+=s.total;n++;by[s.pay]=(by[s.pay]||0)+s.total}});
  var h='<div class="stats"><div class="stat"><b>'+n+'</b><span>Ventas</span></div><div class="stat"><b>'+money(tot)+'</b><span>Total vendido</span></div></div>';
  h+='<div class="stats" style="grid-template-columns:repeat(3,1fr)">'+PAYS.map(function(m){return '<div class="stat"><b style="font-size:16px">'+money(by[m[0]]||0)+'</b><span>'+m[1]+'</span></div>'}).join("")+'</div>';
  if(!S.sales.length)return h+'<div class="empty">Todavía no registraste ventas.</div>';
  S.sales.slice().reverse().forEach(function(s){
    var d=new Date(s.date).toLocaleString("es",{dateStyle:"medium",timeStyle:"short"});
    h+='<div class="card sale"><div class="top"><span class="'+(s.void?"void":"")+'">'+money(s.total)+'</span><span class="meta">'+d+' · '+(PL[s.pay]||"")+'</span></div><div class="meta '+(s.void?"void":"")+'">'+s.items.map(function(i){return i.qty+" × "+esc(i.name)+(tags(i)?" ("+tags(i)+")":"")}).join("<br>")+'</div>'+
    (s.void?'<div class="meta">Anulada · el stock se devolvió</div>':'<div class="actions"><button class="btn sm" data-a="editprices" data-id="'+s.id+'">Editar precios</button><button class="btn sm danger" data-a="void" data-id="'+s.id+'">Anular y devolver stock</button></div>')+'</div>';
  });
  return h;
}

function exp(){
  var g=0,v=0;S.expenses.forEach(function(x){g+=x.amount});S.sales.forEach(function(s){if(!s.void)v+=s.total});
  var r=v-g;
  var h='<div class="stats"><div class="stat"><b>'+money(v)+'</b><span>Ventas</span></div><div class="stat"><b>'+money(g)+'</b><span>Gastos</span></div><div class="stat"><b'+(r<0?' style="color:var(--bad)"':'')+'>'+money(r)+'</b><span>Ventas menos gastos</span></div></div>';
  h+='<div class="row"><button class="btn primary" data-a="newexp" style="flex:1">Nuevo gasto</button></div>';
  if(!S.expenses.length)return h+'<div class="empty">Todavía no registraste gastos. Toca «Nuevo gasto» para cargar el primero.</div>';
  S.expenses.slice().sort(function(a,b){return b.date.localeCompare(a.date)}).forEach(function(x){
    var d=new Date(x.date+"T00:00").toLocaleDateString("es",{dateStyle:"medium"});
    h+='<div class="card item"><div><div class="name">'+esc(x.desc)+'</div><div class="meta">'+esc(x.cat)+' · '+d+'</div></div><div style="text-align:right"><div class="name">'+money(x.amount)+'</div><button class="btn sm danger" data-a="delexp" data-id="'+x.id+'" style="margin-top:4px">Eliminar</button></div></div>';
  });
  return h;
}

function msg(e){return (e&&e.message)||"Error inesperado"}
function ck(r){if(r.error)throw r.error;return r}
async function load(){
  var r=await Promise.all([
    sb.from("products").select("*").order("name"),
    sb.from("sales").select("*, sale_items(*)").order("created_at",{ascending:false}).limit(1000),
    sb.from("expenses").select("*").order("date",{ascending:false}).limit(1000)]);
  r.forEach(ck);
  S.products=r[0].data.map(function(p){return {id:p.id,name:p.name,price:Number(p.price),stock:p.stock,min:p.min_stock,brand:p.brand||"",veh:p.vehicle||"",kind:p.category||"equipamiento"}});
  var bl=document.querySelector("#brands");if(bl)bl.innerHTML=uniq(S.products.map(function(p){return p.brand})).map(function(b){return '<option value="'+esc(b)+'">'}).join("");
  S.sales=r[1].data.map(function(x){return {id:x.id,date:x.created_at,total:Number(x.total),void:x.void,pay:x.payment_method||"efectivo",items:x.sale_items.map(function(i){return {rid:i.id,id:i.product_id,name:i.name,qty:i.qty,price:Number(i.price),brand:i.brand||"",veh:i.vehicle||""}})}}).reverse();
  S.expenses=r[2].data.map(function(x){return {id:x.id,desc:x.description,cat:x.category,amount:Number(x.amount),date:x.date}});
  render();
}
var sub=null,tm=null;
function soon(){clearTimeout(tm);tm=setTimeout(function(){load().catch(function(e){toast(msg(e))})},300)}
function listen(){if(sub)return;sub=sb.channel("cambios");(role==="admin"?["products","sales","expenses"]:["products"]).forEach(function(t){sub.on("postgres_changes",{event:"*",schema:"public",table:t},soon)});sub.subscribe()}
async function start(session){
  if(!session){sb.removeAllChannels();sub=null;S={products:[],sales:[],expenses:[]};$("#app").hidden=true;$("#auth").hidden=false;document.body.removeAttribute("data-role");return}
  $("#auth").hidden=true;$("#app").hidden=false;
  var pr=await sb.from("profiles").select("role").eq("user_id",session.user.id).maybeSingle();
  role=(pr.data&&pr.data.role)||"viewer";
  document.body.dataset.role=role;
  document.querySelectorAll("nav button").forEach(function(b){b.style.display=(role==="admin"||b.dataset.tab==="inv"||b.dataset.tab==="acc")?"":"none"});
  if(role!=="admin")tab="inv";
  $("#sync").textContent=session.user.email+(role==="admin"?" · Administración":" · Consulta");
  listen();
  try{await load()}catch(e){toast(msg(e))}
}
sb.auth.onAuthStateChange(function(ev,session){setTimeout(function(){start(session)},0)});
$("#aform").addEventListener("submit",async function(e){
  e.preventDefault();$("#aerr").textContent="";
  var r=await sb.auth.signInWithPassword({email:$("#aemail").value.trim(),password:$("#apass").value});
  if(r.error)$("#aerr").textContent="Correo o contraseña incorrectos";
});
$("#backup").onclick=function(){sb.auth.signOut()};

document.addEventListener("input",function(e){
  if(e.target.id==="pval"){pval=e.target.value;pvFill()}
  else if(e.target.id==="cpct"){
    var pos=e.target.selectionStart;cpct=e.target.value.replace(/[^0-9.,]/g,"");render();
    var n=$("#cpct");if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}
  }
});
document.addEventListener("change",function(e){
  if(e.target.id==="fbrand"){fBrand=e.target.value;render()}
  else if(e.target.id==="fveh"){fVeh=e.target.value;render()}
  else if(e.target.id==="fkind"){fKind=e.target.value;render()}
});
document.addEventListener("click",async function(e){
  if(e.target.id==="cpct"&&pay==="tarjeta")return;
  var t=e.target.closest("[data-tab],[data-a]");if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;q="";fBrand="";fVeh="";fLow=false;fKind="";pval="";render();return}
  var a=t.dataset.a,id=t.dataset.id,p=id&&find(id);
  try{
    if(a==="new"){editId=null;$("#ptitle").textContent=tab==="acc"?"Nuevo accesorio":"Nuevo equipamiento";$("#pform").reset();$("#pmin").value=3;$("#pdlg").showModal()}
    else if(a==="edit"&&p){editId=id;$("#ptitle").textContent="Editar producto";$("#pname").value=p.name;$("#pbrand").value=p.brand;$("#pveh").value=p.veh;$("#pprice").value=p.price;$("#pstock").value=p.stock;$("#pmin").value=p.min;$("#pdlg").showModal()}
    else if(a==="restock"&&p){restockId=id;$("#rtitle").textContent="Agregar stock: "+p.name;$("#rform").reset();$("#rdlg").showModal()}
    else if(a==="del"&&p){if(confirm("¿Eliminar «"+p.name+"»? Las ventas pasadas se conservan.")){ck(await sb.from("products").delete().eq("id",id));delete cart[id];await load()}}
    else if(a==="add"&&p){if((cart[id]||0)<p.stock){cart[id]=(cart[id]||0)+1;render()}}
    else if(a==="inc"&&p){if(cart[id]<p.stock){cart[id]++;render()}}
    else if(a==="dec"){cart[id]--;if(cart[id]<=0)delete cart[id];render()}
    else if(a==="clear"){cart={};render()}
    else if(a==="low"){fLow=!fLow;render()}
    else if(a==="pay"){pay=t.dataset.v;render()}
    else if(a==="refresh"){await load();toast("Datos actualizados")}
    else if(a==="pmode"){pmode=t.dataset.v;render()}
    else if(a==="applyprices"){
      var rows=filtered().map(function(p){return {id:p.id,price:newPrice(p)}}).filter(function(r){return r.price!==null&&r.price!==find(r.id).price});
      if(!rows.length)return;
      if(confirm("¿Cambiar el precio de "+rows.length+" productos? Las ventas ya registradas no cambian.")){
        t.disabled=true;
        ck(await sb.rpc("update_prices",{p_updates:rows}));
        pval="";await load();toast("Precios actualizados en "+rows.length+" productos");
      }
    }
    else if(a==="reset"){fBrand="";fVeh="";fLow=false;fKind="";q="";render()}
    else if(a==="checkout"){
      var items=Object.keys(cart).map(function(k){return {product_id:k,qty:cart[k]}});
      if(!items.length)return;
      var tot=cartTotal();
      t.disabled=true;
      ck(await sb.rpc("create_sale",{p_items:items,p_payment:pay}));
      cart={};pay="efectivo";await load();toast("Venta registrada: "+money(tot));
    }
    else if(a==="editprices"){
      var sl=S.sales.find(function(x){return x.id===id});
      if(sl&&!sl.void){editSale=id;
        $("#slist").innerHTML=sl.items.map(function(i){return '<label for="pr'+i.rid+'">'+i.qty+' × '+esc(i.name)+(tags(i)?' ('+tags(i)+')':'')+'</label><input id="pr'+i.rid+'" data-rid="'+i.rid+'" type="number" min="0" step="0.01" inputmode="decimal" value="'+i.price+'" required>'}).join("");
        $("#sdlg").showModal()}
    }
    else if(a==="void"){if(confirm("¿Anular esta venta y devolver las unidades al stock?")){ck(await sb.rpc("void_sale",{p_sale_id:id}));await load();toast("Venta anulada")}}
    else if(a==="newexp"){$("#eform").reset();$("#edate").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);$("#edlg").showModal()}
    else if(a==="delexp"){if(confirm("¿Eliminar este gasto?")){ck(await sb.from("expenses").delete().eq("id",id));await load()}}
  }catch(err){toast(msg(err));load().catch(function(){})}
});
$("#pform").addEventListener("submit",async function(e){
  if(e.submitter&&e.submitter.value!=="ok")return;
  var d={name:$("#pname").value.trim(),brand:$("#pbrand").value.trim(),vehicle:$("#pveh").value.trim(),price:parseFloat($("#pprice").value)||0,stock:parseInt($("#pstock").value,10)||0,min_stock:parseInt($("#pmin").value,10)||0};
  if(!d.name)return;
  try{
    if(editId)ck(await sb.from("products").update(d).eq("id",editId));else ck(await sb.from("products").insert(Object.assign({category:tab==="acc"?"accesorios":"equipamiento"},d)));
    await load();
  }catch(err){toast(msg(err))}
});
$("#rform").addEventListener("submit",async function(e){
  if(e.submitter&&e.submitter.value!=="ok")return;
  var n=parseInt($("#rqty").value,10);
  if(!(n>0))return;
  try{ck(await sb.rpc("add_stock",{p_id:restockId,p_qty:n}));await load();toast("+"+n+" unidades")}catch(err){toast(msg(err))}
});
var editSale=null;
$("#sform").addEventListener("submit",async function(e){
  if(e.submitter&&e.submitter.value!=="ok")return;
  var prices=[].map.call(document.querySelectorAll("#slist input"),function(x){return {item_id:x.dataset.rid,price:parseFloat(x.value)}});
  if(!prices.length||prices.some(function(x){return !(x.price>=0)}))return;
  try{ck(await sb.rpc("update_sale_prices",{p_sale_id:editSale,p_prices:prices}));await load();toast("Precios actualizados")}catch(err){toast(msg(err))}
});
$("#eform").addEventListener("submit",async function(e){
  if(e.submitter&&e.submitter.value!=="ok")return;
  var am=parseFloat($("#eamt").value),d=$("#edesc").value.trim();
  if(!d||!(am>0))return;
  try{ck(await sb.from("expenses").insert({description:d,category:$("#ecat").value,amount:am,date:$("#edate").value}));await load();toast("Gasto registrado: "+money(am))}catch(err){toast(msg(err))}
});
})();
