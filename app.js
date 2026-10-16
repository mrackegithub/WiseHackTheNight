const ctaButton = document.getElementById("cta-button");
const statusText = document.getElementById("status-text");

if (ctaButton && statusText) {
  ctaButton.addEventListener("click", () => {
    statusText.textContent = "Thanks! We will contact you with next steps.";
  });
}
