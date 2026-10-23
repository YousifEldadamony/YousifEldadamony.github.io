document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const id = link.getAttribute("href");
    if (!id || id === "#") return;

    const target = document.querySelector(id);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const themeToggle = document.querySelector(".theme-toggle");
const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

themeToggle?.addEventListener("click", () => {
  const lightThemeEnabled = !document.body.classList.contains("light-theme");

  document.body.classList.toggle("light-theme", lightThemeEnabled);
  themeToggle.setAttribute("aria-pressed", String(lightThemeEnabled));
  themeToggle.setAttribute(
    "aria-label",
    lightThemeEnabled ? "Switch to dark mode" : "Switch to light mode",
  );
});

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.classList.toggle("is-open");
  mainNav?.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navToggle?.classList.remove("is-open");
    mainNav?.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

// --- Image Comparison Slider Logic ---
document.querySelectorAll('.image-comparison-container').forEach(container => {
  const overlayWrapper = container.querySelector('.img-overlay-wrapper');
  const overlayImage = container.querySelector('.img-overlay');
  const sliderThumb = container.querySelector('.slider-thumb');

  let isDragging = false;
  let cachedRect = null;

  // Set initial width of overlay image to match container to prevent squishing
  const setOverlayImageWidth = () => {
    cachedRect = container.getBoundingClientRect();
    const containerWidth = cachedRect.width;
    overlayImage.style.width = `${containerWidth}px`;
  };

  const setPosition = (percent) => {
    const boundedPercent = Math.max(0, Math.min(percent, 100));
    overlayWrapper.style.width = `${boundedPercent}%`;
    sliderThumb.style.left = `${boundedPercent}%`;
    if (sliderThumb.getAttribute('role') === 'slider') {
      sliderThumb.setAttribute('aria-valuenow', String(Math.round(boundedPercent)));
    }
  };

  // Call once on load, and on window resize
  setOverlayImageWidth();
  window.addEventListener('resize', setOverlayImageWidth);

  const handleDrag = (e) => {
    if (!isDragging || !cachedRect) return;

    const clientX = e.type.includes('mouse') ? e.clientX : (e.touches ? e.touches[0].clientX : e.clientX);

    // Calculate x relative to container, bound between 0 and container width
    const x = Math.max(0, Math.min(clientX - cachedRect.left, cachedRect.width));
    const percent = (x / cachedRect.width) * 100;
    setPosition(percent);
  };

  const startDrag = (e) => {
    isDragging = true;
    cachedRect = container.getBoundingClientRect();
    handleDrag(e);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('touchmove', handleDrag, {passive: true});
    window.addEventListener('touchend', stopDrag);
  };

  const stopDrag = () => {
    isDragging = false;
    window.removeEventListener('mousemove', handleDrag);
    window.removeEventListener('mouseup', stopDrag);
    window.removeEventListener('touchmove', handleDrag);
    window.removeEventListener('touchend', stopDrag);
  };

  // Mouse events
  container.addEventListener('mousedown', startDrag);

  // Touch events
  container.addEventListener('touchstart', startDrag, {passive: true});

  sliderThumb.addEventListener('keydown', (e) => {
    if (sliderThumb.getAttribute('role') !== 'slider') return;

    const parsedLeft = Number.parseFloat(sliderThumb.style.left);
    const current = Number.isNaN(parsedLeft) ? 50 : parsedLeft;
    let next = current;

    if (e.key === 'ArrowLeft') next = current - 5;
    if (e.key === 'ArrowRight') next = current + 5;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = 100;
    if (next === current) return;

    e.preventDefault();
    setPosition(next);
  });
});

document.querySelectorAll('img-comparison-slider[role="slider"]').forEach((slider) => {
  slider.addEventListener('slide', (event) => {
    const detail = event.detail || {};
    const rawValue = Number(
      detail.value ?? detail.percent ?? (typeof detail.x === 'number' ? detail.x * 100 : Number.NaN),
    );

    if (!Number.isFinite(rawValue)) return;

    const boundedValue = Math.max(0, Math.min(rawValue, 100));
    slider.setAttribute('aria-valuenow', String(Math.round(boundedValue)));
  });
});
