<script setup lang="ts">
// 这个组件是为了在某些场景下替代原生 input，提供更好的样式控制和用户体验
// 比如iOS上原生 input 在输入token时会有奇怪的大小写问题

import { computed, onMounted, ref, watch } from "vue";

interface Props {
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  autofocus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "",
  placeholder: "",
  disabled: false,
  autofocus: false,
});

const emit = defineEmits<{
  "update:modelValue": [value: string];
  input: [value: string];
  focus: [event: FocusEvent];
  blur: [event: FocusEvent];
}>();

const elRef = ref<HTMLDivElement>();

const editable = computed(() => !props.disabled);

function syncFromProps() {
  const el = elRef.value;
  if (!el) return;

  if (el.innerText !== props.modelValue) {
    el.innerText = props.modelValue;
  }
}

function handleInput() {
  const el = elRef.value;
  if (!el) return;

  const value = el.innerText;

  emit("update:modelValue", value);
  emit("input", value);
}

function handlePaste(e: ClipboardEvent) {
  // 纯文本粘贴，避免富文本污染
  e.preventDefault();

  const text = e.clipboardData?.getData("text/plain") ?? "";

  document.execCommand("insertText", false, text);
}

function handleKeydown(e: KeyboardEvent) {
  // 单行 input 风格
  if (e.key === "Enter") {
    e.preventDefault();
  }
}

watch(
  () => props.modelValue,
  () => {
    syncFromProps();
  },
);

onMounted(() => {
  syncFromProps();

  if (props.autofocus) {
    elRef.value?.focus();
  }
});
</script>

<template>
  <div
    ref="elRef"
    :contenteditable="editable"
    :data-placeholder="placeholder"
    :class="[
      'min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow]',
      'outline-none',
      'focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-ring/50',
      'selection:bg-primary selection:text-primary-foreground',
      'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
      '[&:empty:before]:text-muted-foreground',
      '[&:empty:before]:content-[attr(data-placeholder)]',
      '[&:empty:before]:pointer-events-none',
    ]"
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    autocorrect="off"
    @input="handleInput"
    @paste="handlePaste"
    @keydown="handleKeydown"
    @focus="(e) => emit('focus', e)"
    @blur="(e) => emit('blur', e)"
  />
</template>
