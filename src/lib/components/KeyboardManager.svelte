<script lang="ts" module>
  export interface KeyBind {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    ctrlOrMeta?: boolean;
    shift?: boolean;
    alt?: boolean;
    action: () => void;
    allowInModal?: boolean;
  }
</script>

<script lang="ts">
  interface Props {
    keybinds: KeyBind[];
    isAnyModalOpen: boolean;
  }

  let { keybinds, isAnyModalOpen }: Props = $props();

  const isTextInput = (el: Element | null): boolean => {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
  };

  const matches = (e: KeyboardEvent, bind: KeyBind): boolean => {
    if (e.key !== bind.key) return false;
    if (bind.ctrlOrMeta) {
      if (!e.ctrlKey && !e.metaKey) return false;
    } else {
      if (!!bind.ctrl !== e.ctrlKey) return false;
      if (!!bind.meta !== e.metaKey) return false;
    }
    if (!!bind.shift !== e.shiftKey) return false;
    if (!!bind.alt !== e.altKey) return false;
    return true;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (isTextInput(document.activeElement)) return;
    for (const bind of keybinds) {
      if (isAnyModalOpen && !bind.allowInModal) continue;
      if (matches(e, bind)) {
        e.preventDefault();
        bind.action();
        return;
      }
    }
  };
</script>

<svelte:window onkeydown={handleKeyDown} />
