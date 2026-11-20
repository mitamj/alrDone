import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Keep the browser key publishable/anon only. Never put service_role here.
const SUPABASE_URL = "https://awqfglkuvawvwbvyuyjk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_mXuEy_kf5wzAE8RK8AWM6w_Teh1IAmN";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
let entries = [], currentUser = null, collections = [], products = [];

const today = new Date();
const localDate = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$("workDate").value = localDate(today);
$("filterMonth").value = localDate(today).slice(0, 7);
$("recapMonth").value = localDate(today).slice(0, 7);

function say(id, message) { $(id).textContent = message; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function duration(t) {
  if (t.manual_hours !== null && t.manual_hours !== undefined && t.manual_hours !== "") return Math.max(0, Number(t.manual_hours));
  if (!t.start_time || !t.end_time) return 0;
  const [h, m] = t.start_time.split(":").map(Number), [eh, em] = t.end_time.split(":").map(Number);
  let mins = eh * 60 + em - h * 60 - m; if (mins < 0) mins += 1440; return mins / 60;
}
function fmt(n) { return Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " h"; }
function activity() { return $("activityType").value; }

function refreshActivityFields() {
  const a = activity();
  $("postingFields").hidden = a !== "Content Posting";
  $("meetingFields").hidden = a !== "Meeting";
  $("shootFields").hidden = a !== "On-site Photoshoot / Videography";
  $("otherFields").hidden = a !== "Other Tasks";
}
$("activityType").addEventListener("change", refreshActivityFields);
refreshActivityFields();

function optionHtml(items, placeholder, selected = "") {
  return `<option value="">${esc(placeholder)}</option>` + items.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(selected) ? "selected" : ""}>${esc(x.name)}${x.status === "Upcoming" ? " · Upcoming" : ""}</option>`).join("");
}
function refreshCollectionSelects() {
  const online = collections.filter(c => c.status !== "Archived");
  $("collectionSelect").innerHTML = optionHtml(online, "Choose collection / series");
  $("shootCollectionSelect").innerHTML = optionHtml(online, "Unassigned / general shoot");
  refreshProducts();
}
function refreshProducts() {
  const collectionId = $("collectionSelect").value;
  const list = products.filter(p => String(p.collection_id || "") === String(collectionId));
  $("productSelect").innerHTML = optionHtml(list, collectionId ? "Choose product (optional)" : "Choose a collection first");
  $("productSelect").disabled = !collectionId;
  $("addProductBtn").disabled = !collectionId;
}
$("collectionSelect").addEventListener("change", refreshProducts);

async function loadCatalog() {
  const [c, p, sync] = await Promise.all([
    supabase.from("catalog_collections").select("id,name,status,source,source_key").order("name"),
    supabase.from("catalog_products").select("id,name,collection_id,source,source_key,product_url").order("name"),
    supabase.from("catalog_sync_runs").select("finished_at,items_count").order("finished_at", { ascending: false }).limit(1)
  ]);
  if (c.error || p.error) {
    say("catalogStatus", "Catalog database belum siap. Jalankan migration supabase.sql terlebih dahulu. " + (c.error?.message || p.error?.message || ""));
    collections = []; products = [];
  } else {
    collections = c.data || []; products = p.data || [];
    const last = sync.data?.[0]?.finished_at;
    say("catalogStatus", last ? `Online catalog last synced: ${new Date(last).toLocaleString("id-ID")}` : "Catalog loaded. Automatic website sync starts after the Cloudflare Worker is deployed.");
  }
  refreshCollectionSelects();
}

async function addUpcomingCollection(target = "posting") {
  const name = prompt("Upcoming collection / series name:");
  if (!name?.trim()) return null;
  const { data, error } = await supabase.from("catalog_collections").insert({ name: name.trim(), status: "Upcoming", source: "manual", source_key: `manual:${name.trim().toLowerCase()}`, created_by: currentUser.id }).select("id,name,status,source,source_key").single();
  if (error) { alert("Could not add collection: " + error.message); return null; }
  collections.push(data); collections.sort((a, b) => a.name.localeCompare(b.name)); refreshCollectionSelects();
  if (target === "shoot") $("shootCollectionSelect").value = data.id; else $("collectionSelect").value = data.id;
  refreshProducts(); return data;
}
$("addCollectionBtn").onclick = () => addUpcomingCollection("posting");
$("addShootCollectionBtn").onclick = () => addUpcomingCollection("shoot");
$("addProductBtn").onclick = async () => {
  const collectionId = $("collectionSelect").value;
  if (!collectionId) return;
  const name = prompt("Product name (you can add it before it appears online):");
  if (!name?.trim()) return;
  const { data, error } = await supabase.from("catalog_products").insert({ name: name.trim(), collection_id: collectionId, source: "manual", source_key: `manual:${collectionId}:${name.trim().toLowerCase()}`, created_by: currentUser.id }).select("id,name,collection_id,source,source_key,product_url").single();
  if (error) { alert("Could not add product: " + error.message); return; }
  products.push(data); refreshProducts(); $("productSelect").value = data.id;
};

async function showSession() {
  if (!supabase) { $("authPanel").hidden = false; $("appPanel").hidden = true; say("authMessage", "Supabase configuration is missing."); return; }
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user ?? null;
  $("authPanel").hidden = !!currentUser; $("appPanel").hidden = !currentUser;
  if (currentUser) { $("userEmail").textContent = currentUser.email; await Promise.all([loadEntries(), loadCatalog()]); }
}
$("signInBtn").onclick = async () => {
  const { error } = await supabase.auth.signInWithPassword({ email: $("authEmail").value, password: $("authPassword").value });
  say("authMessage", error?.message || "Signed in."); if (!error) await showSession();
};
$("signUpBtn").onclick = async () => {
  const { data, error } = await supabase.auth.signUp({ email: $("authEmail").value, password: $("authPassword").value });
  say("authMessage", error?.message || (data.session ? "Account created." : "Account created. Check your email to confirm, then sign in."));
  if (data.session) await showSession();
};
$("signOutBtn").onclick = async () => { await supabase.auth.signOut(); entries = []; await showSession(); };
if (supabase) supabase.auth.onAuthStateChange(() => { showSession(); });

async function loadEntries() {
  const { data, error } = await supabase.from("work_entries").select("*").order("work_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) { say("entryMessage", "Could not load entries: " + error.message); return; }
  entries = data || []; render();
}
$("saveEntry").onclick = async () => {
  const title = $("title").value.trim(), a = activity();
  const start = $("startTime").value || null, end = $("endTime").value || null, manual = $("manualHours").value;
  if (!title) { say("entryMessage", "Work title wajib diisi."); return; }
  if (!manual && (!start || !end)) { say("entryMessage", "Isi start/end time atau manual duration."); return; }
  let collectionId = null, collectionName = null, productId = null, productName = null, format = a;
  if (a === "Content Posting") {
    collectionId = $("collectionSelect").value;
    if (!collectionId) { say("entryMessage", "Pilih collection untuk content posting."); return; }
    const c = collections.find(x => String(x.id) === String(collectionId)); collectionName = c?.name || null;
    productId = $("productSelect").value || null; productName = products.find(x => String(x.id) === String(productId))?.name || null;
    format = $("format").value;
  } else if (a === "Meeting") format = $("meetingType").value.trim() || "Meeting";
  else if (a === "On-site Photoshoot / Videography") {
    collectionId = $("shootCollectionSelect").value || null;
    collectionName = collections.find(x => String(x.id) === String(collectionId))?.name || null;
    format = $("shootType").value;
  } else format = $("otherType").value.trim() || "Other task";

  const payload = {
    user_id: currentUser.id, work_date: $("workDate").value, title, activity_type: a,
    category: a, collection: collectionName, collection_id: collectionId,
    product: productName, product_id: productId, format,
    shoot_type: a === "On-site Photoshoot / Videography" ? $("shootType").value : null,
    location: a === "On-site Photoshoot / Videography" ? $("shootLocation").value.trim() || null : null,
    participants: a === "Meeting" ? $("participants").value.trim() || null : null,
    deliverables: a === "On-site Photoshoot / Videography" ? $("deliverables").value.trim() || null : null,
    start_time: start, end_time: end, manual_hours: manual === "" ? null : Number(manual),
    status: $("status").value, notes: $("notes").value.trim() || null
  };
  const { error } = await supabase.from("work_entries").insert(payload);
  if (error) { say("entryMessage", "Save failed: " + error.message + ". Pastikan migration database terbaru sudah dijalankan."); return; }
  ["title", "startTime", "endTime", "manualHours", "notes", "meetingType", "participants", "shootLocation", "deliverables", "otherType"].forEach(id => $(id).value = "");
  $("status").value = "In progress"; say("entryMessage", "Entry saved."); await loadEntries();
};

function filtered() {
  const month = $("filterMonth").value, cat = $("filterCategory").value, q = $("search").value.toLowerCase();
  return entries.filter(t => (!month || t.work_date?.startsWith(month)) && (!cat || (t.activity_type || t.category) === cat) && [t.title, t.collection, t.product, t.format, t.notes, t.location, t.participants, t.deliverables].join(" ").toLowerCase().includes(q));
}
function render() {
  const total = entries.reduce((a, t) => a + duration(t), 0);
  $("statTasks").textContent = entries.length; $("statHours").textContent = total.toLocaleString("id-ID", { maximumFractionDigits: 1 });
  $("statDone").textContent = entries.filter(t => t.status === "Completed").length;
  const rows = filtered();
  $("entries").innerHTML = rows.length ? rows.map(t => `
    <article class="entry"><div class="entryhead"><div><div class="entrytitle">${esc(t.title)}</div><div class="entrymeta">${esc(t.work_date)} · ${esc(t.start_time || "--:--")}–${esc(t.end_time || "--:--")}</div></div><b>${fmt(duration(t))}</b></div>
    <div class="tags"><span class="tag">${esc(t.activity_type || t.category)}</span>${t.collection ? `<span class="tag">${esc(t.collection)}</span>` : ""}${t.product ? `<span class="tag">${esc(t.product)}</span>` : ""}<span class="tag">${esc(t.format)}</span><span class="tag">${esc(t.status)}</span></div>
    ${t.location ? `<div class="entrynotes">Location: ${esc(t.location)}</div>` : ""}${t.participants ? `<div class="entrynotes">Participants: ${esc(t.participants)}</div>` : ""}${t.deliverables ? `<div class="entrynotes">Deliverables: ${esc(t.deliverables)}</div>` : ""}${t.notes ? `<div class="entrynotes">${esc(t.notes)}</div>` : ""}
    <div class="entrybuttons"><button class="ghost" data-edit="${t.id}">Edit</button><button class="ghost" data-delete="${t.id}">Delete</button></div></article>`).join("") : "<p class='muted'>Belum ada entry untuk filter ini.</p>";
  renderRecap();
}
function renderBars(target, rows) {
  const groups = {}; rows.forEach(t => { const key = t[target] || "Unspecified"; groups[key] = (groups[key] || 0) + duration(t); });
  const max = Math.max(1, ...Object.values(groups));
  return Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="barrow"><div class="barlabel"><span>${esc(k)}</span><b>${fmt(v)}</b></div><div class="bar"><i style="width:${v / max * 100}%"></i></div></div>`).join("") || "<p class='muted'>No data yet.</p>";
}
function renderRecap() {
  const month = $("recapMonth").value, rows = entries.filter(t => !month || t.work_date?.startsWith(month));
  $("recapHours").textContent = fmt(rows.reduce((a, t) => a + duration(t), 0));
  $("recapDone").textContent = rows.filter(t => t.status === "Completed").length;
  $("activityBreakdown").innerHTML = renderBars("activity_type", rows.map(t => ({ ...t, activity_type: t.activity_type || t.category })));
  $("collectionBreakdown").innerHTML = renderBars("collection", rows);
  const counts = {}; rows.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  $("statusBreakdown").innerHTML = Object.entries(counts).map(([k, v]) => `<div class="barlabel"><span>${esc(k)}</span><b>${v}</b></div>`).join("") || "<p class='muted'>No data yet.</p>";
}
["filterMonth", "filterCategory", "search", "recapMonth"].forEach(id => $(id).addEventListener("input", render));

$("entries").addEventListener("click", async e => {
  const del = e.target.closest("[data-delete]"), edit = e.target.closest("[data-edit]");
  if (del && confirm("Delete this entry?")) {
    const { error } = await supabase.from("work_entries").delete().eq("id", del.dataset.delete);
    if (error) alert(error.message); else await loadEntries();
  }
  if (edit) {
    const t = entries.find(x => String(x.id) === edit.dataset.edit); if (!t) return;
    const title = prompt("Edit work title", t.title); if (title === null) return;
    const status = prompt("Status: In progress / Completed / On hold", t.status); if (status === null) return;
    const notes = prompt("Notes", t.notes || ""); if (notes === null) return;
    const { error } = await supabase.from("work_entries").update({ title, status, notes }).eq("id", t.id);
    if (error) alert(error.message); else await loadEntries();
  }
});

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
  ["entry", "log", "recap"].forEach(k => $(k + "Tab").hidden = k !== btn.dataset.tab);
}));
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
$("exportCsv").onclick = () => {
  const cols = ["work_date", "title", "activity_type", "collection", "product", "format", "shoot_type", "location", "participants", "deliverables", "start_time", "end_time", "hours", "status", "notes"];
  const rows = [cols, ...entries.map(t => cols.map(k => k === "hours" ? duration(t) : t[k] ?? ""))];
  download("ainayya-work-log.csv", "\uFEFF" + rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n"), "text/csv;charset=utf-8");
};
$("exportJson").onclick = () => download("ainayya-backup.json", JSON.stringify(entries, null, 2), "application/json");
showSession();
