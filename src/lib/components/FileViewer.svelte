<script lang="ts">
  /* eslint-disable svelte/no-navigation-without-resolve */
  import { X, ExternalLink, Download, Loader } from "@lucide/svelte";
  import FileIcon from "./FileIcon.svelte";
  import type { R2Object } from "$lib/r2-server";
  import { formatFileSize } from "$lib/utils";
  import { tooltip } from "$lib/tooltip";
  interface Props {
    obj: R2Object | null;
    onClose: () => void;
  }

  let { obj, onClose }: Props = $props();

  let loading = $state(false);
  let error = $state("");
  let textContent = $state("");
  let abortController: AbortController | null = null;

  const getExt = (key: string) => key.split(".").pop()?.toLowerCase() ?? "";

  const getType = (key: string): "image" | "video" | "audio" | "text" | "pdf" | "binary" => {
    const ext = getExt(key);
    if (["png", "jpg", "jpeg", "jfif", "gif", "webp", "svg", "ico"].includes(ext)) return "image";
    if (["mp4", "mov", "webm", "avi"].includes(ext)) return "video";
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a", "opus", "wma"].includes(ext)) return "audio";
    if (
      [
        "txt",
        "md",
        "json",
        "js",
        "ts",
        "css",
        "html",
        "sh",
        "py",
        "rs",
        "go",
        "csv",
        "log",
        "xml",
        "yaml",
        "yml"
      ].includes(ext)
    )
      return "text";
    if (ext === "pdf") return "pdf";
    return "binary";
  };

  const publicUrl = $derived(obj ? `/obj/${obj.key}` : "");
  const fileType = $derived(obj ? getType(obj.key) : "binary");

  $effect(() => {
    if (!obj) {
      textContent = "";
      error = "";
      return;
    }
    textContent = "";
    error = "";
    loading = false;

    if (fileType === "text") {
      loading = true;
      abortController?.abort();
      const ctrl = new AbortController();
      abortController = ctrl;

      fetch(`/obj/${obj.key}`, { signal: ctrl.signal })
        .then((r) => r.text())
        .then((t) => {
          textContent = t;
        })
        .catch((e) => {
          if (e.name !== "AbortError") error = "Failed to load file";
        })
        .finally(() => {
          loading = false;
        });
    }

    return () => {
      abortController?.abort();
    };
  });
</script>

<div class="flex h-full flex-col overflow-hidden">
  {#if !obj}
    <div
      class="flex flex-1 items-center justify-center text-sm tracking-widest text-border uppercase"
    >
      <span>Select a file to preview</span>
    </div>
  {:else}
    <div class="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <FileIcon filename={obj.key.split("/").pop() ?? obj.key} size={14} />
      <span class="flex-1 truncate text-sm text-text" use:tooltip={obj.key}
        >{obj.key.split("/").pop()}</span
      >
      <div class="flex shrink-0 items-center gap-0.5">
        {#if obj.size}
          <span class="mr-1 text-xs text-muted">{formatFileSize(obj.size)}</span>
        {/if}
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="flex cursor-pointer items-center border-none bg-transparent p-1.25 text-muted no-underline transition-colors hover:text-text"
          use:tooltip={"Open in new tab"}
        >
          <ExternalLink size={13} />
        </a>
        <button
          class="flex cursor-pointer items-center border-none bg-transparent p-1.25 text-muted transition-colors hover:text-text"
          onclick={onClose}
          use:tooltip={"Close"}
        >
          <X size={13} />
        </button>
      </div>
    </div>

    <div
      class="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
    >
      {#if loading}
        <div class="flex h-37.5 flex-col items-center justify-center gap-3 text-sm text-muted">
          <Loader size={18} class="spin" />
        </div>
      {:else if error}
        <div class="flex h-37.5 flex-col items-center justify-center gap-3 text-sm text-[#ff8080]">
          {error}
        </div>
      {:else if fileType === "image"}
        <div class="flex min-h-25 items-center justify-center p-4">
          <img src={publicUrl} alt={obj.key} class="block max-w-full object-contain" />
        </div>
      {:else if fileType === "video"}
        <div class="flex w-full items-center justify-center p-4">
          <video class="block bg-black" controls autoplay>
            <source src={publicUrl} />
            <track kind="captions" />
          </video>
        </div>
      {:else if fileType === "audio"}
        <div class="relative flex w-full items-center justify-center p-4">
          <audio class="w-full max-w-96" controls autoplay>
            <source src={publicUrl} />
          </audio>
        </div>
      {:else if fileType === "text"}
        <pre
          class="m-0 p-3 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap text-text">
					{textContent}
				</pre>
      {:else if fileType === "pdf"}
        <iframe src={publicUrl} class="h-full w-full max-w-3xl border" title={obj.key}></iframe>
      {:else}
        <div class="flex h-37.5 flex-col items-center justify-center gap-3 text-sm text-muted">
          <Download size={24} />
          <span>Binary file</span>
          <a
            href={publicUrl}
            class="inline-block bg-accent px-4 py-2 font-mono text-sm font-medium tracking-widest text-bg uppercase no-underline transition-opacity hover:opacity-[0.88]"
            >Download</a
          >
        </div>
      {/if}
    </div>
  {/if}
</div>
