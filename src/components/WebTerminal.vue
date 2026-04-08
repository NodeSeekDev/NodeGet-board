<script setup lang="ts">
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { wsRpcCall } from "@/composables/useWsRpc";
import { useFullscreen } from "@vueuse/core";
import {
  Maximize,
  Minimize,
  Maximize2,
  Minimize2,
  PanelRightClose,
  FileTerminal,
  Copy,
  CopyCheck,
} from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    rpcUrl: string;
    token: string;
    targetUuid: string;
    autoConnect?: boolean;
  }>(),
  {
    autoConnect: true,
  },
);

const emit = defineEmits<{
  connected: [];
  disconnected: [code: number];
  error: [message: string];
}>();

const wrapperRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const status = ref<
  "idle" | "connecting" | "connected" | "disconnected" | "error"
>("idle");
const statusText = ref("Waiting");

const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(wrapperRef);
const isWindowFull = ref(false);

const toggleWindowFull = () => {
  isWindowFull.value = !isWindowFull.value;
  nextTick(() => fit());
};

let socket: WebSocket | null = null;
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;
let dataDisposable: { dispose: () => void } | null = null;
let resizeDisposable: { dispose: () => void } | null = null;
let containerClickHandler: (() => void) | null = null;
let heartbeatTimer: number | null = null;
let connectId = 0;

const generateId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const terminalId = generateId();

const initTerminal = () => {
  if (!containerRef.value) return;
  if (terminal) return;

  terminal = new Terminal({
    cursorBlink: true,
    fontFamily:
      '"Cascadia Code", Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: 14,
    theme: {
      background: "#000000",
    },
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(containerRef.value);
  fitAddon.fit();
  terminal.focus();

  containerClickHandler = () => terminal?.focus();
  containerRef.value.addEventListener("click", containerClickHandler);

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(containerRef.value);
};

const destroySocket = () => {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (dataDisposable) {
    dataDisposable.dispose();
    dataDisposable = null;
  }

  if (resizeDisposable) {
    resizeDisposable.dispose();
    resizeDisposable = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }
};

const disconnect = () => {
  destroySocket();
  status.value = "disconnected";
  statusText.value = "Disconnected";
};

const fit = () => {
  fitAddon?.fit();
};

const buildWsUrl = (pathname: string, query: Record<string, string> = {}) => {
  try {
    const parsed = new URL(props.rpcUrl);
    parsed.pathname = pathname;
    parsed.search = "";
    parsed.hash = "";
    Object.entries(query).forEach(([key, value]) => {
      parsed.searchParams.set(key, value);
    });
    return parsed.toString();
  } catch {
    return "";
  }
};

const createTask = async () => {
  const rpcUrl = props.rpcUrl?.trim();
  const token = props.token?.trim();
  const targetUuid = props.targetUuid?.trim();
  const taskWebShellUrl = buildWsUrl("/auto_gen");

  if (!rpcUrl) throw new Error("RPC WebSocket URL is required");
  if (!token) throw new Error("Token is required");
  if (!targetUuid) throw new Error("Target UUID is required");
  if (!taskWebShellUrl) throw new Error("Task WebShell URL is invalid");
  await wsRpcCall(
    rpcUrl,
    "task_create_task",
    {
      token,
      target_uuid: targetUuid,
      task_type: {
        web_shell: {
          url: taskWebShellUrl,
          terminal_id: terminalId,
        },
      },
    },
    { timeoutMs: 10000 },
  );
};

const connect = async () => {
  const currentId = ++connectId;

  const targetUrl = buildWsUrl("/terminal", {
    agent_uuid: props.targetUuid?.trim(),
    terminal_id: terminalId,
    token: props.token?.trim(),
  }).trim();
  if (!targetUrl) {
    status.value = "error";
    statusText.value = "Invalid URL";
    terminal?.writeln("\x1b[1;31mWebSocket URL is required\x1b[0m");
    emit("error", "WebSocket URL is required");
    return;
  }

  destroySocket();
  initTerminal();
  terminal?.clear();
  terminal?.writeln("Connecting to server...");

  status.value = "connecting";
  statusText.value = "Creating task";

  try {
    await createTask();
    if (currentId !== connectId) return;
    terminal?.writeln("\x1b[1;32mWebShell task created successfully\x1b[0m");
  } catch (error: any) {
    if (currentId !== connectId) return;
    const message = error?.message || "Failed to create task";
    status.value = "error";
    statusText.value = "Task creation failed";
    terminal?.writeln(`\r\n\x1b[1;31m${message}\x1b[0m`);
    emit("error", message);
    return;
  }

  const connectWs = (retryCount = 0) => {
    if (currentId !== connectId) return;

    statusText.value =
      retryCount > 0 ? `Connecting (Retry ${retryCount})...` : "Connecting";

    if (retryCount > 0) {
      destroySocket();
    }

    const ws = new WebSocket(targetUrl);
    ws.binaryType = "arraybuffer";
    socket = ws;

    let connectionEstablished = false;
    let connectionTimer: number | null = null;

    ws.onopen = () => {
      if (currentId !== connectId || socket !== ws) {
        ws.close();
        return;
      }

      dataDisposable =
        terminal?.onData((data: string) => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(data);
          }
        }) ?? null;

      resizeDisposable =
        terminal?.onResize(({ cols, rows }) => {
          if (socket?.readyState === WebSocket.OPEN) {
            const resizeMsg = JSON.stringify({
              type: "resize",
              cols,
              rows,
            });
            socket.send(resizeMsg);
          }
        }) ?? null;

      const dims = fitAddon?.proposeDimensions();
      if (dims && socket?.readyState === WebSocket.OPEN) {
        const resizeMsg = JSON.stringify({
          type: "resize",
          cols: dims.cols,
          rows: dims.rows,
        });
        socket.send(resizeMsg);
      }

      terminal?.focus();

      if (heartbeatTimer !== null) {
        window.clearInterval(heartbeatTimer);
      }
      heartbeatTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send("");
        }
      }, 15000);

      connectionTimer = window.setTimeout(() => {
        if (currentId !== connectId || socket !== ws) return;
        connectionEstablished = true;
        status.value = "connected";
        statusText.value = "Connected";
        emit("connected");
      }, 500);
    };

    ws.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        terminal?.write(new Uint8Array(event.data));
        return;
      }
      if (typeof Blob !== "undefined" && event.data instanceof Blob) {
        terminal?.write(await event.data.text());
        return;
      }
      terminal?.write(String(event.data));
    };

    ws.onclose = (event) => {
      if (socket !== ws) return;
      if (connectionTimer !== null) {
        window.clearTimeout(connectionTimer);
      }

      if (!connectionEstablished && retryCount < 4) {
        terminal?.writeln(
          `\r\n\x1b[1;33mConnection dropped, retrying in 1s...\x1b[0m`,
        );
        setTimeout(() => connectWs(retryCount + 1), 1000);
        return;
      }

      status.value = "disconnected";
      statusText.value = `Disconnected (${event.code})`;
      terminal?.writeln(
        `\r\n\x1b[1;31mDisconnected [code: ${event.code}]\x1b[0m`,
      );
      emit("disconnected", event.code);
    };

    ws.onerror = () => {
      if (socket !== ws) return;
      if (!connectionEstablished && retryCount < 4) {
        return; // Let onclose handle retry
      }
      status.value = "error";
      statusText.value = "Connection error";
      terminal?.writeln("\r\n\x1b[1;31mWebSocket error occurred\x1b[0m");
      emit("error", "WebSocket error occurred");
    };
  };

  setTimeout(() => connectWs(0), 500);
};

watch(
  () => [props.rpcUrl, props.token, props.targetUuid],
  async () => {
    if (!props.autoConnect) return;
    await nextTick();
    connect();
  },
);

onMounted(async () => {
  initTerminal();
  terminal?.writeln("Ready");

  if (props.autoConnect) {
    await nextTick();
    connect();
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  if (containerRef.value && containerClickHandler) {
    containerRef.value.removeEventListener("click", containerClickHandler);
  }
  containerClickHandler = null;
  destroySocket();
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
});

defineExpose({
  connect,
  disconnect,
  fit,
});

// Scripts
import { useScripts } from "@/composables/useScripts";
import type { Script } from "@/composables/useScripts";
const { scripts, loading } = useScripts();
import Switch from "./ui/switch/Switch.vue";
import { toast } from "vue-sonner";

const scriptsList = ref<(Script & { copyStatus: boolean })[]>([]);

const scriptShow = ref(false);

const autoRun = ref(false);
const codeIn = (code: string) => {
  if (autoRun.value) {
    terminal?.paste(code);
    terminal?.input("\r");
  } else {
    terminal?.paste(code);
  }
};

const copyScript = async (s: string, index: number) => {
  const item = scriptsList.value[index];
  if (item) {
    item.copyStatus = true;
  }

  if (!navigator.clipboard) {
    toast.error("Clipboard API unsupported");
  }

  try {
    await navigator.clipboard.writeText(s);
    toast.success("copy success");
  } catch (err) {
    toast.error("copy failed");
  }
  // 兼容代码 - 不启用
  // const textarea = document.createElement('textarea')
  // textarea.value = s
  // textarea.style.position = 'fixed'
  // textarea.style.left = '-9999px'
  // textarea.style.top = '0'
  // document.body.appendChild(textarea)
  // textarea.focus()
  // textarea.select()

  // const success = document.execCommand('copy')
  // document.body.removeChild(textarea)

  if (item) {
    setTimeout(() => {
      item.copyStatus = false;
    }, 2000);
  }
};

watch(
  () => scripts.value,
  (val) => {
    scriptsList.value = val
      .filter((item) => item.lang === "shell")
      .map((item) => ({
        ...item,
        copyStatus: false,
      }));
  },
  {
    immediate: true,
    deep: true,
  },
);
</script>

<template>
  <div
    ref="wrapperRef"
    class="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col box-border relative"
    :class="{
      'fixed inset-0 z-50 w-screen h-screen rounded-none border-0':
        isWindowFull,
    }"
  >
    <div
      class="h-11 px-3 border-b bg-muted/30 flex items-center justify-between shrink-0"
    >
      <div class="text-sm text-muted-foreground">
        Status: <span class="font-mono">{{ statusText }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          @click="scriptShow = !scriptShow"
          :title="$t('dashboard.webterminal.scripts.name')"
        >
          <FileTerminal class="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          @click="toggleWindowFull"
          title="Toggle Full Window"
        >
          <Minimize2 v-if="isWindowFull" class="w-4 h-4" />
          <Maximize2 v-else class="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          @click="toggleFullscreen"
          title="Toggle Full Screen"
        >
          <Minimize v-if="isFullscreen" class="w-4 h-4" />
          <Maximize v-else class="w-4 h-4" />
        </Button>
        <Button size="sm" variant="secondary" @click="connect"
          >Reconnect</Button
        >
      </div>
    </div>
    <div
      ref="containerRef"
      class="w-full bg-black"
      :class="isFullscreen || isWindowFull ? 'flex-1 h-0' : 'h-full'"
    />

    <div
      class="flex flex-col p-4 rounded-tl-lg rounded-bl-lg shadow-sm absolute top-11 bottom-0 right-0 bg-white dark:bg-[#1d1d20] w-[300px] transition-all duration-300 overflow-hidden z-1"
      :class="scriptShow ? 'translate-x-0' : 'translate-x-full'"
    >
      <div
        class="text-lg font-semibold text-gray-800 mb-3 dark:text-white items-end gap-2 justify-between flex"
      >
        <div class="flex items-center">
          <PanelRightClose
            @click="scriptShow = false"
            class="mr-2 cursor-pointer w-5 h-5"
          />
          {{ $t("dashboard.webterminal.scripts.name") }}
        </div>
        <label class="flex items-center">
          <span class="text-sm color-gray-500 mr-1 opacity-60">自动回车</span>
          <Switch
            v-model="autoRun"
            :title="$t('dashboard.webterminal.scripts.autoRun')"
          />
        </label>
      </div>
      <div v-if="loading" class="text-gray-500">
        {{ $t("dashboard.webterminal.scripts.loading") }}
      </div>
      <div v-else class="flex flex-wrap gap-2 flex-1 overflow-auto min-h-0">
        <Button
          variant="outline"
          class="w-full flex flex-col gap-1 items-start h-auto border"
          v-for="(script, index) in scriptsList"
          @click="codeIn(script.content)"
        >
          <div class="flex flex-row gap-1 items-start w-full">
            <div class="text-base font-blod flex-1 truncate text-left">
              {{ script.name }}
            </div>
            <div
              @click.stop="copyScript(script.content, index)"
              :title="$t('dashboard.webterminal.scripts.copy')"
              class="cursor-pointer"
            >
              <Copy
                class="opacity-50 dark:opacity-65"
                v-if="script.copyStatus == false"
              ></Copy>
              <CopyCheck class="opacity-80" v-else></CopyCheck>
            </div>
          </div>
          <div class="flex flex-col gap-1 items-start w-full text-left">
            <div class="truncate text-xs opacity-80 break-words w-full">
              {{ script.content }}
            </div>
          </div>
        </Button>
      </div>
    </div>
  </div>
</template>
