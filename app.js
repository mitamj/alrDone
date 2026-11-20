import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { catalog, familySeries, otherCollections } from "./catalog.js";

// 1) Replace these two values with your Supabase Project URL and anon/publishable key.
const SUPABASE_URL = "https://awqfglkuvawvwbvyuyjk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mXuEy_kf5wzAE8RK8AWM6w_Teh1IAmN";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
let entries = [];
let currentUser = null;
let editingId = null;

const today = new Date();
const localDate = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10);
$("workDate").value = localDate(today);
$("filterMonth").value = localDate(today).slice(0,7);
$("recapMonth").value = localDate(today).slice(0,7);

function say(id, message){ $(id).textContent = message; }
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function duration(t){
  if(t.manual_hours !== null && t.manual_hours !== undefined && t.manual_hours !== "") return Math.max(0, Number(t.manual_hours));
  if(!t.start_time || !t.end_time) return 0;
  const [h,m] = t.start_time.split(":").map(Number), [eh,em] = t.end_time.split(":").map(Number);
  let mins = eh*60+em-h*60-m; if(mins<0) mins+=1440; return mins/60;
}
function fmt(n){ return Number(n).toLocaleString("id-ID",{maximumFractionDigits:2})+" h"; }

function fillSelect(el, values, placeholder){
  el.innerHTML = `<option value="">${esc(placeholder)}</option>` + values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
}
function refreshProducts(){
  const category = $("category").value;
  const collection = category === "Series" ? $("family").value : $("collection").value;
  const list = catalog[collection] || [];
  fillSelect($("product"), list, collection ? "Choose product" : "Choose a collection first");
  $("product").disabled = !collection;
}
function refreshCategory(){
  const c = $("category").value;
  $("familyWrap").hidden = c !== "Series";
  $("collectionWrap").hidden = c !== "Other collection";
  $("productWrap").hidden = !["Series","Other collection"].includes(c);
  $("customWrap").hidden = !["General content","Other"].includes(c);
  if(c === "Other collection") fillSelect($("collection"), otherCollections, "Choose other collection");
  if(c === "Series") fillSelect($("family"), familySeries, "Choose family series");
  refreshProducts();
}
fillSelect($("family"), familySeries, "Choose family series");
$("category").addEventListener("change", refreshCategory);
$("family").addEventListener("change", refreshProducts);
$("collection").addEventListener("change", refreshProducts);
refreshCategory();

async function showSession(){
  if(!supabase){ $("authPanel").hidden=false; $("appPanel").hidden=true; say("authMessage","Masukkan URL dan anon/publishable key Supabase ke app.js terlebih dahulu."); return; }
  const {data:{session}} = await supabase.auth.getSession();
  currentUser = session?.user ?? null;
  $("authPanel").hidden = !!currentUser;
  $("appPanel").hidden = !currentUser;
  if(currentUser){ $("userEmail").textContent=currentUser.email; await loadEntries(); }
}
$("signInBtn").onclick = async()=>{
  const {error}=await supabase.auth.signInWithPassword({email:$("authEmail").value,password:$("authPassword").value});
  say("authMessage",error?.message || "Signed in."); if(!error) await showSession();
};
$("signUpBtn").onclick = async()=>{
  const {data,error}=await supabase.auth.signUp({email:$("authEmail").value,password:$("authPassword").value});
  say("authMessage",error?.message || (data.session ? "Account created." : "Account created. Check your email to confirm, then sign in."));
  if(data.session) await showSession();
};
$("signOutBtn").onclick = async()=>{await supabase.auth.signOut();entries=[];await showSession();};
if(supabase) supabase.auth.onAuthStateChange(()=>showSession());

async function loadEntries(){
  const {data,error}=await supabase.from("work_entries").select("*").order("work_date",{ascending:false}).order("created_at",{ascending:false});
  if(error){say("entryMessage","Could not load entries: "+error.message);return;}
  entries=data||[];render();
}
$("saveEntry").onclick = async()=>{
  const title=$("title").value.trim(), category=$("category").value;
  const start=$("startTime").value||null,end=$("endTime").value||null,manual=$("manualHours").value;
  if(!title){say("entryMessage","Work title wajib diisi.");return;}
  if(!manual && (!start||!end)){say("entryMessage","Isi start/end time atau manual duration.");return;}
  const collection=category==="Series"?$("family").value:category==="Other collection"?$("collection").value:$("customName").value.trim();
  if(["Series","Other collection"].includes(category)&&!collection){say("entryMessage","Pilih series atau collection terlebih dahulu.");return;}
  const product=["Series","Other collection"].includes(category)?($("productManual").value.trim()||$("product").value):null;
  const payload={
    user_id:currentUser.id,work_date:$("workDate").value,title,category,collection:collection||null,
    product:product||null,format:$("format").value,start_time:start,end_time:end,
    manual_hours:manual===""?null:Number(manual),status:$("status").value,notes:$("notes").value.trim()||null
  };
  const {error}=await supabase.from("work_entries").insert(payload);
  if(error){say("entryMessage","Save failed: "+error.message);return;}
  ["title","startTime","endTime","manualHours","notes","productManual","customName"].forEach(id=>$(id).value="");
  $("status").value="In progress";say("entryMessage","Entry saved.");await loadEntries();
};

function filtered(){
  const month=$("filterMonth").value,cat=$("filterCategory").value,q=$("search").value.toLowerCase();
  return entries.filter(t=>(!month||t.work_date?.startsWith(month))&&(!cat||t.category===cat)&&
    [t.title,t.collection,t.product,t.format,t.notes].join(" ").toLowerCase().includes(q));
}
function render(){
  const total=entries.reduce((a,t)=>a+duration(t),0);
  $("statTasks").textContent=entries.length;$("statHours").textContent=total.toLocaleString("id-ID",{maximumFractionDigits:1});
  $("statDone").textContent=entries.filter(t=>t.status==="Completed").length;
  const rows=filtered();
  $("entries").innerHTML=rows.length?rows.map(t=>`
    <article class="entry">
      <div class="entryhead"><div><div class="entrytitle">${esc(t.title)}</div><div class="entrymeta">${esc(t.work_date)} · ${esc(t.start_time||"--:--")}–${esc(t.end_time||"--:--")}</div></div><b>${fmt(duration(t))}</b></div>
      <div class="tags"><span class="tag">${esc(t.category)}</span>${t.collection?`<span class="tag">${esc(t.collection)}</span>`:""}${t.product?`<span class="tag">${esc(t.product)}</span>`:""}<span class="tag">${esc(t.format)}</span><span class="tag">${esc(t.status)}</span></div>
      ${t.notes?`<div class="entrynotes">${esc(t.notes)}</div>`:""}
      <div class="entrybuttons"><button class="ghost" data-edit="${t.id}">Edit</button><button class="ghost" data-delete="${t.id}">Delete</button></div>
    </article>`).join(""):"<p class='muted'>Belum ada entry untuk filter ini.</p>";
  renderRecap();
}
function renderBars(target,rows){
  const groups={};rows.forEach(t=>{const key=t[target]||"Unspecified";groups[key]=(groups[key]||0)+duration(t);});
  const max=Math.max(1,...Object.values(groups));
  return Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="barrow"><div class="barlabel"><span>${esc(k)}</span><b>${fmt(v)}</b></div><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join("")||"<p class='muted'>No data yet.</p>";
}
function renderRecap(){
  const month=$("recapMonth").value,rows=entries.filter(t=>!month||t.work_date?.startsWith(month));
  $("recapHours").textContent=fmt(rows.reduce((a,t)=>a+duration(t),0));
  $("recapDone").textContent=rows.filter(t=>t.status==="Completed").length;
  $("activityBreakdown").innerHTML=renderBars("format",rows);
  $("collectionBreakdown").innerHTML=renderBars("collection",rows);
  const counts={};rows.forEach(t=>counts[t.status]=(counts[t.status]||0)+1);
  $("statusBreakdown").innerHTML=Object.entries(counts).map(([k,v])=>`<div class="barlabel"><span>${esc(k)}</span><b>${v}</b></div>`).join("")||"<p class='muted'>No data yet.</p>";
}
["filterMonth","filterCategory","search","recapMonth"].forEach(id=>$(id).addEventListener("input",render));

$("entries").addEventListener("click",async e=>{
  const del=e.target.closest("[data-delete]"),edit=e.target.closest("[data-edit]");
  if(del && confirm("Delete this entry?")){
    const {error}=await supabase.from("work_entries").delete().eq("id",del.dataset.delete);
    if(error) alert(error.message); else await loadEntries();
  }
  if(edit){
    const t=entries.find(x=>x.id===edit.dataset.edit);if(!t)return;
    const title=prompt("Edit work title",t.title);if(title===null)return;
    const status=prompt("Status: In progress / Completed / On hold",t.status);if(status===null)return;
    const notes=prompt("Notes",t.notes||"");if(notes===null)return;
    const {error}=await supabase.from("work_entries").update({title,status,notes}).eq("id",t.id);
    if(error)alert(error.message);else await loadEntries();
  }
});

document.querySelectorAll("#ainayya-tracker-starter .tab");
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
  ["entry","log","recap"].forEach(k=>$(k+"Tab").hidden=k!==btn.dataset.tab);
}));
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$("exportCsv").onclick=()=>{
  const cols=["work_date","title","category","collection","product","format","start_time","end_time","hours","status","notes"];
  const rows=[cols,...entries.map(t=>cols.map(k=>k==="hours"?duration(t):t[k]??""))];
  download("ainayya-work-log.csv","\uFEFF"+rows.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\r\n"),"text/csv;charset=utf-8");
};
$("exportJson").onclick=()=>download("ainayya-backup.json",JSON.stringify(entries,null,2),"application/json");
showSession();
