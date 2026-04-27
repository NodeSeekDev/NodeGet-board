<script setup lang="ts">
import { computed, ref } from "vue";
import { Check, ChevronsUpDown, X } from "lucide-vue-next";
import {
  AutocompleteAnchor,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompletePortal,
  AutocompleteRoot,
  AutocompleteViewport,
  SwitchRoot,
  SwitchThumb,
} from "reka-ui";
import { Input } from "@/components/ui/input";
import { NumberField } from "@/components/ui/number-field";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIONS } from "@/data/regions";
import { cn } from "@/lib/utils";
import type { NodeMetadata } from "@/types/node";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const PRICE_UNITS = [
  { symbol: "¥", label: "¥ 人民币" },
  { symbol: "$", label: "$ 美元" },
  { symbol: "€", label: "€ 欧元" },
  { symbol: "£", label: "£ 英镑" },
  { symbol: "₽", label: "₽ 卢布" },
  { symbol: "₣", label: "₣ 法郎" },
  { symbol: "₹", label: "₹ 卢比" },
  { symbol: "₫", label: "₫ 越南盾" },
  { symbol: "฿", label: "฿ 泰铢" },
];

const props = defineProps<{ modelValue: NodeMetadata }>();
const emit = defineEmits<{ "update:modelValue": [value: NodeMetadata] }>();

const tagInput = ref("");

function update(patch: Partial<NodeMetadata>) {
  emit("update:modelValue", { ...props.modelValue, ...patch });
}

function addTag() {
  const val = tagInput.value.trim();
  if (val && !props.modelValue.tags.includes(val)) {
    update({ tags: [...props.modelValue.tags, val] });
  }
  tagInput.value = "";
}

function removeTag(index: number) {
  const tags = [...props.modelValue.tags];
  tags.splice(index, 1);
  update({ tags });
}

function handleTagKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    addTag();
  }
}

// Region autocomplete
const regionSearch = ref(
  (() => {
    const found = REGIONS.find((r) => r.code === props.modelValue.region);
    return found ? `${found.code} · ${found.name}` : "";
  })(),
);

const filteredRegions = computed(() => {
  const q = regionSearch.value.toLowerCase();
  if (!q) return REGIONS;
  return REGIONS.filter(
    (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q),
  );
});
</script>

<template>
  <div class="space-y-6">
    <!-- name -->
    <div class="space-y-2">
      <Label for="nm-name">{{ $t("dashboard.node.metadata.name") }}</Label>
      <Input
        id="nm-name"
        :model-value="modelValue.name"
        :placeholder="$t('dashboard.node.metadata.namePlaceholder')"
        @update:model-value="update({ name: String($event) })"
      />
    </div>

    <!-- tags -->
    <div class="space-y-2">
      <Label>{{ $t("dashboard.node.metadata.tags") }}</Label>
      <div class="flex flex-wrap gap-2 mb-2">
        <Badge
          v-for="(tag, i) in modelValue.tags"
          :key="tag"
          variant="secondary"
          class="flex items-center gap-1 pr-1"
        >
          {{ tag }}
          <button
            type="button"
            class="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
            @click="removeTag(i)"
          >
            <X class="h-3 w-3" />
          </button>
        </Badge>
      </div>
      <Input
        v-model="tagInput"
        :placeholder="$t('dashboard.node.metadata.tagsPlaceholder')"
        @keydown="handleTagKeydown"
        @blur="addTag"
      />
    </div>

    <!-- price & priceUnit -->
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label for="nm-price">{{ $t("dashboard.node.metadata.price") }}</Label>
        <NumberField
          id="nm-price"
          :model-value="modelValue.price"
          :min="0"
          :step="0.01"
          @update:model-value="update({ price: $event })"
        />
      </div>
      <div class="space-y-2">
        <Label>{{ $t("dashboard.node.metadata.priceUnit") }}</Label>
        <Select
          :model-value="modelValue.priceUnit"
          @update:model-value="update({ priceUnit: $event as string })"
        >
          <SelectTrigger>
            <SelectValue
              :placeholder="$t('dashboard.node.metadata.priceUnitPlaceholder')"
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="u in PRICE_UNITS"
              :key="u.symbol"
              :value="u.symbol"
            >
              {{ u.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- priceCycle -->
    <div class="space-y-2">
      <Label for="nm-price-cycle">{{
        $t("dashboard.node.metadata.priceCycle")
      }}</Label>
      <NumberField
        id="nm-price-cycle"
        :model-value="modelValue.priceCycle"
        :min="1"
        :step="1"
        @update:model-value="update({ priceCycle: $event })"
      />
    </div>

    <!-- expireTime -->
    <div class="space-y-2">
      <Label for="nm-expire-time">{{
        $t("dashboard.node.metadata.expireTime")
      }}</Label>
      <input
        id="nm-expire-time"
        type="date"
        :value="modelValue.expireTime"
        class="placeholder:text-muted-foreground border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px] md:text-sm"
        @change="
          update({ expireTime: ($event.target as HTMLInputElement).value })
        "
      />
    </div>

    <!-- region -->
    <div class="space-y-2">
      <Label for="nm-region">{{ $t("dashboard.node.metadata.region") }}</Label>
      <AutocompleteRoot
        v-model="regionSearch"
        :ignore-filter="true"
        :open-on-focus="true"
        :open-on-click="true"
      >
        <AutocompleteAnchor class="relative">
          <AutocompleteInput
            id="nm-region"
            :placeholder="t('dashboard.node.metadata.regionPlaceholder')"
            :class="
              cn(
                'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-8 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]',
              )
            "
          />
          <ChevronsUpDown
            class="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 shrink-0 text-muted-foreground"
          />
        </AutocompleteAnchor>
        <AutocompletePortal>
          <AutocompleteContent
            position="popper"
            :side-offset="4"
            :class="
              cn(
                'z-50 min-w-48 w-[var(--reka-combobox-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
              )
            "
          >
            <AutocompleteViewport class="p-1">
              <AutocompleteEmpty
                class="py-6 text-center text-sm text-muted-foreground"
              >
                {{ $t("dashboard.node.metadata.regionEmpty") }}
              </AutocompleteEmpty>
              <AutocompleteItem
                v-for="r in filteredRegions"
                :key="r.code"
                :value="r.code"
                :text-value="`${r.code} · ${r.name}`"
                :class="
                  cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )
                "
                @select="update({ region: r.code })"
              >
                <span class="w-8 font-mono text-xs text-muted-foreground">
                  {{ r.code }}
                </span>
                <span class="ml-2">{{ r.name }}</span>
                <Check
                  v-if="modelValue.region === r.code"
                  class="ml-auto h-4 w-4"
                />
              </AutocompleteItem>
            </AutocompleteViewport>
          </AutocompleteContent>
        </AutocompletePortal>
      </AutocompleteRoot>
    </div>

    <!-- hidden -->
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>{{ $t("dashboard.node.metadata.hidden") }}</Label>
        <p class="text-sm text-muted-foreground">
          {{ $t("dashboard.node.metadata.hiddenDesc") }}
        </p>
      </div>
      <SwitchRoot
        :checked="modelValue.hidden"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
        @update:checked="update({ hidden: $event })"
      >
        <SwitchThumb
          class="pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        />
      </SwitchRoot>
    </div>
  </div>
</template>
