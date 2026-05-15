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
const orderForm = document.querySelector("[data-order-form]");
const orderQuantity = document.querySelector("[data-order-quantity]");
const orderStatus = document.querySelector("[data-order-status]");
const checkoutDialog = document.querySelector("[data-checkout-dialog]");
const checkoutForm = document.querySelector("[data-checkout-form]");
const checkoutSummary = document.querySelector("[data-checkout-summary]");
const checkoutStatus = document.querySelector("[data-checkout-status]");

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

const getProductImage = (product) => product.whiteBgImage || product.mainImage || product.images?.[0] || "";

const getSelectedVariant = () => activeProduct?.variants?.[activeVariantIndex] || null;

const getCurrentUnitPrice = () => getSelectedVariant()?.price || activeProduct?.price || 0;

const renderProducts = () => {
  if (!productGrid) return;

  productGrid.innerHTML = products
    .map((product, index) => {
      const image = getProductImage(product);
      const price = formatAmount(product.price || 0);
      const label = `${product.category || "商品"} / ${product.managementNumber || product.id}`;
      const detailHash = `#product=${encodeURIComponent(product.id)}`;

      return `
        <article class="store-product-card">
          <a class="store-product-button" href="${detailHash}" data-product-index="${index}">
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
  dialogMainImage.src = src;
  dialogMainImage.alt = alt;
};

const updateVariantSelection = (variantIndex) => {
  activeVariantIndex = variantIndex;
  const selectedVariant = getSelectedVariant();

  if (selectedVariant?.image) {
    setDialogImage(selectedVariant.image, selectedVariant.label || activeProduct?.name || "");
  }

  if (dialogPrice) {
    dialogPrice.textContent = formatAmount(getCurrentUnitPrice());
  }

  dialogVariants?.querySelectorAll("[data-variant-index]").forEach((button) => {
    const isActive = Number(button.dataset.variantIndex) === activeVariantIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
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
        (variant, index) => `
          <button class="variant-chip ${index === 0 ? "is-active" : ""}" type="button" data-variant-index="${index}" aria-pressed="${index === 0}">
            <img src="${escapeHtml(variant.image)}" alt="${escapeHtml(variant.label)}" loading="eager">
            <span>${escapeHtml(variant.label)}</span>
          </button>
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

  updateVariantSelection(0);

  if (updateHash) {
    window.history.pushState(null, "", `#product=${encodeURIComponent(product.id)}`);
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
      <img src="${escapeHtml(selectedVariant?.image || getProductImage(activeProduct))}" alt="${escapeHtml(activeProduct.name)}">
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
    variantLabel: selectedVariant?.label || "",
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

window.addEventListener("hashchange", openProductFromHash);

const loadProducts = async () => {
  if (!productGrid) return;

  try {
    const response = await fetch("assets/data/products.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Product data request failed: ${response.status}`);
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
    renderProducts();
    openProductFromHash();
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
