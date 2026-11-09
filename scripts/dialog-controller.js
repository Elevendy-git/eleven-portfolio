/* Shared native-dialog behavior for portfolio and work-experience readers. */
(() => {
  "use strict";

  window.createDialogController = (element, { className, onClose = () => {} }) => {
    const root = document.documentElement;
    const openClass = className + "-open";
    const cursorClass = className + "-cursor-active";
    let session;
    let modalCursor;
    let backdropPointerId = null;
    let backdropClickReady = false;

    function restoreCursor() {
      root.classList.remove(cursorClass);
      if (!modalCursor) return;
      if (modalCursor.matches(":popover-open")) modalCursor.hidePopover();
      modalCursor.removeAttribute("popover");
      modalCursor = null;
    }

    function liftCursor() {
      // Reopening before a queued close event must put the cursor above the
      // new dialog, rather than leave its previous popover underneath it.
      restoreCursor();
      const cursor = document.querySelector(".cursor-fx");
      if (!root.classList.contains("has-cursor-fx") || !cursor || typeof cursor.showPopover !== "function") return;
      cursor.setAttribute("popover", "manual");
      try {
        cursor.showPopover();
        modalCursor = cursor;
        root.classList.add(cursorClass);
      } catch {
        cursor.removeAttribute("popover");
      }
    }

    function restorePage() {
      // Native close events are queued. An older close must not reset a
      // newly opened dialog, and duplicate close events restore only once.
      if (element.open || !session) return;
      const previous = session;
      session = null;
      root.classList.remove(openClass);
      restoreCursor();
      backdropPointerId = null;
      backdropClickReady = false;
      delete element.dataset.dialogInput;
      onClose();
      if (window.portfolioCardInteractions) {
        window.portfolioCardInteractions.restoreFocus(previous.trigger, previous.activation);
      } else if (previous.trigger?.isConnected) {
        previous.trigger.focus({ preventScroll: true });
      }
      window.scrollTo({ left: previous.scroll.x, top: previous.scroll.y, behavior: "instant" });
    }

    function isOutside(event) {
      const bounds = element.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    }

    element.addEventListener("close", restorePage);
    element.addEventListener("cancel", (event) => {
      event.preventDefault();
      element.close();
    });
    element.querySelector("[data-dialog-close]").addEventListener("click", () => element.close());
    element.addEventListener("keydown", (event) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
        element.dataset.dialogInput = "keyboard";
      }
    });
    element.addEventListener("pointerdown", (event) => {
      element.dataset.dialogInput = "pointer";
      backdropClickReady = false;
      backdropPointerId = event.button === 0 && event.target === element && isOutside(event) ? event.pointerId : null;
    });
    element.addEventListener("pointerup", (event) => {
      backdropClickReady = backdropPointerId === event.pointerId && event.target === element && isOutside(event);
      backdropPointerId = null;
    });
    element.addEventListener("pointercancel", () => {
      backdropPointerId = null;
      backdropClickReady = false;
    });
    element.addEventListener("click", (event) => {
      const shouldClose = backdropClickReady && event.target === element && isOutside(event);
      backdropClickReady = false;
      if (shouldClose) element.close();
    });

    return {
      open(trigger, event, afterOpen = () => {}) {
        if (element.open) return false;
        session = {
          trigger,
          activation: window.portfolioCardInteractions?.suspend(trigger, event),
          scroll: { x: window.scrollX, y: window.scrollY },
        };
        // Safari may mark autofocus and native selects as focus-visible after
        // a tap. Use the actual activation method for the dialog focus ring.
        element.dataset.dialogInput = session.activation?.keyboard ? "keyboard" : "pointer";
        backdropPointerId = null;
        backdropClickReady = false;
        root.classList.add(openClass);
        try {
          element.showModal();
          liftCursor();
          afterOpen();
        } catch (error) {
          if (element.open) element.close();
          restorePage();
          throw error;
        }
        return true;
      },
    };
  };
})();
