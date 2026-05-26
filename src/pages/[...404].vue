<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeftIcon, HomeIcon, ShieldQuestionIcon } from "lucide-vue-next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const route = useRoute();
const router = useRouter();

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push("/");
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

const matchedRoutes = computed(() => {
  return route.matched.map((record) => ({
    name: record.name ?? null,
    path: record.path,
    meta: record.meta,
  }));
});

const routeDetails = computed(() => [
  {
    label: "fullPath",
    value: formatValue(route.fullPath),
  },
  {
    label: "path",
    value: formatValue(route.path),
  },
  {
    label: "name",
    value: formatValue(route.name),
  },
  {
    label: "params",
    value: formatValue(route.params),
  },
  {
    label: "query",
    value: formatValue(route.query),
  },
  {
    label: "hash",
    value: formatValue(route.hash),
  },
  {
    label: "meta",
    value: formatValue(route.meta),
  },
  {
    label: "matched",
    value: formatValue(matchedRoutes.value),
  },
  {
    label: "redirectedFrom",
    value: formatValue(
      route.redirectedFrom
        ? {
            fullPath: route.redirectedFrom.fullPath,
            path: route.redirectedFrom.path,
            params: route.redirectedFrom.params,
            query: route.redirectedFrom.query,
            hash: route.redirectedFrom.hash,
          }
        : null,
    ),
  },
]);
</script>

<template>
  <main
    class="grid min-h-dvh place-items-center bg-background p-4 text-foreground"
  >
    <Card class="w-full max-w-xl overflow-hidden border-border/70 shadow-sm">
      <CardHeader class="space-y-3 p-5 pb-3">
        <div class="flex items-center justify-between gap-3">
          <Badge
            variant="secondary"
            class="rounded-full px-2.5 py-1 text-[11px]"
          >
            404 Not Found
          </Badge>

          <div
            class="grid size-8 place-items-center rounded-full border bg-muted/40"
          >
            <ShieldQuestionIcon class="size-4 text-muted-foreground" />
          </div>
        </div>

        <div class="space-y-1">
          <CardTitle class="text-2xl font-semibold tracking-tight">
            页面走丢了
          </CardTitle>

          <CardDescription class="text-sm leading-5">
            你访问的页面不存在、已移动，或链接地址有误。
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-4 p-5 pt-2">
        <section class="rounded-lg border bg-muted/30">
          <div
            class="flex items-center justify-between gap-3 border-b px-3 py-2"
          >
            <p class="text-xs font-medium text-foreground">路由信息</p>

            <Badge variant="outline" class="h-5 rounded-full px-2 text-[10px]">
              debug
            </Badge>
          </div>

          <dl class="max-h-72 divide-y overflow-auto">
            <div
              v-for="item in routeDetails"
              :key="item.label"
              class="grid gap-1 px-3 py-2 sm:grid-cols-[112px_1fr] sm:gap-3"
            >
              <dt class="text-xs font-medium text-muted-foreground">
                {{ item.label }}
              </dt>

              <dd>
                <pre
                  class="font-mono text-xs leading-5 break-all whitespace-pre-wrap text-foreground"
                  >{{ item.value }}</pre
                >
              </dd>
            </div>
          </dl>
        </section>

        <Separator />

        <div class="grid gap-2 sm:grid-cols-2">
          <Button as-child size="sm" class="h-8">
            <RouterLink to="/">
              <HomeIcon class="size-4" />
              回到首页
            </RouterLink>
          </Button>

          <Button variant="outline" size="sm" class="h-8" @click="goBack">
            <ArrowLeftIcon class="size-4" />
            返回上一页
          </Button>
        </div>
      </CardContent>
    </Card>
  </main>
</template>
