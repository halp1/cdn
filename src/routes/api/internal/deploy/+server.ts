import { execSync, spawn } from "child_process";
import type { RequestHandler } from "@sveltejs/kit";

const ANSI_RE = /\x1b(?:[@-Z\\-_]|\[[0-9;]*[a-zA-Z])/g;
const stripAnsi = (s: string) => s.replace(ANSI_RE, "");

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const cwd = process.cwd();

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {}
      };

      let currentCommit = "";
      let targetCommit = "";
      try {
        currentCommit = execSync("git rev-parse --short HEAD", { cwd, stdio: "pipe" })
          .toString()
          .trim();
        execSync("git fetch", { cwd, stdio: "pipe" });
        targetCommit = execSync("git rev-parse --short FETCH_HEAD", { cwd, stdio: "pipe" })
          .toString()
          .trim();
      } catch {
        targetCommit = "";
      }

      enqueue("meta", JSON.stringify({ currentCommit, targetCommit }));

      const child = spawn("bash", ["prod.sh"], { cwd });

      const handleChunk = (chunk: Buffer) => {
        const text = stripAnsi(chunk.toString());
        for (const line of text.split("\n")) {
          const trimmed = line.trimEnd();
          if (trimmed) enqueue("output", JSON.stringify(trimmed));
        }
      };

      child.stdout.on("data", handleChunk);
      child.stderr.on("data", handleChunk);

      child.on("close", (code) => {
        enqueue("done", JSON.stringify({ exitCode: code ?? 1 }));
        try {
          controller.close();
        } catch {}
      });

      child.on("error", (err) => {
        enqueue("output", JSON.stringify(`Error: ${err.message}`));
        enqueue("done", JSON.stringify({ exitCode: 1 }));
        try {
          controller.close();
        } catch {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
};
