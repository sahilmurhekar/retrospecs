import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Several tests (cache, ai-assist) share a real directory on disk
    // (.retrospecs-cache/). Running test FILES in parallel causes race
    // conditions between one file's cleanup and another's cache writes.
    // Sequential file execution avoids this entirely.
    fileParallelism: false,
  },
});