const accordionButtons = document.querySelectorAll(".accordion-header");

accordionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    accordionButtons.forEach((btn) => {
      btn.setAttribute("aria-expanded", "false");
      btn.nextElementSibling.classList.remove("open");
    });
    if (!expanded) {
      button.setAttribute("aria-expanded", "true");
      button.nextElementSibling.classList.add("open");
    }
  });
});

const mobileToggle = document.querySelector(".mobile-toggle");
const navLinks = document.querySelector(".nav-links");

if (mobileToggle && navLinks) {
  mobileToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    mobileToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}
