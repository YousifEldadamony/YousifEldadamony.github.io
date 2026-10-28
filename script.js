(() => {
  const initialize = () => {
    if (window.__portfolioInteractionsInitialized) return;
    window.__portfolioInteractionsInitialized = true;
    document.documentElement.classList.add("js-enabled");

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    const themeToggle = document.querySelector(".theme-toggle");
    themeToggle?.addEventListener("click", () => {
      const lightThemeEnabled = document.body.classList.toggle("light-theme");
      themeToggle.setAttribute("aria-pressed", String(lightThemeEnabled));
      themeToggle.setAttribute(
        "aria-label",
        lightThemeEnabled ? "Switch to dark mode" : "Switch to light mode",
      );
    });

    const navToggle = document.querySelector(".nav-toggle");
    const mainNav = document.querySelector(".main-nav");
    if (navToggle && mainNav) {
      const mobileViewport = window.matchMedia("(max-width: 720px)");
      const setNavOpen = (isOpen) => {
        navToggle.classList.toggle("is-open", isOpen);
        mainNav.classList.toggle("is-open", isOpen);
        navToggle.setAttribute("aria-expanded", String(isOpen));
        mainNav.inert = mobileViewport.matches && !isOpen;
      };

      navToggle.addEventListener("click", () => {
        setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
      });
      mainNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) setNavOpen(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || navToggle.getAttribute("aria-expanded") !== "true") return;
        setNavOpen(false);
        navToggle.focus();
      });
      document.addEventListener("pointerdown", (event) => {
        if (!mainNav.contains(event.target) && !navToggle.contains(event.target)) {
          setNavOpen(false);
        }
      });
      mainNav.addEventListener("focusout", (event) => {
        if (event.relatedTarget && !mainNav.contains(event.relatedTarget) && event.relatedTarget !== navToggle) {
          setNavOpen(false);
        }
      });
      mobileViewport.addEventListener("change", () => {
        if (mobileViewport.matches && mainNav.contains(document.activeElement)) navToggle.focus();
        setNavOpen(false);
      });
      setNavOpen(false);
    }

    const revealTargets = document.querySelectorAll(
      "#about .container, #gallery .case-title, #gallery .showcase-grid, #planning-guided-surgery .container > h2, #guided-surgery-cards .model-card, #capabilities .card, #workstation .stack-list, .contact-section",
    );
    const showAll = () => {
      revealTargets.forEach((element) => {
        element.classList.remove("reveal");
        element.classList.add("is-visible");
      });
    };

    if (motionPreference.matches || !("IntersectionObserver" in window)) {
      showAll();
    } else {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

      revealTargets.forEach((element) => {
        element.classList.add("reveal");
        observer.observe(element);
      });
      motionPreference.addEventListener("change", (event) => {
        if (!event.matches) return;
        observer.disconnect();
        showAll();
      });
    }

    document.querySelectorAll(".image-comparison-container").forEach((container) => {
      const control = container.querySelector(".comparison-range");
      if (!control) return;
      const helper = document.getElementById(control.getAttribute("aria-describedby"));

      let activePointer = null;
      let dragRect = null;

      const renderPosition = () => {
        container.style.setProperty("--comparison-position", `${control.valueAsNumber}%`);
      };
      const updateFromPointer = (event) => {
        if (!dragRect?.width) return;
        const fraction = (event.clientX - dragRect.left) / dragRect.width;
        control.value = String(Math.max(0, Math.min(100, fraction * 100)));
        renderPosition();
      };
      const stopDrag = () => {
        const pointerId = activePointer;
        activePointer = null;
        dragRect = null;
        container.classList.remove("is-dragging");
        if (pointerId !== null && control.hasPointerCapture(pointerId)) {
          control.releasePointerCapture(pointerId);
        }
      };

      control.addEventListener("input", renderPosition);
      control.addEventListener("pointerdown", (event) => {
        if (!event.isPrimary || event.button !== 0) return;
        // Native range semantics handle keys; pointer capture keeps drags in bounds.
        event.preventDefault();
        control.focus({ preventScroll: true });
        activePointer = event.pointerId;
        dragRect = container.getBoundingClientRect();
        control.setPointerCapture(activePointer);
        container.classList.add("is-dragging");
        updateFromPointer(event);
      });
      control.addEventListener("pointermove", (event) => {
        if (event.pointerId === activePointer) updateFromPointer(event);
      });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => {
        control.addEventListener(type, (event) => {
          if (event.pointerId === activePointer) stopDrag();
        });
      });
      window.addEventListener("blur", stopDrag);
      window.addEventListener("resize", stopDrag);
      control.disabled = false;
      if (helper) helper.textContent = "Drag or use arrow keys to compare";
      renderPosition();
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
