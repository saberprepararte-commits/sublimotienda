const STORAGE_KEY = "gallery-store-template-v1";
const THEME_KEY = "gallery-store-theme";
const PROMO_DISMISS_KEY = "sublimo-promo-dismissed";
const PAGE_SIZE = 24;

const starterProducts = [
  {
    id: "camiseta-basica",
    name: "Camiseta básica Sublimo",
    category: "Camiseta",
    price: "$ 45.000",
    status: "Disponible",
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
    description: "Camiseta básica para estampados personalizados, cómoda y de alta calidad.",
    featured: true
  },
  {
    id: "camiseta-dallas",
    name: "Camiseta estampada Dallas",
    category: "Camiseta",
    price: "$ 58.000",
    status: "Disponible",
    image: "https://images.unsplash.com/photo-1571945153237-4929e783af4a?auto=format&fit=crop&w=900&q=80",
    description: "Diseño estampado sobre camiseta blanca, ideal para un look urbano.",
    featured: true
  },
  {
    id: "set-ceramica",
    name: "Set cer\u00e1mica Nube",
    category: "Hogar",
    price: "$ 120.000",
    status: "Disponible",
    image: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&q=80",
    description: "Piezas esmaltadas para mesa, disponibles en tonos claros y acabado mate.",
    featured: false
  },
  {
    id: "camisa-lino",
    name: "Camisa lino Oliva",
    category: "Ropa",
    price: "$ 145.000",
    status: "Por encargo",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
    description: "Camisa fresca de corte relajado, ideal para clima cálido y uso diario.",
    featured: false
  },
  {
    id: "vela-botanica",
    name: "Vela Botánica",
    category: "Decoraci\u00f3n",
    price: "$ 42.000",
    status: "Disponible",
    image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80",
    description: "Aroma suave con notas herbales, vaso reutilizable y cera vegetal.",
    featured: false
  }
];

let store = loadStore();
let visibleProductCount = PAGE_SIZE;

const els = {
  storeNameLabel: document.querySelector("#storeNameLabel"),
  storeTaglineLabel: document.querySelector("#storeTaglineLabel"),
  footerStoreName: document.querySelector("#footerStoreName"),
  heroWhatsapp: document.querySelector("#heroWhatsapp"),
  promoBanner: document.querySelector("#promoBanner"),
  promoClose: document.querySelector("#promoClose"),
  promoPrev: document.querySelector("#promoPrev"),
  promoNext: document.querySelector("#promoNext"),
  promoProducts: document.querySelector("#promoProducts"),
  promoWhatsapp: document.querySelector("#promoWhatsapp"),
  productGrid: document.querySelector("#productGrid"),
  emptyState: document.querySelector("#emptyState"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  sortFilter: document.querySelector("#sortFilter"),
  categoryChips: document.querySelector("#categoryChips"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  resultCount: document.querySelector("#resultCount"),
  themeToggle: document.querySelector("#themeToggle")
};

function loadStore() {
  const defaults = {
    name: "Sublimo Shop",
    tagline: "Productos seleccionados",
    whatsapp: "573126611414",
    products: starterProducts
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return defaults;
    return {
      ...defaults,
      name: stored.name || defaults.name,
      tagline: stored.tagline || defaults.tagline,
      whatsapp: stored.whatsapp || defaults.whatsapp,
      products: Array.isArray(stored.products) && stored.products.length ? stored.products : defaults.products
    };
  } catch {
    return defaults;
  }
}

async function init() {
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === "dark") document.documentElement.classList.add("dark");

  await loadProductsFromSupabase();
  await loadSettingsFromSupabase();
  renderStoreIdentity();
  renderPromoBanner();
  renderCategories();
  renderProducts();
  bindEvents();
  refreshIcons();
}

async function loadSettingsFromSupabase() {
  const config = window.SUBLIMO_SUPABASE;
  if (!config?.url || !config?.anonKey) return;

  const endpoint = `${config.url.replace(/\/$/, "")}/rest/v1/store_settings?select=name,tagline,whatsapp&id=eq.main`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    });

    if (!response.ok) throw new Error(`Supabase respondi\u00f3 ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data) || !data[0]) return;

    store = {
      ...store,
      name: data[0].name || store.name,
      tagline: data[0].tagline || store.tagline,
      whatsapp: data[0].whatsapp || store.whatsapp
    };
  } catch (error) {
    console.warn("No se pudieron cargar los datos de la tienda desde Supabase.", error);
  }
}

async function loadProductsFromSupabase() {
  const config = window.SUBLIMO_SUPABASE;
  if (!config?.url || !config?.anonKey) return;

  const endpoint = [
    `${config.url.replace(/\/$/, "")}/rest/v1/products`,
    "?select=id,name,category,price,status,image,description,featured,created_at",
    "&order=created_at.desc"
  ].join("");

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`
      }
    });

    if (!response.ok) throw new Error(`Supabase respondi\u00f3 ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) return;

    store = {
      ...store,
      products: data.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        status: product.status,
        image: normalizeImageUrl(product.image),
        description: product.description,
        featured: product.featured
      }))
    };
  } catch (error) {
    console.warn("No se pudieron cargar productos desde Supabase.", error);
  }
}

function bindEvents() {
  els.searchInput?.addEventListener("input", resetProductView);
  els.categoryFilter?.addEventListener("change", resetProductView);
  els.sortFilter?.addEventListener("change", resetProductView);
  els.loadMoreButton?.addEventListener("click", showMoreProducts);
  els.promoClose?.addEventListener("click", closePromoBanner);
  els.promoPrev?.addEventListener("click", () => scrollPromoProducts(-1));
  els.promoNext?.addEventListener("click", () => scrollPromoProducts(1));
  els.themeToggle?.addEventListener("click", toggleTheme);
  els.heroWhatsapp?.addEventListener("click", () => {
    window.open(getWhatsappUrl(`Hola, deseo recibir informaci\u00f3n de ${store.name}.`), "_blank");
  });
}

function getFeaturedProducts() {
  return store.products.filter((product) => product.featured).slice(0, 12);
}

function getPromoKey(products) {
  return products.map((product) => product.id).join("|");
}

function renderPromoBanner() {
  if (!els.promoBanner || !els.promoProducts || !els.promoWhatsapp) return;

  const featuredProducts = getFeaturedProducts();
  const promoKey = getPromoKey(featuredProducts);
  const dismissedKey = localStorage.getItem(PROMO_DISMISS_KEY);

  if (!featuredProducts.length || dismissedKey === promoKey) {
    els.promoBanner.hidden = true;
    return;
  }

  els.promoBanner.classList.toggle("is-single", featuredProducts.length === 1);
  els.promoBanner.classList.toggle("has-carousel", featuredProducts.length > 3);
  if (els.promoPrev) els.promoPrev.hidden = featuredProducts.length <= 3;
  if (els.promoNext) els.promoNext.hidden = featuredProducts.length <= 3;
  els.promoProducts.innerHTML = "";
  featuredProducts.forEach((product) => {
    const item = document.createElement("article");
    item.className = "promo-product";
    item.innerHTML = `
      <img src="${escapeAttribute(normalizeImageUrl(product.image))}" alt="${escapeAttribute(product.name)}" loading="lazy">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(formatPrice(product.price))}</span>
      </div>
    `;
    els.promoProducts.append(item);
  });

  const names = featuredProducts.map((product) => product.name).join(", ");
  els.promoWhatsapp.href = getWhatsappUrl(`Hola, quiero consultar la promoci\u00f3n de estas camisetas: ${names}.`);
  els.promoBanner.dataset.promoKey = promoKey;
  els.promoBanner.hidden = false;
  refreshIcons();
}

function scrollPromoProducts(direction) {
  if (!els.promoProducts) return;
  const distance = Math.max(els.promoProducts.clientWidth * 0.85, 260);
  els.promoProducts.scrollBy({ left: distance * direction, behavior: "smooth" });
}

function closePromoBanner() {
  const promoKey = els.promoBanner?.dataset.promoKey || "";
  if (promoKey) localStorage.setItem(PROMO_DISMISS_KEY, promoKey);
  if (els.promoBanner) els.promoBanner.hidden = true;
}

function resetProductView() {
  visibleProductCount = PAGE_SIZE;
  renderProducts();
  syncCategoryChips();
}

function showMoreProducts() {
  visibleProductCount += PAGE_SIZE;
  renderProducts();
}

function renderStoreIdentity() {
  if (els.storeNameLabel) els.storeNameLabel.textContent = store.name;
  if (els.footerStoreName) els.footerStoreName.textContent = store.name;
  if (els.storeTaglineLabel) els.storeTaglineLabel.textContent = store.tagline;
}

function renderCategories() {
  const selected = els.categoryFilter.value || "all";
  const categories = [...new Set(store.products.map((product) => product.category.trim()).filter(Boolean))].sort();

  els.categoryFilter.innerHTML = '<option value="all">Todas</option>';
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  });
  els.categoryFilter.value = categories.includes(selected) ? selected : "all";
  renderCategoryChips(categories);
}

function renderCategoryChips(categories) {
  if (!els.categoryChips) return;

  const selected = els.categoryFilter.value || "all";
  const chipCategories = ["all", ...categories.slice(0, 10)];
  els.categoryChips.innerHTML = "";

  chipCategories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-chip";
    button.textContent = category === "all" ? "Todas" : category;
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === selected));
    button.addEventListener("click", () => {
      els.categoryFilter.value = category;
      resetProductView();
      syncCategoryChips();
    });
    els.categoryChips.append(button);
  });
}

function syncCategoryChips() {
  if (!els.categoryChips) return;
  const selected = els.categoryFilter.value || "all";
  els.categoryChips.querySelectorAll(".category-chip").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.category === selected));
  });
}

function renderProducts() {
  const term = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const products = sortProducts(store.products.filter((product) => {
    const matchesText = [product.name, product.category, product.description, product.price]
      .join(" ")
      .toLowerCase()
      .includes(term);
    const matchesCategory = category === "all" || product.category === category;
    return matchesText && matchesCategory;
  }));

  els.productGrid.innerHTML = "";
  els.emptyState.hidden = products.length > 0;
  const visibleProducts = products.slice(0, visibleProductCount);

  visibleProducts.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-image">
        <img src="${escapeAttribute(normalizeImageUrl(product.image))}" alt="${escapeAttribute(product.name)}" loading="lazy">
        <span class="badge">${escapeHtml(product.featured ? "Destacado" : product.status)}</span>
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span>${escapeHtml(product.category)}</span>
          <span>${escapeHtml(product.status)}</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description)}</p>
        <div class="product-footer">
          <span class="price">${escapeHtml(formatPrice(product.price))}</span>
          <a class="whatsapp-button" href="${getWhatsappUrl(buildProductMessage(product))}" target="_blank" rel="noopener" aria-label="Consultar ${escapeAttribute(product.name)} por WhatsApp" title="Consultar por WhatsApp">
            <span data-icon="message-circle"></span>
          </a>
        </div>
      </div>
    `;
    els.productGrid.append(card);
  });

  if (els.loadMoreButton) {
    els.loadMoreButton.hidden = visibleProductCount >= products.length;
  }
  if (els.resultCount) {
    els.resultCount.textContent = products.length
      ? `Mostrando ${Math.min(visibleProductCount, products.length)} de ${products.length} productos`
      : "";
  }

  refreshIcons();
}

function sortProducts(products) {
  const sortValue = els.sortFilter?.value || "recent";
  return [...products].sort((a, b) => {
    if (sortValue === "featured") return Number(b.featured) - Number(a.featured);
    if (sortValue === "price-asc") return getPriceNumber(a.price) - getPriceNumber(b.price);
    if (sortValue === "price-desc") return getPriceNumber(b.price) - getPriceNumber(a.price);
    if (sortValue === "name") return String(a.name).localeCompare(String(b.name), "es");
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

function buildProductMessage(product) {
  return `Hola, me interesa el producto "${product.name}" (${formatPrice(product.price)}). Quisiera saber si est\u00e1 disponible.`;
}

function getWhatsappUrl(message) {
  return `https://wa.me/${sanitizePhone(store.whatsapp)}?text=${encodeURIComponent(message)}`;
}

function sanitizePhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function formatPrice(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return String(value || "");
  return `$${Number(digits).toLocaleString("es-CO")}`;
}

function getPriceNumber(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
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

function toggleTheme() {
  document.documentElement.classList.toggle("dark");
  const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  localStorage.setItem(THEME_KEY, theme);
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
  "grid": '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  "chevron-left": '<svg viewBox="0 0 24 24" fill="none"><path d="m15 6-6 6 6 6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "chevron-right": '<svg viewBox="0 0 24 24" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  "message-circle": '<svg viewBox="0 0 32 32" fill="none"><path d="M5.4 27 7 21.4A11.3 11.3 0 1 1 11 25l-5.6 2Z" fill="currentColor"/><path d="M10.8 9.8c.2-.5.5-.6.9-.6h.7c.3 0 .6.1.8.6l.9 2c.2.4.1.8-.2 1.1l-.7.8c.8 1.6 2.1 2.9 3.8 3.8l.8-.8c.3-.3.7-.4 1.1-.2l2 .9c.5.2.6.5.6.9v.6c0 .6-.2.9-.7 1.2-.8.5-2 .7-3.4.2-3.9-1.3-6.9-4.3-8.2-8.2-.5-1.4-.3-2.6.2-3.4Z" fill="var(--wa-mark, #fff)"/></svg>',
  "moon": '<svg viewBox="0 0 24 24" fill="none"><path d="M20 14.2A7.6 7.6 0 0 1 9.8 4a8.1 8.1 0 1 0 10.2 10.2Z" stroke="currentColor" stroke-linejoin="round"/></svg>',
  "search": '<svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-linecap="round"/></svg>',
  "x": '<svg viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-linecap="round"/></svg>'
};

init();
