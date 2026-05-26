<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TOKEN_TEMPLATES, type TokenTemplate } from "../tokenTemplates.ts";

const emits = defineEmits<{
  (e: "select", template: TokenTemplate): void;
}>();

const { t } = useI18n();

const templates = computed(() => TOKEN_TEMPLATES);
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <Table>
      <TableBody>
        <TableRow v-for="template in templates" :key="template.id">
          <TableCell class="w-[32%] align-top">
            <div class="font-medium">
              {{ t(template.nameKey) }}
            </div>
          </TableCell>
          <TableCell class="align-top text-sm text-muted-foreground">
            {{ t(template.descriptionKey) }}
          </TableCell>
          <TableCell class="w-[1%] whitespace-nowrap text-right align-middle">
            <Button type="button" @click="emits('select', template)">
              {{ t("dashboard.token.create.templates.useTemplate") }}
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
