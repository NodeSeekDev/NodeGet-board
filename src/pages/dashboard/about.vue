<script setup lang="ts">
import { Info } from "lucide-vue-next";
import MarkdownIt from "markdown-it";
import about from "@/about.md?raw";

definePage({
  meta: {
    title: "router.about",
    icon: Info,
    order: 16,
    group: "router.group.system",
  },
});

const md = new MarkdownIt({ html: false });
const rendered = md.render(about);
</script>

<template>
  <div
    class="prose prose-sm dark:prose-invert max-w-none"
    v-html="rendered"
  ></div>
</template>
