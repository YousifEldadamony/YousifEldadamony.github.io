(() => {
  if (window.__portfolioInteractionsInitialized) {
    return;
  }
  window.__portfolioInteractionsInitialized = true;

  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  const initSmoothScrolling = () => {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      if (link.dataset.smoothScrollBound === "true") return;
      link.dataset.smoothScrollBound = "true";

      link.addEventListener("click", (event) => {
        const id = link.getAttribute("href");
        if (!id || id === "#") return;

        const target = document.querySelector(id);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
      });
    });
  };

  const initThemeToggle = () => {
    const themeToggle = document.querySelector(".theme-toggle");
    if (!themeToggle || themeToggle.dataset.themeBound === "true") return;

    themeToggle.dataset.themeBound = "true";
    themeToggle.addEventListener("click", () => {
      const lightThemeEnabled = !document.body.classList.contains("light-theme");

      document.body.classList.toggle("light-theme", lightThemeEnabled);
      themeToggle.setAttribute("aria-pressed", String(lightThemeEnabled));
      themeToggle.setAttribute(
        "aria-label",
        lightThemeEnabled ? "Switch to dark mode" : "Switch to light mode",
      );
    });
  };

  const initMobileNav = () => {
    const navToggle = document.querySelector(".nav-toggle");
    const mainNav = document.querySelector(".main-nav");
    if (!navToggle || !mainNav || navToggle.dataset.navBound === "true") return;

    navToggle.dataset.navBound = "true";
    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.classList.toggle("is-open");
      mainNav.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach((link) => {
      if (link.dataset.navCloseBound === "true") return;
      link.dataset.navCloseBound = "true";

      link.addEventListener("click", () => {
        navToggle.classList.remove("is-open");
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  };

  const initScrollReveal = () => {
    const revealTargets = document.querySelectorAll(
      "#about .container, #gallery .case-title, #gallery .showcase-grid, #planning-guided-surgery .container > h2, #guided-surgery-cards .model-card, #capabilities .card, #workstation .stack-list, .contact-section",
    );

    if (!revealTargets.length) return;

    const showImmediately = () => {
      revealTargets.forEach((element) => {
        element.classList.remove("reveal");
        element.classList.add("is-visible");
      });
    };

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      showImmediately();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    revealTargets.forEach((element) => {
      element.classList.add("reveal");
      observer.observe(element);
    });
  };

  const initImageComparisonSliders = () => {
    document.querySelectorAll(".image-comparison-container").forEach((container) => {
      if (container.dataset.sliderBound === "true") return;
      container.dataset.sliderBound = "true";

      const overlayWrapper = container.querySelector(".img-overlay-wrapper");
      const overlayImage = container.querySelector(".img-overlay");
      const sliderThumb = container.querySelector(".slider-thumb");
      if (!overlayWrapper || !overlayImage || !sliderThumb) return;

      let isDragging = false;
      let cachedRect = null;

      const setOverlayImageWidth = () => {
        cachedRect = container.getBoundingClientRect();
        overlayImage.style.width = `${cachedRect.width}px`;
      };

      const setPosition = (percent) => {
        const boundedPercent = Math.max(0, Math.min(percent, 100));
        overlayWrapper.style.width = `${boundedPercent}%`;
        sliderThumb.style.left = `${boundedPercent}%`;

        if (sliderThumb.getAttribute("role") === "slider") {
          sliderThumb.setAttribute("aria-valuenow", String(Math.round(boundedPercent)));
        }
      };

      setOverlayImageWidth();
      window.addEventListener("resize", setOverlayImageWidth);

      const handleDrag = (event) => {
        if (!isDragging || !cachedRect) return;

        const clientX = event.type.includes("mouse")
          ? event.clientX
          : (event.touches ? event.touches[0].clientX : event.clientX);

        const x = Math.max(0, Math.min(clientX - cachedRect.left, cachedRect.width));
        const percent = (x / cachedRect.width) * 100;
        setPosition(percent);
      };

      const stopDrag = () => {
        if (!isDragging) return;

        isDragging = false;
        container.classList.remove("is-dragging");
        window.removeEventListener("mousemove", handleDrag);
        window.removeEventListener("mouseup", stopDrag);
        window.removeEventListener("touchmove", handleDrag);
        window.removeEventListener("touchend", stopDrag);
        window.removeEventListener("touchcancel", stopDrag);
      };

      const startDrag = (event) => {
        isDragging = true;
        container.classList.add("is-dragging");
        cachedRect = container.getBoundingClientRect();

        handleDrag(event);
        window.addEventListener("mousemove", handleDrag);
        window.addEventListener("mouseup", stopDrag);
        window.addEventListener("touchmove", handleDrag, { passive: true });
        window.addEventListener("touchend", stopDrag);
        window.addEventListener("touchcancel", stopDrag);
      };

      container.addEventListener("mousedown", startDrag);
      container.addEventListener("touchstart", startDrag, { passive: true });

      sliderThumb.addEventListener("keydown", (event) => {
        if (sliderThumb.getAttribute("role") !== "slider") return;

        const current = Number.parseFloat(sliderThumb.style.left) || 50;
        let next = current;

        if (event.key === "ArrowLeft") next = current - 5;
        if (event.key === "ArrowRight") next = current + 5;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = 100;
        if (next === current) return;

        event.preventDefault();
        setPosition(next);
      });
    });
  };

  const initWebComponentSliders = () => {
    document.querySelectorAll('img-comparison-slider[role="slider"]').forEach((slider) => {
      if (slider.dataset.sliderAriaBound === "true") return;
      slider.dataset.sliderAriaBound = "true";

      slider.addEventListener("slide", (event) => {
        const detail = event.detail || {};
        const rawValue = Number(
          detail.value ?? detail.percent ?? (typeof detail.x === "number" ? detail.x * 100 : Number.NaN),
        );

        if (!Number.isFinite(rawValue)) return;

        const boundedValue = Math.max(0, Math.min(rawValue, 100));
        slider.setAttribute("aria-valuenow", String(Math.round(boundedValue)));
      });
    });
  };

  initSmoothScrolling();
  initThemeToggle();
  initMobileNav();
  initScrollReveal();
  initImageComparisonSliders();
  initWebComponentSliders();
})();
