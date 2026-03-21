<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { type Token } from "../type";
import { CircleX, KeyRound } from "lucide-vue-next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const props = defineProps<{
  token: Token;
}>();
const emits = defineEmits<{
  (e: "update:token", token: Token): void;
}>();

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
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <!-- <KeyRound class="h-5 w-5" /> -->
        基础信息
      </CardTitle>
    </CardHeader>

    <CardContent class="grid gap-6 space-y-6 xl:grid-cols-2">
      <div class="space-y-2">
        <Label>用户名</Label>
        <Input
          v-model="localToken.username"
          @blur="updateData()"
          placeholder="输入用户名（可选）"
          clearable
        ></Input>
      </div>
      <div class="space-y-2">
        <Label>密码</Label>
        <Input
          v-model="localToken.password"
          type="password"
          @blur="updateData()"
          placeholder="输入密码（可选）"
        ></Input>
      </div>
      <div class="space-y-2">
        <Label>开始时间</Label>
        <div class="group relative">
          <Input
            v-model="timestampFromInput"
            :max="timestampFromMax"
            @blur="handleTimestampFromBlur"
            type="datetime-local"
            placeholder="输入开始时间（可选）"
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
        <Label>结束时间</Label>
        <div class="group relative">
          <Input
            v-model="timestampToInput"
            :min="timestampToMin"
            @blur="handleTimestampToBlur"
            type="datetime-local"
            placeholder="输入结束时间（可选）"
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
  </Card>
</template>
