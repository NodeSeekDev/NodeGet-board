<script setup lang="ts">
import { Github } from "lucide-vue-next";
</script>

<template>
  <footer class="mt-8 border-t py-6 md:py-8">
    <div class="container flex flex-col items-center justify-between gap-4 md:h-14 md:flex-row">
      <p class="text-muted-foreground text-center text-sm leading-loose md:text-left">
        Made with ❤️ by NodeSeekDev
      </p>
      <div class="flex items-center gap-4">
        <a
          href="https://github.com/NodeSeekDev/NodeGet"
          target="_blank"
          rel="noreferrer"
          class="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium underline-offset-4 transition-colors hover:underline"
        >
          <Github class="h-4 w-4" />
          GitHub
        </a>
      </div>
    </div>
  </footer>
</template>
