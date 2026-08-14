document.addEventListener("DOMContentLoaded", () => {
    // =====================================================
    // ANIMATED PROGRESS BARS
    // =====================================================
    document.querySelectorAll(".progress-bar[data-progress]").forEach((bar) => {
        const value = Math.max(0, Math.min(100, Number(bar.dataset.progress) || 0));

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                bar.style.width = `${value}%`;
            });
        });
    });

    // =====================================================
    // COLLAPSIBLE SECTIONS
    // =====================================================
    document.querySelectorAll("[data-collapsible]").forEach((section) => {
        const button = section.querySelector(".section-toggle");

        if (!button) {
            return;
        }

        button.addEventListener("click", () => {
            const collapsed = section.classList.toggle("is-collapsed");

            button.setAttribute(
                "aria-expanded",
                String(!collapsed)
            );

            const label = button.querySelector(".toggle-label");

            if (label) {
                label.textContent = collapsed
                    ? "Expandir"
                    : "Recolher";
            }
        });
    });

    // =====================================================
    // FORM FEEDBACK
    // =====================================================
    document.querySelectorAll("form").forEach((form) => {
        form.addEventListener("submit", () => {
            const button = form.querySelector(".action-button");

            if (!button || button.disabled) {
                return;
            }

            button.dataset.originalText = button.textContent.trim();

            const loadingText = button.dataset.loadingText;

            if (loadingText) {
                button.textContent = loadingText;
            }

            button.classList.add("is-loading");
            button.disabled = true;
        });
    });

    // =====================================================
    // FLASH MESSAGE AUTO-HIDE
    // =====================================================
    document.querySelectorAll(".flash-message").forEach((message) => {
        window.setTimeout(() => {
            message.classList.add("is-hiding");

            window.setTimeout(() => {
                message.remove();
            }, 380);
        }, 4500);
    });
});
