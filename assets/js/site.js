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
const orderForm = document.querySelector("[data-order-form]");
const orderQuantity = document.querySelector("[data-order-quantity]");
const orderStatus = document.querySelector("[data-order-status]");
const checkoutDialog = document.querySelector("[data-checkout-dialog]");
const checkoutForm = document.querySelector("[data-checkout-form]");
const checkoutSummary = document.querySelector("[data-checkout-summary]");
const checkoutStatus = document.querySelector("[data-checkout-status]");
const productsSection = document.getElementById("products");
const VARIANT_CHIP_LIMIT = 36;
const PRODUCTS_DATA_VERSION = "2026052202";
const PRODUCTS_DATA_URL = `assets/data/products.json?v=${PRODUCTS_DATA_VERSION}`;

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

let products = [];
let activeProduct = null;
let activeVariantIndex = 0;
let activeQuantity = 1;
let preserveProductHashOnClose = false;
let dialogImageLoadTimer = null;

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

const formatAmount = (amount = 0) => currencyFormatter.format(amount);

const getProductImage = (product) => product.mainImage || product.images?.[0] || product.whiteBgImage || "";

const getBackupProductImage = (product) => (product.images || []).find((image) => image && image !== getProductImage(product)) || product.whiteBgImage || "";

const getVariantImage = (variant = {}, product = activeProduct) => variant.image || getProductImage(product);

const getSelectedVariant = () => activeProduct?.variants?.[activeVariantIndex] || null;

const getSizedImage = (src = "", size = 300) => {
  if (!src || !src.includes("image.rakuten.co.jp/")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}_ex=${size}x${size}`;
};

const getLocalProductDerivative = (src = "", folder = "medium") => {
  const prefix = "assets/images/products/";
  if (!src.startsWith(prefix)) return "";
  const fileName = src.slice(prefix.length);
  if (!fileName || fileName.includes("/")) return "";
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${prefix}${folder}/${baseName}.jpg`;
};

const getDisplayImage = (src = "") => getLocalProductDerivative(src, "medium") || getSizedImage(src, 900) || src;

const getThumbImage = (src = "") => getLocalProductDerivative(src, "thumbs") || getSizedImage(src, 300) || src;

const getCurrentUnitPrice = () => getSelectedVariant()?.price || activeProduct?.price || 0;

const variantDisplayLabel = (variant = {}) => variant.label || variant.merchantSku || variant.sku || "SKU";

const updateCatalogVisibility = (scrollToCatalog = false) => {
  const isCatalogRoute = location.hash === "#products" || location.hash.startsWith("#product=");
  document.body.classList.toggle("catalog-visible", isCatalogRoute);

  if (scrollToCatalog && location.hash === "#products" && productsSection) {
    window.requestAnimationFrame(() => {
      productsSection.scrollIntoView({ block: "start" });
    });
  }
};

const renderProducts = () => {
  if (!productGrid) return;

  const productLimit = Number(productGrid.dataset.productLimit || 0);
  const visibleProducts = productLimit > 0 ? products.slice(0, productLimit) : products;

  productGrid.innerHTML = visibleProducts
    .map((product, index) => {
      const productIndex = productLimit > 0 ? index : products.indexOf(product);
      const image = getProductImage(product);
      const price = formatAmount(product.price || 0);
      const label = `${product.category || "商品"} / ${product.managementNumber || product.id}`;
      const detailHash = `#product=${encodeURIComponent(product.id)}`;

      return `
        <article class="store-product-card">
          <a class="store-product-button" href="${detailHash}" data-product-index="${productIndex}">
            <span class="product-card-media">
              <img src="${escapeHtml(getDisplayImage(image))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" data-fallback-src="${escapeHtml(image || getBackupProductImage(product))}">
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
          </a>
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
  const displaySrc = getDisplayImage(src);
  window.clearTimeout(dialogImageLoadTimer);
  dialogMainImage.classList.add("is-loading");
  dialogMainImage.dataset.requestSrc = src;
  dialogMainImage.style.backgroundImage = "";
  dialogMainImage.dataset.fallbackSrc = src;
  dialogMainImage.src = displaySrc;
  dialogMainImage.alt = alt;

  dialogImageLoadTimer = window.setTimeout(() => {
    if (!activeProduct || dialogMainImage.dataset.requestSrc !== src || (dialogMainImage.complete && dialogMainImage.naturalWidth > 0)) return;
    const images = [...new Set([getProductImage(activeProduct), ...(activeProduct.images || [])].filter(Boolean))];
    const currentIndex = images.indexOf(src);
    const fallbackImage = images.find((image, index) => index > currentIndex && image !== src);
    if (fallbackImage) setDialogImage(fallbackImage, alt);
  }, 8000);
};

const updateVariantSelection = (variantIndex, updateImage = true) => {
  activeVariantIndex = variantIndex;
  const selectedVariant = getSelectedVariant();

  if (updateImage && activeProduct) {
    setDialogImage(getVariantImage(selectedVariant, activeProduct), selectedVariant?.label || activeProduct.name || "");
  }

  if (dialogPrice) {
    dialogPrice.textContent = formatAmount(getCurrentUnitPrice());
  }

  dialogVariants?.querySelectorAll("[data-variant-index]").forEach((button) => {
    const isActive = Number(button.dataset.variantIndex) === activeVariantIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const select = dialogVariants?.querySelector("[data-variant-select]");
  if (select && Number(select.value) !== activeVariantIndex) {
    select.value = String(activeVariantIndex);
  }
};

const openProductDialog = (product, updateHash = true) => {
  if (!productDialog || !dialogTitle) return;

  activeProduct = product;
  activeVariantIndex = 0;
  activeQuantity = 1;
  if (orderQuantity) orderQuantity.value = "1";
  if (orderStatus) orderStatus.textContent = "";

  const images = [getProductImage(product), ...(product.images || [])].filter(Boolean);
  const uniqueImages = [...new Set(images)];

  if (dialogCategory) {
    dialogCategory.textContent = `${product.storeName || "RISUKAI"} / ${product.managementNumber || product.id}`;
  }

  dialogTitle.textContent = product.name;
  dialogTitle.classList.toggle("is-long-title", product.name.length > 60);

  if (dialogTagline) {
    dialogTagline.textContent = product.tagline || "";
  }

  if (dialogPrice) {
    dialogPrice.textContent = formatAmount(product.price || 0);
  }

  setDialogImage(uniqueImages[0], product.name);

  if (dialogThumbs) {
    dialogThumbs.innerHTML = uniqueImages
      .map(
        (image, index) => {
          const thumbSrc = getThumbImage(image);
          return `
          <button class="${index === 0 ? "is-active" : ""}" type="button" data-thumb-src="${escapeHtml(image)}">
            <img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(`${product.name} ${index + 1}`)}" loading="${index < 6 ? "eager" : "lazy"}" decoding="async" fetchpriority="${index < 2 ? "high" : "low"}" width="76" height="76" data-fallback-src="${escapeHtml(getDisplayImage(image))}">
          </button>
        `;
        },
      )
      .join("");
  }

  if (dialogVariants) {
    const variants = product.variants || [];
    dialogVariants.classList.toggle("variant-chips-compact", variants.length > VARIANT_CHIP_LIMIT);
    dialogVariants.innerHTML =
      variants.length > VARIANT_CHIP_LIMIT
        ? `
          <label class="variant-select-field">
            <span>SKU / ${escapeHtml(variants.length)} 種</span>
            <select data-variant-select>
              ${variants
                .map((variant, index) => {
                  return `<option value="${index}">${escapeHtml(variantDisplayLabel(variant))}</option>`;
                })
                .join("")}
            </select>
          </label>
        `
        : variants
            .map(
              (variant, index) => `
                <button class="variant-chip ${index === 0 ? "is-active" : ""}" type="button" data-variant-index="${index}" aria-pressed="${index === 0}">
                  <img src="${escapeHtml(getThumbImage(getVariantImage(variant, product)))}" alt="${escapeHtml(variantDisplayLabel(variant))}" loading="lazy" decoding="async" fetchpriority="low" data-fallback-src="${escapeHtml(getDisplayImage(getProductImage(product)))}">
                  <span>${escapeHtml(variantDisplayLabel(variant))}</span>
                </button>
              `,
            )
            .join("");
  }

  updateVariantSelection(0, false);

  if (updateHash) {
    window.history.pushState(null, "", `#product=${encodeURIComponent(product.id)}`);
    updateCatalogVisibility();
  }

  if (!productDialog.open) {
    productDialog.showModal();
  }
};

const openProductFromHash = () => {
  if (!location.hash.startsWith("#product=") || products.length === 0) return;

  const productId = decodeURIComponent(location.hash.replace("#product=", ""));
  const product = products.find((item) => item.id === productId || item.managementNumber === productId);
  if (product) {
    openProductDialog(product, false);
  }
};

const renderCheckoutSummary = () => {
  if (!checkoutSummary || !activeProduct) return;

  const selectedVariant = getSelectedVariant();
  const unitPrice = getCurrentUnitPrice();
  const total = unitPrice * activeQuantity;

  checkoutSummary.innerHTML = `
    <div class="checkout-product-line">
      <img src="${escapeHtml(getThumbImage(selectedVariant?.image || getProductImage(activeProduct)))}" alt="${escapeHtml(activeProduct.name)}">
      <div>
        <strong>${escapeHtml(activeProduct.name)}</strong>
        <span>${escapeHtml(activeProduct.managementNumber || activeProduct.id)}</span>
        <span>${escapeHtml(selectedVariant?.label || "標準")}</span>
      </div>
    </div>
    <dl>
      <div><dt>単価</dt><dd>${escapeHtml(formatAmount(unitPrice))}</dd></div>
      <div><dt>数量</dt><dd>${escapeHtml(activeQuantity)}</dd></div>
      <div><dt>合計</dt><dd>${escapeHtml(formatAmount(total))}</dd></div>
    </dl>
  `;
};

productGrid?.addEventListener("click", (event) => {
  const link = event.target.closest("[data-product-index]");
  if (!link) return;

  event.preventDefault();
  const product = products[Number(link.dataset.productIndex)];
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

dialogVariants?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-variant-index]");
  if (!button) return;

  updateVariantSelection(Number(button.dataset.variantIndex));
});

dialogVariants?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-variant-select]");
  if (!select) return;

  updateVariantSelection(Number(select.value));
});

document.addEventListener(
  "load",
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    image.closest("[data-thumb-src]")?.classList.add("is-loaded");

    if (image === dialogMainImage) {
      window.clearTimeout(dialogImageLoadTimer);
      dialogMainImage.classList.remove("is-loading");
    }
  },
  true,
);

document.addEventListener(
  "error",
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const fallback = image.dataset.fallbackSrc || "";
    if (fallback && image.src !== fallback) {
      image.src = fallback;
      image.removeAttribute("data-fallback-src");
      return;
    }

    const thumbButton = image.closest("[data-thumb-src]");
    if (thumbButton) {
      thumbButton.hidden = true;
      return;
    }

    if (image === dialogMainImage && activeProduct) {
      const currentIndex = dialogThumbs ? [...dialogThumbs.querySelectorAll("[data-thumb-src]")].findIndex((button) => button.dataset.thumbSrc === image.getAttribute("src")) : -1;
      const fallbackImage = (activeProduct.images || []).find((src, index) => index > currentIndex && src) || getProductImage(activeProduct);
      if (fallbackImage && image.src !== fallbackImage) {
        image.src = fallbackImage;
      }
    }
  },
  true,
);

productDialog?.addEventListener("click", (event) => {
  if (event.target === productDialog) {
    productDialog.close();
  }
});

productDialog?.addEventListener("close", () => {
  if (preserveProductHashOnClose) {
    preserveProductHashOnClose = false;
    return;
  }

  if (location.hash.startsWith("#product=")) {
    window.history.replaceState(null, "", "#products");
    updateCatalogVisibility();
  }
});

orderForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activeProduct) return;

  activeQuantity = Math.max(1, Number(orderQuantity?.value || 1));
  renderCheckoutSummary();
  if (checkoutStatus) checkoutStatus.textContent = "";

  preserveProductHashOnClose = true;
  productDialog?.close();
  checkoutDialog?.showModal();
});

checkoutDialog?.addEventListener("click", (event) => {
  if (event.target === checkoutDialog) {
    checkoutDialog.close();
  }
});

checkoutDialog?.addEventListener("close", () => {
  if (location.hash.startsWith("#product=")) {
    window.history.replaceState(null, "", "#products");
    updateCatalogVisibility();
  }
});

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeProduct || !checkoutStatus) return;

  const formData = new FormData(checkoutForm);
  const selectedVariant = getSelectedVariant();
  const orderDraft = {
    createdAt: new Date().toISOString(),
    productId: activeProduct.id,
    managementNumber: activeProduct.managementNumber,
    variantSku: selectedVariant?.sku || "",
    variantMerchantSku: selectedVariant?.merchantSku || "",
    variantLabel: variantDisplayLabel(selectedVariant || {}),
    quantity: activeQuantity,
    unitPrice: getCurrentUnitPrice(),
    total: getCurrentUnitPrice() * activeQuantity,
    customer: Object.fromEntries(formData.entries()),
  };

  try {
    if (activeProduct.orderEndpoint) {
      const response = await fetch(activeProduct.orderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderDraft),
      });

      if (!response.ok) throw new Error(`Order request failed: ${response.status}`);
      checkoutStatus.textContent = "注文を受け付けました。確認メールをお待ちください。";
      checkoutForm.reset();
      return;
    }

    localStorage.setItem("risukaiOrderDraft", JSON.stringify(orderDraft));
    checkoutStatus.textContent = "注文内容を下書きとして保存しました。受注API接続後に本送信できます。";
  } catch (error) {
    checkoutStatus.textContent = "送信できませんでした。時間をおいてもう一度お試しください。";
    console.error(error);
  }
});

window.addEventListener("hashchange", () => {
  updateCatalogVisibility(true);
  openProductFromHash();
});

const loadProducts = async () => {
  try {
    const response = await fetch(PRODUCTS_DATA_URL);
    if (!response.ok) throw new Error(`Product data request failed: ${response.status}`);
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
    updateCatalogVisibility(location.hash === "#products");
    openProductFromHash();
  } catch (error) {
    if (productGrid) {
      productGrid.innerHTML = `
        <article class="store-product-card product-skeleton">
          <div class="store-product-copy">
            <p class="meta">ERROR</p>
            <h3>商品データを表示できませんでした</h3>
          </div>
        </article>
      `;
    }
    if (productCount) productCount.textContent = "0 商品";
    console.error(error);
  }
};

loadProducts();
