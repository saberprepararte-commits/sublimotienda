let supabaseClient = null;
let products = [];
let editingProductId = null;

const els = {
  loginForm: document.querySelector("#loginForm"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  loginError: document.querySelector("#loginError"),
  logoutButton: document.querySelector("#logoutButton"),
  adminWorkspace: document.querySelector("#adminWorkspace"),
  settingsForm: document.querySelector("#settingsForm"),
  storeName: document.querySelector("#storeName"),
  whatsappNumber: document.querySelector("#whatsappNumber"),
  storeTagline: document.querySelector("#storeTagline"),
  productForm: document.querySelector("#productForm"),
  formTitle: document.querySelector("#formTitle"),
  resetFormButton: document.querySelector("#resetFormButton"),
  productId: document.querySelector("#productId"),
  productName: document.querySelector("#productName"),
  productCategory: document.querySelector("#productCategory"),
  productPrice: document.querySelector("#productPrice"),
  productStatus: document.querySelector("#productStatus"),
  productImage: document.querySelector("#productImage"),
  productDescription: document.querySelector("#productDescription"),
  productFeatured: document.querySelector("#productFeatured"),
  adminProductRows: document.querySelector("#adminProductRows"),
  totalProducts: document.querySelector("#totalProducts"),
  totalFeatured: document.querySelector("#totalFeatured"),
  themeToggle: document.querySelector("#themeToggle"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  const theme = localStorage.getItem("gallery-store-theme");
  if (theme === "dark") document.documentElement.classList.add("dark");

  supabaseClient = createSupabaseClient();
  bindEvents();
  refreshIcons();

  if (!supabaseClient) {
    showError("Falta configurar Supabase en supabase-config.js.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await showWorkspace();
}

function createSupabaseClient() {
  const config = window.SUBLIMO_SUPABASE;
  if (!config?.url || !config?.anonKey || !window.supabase) return null;
  return window.supabase.createClient(config.url, config.anonKey);
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", handleLogout);
  els.settingsForm.addEventListener("submit", handleSettingsSubmit);
  els.productForm.addEventListener("submit", handleProductSubmit);
  els.resetFormButton.addEventListener("click", resetProductForm);
  els.themeToggle.addEventListener("click", toggleTheme);
}

async function handleLogin(event) {
  event.preventDefault();
  els.loginError.hidden = true;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: els.emailInput.value.trim(),
    password: els.passwordInput.value
  });

  if (error) {
    showError("No se pudo iniciar sesión. Revisa correo y contraseña.");
    return;
  }

  await showWorkspace();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  products = [];
  renderProducts();
  els.loginForm.hidden = false;
  els.adminWorkspace.hidden = true;
  els.logoutButton.hidden = true;
  showToast("Sesión cerrada.");
}

async function showWorkspace() {
  els.loginForm.hidden = true;
  els.adminWorkspace.hidden = false;
  els.logoutButton.hidden = false;
  await loadSettings();
  await loadProducts();
  showToast("Acceso concedido.");
}

async function loadSettings() {
  const { data, error } = await supabaseClient
    .from("store_settings")
    .select("name,tagline,whatsapp")
    .eq("id", "main")
    .maybeSingle();

  const settings = error || !data
    ? { name: "Sublimo Shop", tagline: "Productos seleccionados", whatsapp: "3126611414" }
    : data;

  els.storeName.value = settings.name || "Sublimo Shop";
  els.storeTagline.value = settings.tagline || "Productos seleccionados";
  els.whatsappNumber.value = stripColombiaPrefix(settings.whatsapp || "3126611414");
}

async function handleSettingsSubmit(event) {
  event.preventDefault();

  const payload = {
    id: "main",
    name: els.storeName.value.trim(),
    tagline: els.storeTagline.value.trim(),
    whatsapp: normalizePhone(els.whatsappNumber.value),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from("store_settings")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    showError("No se pudieron guardar los datos de la tienda. Revisa que hayas ejecutado el SQL actualizado.");
    return;
  }

  els.whatsappNumber.value = stripColombiaPrefix(payload.whatsapp);
  showToast("Datos de tienda actualizados.");
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,category,price,status,image,description,featured,sort_order,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showError("No se pudieron cargar los productos.");
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  els.totalProducts.textContent = products.length;
  els.totalFeatured.textContent = products.filter((product) => product.featured).length;
  els.adminProductRows.innerHTML = "";

  products.forEach((product) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${escapeHtml(formatPrice(product.price))}</td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" data-edit="${product.id}" aria-label="Editar ${escapeAttribute(product.name)}" title="Editar">
            <span data-icon="pencil"></span>
          </button>
          <button class="icon-button" type="button" data-delete="${product.id}" aria-label="Eliminar ${escapeAttribute(product.name)}" title="Eliminar">
            <span data-icon="trash-2"></span>
          </button>
        </div>
      </td>
    `;
    els.adminProductRows.append(row);
  });

  els.adminProductRows.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editProduct(button.dataset.edit));
  });
  els.adminProductRows.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteProduct(button.dataset.delete));
  });

  refreshIcons();
}

async function handleProductSubmit(event) {
  event.preventDefault();

  const wasEditing = Boolean(editingProductId);
  const currentProduct = products.find((product) => product.id === editingProductId);
  const payload = {
    name: els.productName.value.trim(),
    category: els.productCategory.value.trim(),
    price: formatPrice(els.productPrice.value),
    status: els.productStatus.value,
    image: normalizeImageUrl(els.productImage.value),
    description: els.productDescription.value.trim(),
    featured: els.productFeatured.checked,
    sort_order: currentProduct?.sort_order ?? 0
  };

  const request = editingProductId
    ? supabaseClient.from("products").update(payload).eq("id", editingProductId)
    : supabaseClient.from("products").insert(payload);

  const { error } = await request;
  if (error) {
    showError("No se pudo guardar. Verifica que tu usuario sea administrador.");
    return;
  }

  resetProductForm();
  await loadProducts();
  showToast(wasEditing ? "Producto actualizado." : "Producto agregado.");
}

function editProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;

  editingProductId = product.id;
  els.formTitle.textContent = "Editar producto";
  els.productName.value = product.name;
  els.productCategory.value = product.category;
  els.productPrice.value = product.price;
  els.productStatus.value = product.status;
  els.productImage.value = product.image;
  els.productDescription.value = product.description;
  els.productFeatured.checked = product.featured;
  els.productName.focus();
}

async function deleteProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product || !confirm(`Eliminar "${product.name}"?`)) return;

  const { error } = await supabaseClient.from("products").delete().eq("id", productId);
  if (error) {
    showError("No se pudo eliminar. Verifica que tu usuario sea administrador.");
    return;
  }

  await loadProducts();
  showToast("Producto eliminado.");
}

function resetProductForm() {
  editingProductId = null;
  els.formTitle.textContent = "Agregar producto";
  els.productForm.reset();
  els.productStatus.value = "Disponible";
}

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem("gallery-store-theme", theme);
}

function normalizePhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function stripColombiaPrefix(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) return digits.slice(2);
  return digits;
}

function formatPrice(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return String(value || "");
  return `$${Number(digits).toLocaleString("es-CO")}`;
}

function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (driveMatch?.[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveMatch[1])}&sz=w1200`;
  }

  return url;
}

function showError(message) {
  els.loginError.textContent = message;
  els.loginError.hidden = false;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("is-visible"), 2400);
}

function refreshIcons() {
  document.querySelectorAll("[data-icon]").forEach((icon) => {
    const name = icon.dataset.icon;
    const svg = ICONS[name];
    if (!svg) return;
    icon.innerHTML = svg;
    icon.setAttribute("aria-hidden", "true");
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

const ICONS = {
  "lock": '<svg viewBox="0 0 24 24" fill="none"><path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" stroke-linecap="round"/><path d="M6 10h12v10H6V10Z" stroke="currentColor" stroke-linejoin="round"/><path d="M12 14v2" stroke="currentColor" stroke-linecap="round"/></svg>',
  "log-out": '<svg viewBox="0 0 24 24" fill="none"><path d="M10 5H6v14h4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 8l4 4-4 4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 12H9" stroke="currentColor" stroke-linecap="round"/></svg>',
  "moon": '<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.2A7.6 7.6 0 0 1 9.8 4a8.1 8.1 0 1 0 10.2 10.2Z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  "pencil": '<svg viewBox="0 0 24 24" fill="none"><path d="M4 16.8V20h3.2L18.6 8.6l-3.2-3.2L4 16.8Z" stroke="currentColor" stroke-linejoin="round"/><path d="M14.4 6.4l3.2 3.2" stroke="currentColor" stroke-linecap="round"/></svg>',
  "plus": '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-linecap="round"/></svg>',
  "save": '<svg viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="currentColor" stroke-linejoin="round"/><path d="M8 4v6h7V4M8 20v-6h8v6" stroke="currentColor" stroke-linejoin="round"/></svg>',
  "trash-2": '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "x": '<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-linecap="round"/></svg>'
};
