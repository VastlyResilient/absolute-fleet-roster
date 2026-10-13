import { SOURCE_RECORDS } from "./data.js";

const STORAGE_KEY = "absolute-fleet-roster.v1";
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const cloneSource = () => SOURCE_RECORDS.map((record) => ({ ...record }));
const loadRecords = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) && stored.length ? stored : cloneSource();
  } catch {
    return cloneSource();
  }
};

let records = loadRecords();
let activeId = null;
let metricsAnimated = false;
const CATEGORIES = [
  "Sedan",
  "SUV / crossover",
  "Minivan",
  "Passenger van",
  "Accessible",
  "Limousine",
  "Electric",
];
const state = {
  query: "",
  category: "",
  owner: "",
  make: "",
  status: "",
  sort: "year-desc",
};

const els = {
  search: $("#searchInput"),
  owner: $("#ownerFilter"),
  make: $("#makeFilter"),
  status: $("#statusFilter"),
  sort: $("#sortSelect"),
  table: $("#tableBody"),
  cards: $("#cardList"),
  count: $("#resultCount"),
  empty: $("#emptyState"),
  drawer: $("#detailDrawer"),
  drawerContent: $("#drawerContent"),
  dialog: $("#recordDialog"),
  form: $("#recordForm"),
  confirm: $("#confirmDialog"),
};

function categoryOf(record) {
  if (record.category) return record.category;
  const model = record.model.toLowerCase();
  if (model.includes("handicap")) return "Accessible";
  if (model.includes("stretch limousine")) return "Limousine";
  if (model.includes("mustang mach-e")) return "Electric";
  if (["odyssey", "sienna"].some((name) => model.includes(name)))
    return "Minivan";
  if (["transit", "sprinter"].some((name) => model.includes(name)))
    return "Passenger van";
  if (
    ["altima", "sentra", "accord", "malibu"].some((name) =>
      model.includes(name),
    )
  )
    return "Sedan";
  return "SUV / crossover";
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}
function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
}
function sourcePath(number) {
  return `./research/source-photos/${number}-Photo-${number}.jpg`;
}
function statusClass(status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}
function nextId() {
  const max = records.reduce(
    (value, row) => Math.max(value, Number(row.id.replace(/\D/g, "")) || 0),
    0,
  );
  return `AT-${String(max + 1).padStart(3, "0")}`;
}

function populateFilter(select, values, label) {
  const current = select.value;
  select.innerHTML =
    `<option value="">All ${label}</option>` +
    [...new Set(values)]
      .sort()
      .map((value) => `<option>${escapeHtml(value)}</option>`)
      .join("");
  select.value = current;
}

function filteredRecords() {
  const query = state.query.trim().toLowerCase();
  const result = records.filter((record) => {
    const category = categoryOf(record);
    const haystack = [
      record.id,
      category,
      record.owner,
      record.year,
      record.make,
      record.model,
      record.plate,
      record.assignment,
      record.status,
      record.note,
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query || haystack.includes(query)) &&
      (!state.category || category === state.category) &&
      (!state.owner || record.owner === state.owner) &&
      (!state.make || record.make === state.make) &&
      (!state.status || record.status === state.status)
    );
  });
  return result.sort((a, b) => {
    if (state.sort === "year-asc")
      return a.year - b.year || a.make.localeCompare(b.make);
    if (state.sort === "plate") return a.plate.localeCompare(b.plate);
    if (state.sort === "assignment")
      return (a.assignment || "ZZZ").localeCompare(b.assignment || "ZZZ");
    if (state.sort === "owner")
      return a.owner.localeCompare(b.owner) || b.year - a.year;
    return b.year - a.year || a.make.localeCompare(b.make);
  });
}

function rowTemplate(record) {
  return `<tr data-record="${record.id}"><td class="vehicle-cell"><strong>${record.year} ${escapeHtml(record.make)}</strong><span>${escapeHtml(record.model)}</span><span class="category-label">${escapeHtml(categoryOf(record))}</span></td><td><span class="plate">${escapeHtml(record.plate)}</span>${record.review ? '<span class="review-mark">Review</span>' : ""}</td><td class="owner">${escapeHtml(record.owner)}</td><td>${escapeHtml(record.assignment || "Not assigned")}</td><td><span class="status-badge ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td><td><button class="row-action" type="button" data-open="${record.id}" aria-label="Open ${escapeHtml(record.plate)} details">Open</button></td></tr>`;
}

function cardTemplate(record) {
  return `<article class="vehicle-card"><div class="vehicle-card-top"><div><h3>${record.year} ${escapeHtml(record.make)}</h3><p class="vehicle-card-model">${escapeHtml(record.model)}</p><span class="mobile-category">${escapeHtml(categoryOf(record))}</span></div><div><span class="plate">${escapeHtml(record.plate)}</span>${record.review ? '<span class="review-mark">Review</span>' : ""}</div></div><div class="vehicle-card-grid"><div><span>Ownership</span><strong>${escapeHtml(record.owner)}</strong></div><div><span>Assignment</span><strong>${escapeHtml(record.assignment || "Not assigned")}</strong></div></div><div class="vehicle-card-foot"><span class="status-badge ${statusClass(record.status)}">${escapeHtml(record.status)}</span><button class="source-link" type="button" data-open="${record.id}">View record</button></div></article>`;
}

function renderCategories() {
  const options = ["", ...CATEGORIES];
  $("#categoryNav").innerHTML = options
    .map((category) => {
      const count = records.filter(
        (record) => !category || categoryOf(record) === category,
      ).length;
      const label = category || "All vehicles";
      return `<button class="category-button" type="button" data-category="${escapeHtml(category)}" aria-current="${state.category === category}">${escapeHtml(label)} <span>${count}</span></button>`;
    })
    .join("");
}

function render() {
  populateFilter(
    els.owner,
    records.map((r) => r.owner),
    "ownership",
  );
  populateFilter(
    els.make,
    records.map((r) => r.make),
    "makes",
  );
  populateFilter(
    els.status,
    records.map((r) => r.status),
    "statuses",
  );
  renderCategories();
  const result = filteredRecords();
  els.table.innerHTML = result.map(rowTemplate).join("");
  els.cards.innerHTML = result.map(cardTemplate).join("");
  els.count.textContent = `${result.length} of ${records.length} vehicles`;
  els.empty.hidden = result.length > 0;
  const metricValues = {
    totalMetric: records.length,
    assignedMetric: records.filter((r) => r.status === "Assigned").length,
    garageMetric: records.filter((r) =>
      ["Garage", "Repairs"].includes(r.status),
    ).length,
    reviewMetric: records.filter((r) => r.review).length,
  };
  if (
    !metricsAnimated &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    metricsAnimated = true;
    Object.entries(metricValues).forEach(([id, value], index) =>
      animateMetric($("#" + id), value, index * 70),
    );
  } else {
    Object.entries(metricValues).forEach(
      ([id, value]) => ($("#" + id).textContent = value),
    );
  }
}

function animateMetric(element, target, delay = 0) {
  const duration = 560;
  const start = performance.now() + delay;
  element.textContent = "0";
  function tick(now) {
    if (now < start) return requestAnimationFrame(tick);
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function openDrawer(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  activeId = id;
  $$("[data-record]").forEach((row) =>
    row.classList.toggle("is-selected", row.dataset.record === id),
  );
  els.drawerContent.innerHTML = `<p class="kicker">${record.id} · ${escapeHtml(categoryOf(record))} · Source photo ${record.source || "—"}</p><h2 class="detail-title">${record.year} ${escapeHtml(record.make)}<br>${escapeHtml(record.model)}</h2><p class="detail-sub">Plate / vehicle number <strong class="plate">${escapeHtml(record.plate)}</strong></p><div class="detail-grid"><div class="detail-field"><span>Ownership</span><strong>${escapeHtml(record.owner)}</strong></div><div class="detail-field"><span>Status</span><strong>${escapeHtml(record.status)}</strong></div><div class="detail-field"><span>Assignment</span><strong>${escapeHtml(record.assignment || "Not assigned")}</strong></div><div class="detail-field"><span>Category</span><strong>${escapeHtml(categoryOf(record))}</strong></div><div class="detail-field"><span>Review</span><strong>${record.review ? "Flagged for review" : "No flag"}</strong></div><div class="detail-field"><span>Source</span><strong>${record.source ? `Photo ${record.source}` : "Working copy"}</strong></div></div>${record.note ? `<p>${escapeHtml(record.note)}</p>` : ""}<div class="drawer-actions"><button class="button button-primary" type="button" data-edit="${record.id}">Edit record</button><button class="button button-quiet" type="button" data-close-drawer>Back to roster</button></div>${record.source ? `<div class="evidence"><p class="kicker">Original evidence</p><img src="${sourcePath(record.source)}" alt="Source photo ${record.source} containing this fleet record" loading="lazy"><p>Use the full-size source to verify spelling and corrections. The record is linked to the source sheet, not to a cropped reconstruction.</p></div>` : ""}`;
  els.drawer.classList.add("open");
  els.drawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $(".drawer-close").focus();
}

function closeDrawer() {
  els.drawer.classList.remove("open");
  els.drawer.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  $$("[data-record]").forEach((row) => row.classList.remove("is-selected"));
  const trigger = activeId && $(`[data-open="${activeId}"]`);
  trigger?.focus();
}

function openForm(record = null) {
  if (record && els.drawer.classList.contains("open")) closeDrawer();
  els.form.reset();
  $("#dialogTitle").textContent = record ? "Edit vehicle" : "Add vehicle";
  const values = record
    ? { ...record, category: categoryOf(record) }
    : {
        id: "",
        owner: "",
        year: new Date().getFullYear(),
        make: "",
        model: "",
        plate: "",
        assignment: "",
        category: "SUV / crossover",
        status: "Assigned",
        source: "",
        note: "",
        review: false,
      };
  Object.entries(values).forEach(([key, value]) => {
    const field = els.form.elements.namedItem(key);
    if (!field) return;
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = value ?? "";
  });
  els.dialog.showModal();
  setTimeout(() => els.form.elements.namedItem("owner").focus(), 0);
}

function saveForm(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!els.form.reportValidity()) return;
  const data = new FormData(els.form);
  const id = data.get("id") || nextId();
  const current = records.find((r) => r.id === id);
  const next = {
    ...current,
    id,
    owner: data.get("owner").trim(),
    year: Number(data.get("year")),
    make: data.get("make").trim(),
    model: data.get("model").trim(),
    plate: data.get("plate").trim(),
    assignment: data.get("assignment").trim(),
    category: data.get("category"),
    status: data.get("status"),
    source: Number(data.get("source")) || null,
    note: data.get("note").trim(),
    review: data.get("review") === "on",
  };
  records = current
    ? records.map((row) => (row.id === id ? next : row))
    : [next, ...records];
  persist();
  els.dialog.close();
  closeDrawer();
  render();
}

function clearFilters() {
  Object.assign(state, {
    query: "",
    category: "",
    owner: "",
    make: "",
    status: "",
    sort: "year-desc",
  });
  els.search.value = "";
  els.owner.value = "";
  els.make.value = "";
  els.status.value = "";
  els.sort.value = "year-desc";
  render();
  els.search.focus();
}

function exportCsv() {
  const headers = [
    "ID",
    "Category",
    "Ownership",
    "Year",
    "Make",
    "Model",
    "Plate / Vehicle Number",
    "Assignment",
    "Status",
    "Source Photo",
    "Review",
    "Notes",
  ];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    headers,
    ...filteredRecords().map((r) => [
      r.id,
      categoryOf(r),
      r.owner,
      r.year,
      r.make,
      r.model,
      r.plate,
      r.assignment,
      r.status,
      r.source,
      r.review ? "Yes" : "No",
      r.note,
    ]),
  ]
    .map((row) => row.map(quote).join(","))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `absolute-fleet-roster-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open]");
  if (open) openDrawer(open.dataset.open);
  const edit = event.target.closest("[data-edit]");
  if (edit) openForm(records.find((r) => r.id === edit.dataset.edit));
  const category = event.target.closest("[data-category]");
  if (category) {
    state.category = category.dataset.category;
    render();
    requestAnimationFrame(() =>
      $("#categoryNav [aria-current='true']")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
        inline: "center",
      }),
    );
  }
  if (event.target.closest("[data-close-drawer]")) closeDrawer();
  if (event.target.closest("[data-clear]")) clearFilters();
});
els.search.addEventListener("input", () => {
  state.query = els.search.value;
  render();
});
[
  [els.owner, "owner"],
  [els.make, "make"],
  [els.status, "status"],
  [els.sort, "sort"],
].forEach(([element, key]) =>
  element.addEventListener("change", () => {
    state[key] = element.value;
    render();
  }),
);
$("#clearButton").addEventListener("click", clearFilters);
$("#addButton").addEventListener("click", () => openForm());
$("#exportButton").addEventListener("click", exportCsv);
$("#printButton").addEventListener("click", () => window.print());
$("#resetButton").addEventListener("click", () => els.confirm.showModal());
els.confirm.addEventListener("close", () => {
  if (els.confirm.returnValue === "confirm") {
    records = cloneSource();
    persist();
    clearFilters();
  }
});
els.form.addEventListener("submit", saveForm);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.search.focus();
  }
  if (event.key === "Escape" && els.drawer.classList.contains("open"))
    closeDrawer();
});
render();
