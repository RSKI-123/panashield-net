const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const newsletter = document.querySelector("[data-newsletter]");
const statusNode = document.querySelector("[data-form-status]");

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
    statusNode.textContent = "Form placeholder ready. Connect your email service later.";
  });
}
