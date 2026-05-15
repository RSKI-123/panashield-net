const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const newsletter = document.querySelector("[data-newsletter]");
const statusNode = document.querySelector("[data-form-status]");
const productGrid = document.querySelector("[data-product-grid]");
const productCount = document.querySelector("[data-product-count]");
const productDialog = document.querySelector("[data-product-dialog]");
const dialogMainImage = document.querySelector("[data-dialog-main-image]");
const dialogThumbs = document.querySelector("[data-dialog-thumbs]");
const dialogCategory = document.querySelector("[data-dialog-category]");
const dialogTitle = document.querySelector("[data-dialog-title]");
const dialogTagline = document.querySelector("[data-dialog-tagline]");
const dialogPrice = document.querySelector("[data-dialog-price]");
const dialogVariants = document.querySelector("[data-dialog-variants]");
const dialogSpecs = document.querySelector("[data-dialog-specs]");
const dialogLink = document.querySelector("[data-dialog-link]");

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

let products = [];

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

if (newsletter && statusNode) {
  newsletter.addEventListener("submit", (event) => {
    event.preventDefault();
    newsletter.reset();
    statusNode.textContent = "登録フォームは仮置きです。後でメール配信サービスに接続できます。";
  });
}

const formatPrice = (product) => currencyFormatter.format(product.price || 0);

const getProductImage = (product) => product.whiteBgImage || product.mainImage || product.images?.[0] || "";

const renderProducts = () => {
  if (!productGrid) return;

  productGrid.innerHTML = products
    .map((product, index) => {
      const image = getProductImage(product);
      const price = formatPrice(product);
      const label = `${product.category || "商品"} / ${product.managementNumber || product.id}`;

      return `
        <article class="store-product-card">
          <button class="store-product-button" type="button" data-product-index="${index}">
            <span class="product-card-media">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy">
            </span>
            <span class="store-product-copy">
              <span class="meta">${escapeHtml(label)}</span>
              <strong>${escapeHtml(product.name)}</strong>
              <span class="store-product-tagline">${escapeHtml(product.tagline || "")}</span>
              <span class="store-product-bottom">
                <span>${escapeHtml(price)}</span>
                <span>${escapeHtml(product.availability || "")}</span>
              </span>
            </span>
          </button>
        </article>
      `;
    })
    .join("");

  if (productCount) {
    productCount.textContent = `${products.length} 商品`;
  }
};

const setDialogImage = (src, alt) => {
  if (!dialogMainImage || !src) return;
  dialogMainImage.src = src;
  dialogMainImage.alt = alt;
};

const openProductDialog = (product) => {
  if (!productDialog || !dialogTitle) return;

  const images = [getProductImage(product), ...(product.images || [])].filter(Boolean);
  const uniqueImages = [...new Set(images)];

  if (dialogCategory) {
    dialogCategory.textContent = `${product.storeName || "RISUKAI"} / ${product.managementNumber || product.id}`;
  }

  dialogTitle.textContent = product.name;

  if (dialogTagline) {
    dialogTagline.textContent = product.tagline || product.rakutenTitle || "";
  }

  if (dialogPrice) {
    dialogPrice.textContent = formatPrice(product);
  }

  if (dialogLink) {
    dialogLink.href = product.productUrl || "#";
  }

  setDialogImage(uniqueImages[0], product.name);

  if (dialogThumbs) {
    dialogThumbs.innerHTML = uniqueImages
      .map(
        (image, index) => `
          <button class="${index === 0 ? "is-active" : ""}" type="button" data-thumb-src="${escapeHtml(image)}">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(`${product.name} ${index + 1}`)}" loading="eager">
          </button>
        `,
      )
      .join("");
  }

  if (dialogVariants) {
    dialogVariants.innerHTML = (product.variants || [])
      .map(
        (variant) => `
          <span class="variant-chip">
            <img src="${escapeHtml(variant.image)}" alt="${escapeHtml(variant.label)}" loading="eager">
            <span>${escapeHtml(variant.label)}</span>
          </span>
        `,
      )
      .join("");
  }

  if (dialogSpecs) {
    dialogSpecs.innerHTML = (product.specs || [])
      .map(
        (spec) => `
          <div>
            <dt>${escapeHtml(spec.label)}</dt>
            <dd>${escapeHtml(spec.value)}</dd>
          </div>
        `,
      )
      .join("");
  }

  productDialog.showModal();
};

productGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-index]");
  if (!button) return;

  const product = products[Number(button.dataset.productIndex)];
  if (product) {
    openProductDialog(product);
  }
});

dialogThumbs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-thumb-src]");
  if (!button || !dialogMainImage) return;

  setDialogImage(button.dataset.thumbSrc, dialogMainImage.alt);
  dialogThumbs.querySelectorAll("button").forEach((thumb) => thumb.classList.toggle("is-active", thumb === button));
});

productDialog?.addEventListener("click", (event) => {
  if (event.target === productDialog) {
    productDialog.close();
  }
});

const loadProducts = async () => {
  if (!productGrid) return;

  try {
    const response = await fetch("assets/data/products.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Product data request failed: ${response.status}`);
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
  } catch (error) {
    productGrid.innerHTML = `
      <article class="store-product-card product-skeleton">
        <div class="store-product-copy">
          <p class="meta">ERROR</p>
          <h3>商品データを表示できませんでした</h3>
        </div>
      </article>
    `;
    if (productCount) productCount.textContent = "0 商品";
    console.error(error);
  }
};

loadProducts();
