const OFFSET = 8;

const css = `
  @keyframes __tt-in {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .__tt {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    background: var(--surface, #161616);
    border: 1px solid var(--border, #2a2a2a);
    color: var(--text, #f0ede6);
    font-family: "DM Mono", monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 4px 8px;
    white-space: nowrap;
    animation: __tt-in 0.1s ease both;
  }
`;

let styleInjected = false;
const injectStyle = () => {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = css;
  document.head.appendChild(el);
};

const show = (trigger: Element, text: string): HTMLDivElement => {
  injectStyle();
  const tt = document.createElement("div");
  tt.className = "__tt";
  tt.textContent = text;
  document.body.appendChild(tt);

  const rect = trigger.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();

  let top = rect.top - ttRect.height - OFFSET;
  if (top < OFFSET) top = rect.bottom + OFFSET;

  const left = Math.max(
    OFFSET,
    Math.min(
      rect.left + rect.width / 2 - ttRect.width / 2,
      window.innerWidth - ttRect.width - OFFSET
    )
  );

  tt.style.top = `${top}px`;
  tt.style.left = `${left}px`;

  return tt;
};

export const tooltip = (node: HTMLElement, text: string) => {
  let el: HTMLDivElement | null = null;

  const enter = () => {
    if (text) el = show(node, text);
  };
  const leave = () => {
    el?.remove();
    el = null;
  };

  node.addEventListener("mouseenter", enter);
  node.addEventListener("mouseleave", leave);
  node.addEventListener("focus", enter);
  node.addEventListener("blur", leave);

  return {
    update(next: string) {
      text = next;
      if (el) el.textContent = next;
    },
    destroy() {
      leave();
      node.removeEventListener("mouseenter", enter);
      node.removeEventListener("mouseleave", leave);
      node.removeEventListener("focus", enter);
      node.removeEventListener("blur", leave);
    }
  };
};
