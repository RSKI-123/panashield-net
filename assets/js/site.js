const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const newsletter = document.querySelector("[data-newsletter]");
const statusNode = document.querySelector("[data-form-status]");
const productGrid = document.querySelector("[data-product-grid]");
const productCount = document.querySelector("[data-product-count]");
const productDetail = document.querySelector("[data-product-detail]");
const productMainImage = document.querySelector("[data-product-main-image]");
const productThumbs = document.querySelector("[data-product-thumbs]");
const productStore = document.querySelector("[data-product-store]");
const productTitle = document.querySelector("[data-product-title]");
const productTagline = document.querySelector("[data-product-tagline]");
const productPrice = document.querySelector("[data-product-price]");
const productVariants = document.querySelector("[data-product-variants]");
const productQuantity = document.querySelector("[data-product-quantity]");
const productSpecs = document.querySelector("[data-product-specs]");
const productDescription = document.querySelector("[data-product-description]");
const productFeatures = document.querySelector("[data-product-features]");
const productStatus = document.querySelector("[data-product-status]");
const addCartButton = document.querySelector("[data-add-cart]");
const buyNowButton = document.querySelector("[data-buy-now]");
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

const formatAmount = (amount = 0) => currencyFormatter.format(amount);

const getProductImage = (product) => product.whiteBgImage || product.mainImage || product.images?.[0] || "";

const getMainDetailImage = (product) => product.mainImage || getProductImage(product);

const getSelectedVariant = () => activeProduct?.variants?.[activeVariantIndex] || null;

const getQuantity = () => Math.max(1, Number(productQuantity?.value || 1));

const getUnitPrice = () => getSelectedVariant()?.price || activeProduct?.price || 0;

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
    statusNode.textContent = "登録ありがとうございます。新商品情報をお届けします。";
  });
}

const renderProductCards = () => {
  if (!productGrid) return;

  productGrid.innerHTML = products
    .map((product) => {
      const image = getProductImage(product);
      const price = formatAmount(product.price || 0);
      const label = `${product.category || "商品"} / ${product.managementNumber || product.id}`;
      const detailPath = product.detailPath || `product.html?product=${encodeURIComponent(product.id)}`;

      return `
        <article class="store-product-card">
          <a class="store-product-button" href="${escapeHtml(detailPath)}">
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

const setDetailImage = (src, alt) => {
  if (!productMainImage || !src) return;
  productMainImage.src = src;
  productMainImage.alt = alt;
};

const renderCheckoutSummary = () => {
  if (!checkoutSummary || !activeProduct) return;

  const variant = getSelectedVariant();
  const quantity = getQuantity();
  const unitPrice = getUnitPrice();

  checkoutSummary.innerHTML = `
    <div class="checkout-product-line">
      <img src="${escapeHtml(variant?.image || getProductImage(activeProduct))}" alt="${escapeHtml(activeProduct.name)}">
      <div>
        <strong>${escapeHtml(activeProduct.name)}</strong>
        <span>${escapeHtml(activeProduct.managementNumber || activeProduct.id)}</span>
        <span>${escapeHtml(variant?.label || "標準")}</span>
      </div>
    </div>
    <dl>
      <div><dt>単価</dt><dd>${escapeHtml(formatAmount(unitPrice))}</dd></div>
      <div><dt>数量</dt><dd>${escapeHtml(quantity)}</dd></div>
      <div><dt>合計</dt><dd>${escapeHtml(formatAmount(unitPrice * quantity))}</dd></div>
    </dl>
  `;
};

const updateVariantSelection = (variantIndex) => {
  activeVariantIndex = variantIndex;
  const variant = getSelectedVariant();

  productVariants?.querySelectorAll("[data-variant-index]").forEach((button) => {
    const isActive = Number(button.dataset.variantIndex) === activeVariantIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (productPrice) {
    productPrice.textContent = formatAmount(getUnitPrice());
  }

  if (variant?.image) {
    setDetailImage(variant.image, `${activeProduct.name} ${variant.label}`);
  }

  renderCheckoutSummary();
};

const renderProductPage = () => {
  if (!productDetail) return;

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("product") || window.location.hash.replace("#product=", "") || products[0]?.id;
  activeProduct = products.find((product) => product.id === productId || product.managementNumber === productId);

  if (!activeProduct) {
    productDetail.innerHTML = "<p>商品が見つかりませんでした。</p>";
    return;
  }

  activeVariantIndex = 0;
  document.title = `${activeProduct.name} | RISUKAI`;

  const galleryImages = [getMainDetailImage(activeProduct), getProductImage(activeProduct), ...(activeProduct.images || [])]
    .filter(Boolean);
  const uniqueImages = [...new Set(galleryImages)];

  setDetailImage(uniqueImages[0], activeProduct.name);

  if (productThumbs) {
    productThumbs.innerHTML = uniqueImages
      .map(
        (image, index) => `
          <button class="${index === 0 ? "is-active" : ""}" type="button" data-detail-thumb="${escapeHtml(image)}">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(`${activeProduct.name} ${index + 1}`)}" loading="eager">
          </button>
        `,
      )
      .join("");
  }

  if (productStore) productStore.textContent = activeProduct.storeName || "RISUKAI";
  if (productTitle) productTitle.textContent = activeProduct.name;
  if (productTagline) productTagline.textContent = activeProduct.tagline || "";
  if (productPrice) productPrice.textContent = formatAmount(activeProduct.price || 0);

  if (productVariants) {
    productVariants.innerHTML = (activeProduct.variants || [])
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

  if (productSpecs) {
    productSpecs.innerHTML = (activeProduct.specs || [])
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

  if (productDescription) {
    productDescription.innerHTML = (activeProduct.description || [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }

  if (productFeatures) {
    productFeatures.innerHTML = (activeProduct.features || [])
      .map((feature) => `<li>${escapeHtml(feature)}</li>`)
      .join("");
  }

  renderCheckoutSummary();
};

productThumbs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-detail-thumb]");
  if (!button || !activeProduct) return;

  setDetailImage(button.dataset.detailThumb, activeProduct.name);
  productThumbs.querySelectorAll("button").forEach((thumb) => thumb.classList.toggle("is-active", thumb === button));
});

productVariants?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-variant-index]");
  if (!button) return;

  updateVariantSelection(Number(button.dataset.variantIndex));
});

document.querySelectorAll("[data-quantity-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!productQuantity) return;
    const delta = button.dataset.quantityAction === "plus" ? 1 : -1;
    productQuantity.value = String(Math.max(1, getQuantity() + delta));
    renderCheckoutSummary();
  });
});

productQuantity?.addEventListener("input", renderCheckoutSummary);

addCartButton?.addEventListener("click", () => {
  if (!activeProduct || !productStatus) return;

  const variant = getSelectedVariant();
  const cartItem = {
    productId: activeProduct.id,
    managementNumber: activeProduct.managementNumber,
    variantSku: variant?.sku || "",
    variantLabel: variant?.label || "",
    quantity: getQuantity(),
    unitPrice: getUnitPrice(),
  };

  localStorage.setItem("risukaiCartItem", JSON.stringify(cartItem));
  productStatus.textContent = "カートに追加しました。下の注文フォームから続けて入力できます。";
});

buyNowButton?.addEventListener("click", () => {
  document.querySelector("#order")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeProduct || !checkoutStatus) return;

  const variant = getSelectedVariant();
  const orderDraft = {
    createdAt: new Date().toISOString(),
    productId: activeProduct.id,
    managementNumber: activeProduct.managementNumber,
    variantSku: variant?.sku || "",
    variantLabel: variant?.label || "",
    quantity: getQuantity(),
    unitPrice: getUnitPrice(),
    total: getUnitPrice() * getQuantity(),
    customer: Object.fromEntries(new FormData(checkoutForm).entries()),
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

const loadProducts = async () => {
  try {
    const response = await fetch("assets/data/products.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Product data request failed: ${response.status}`);
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
    renderProductCards();
    renderProductPage();
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
