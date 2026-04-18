<script setup lang="ts">
/**
 * 日志面板统一容器组件
 *
 * 用途：
 * 1. 对外只暴露一个 `filters` 参数，父组件传入筛选条件后即可自动同步日志订阅筛选。
 * 2. 内部统一接管日志连接、暂停、重连、清空和列表渲染，减少外部接入成本。
 * 3. 通过组件实例暴露 `connect / pause / resume / stop / reconnect / clearLogs / setExternalFilters`
 *    等方法，方便后续在不同页面由父组件主动控制。
 *
 * 推荐传参格式：
 * filters?: Array<{ target: LogTarget; level: LogLevel }>
 */
import { onMounted, ref, watch } from "vue";
import HeaderFilter from "./components/headerFilter.vue";
import LogsList from "./components/logsList.vue";
import {
  useLogs,
  type LogActionStatus,
  type LogEntry,
  type LogFilterRule,
  type LogStatus,
} from "@/composables/useLogs";

interface LogsViewProps {
  filters?: LogFilterRule[];
  autoConnect?: boolean;
  showHeader?: boolean;
}

const props = withDefaults(defineProps<LogsViewProps>(), {
  autoConnect: false,
  showHeader: true,
});

const emit = defineEmits<{
  "update:filters": [filters: LogFilterRule[]];
  connect: [];
  pause: [];
  resume: [];
  stop: [];
  reconnect: [];
  clear: [];
}>();

const {
  logs,
  filters,
  status,
  actionStatus,
  isBusy,
  error,
  targetOptions,
  levelOptions,
  connect,
  pause,
  resume,
  stop,
  reconnect,
  setFilters,
  clearLogs,
} = useLogs();

const localFilters = ref<LogFilterRule[]>([]);

const cloneFilters = (value: LogFilterRule[] = []) =>
  value.map((item) => ({ ...item }));
const serializeFilters = (value: LogFilterRule[] = []) => JSON.stringify(value);

const syncFilters = async (nextFilters: LogFilterRule[] = []) => {
  const normalizedFilters = cloneFilters(nextFilters);
  const nextSerialized = serializeFilters(normalizedFilters);
  const localSerialized = serializeFilters(localFilters.value);
  const storeSerialized = serializeFilters(filters.value);

  if (localSerialized !== nextSerialized) {
    localFilters.value = normalizedFilters;
  }

  if (storeSerialized !== nextSerialized) {
    await setFilters(normalizedFilters);
  }
};

const updateFilters = async (nextFilters: LogFilterRule[]) => {
  await syncFilters(nextFilters);
  emit("update:filters", cloneFilters(nextFilters));
};

const handleConnect = async () => {
  await connect();
  emit("connect");
};

const handlePause = () => {
  pause();
  emit("pause");
};

const handleResume = () => {
  resume();
  emit("resume");
};

const handleStop = async () => {
  await stop();
  emit("stop");
};

const handleReconnect = async () => {
  await reconnect();
  emit("reconnect");
};

const handleClear = () => {
  clearLogs();
  emit("clear");
};

watch(
  () => props.filters,
  async (nextFilters) => {
    if (!nextFilters) return;
    await syncFilters(nextFilters);
  },
  { deep: true, immediate: true },
);

onMounted(async () => {
  if (props.autoConnect && status.value === "disconnected") {
    await handleConnect();
  }
});

defineExpose({
  connect: handleConnect,
  pause: handlePause,
  resume: handleResume,
  stop: handleStop,
  reconnect: handleReconnect,
  clearLogs: handleClear,
  setExternalFilters: updateFilters,
  getFilters: () => cloneFilters(localFilters.value),
  getStatus: () => status.value as LogStatus,
  getActionStatus: () => actionStatus.value as LogActionStatus,
  getLogs: () => [...logs.value] as LogEntry[],
});
</script>

<template>
  <div class="flex flex-col">
    <HeaderFilter
      v-if="showHeader"
      :filters="localFilters"
      :status="status"
      :action-status="actionStatus"
      :is-busy="isBusy"
      :target-options="targetOptions"
      :level-options="levelOptions"
      @update:filters="updateFilters"
      @connect="handleConnect"
      @pause="handlePause"
      @resume="handleResume"
      @stop="handleStop"
      @reconnect="handleReconnect"
      @clear="handleClear"
    />
    <LogsList
      :logs="logs"
      :error="error"
      :status="status"
      :action-status="actionStatus"
      :is-busy="isBusy"
    />
  </div>
</template>
