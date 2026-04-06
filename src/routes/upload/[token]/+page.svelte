<script lang="ts">
  import type { PageData } from "./$types";
  import { getPresignedUploadUrl, confirmUpload } from "$lib/api/upload.remote";
  import { Upload, CheckCircle, XCircle, Loader } from "@lucide/svelte";
  import { formatFileSize } from "$lib/utils";

  interface Props {
    data: PageData;
  }
  let { data }: Props = $props();

  let files = $state<FileList | null>(null);
  let uploading = $state(false);
  let progress = $state(0);
  let done = $state(false);
  let errorMsg = $state("");
  let remainingUploads = $state(0);
  $effect(() => {
    remainingUploads = data.remainingUploads;
  });
  let dropActive = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  const upload = async () => {
    if (!files || files.length === 0) return;
    uploading = true;
    errorMsg = "";
    progress = 0;

    const file = files[0];
    try {
      const result = await getPresignedUploadUrl({
        token: data.token,
        filename: file.name,
        fileType: file.type || "application/octet-stream",
        size: file.size
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) progress = Math.round((e.loaded / e.total) * 100);
        });
        xhr.open("PUT", result.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.onload = () =>
          xhr.status < 300 ? resolve() : reject(new Error(`Upload failed — status ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(file);
      });

      await confirmUpload({ token: data.token });

      remainingUploads = Math.max(0, remainingUploads - 1);
      done = true;
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : "Upload failed";
    } finally {
      uploading = false;
    }
  };

  const formatExpiry = (ts: number): string => {
    const diff = ts - Math.floor(Date.now() / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
</script>

<div class="relative z-1 flex min-h-screen items-center justify-center p-6">
  <div
    class="card relative w-full max-w-105 animate-[fadeUp_0.5s_ease_both] border border-border bg-surface px-10 py-12"
  >
    <p class="mb-5 text-xs tracking-[0.18em] text-accent uppercase">Secure upload</p>
    <h1 class="font-heading mb-6 text-5xl text-text">Upload file.</h1>

    <div class="mb-7 flex flex-wrap gap-3 border-b border-border pb-5">
      <span class="flex flex-col gap-0.75">
        <span class="text-xs tracking-[0.16em] text-muted uppercase">Path</span>
        <code class="font-mono text-sm text-text">{data.targetPath}</code>
      </span>
      <span class="flex flex-col gap-0.75">
        <span class="text-xs tracking-[0.16em] text-muted uppercase">Remaining</span>
        <span class="font-mono text-sm text-text">{remainingUploads} / {data.maxUploads}</span>
      </span>
      <span class="flex flex-col gap-0.75">
        <span class="text-xs tracking-[0.16em] text-muted uppercase">Expires in</span>
        <span class="font-mono text-sm text-accent">{formatExpiry(data.expiresAt)}</span>
      </span>
    </div>

    {#if done}
      <div class="flex flex-col items-center gap-3 py-6 text-lg text-accent">
        <CheckCircle size={28} />
        <span>Upload complete!</span>
        {#if remainingUploads > 0}
          <button
            class="mt-2 cursor-pointer border border-border bg-transparent px-4 py-2 font-mono text-xs tracking-widest text-muted uppercase transition-all hover:border-accent hover:text-accent"
            style="border-radius:0"
            onclick={() => {
              done = false;
              files = null;
              progress = 0;
            }}
          >
            Upload another
          </button>
        {/if}
      </div>
    {:else}
      <div
        class="justify-content-center mb-5 flex cursor-pointer flex-col items-center gap-2.5 border border-dashed px-5 py-9 text-sm text-muted transition-[border-color,background] hover:border-accent hover:bg-accent/4 {dropActive
          ? 'border-accent bg-accent/4'
          : 'border-border'} {files && files.length > 0 ? 'border-solid border-accent' : ''}"
        role="button"
        tabindex="0"
        onclick={() => fileInput?.click()}
        onkeydown={(e) => e.key === "Enter" && fileInput?.click()}
        ondragover={(e) => {
          e.preventDefault();
          dropActive = true;
        }}
        ondragleave={() => {
          dropActive = false;
        }}
        ondrop={(e) => {
          e.preventDefault();
          dropActive = false;
          if (e.dataTransfer?.files.length) files = e.dataTransfer.files;
        }}
      >
        {#if files && files.length > 0}
          <p class="text-center text-base break-all text-text">{files[0].name}</p>
          <p class="text-sm text-muted">{formatFileSize(files[0].size)}</p>
        {:else}
          <Upload size={20} />
          <span>Drop file here or click to browse</span>
        {/if}
      </div>

      <input
        bind:this={fileInput}
        type="file"
        class="hidden"
        onchange={(e) => {
          files = (e.target as HTMLInputElement).files;
        }}
      />

      {#if errorMsg}
        <p
          class="mb-4 flex items-center gap-1.5 border border-[rgba(255,80,80,0.3)] bg-[rgba(255,80,80,0.1)] px-3 py-2 text-sm text-[#ff8080]"
        >
          <XCircle size={13} />{errorMsg}
        </p>
      {/if}

      {#if uploading}
        <div class="mb-2 h-0.5 bg-border">
          <div
            class="h-full bg-accent transition-[width_0.1s_ease]"
            style="width: {progress}%"
          ></div>
        </div>
        <p class="mb-4 text-right text-xs text-muted">{progress}%</p>
      {/if}

      <button
        class="flex w-full cursor-pointer items-center justify-center gap-2 border-none bg-accent py-3.5 font-mono text-sm font-medium tracking-[0.12em] text-bg uppercase transition-opacity hover:opacity-[0.88] disabled:cursor-not-allowed disabled:opacity-40"
        style="border-radius:0"
        disabled={!files || uploading}
        onclick={upload}
      >
        {#if uploading}<Loader size={13} class="spin" /> Uploading…{:else}Upload{/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .card::before {
    content: "";
    position: absolute;
    top: -1px;
    right: -1px;
    width: 32px;
    height: 32px;
    border-top: 2px solid var(--color-accent);
    border-right: 2px solid var(--color-accent);
  }
</style>
