<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { type Token } from "../type";
import { generateUuid } from "../scopeCodec";
import { ChevronDown, CircleX } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const props = defineProps<{
  token: Token;
}>();
const emits = defineEmits<{
  (e: "update:token", token: Token): void;
}>();
const { t } = useI18n();

const isOpen = ref(false);
const localToken = ref<Token>(props.token);
const timestampFromInput = ref(
  formatTimestampForInput(props.token.timestamp_from),
);
const timestampToInput = ref(formatTimestampForInput(props.token.timestamp_to));

watch(
  () => props.token,
  (value) => {
    localToken.value = value;
    timestampFromInput.value = formatTimestampForInput(value.timestamp_from);
    timestampToInput.value = formatTimestampForInput(value.timestamp_to);
  },
  { immediate: true },
);

function formatTimestampForInput(timestamp: number) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function parseInputToTimestamp(value: string) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

const timestampFromMax = computed(() => timestampToInput.value || undefined);
const timestampToMin = computed(() => timestampFromInput.value || undefined);

const updateData = () => {
  emits("update:token", localToken.value);
};

const handleUsernameBlur = () => {
  const username = localToken.value.username.trim();
  const password = localToken.value.password.trim();

  localToken.value.username = username;
  if (username && !password) {
    localToken.value.password = generateUuid();
  }

  updateData();
};

const handlePasswordBlur = () => {
  localToken.value.password = localToken.value.password.trim();
  updateData();
};

const handleTimestampFromBlur = () => {
  let fromTs = parseInputToTimestamp(timestampFromInput.value);
  const toTs = parseInputToTimestamp(timestampToInput.value);

  if (fromTs && toTs && fromTs > toTs) {
    fromTs = toTs;
    timestampFromInput.value = formatTimestampForInput(fromTs);
  }

  localToken.value.timestamp_from = fromTs;
  updateData();
};

const handleTimestampToBlur = () => {
  const fromTs = parseInputToTimestamp(timestampFromInput.value);
  let toTs = parseInputToTimestamp(timestampToInput.value);

  if (fromTs && toTs && toTs < fromTs) {
    toTs = fromTs;
    timestampToInput.value = formatTimestampForInput(toTs);
  }

  localToken.value.timestamp_to = toTs;
  updateData();
};

const clearTimestampFrom = () => {
  timestampFromInput.value = "";
  localToken.value.timestamp_from = 0;
  updateData();
};

const clearTimestampTo = () => {
  timestampToInput.value = "";
  localToken.value.timestamp_to = 0;
  updateData();
};
</script>

<template>
  <Collapsible v-model:open="isOpen">
    <Card>
      <CardHeader class="flex flex-row items-center justify-between gap-2">
        <CardTitle class="flex items-center gap-2">
          {{ t("dashboard.token.tokenInfo.baseInfoTitle") }}
        </CardTitle>
        <CollapsibleTrigger as-child>
          <Button variant="ghost" size="icon" class="size-8">
            <ChevronDown
              class="h-4 w-4 transition-transform duration-200"
              :class="{ 'rotate-180': isOpen }"
            />
            <span class="sr-only">{{
              t("dashboard.token.permissionsConfig.toggleAriaLabel")
            }}</span>
          </Button>
        </CollapsibleTrigger>
      </CardHeader>

      <CollapsibleContent>
        <CardContent class="grid gap-6 space-y-6 xl:grid-cols-2">
          <div class="space-y-2">
            <Label>
              {{ t("dashboard.token.tokenInfo.username") }}
            </Label>
            <Input
              v-model="localToken.username"
              @blur="handleUsernameBlur"
              :placeholder="t('dashboard.token.tokenInfo.usernamePlaceholder')"
              clearable
            ></Input>
          </div>
          <div class="space-y-2">
            <Label>
              {{ t("dashboard.token.tokenInfo.password") }}
            </Label>
            <Input
              v-model="localToken.password"
              type="password"
              @blur="handlePasswordBlur"
              :placeholder="t('dashboard.token.tokenInfo.passwordPlaceholder')"
            ></Input>
          </div>
          <div class="space-y-2">
            <Label>
              {{ t("dashboard.token.tokenInfo.startTime") }}
            </Label>
            <div class="group relative">
              <Input
                v-model="timestampFromInput"
                :max="timestampFromMax"
                @blur="handleTimestampFromBlur"
                type="datetime-local"
                :placeholder="
                  t('dashboard.token.tokenInfo.startTimePlaceholder')
                "
              ></Input>
              <button
                v-if="timestampFromInput"
                type="button"
                class="text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-sm bg-background/80 p-0.5 opacity-0 shadow-sm transition-opacity pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[1px]"
                @click="clearTimestampFrom"
              >
                <CircleX class="h-4 w-4" />
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>
              {{ t("dashboard.token.tokenInfo.endTime") }}
            </Label>
            <div class="group relative">
              <Input
                v-model="timestampToInput"
                :min="timestampToMin"
                @blur="handleTimestampToBlur"
                type="datetime-local"
                :placeholder="t('dashboard.token.tokenInfo.endTimePlaceholder')"
              ></Input>
              <button
                v-if="timestampToInput"
                type="button"
                class="text-muted-foreground hover:text-foreground focus-visible:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-2 z-10 -translate-y-1/2 rounded-sm bg-background/80 p-0.5 opacity-0 shadow-sm transition-opacity pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[1px]"
                @click="clearTimestampTo"
              >
                <CircleX class="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Card>
  </Collapsible>
</template>
