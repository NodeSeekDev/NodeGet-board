<script setup lang="ts">
import { ref, computed, watch, defineComponent, h, type VNode } from "vue";
import { useRouter } from "vue-router";
import { marked } from "marked";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { StreamLanguage } from "@codemirror/language";
import type { Extension as CMExtension } from "@codemirror/state";
import { javascript } from "@codemirror/legacy-modes/mode/javascript";
import { css } from "@codemirror/legacy-modes/mode/css";
import { xml } from "@codemirror/legacy-modes/mode/xml";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { useThemeStore } from "@/stores/theme";

// 渲染 markdown，禁用原生 HTML
const renderMarkdown = (src: string): string => {
  const result = marked.parse(src, { async: false, breaks: true });
  return result as string;
};
import {
  ExternalLink,
  ChevronRight,
  File,
  Folder,
  AlertCircle,
  Loader2,
  Save,
  Upload,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Extension } from "@/composables/useExtensions";
import { useExtensions } from "@/composables/useExtensions";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";

const props = defineProps<{
  extension: Extension;
}>();

const emit = defineEmits<{
  deleted: [];
  updated: [ext: Extension];
}>();

const { currentBackend } = useBackendStore();
const backendUrl = computed(() => currentBackend.value?.url ?? "");
const router = useRouter();

const { saveExtension, deleteExtension, getStaticUrl, uploadFile } =
  useExtensions();

const backendToken = computed(() => currentBackend.value?.token ?? "");

const nodeUuids = ref<string[]>([]);
const nodeNames = ref<Record<string, string>>({});
const nodePickerRoute = ref<string | null>(null);

const fetchNodeUuids = async () => {
  if (!backendUrl.value) return;
  const conn = getWsConnection(backendUrl.value);
  try {
    const result = await conn.call<{ uuids: string[] }>(
      "nodeget-server_list_all_agent_uuid",
      { token: backendToken.value },
    );
    const uuids = Array.isArray(result?.uuids) ? result.uuids : [];
    nodeUuids.value = uuids;

    // 批量拉取节点名称
    if (uuids.length > 0) {
      const names = await conn.call<
        { namespace: string; key: string; value: unknown }[]
      >("kv_get_multi_value", {
        token: backendToken.value,
        namespace_key: uuids.map((uuid) => ({
          namespace: uuid,
          key: "metadata_name",
        })),
      });
      const map: Record<string, string> = {};
      if (Array.isArray(names)) {
        for (const item of names) {
          if (item.value && typeof item.value === "string") {
            map[item.namespace] = item.value;
          }
        }
      }
      nodeNames.value = map;
    }
  } catch {
    nodeUuids.value = [];
  }
};

// 文件树
const themeStore = useThemeStore();

const selectedFile = ref<string | null>(null);
const fileContent = ref<string>("");

const editorExtensions = computed(() => {
  const ext = selectedFile.value?.split(".").pop()?.toLowerCase() ?? "";
  const langMap: Record<string, () => CMExtension> = {
    json: () => json(),
    js: () => StreamLanguage.define(javascript),
    mjs: () => StreamLanguage.define(javascript),
    ts: () => StreamLanguage.define(javascript),
    css: () => StreamLanguage.define(css),
    html: () => StreamLanguage.define(xml),
    xml: () => StreamLanguage.define(xml),
    sh: () => StreamLanguage.define(shell),
    bash: () => StreamLanguage.define(shell),
    yaml: () => StreamLanguage.define(yaml),
    yml: () => StreamLanguage.define(yaml),
  };
  const lang = langMap[ext]?.();
  return [...(lang ? [lang] : []), ...(themeStore.isDark ? [oneDark] : [])];
});
const fileLoading = ref(false);
const fileError = ref<string | null>(null);
const editedContent = ref("");
const fileSaving = ref(false);
const fileUploadInputRef = ref<HTMLInputElement | null>(null);

const isSpecialFile = computed(
  () =>
    selectedFile.value === "__app.json__" ||
    selectedFile.value === "__readme__",
);
const isDirty = computed(() => editedContent.value !== fileContent.value);

watch(fileContent, (val) => {
  editedContent.value = val;
});

const saveFile = async () => {
  if (!selectedFile.value || isSpecialFile.value) return;
  fileSaving.value = true;
  try {
    const encoded = new TextEncoder().encode(editedContent.value);
    await uploadFile(
      props.extension.id,
      selectedFile.value,
      encoded.buffer as ArrayBuffer,
    );
    fileContent.value = editedContent.value;
    toast.success("已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    fileSaving.value = false;
  }
};

const handleFileUpload = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !selectedFile.value || isSpecialFile.value) return;
  (e.target as HTMLInputElement).value = "";
  fileSaving.value = true;
  try {
    const content = await file.arrayBuffer();
    await uploadFile(
      props.extension.id,
      selectedFile.value,
      content,
      file.type || undefined,
    );
    fileContent.value = await new Response(content).text();
    toast.success("已上传");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    fileSaving.value = false;
  }
};

// 设置
const activeTab = ref("overview");

watch(activeTab, (tab) => {
  if (tab === "files" && !selectedFile.value) {
    const first = props.extension.files?.[0];
    if (first) loadFileContent(first.path);
  }
});
const tokenInput = ref(props.extension.token);
const savingToken = ref(false);
const toggling = ref(false);
const deleting = ref(false);
const savingRoutes = ref(false);
const showToken = ref(false);

type EditableRoute = {
  name: string;
  type: string;
  entry: string;
  icon: string;
};

const emptyRow = (): EditableRoute => ({
  name: "",
  type: "",
  entry: "",
  icon: "",
});

const editableRoutes = ref<EditableRoute[]>([
  ...(props.extension.app.routes ?? []).map((r) => ({
    name: r.name,
    type: r.type,
    entry: r.entry,
    icon: r.icon ?? "",
  })),
  emptyRow(),
]);

// 最后一行有内容时自动追加新空行
const onRouteInput = () => {
  const last = editableRoutes.value[editableRoutes.value.length - 1];
  if (last && (last.name || last.type || last.entry || last.icon)) {
    editableRoutes.value.push(emptyRow());
  }
};

const handleSaveRoutes = async () => {
  savingRoutes.value = true;
  try {
    // 过滤掉完全空的行
    const routes = editableRoutes.value.filter(
      (r) => r.name.trim() || r.type.trim() || r.entry.trim() || r.icon.trim(),
    ) as typeof props.extension.app.routes;
    const updated = {
      ...props.extension,
      app: { ...props.extension.app, routes },
      updated_at: Date.now(),
    };
    await saveExtension(props.extension.id, updated);
    emit("updated", updated);
    toast.success("路由已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    savingRoutes.value = false;
  }
};

// 文件树结构
type TreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
};

const buildFileTree = (files: { path: string }[]): TreeNode[] => {
  const root: TreeNode[] = [];
  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      if (isLast) {
        current.push({ name: part, path: file.path, isDir: false });
      } else {
        let dir = current.find((n) => n.name === part && n.isDir);
        if (!dir) {
          dir = {
            name: part,
            path: parts.slice(0, i + 1).join("/"),
            isDir: true,
            children: [],
          };
          current.push(dir);
        }
        current = dir.children!;
      }
    }
  }
  return root;
};

const resourceFiles = computed(() =>
  buildFileTree(props.extension.files ?? []),
);

const specialFiles = [
  { name: "app.json", path: "__app.json__", isDir: false },
  { name: "readme.md", path: "__readme__", isDir: false },
];

const loadFileContent = async (path: string) => {
  selectedFile.value = path;
  fileError.value = null;

  if (path === "__app.json__") {
    fileContent.value = JSON.stringify(props.extension.app, null, 2);
    return;
  }
  if (path === "__readme__") {
    fileContent.value = props.extension.readme || "（无 README）";
    return;
  }

  fileLoading.value = true;
  try {
    const url = getStaticUrl(props.extension.id, path);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    fileContent.value = await resp.text();
  } catch (e: unknown) {
    fileError.value = e instanceof Error ? e.message : String(e);
    fileContent.value = "";
  } finally {
    fileLoading.value = false;
  }
};

const handleToggle = async (disabled: boolean) => {
  toggling.value = true;
  try {
    const updated = { ...props.extension, disabled, updated_at: Date.now() };
    await saveExtension(props.extension.id, updated);
    emit("updated", updated);
    toast.success(disabled ? "扩展已禁用" : "扩展已启用");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    toggling.value = false;
  }
};

const handleSaveToken = async () => {
  const t = tokenInput.value.trim();
  if (!t) return;
  savingToken.value = true;
  try {
    const updated = { ...props.extension, token: t, updated_at: Date.now() };
    await saveExtension(props.extension.id, updated);
    emit("updated", updated);
    toast.success("Token 已更新");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    savingToken.value = false;
  }
};

const handleDelete = async () => {
  if (!confirm(`确认删除扩展「${props.extension.app.name}」？此操作不可撤销。`))
    return;
  deleting.value = true;
  try {
    await deleteExtension(props.extension.id);
    emit("deleted");
    toast.success("扩展已删除");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deleting.value = false;
  }
};

const routePath = (routeName: string, type: "global" | "node") => {
  if (type === "global") return `/dashboard/app/${routeName}`;
  // node 路由需要 UUID，无法在此处确定，提示用户
  return null;
};

const navigateRoute = async (routeName: string, type: "global" | "node") => {
  if (type === "global") {
    router.push(`/dashboard/app/${routeName}`);
    return;
  }
  // node 路由：拉取 UUID 列表
  await fetchNodeUuids();
  if (nodeUuids.value.length === 1) {
    router.push(`/dashboard/node/${nodeUuids.value[0]}/${routeName}`);
  } else if (nodeUuids.value.length > 1) {
    nodePickerRoute.value = routeName; // 弹出节点选择器
  } else {
    toast.error("未找到节点");
  }
};

const pickNode = (uuid: string) => {
  if (!nodePickerRoute.value) return;
  router.push(`/dashboard/node/${uuid}/${nodePickerRoute.value}`);
  nodePickerRoute.value = null;
};

// 递归文件树节点组件
const ExtensionFileNode = defineComponent({
  name: "ExtensionFileNode",
  props: {
    node: { type: Object as () => TreeNode, required: true },
    selected: { type: String as () => string | null, default: null },
  },
  emits: ["select"],
  setup(props, { emit }) {
    const expanded = ref(true);

    return (): VNode => {
      const node = props.node;
      if (node.isDir) {
        return h("div", [
          h(
            "button",
            {
              class:
                "flex items-center gap-1 w-full text-left text-xs px-2 py-1 hover:bg-muted rounded transition-colors",
              onClick: () => (expanded.value = !expanded.value),
            },
            [
              h(ChevronRight, {
                class: `h-3 w-3 text-muted-foreground transition-transform ${expanded.value ? "rotate-90" : ""}`,
              }),
              h(Folder, { class: "h-3 w-3 text-muted-foreground" }),
              h("span", node.name),
            ],
          ),
          expanded.value && node.children?.length
            ? h(
                "div",
                { class: "pl-4" },
                node.children.map((child) =>
                  h(ExtensionFileNode, {
                    key: child.path,
                    node: child,
                    selected: props.selected,
                    onSelect: (p: string) => emit("select", p),
                  }),
                ),
              )
            : null,
        ]);
      }
      return h(
        "button",
        {
          class: `flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors ${props.selected === node.path ? "bg-muted" : ""}`,
          onClick: () => emit("select", node.path),
        },
        [
          h(File, { class: "h-3 w-3 text-muted-foreground flex-shrink-0" }),
          h("span", node.name),
        ],
      );
    };
  },
});
</script>

<template>
  <Tabs v-model="activeTab" class="flex flex-col flex-1 min-h-0">
    <TabsList class="mb-4 shrink-0">
      <TabsTrigger value="overview">概览</TabsTrigger>
      <TabsTrigger value="files">文件</TabsTrigger>
      <TabsTrigger value="settings">设置</TabsTrigger>
    </TabsList>

    <!-- ── 概览 ── -->
    <TabsContent value="overview" class="flex-1 min-h-0 overflow-y-auto">
      <div class="rounded-lg border p-4 space-y-4">
        <!-- 基本字段 -->
        <div class="space-y-2 text-sm">
          <div class="flex gap-2">
            <span class="text-muted-foreground w-12 shrink-0">名称</span>
            <span class="font-medium">{{ extension.app.name }}</span>
          </div>
          <div class="flex gap-2">
            <span class="text-muted-foreground w-12 shrink-0">ID</span>
            <span class="font-mono text-xs truncate">{{ extension.id }}</span>
          </div>
          <div class="flex gap-2">
            <span class="text-muted-foreground w-12 shrink-0">描述</span>
            <span>{{ extension.app.description || "—" }}</span>
          </div>
          <div class="flex gap-4">
            <div class="flex gap-2">
              <span class="text-muted-foreground">创建于</span>
              <span>{{
                new Date(extension.created_at).toLocaleDateString("zh-CN")
              }}</span>
            </div>
            <div class="flex gap-2">
              <span class="text-muted-foreground">编辑于</span>
              <span>{{
                extension.updated_at
                  ? new Date(extension.updated_at).toLocaleDateString("zh-CN")
                  : "—"
              }}</span>
            </div>
          </div>
          <div v-if="extension.app.routes?.length">
            <span class="text-muted-foreground">前端路由</span>
            <div class="flex flex-wrap gap-2 mt-1.5 ml-0.5">
              <template v-for="route in extension.app.routes" :key="route.name">
                <!-- global 路由：直接跳转 -->
                <button
                  v-if="route.type === 'global'"
                  class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono text-primary border-primary/30 hover:bg-muted transition-colors"
                  @click="navigateRoute(route.name, route.type)"
                >
                  {{ route.name }}
                  <span class="text-[10px] opacity-60">global</span>
                  <ExternalLink class="h-3 w-3 opacity-60" />
                </button>

                <!-- node 路由：点击后弹出节点选择 -->
                <Popover
                  v-else
                  :open="nodePickerRoute === route.name"
                  @update:open="
                    (v) => {
                      if (!v) nodePickerRoute = null;
                    }
                  "
                >
                  <PopoverTrigger as-child>
                    <button
                      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-mono text-muted-foreground border-border hover:bg-muted transition-colors"
                      @click="navigateRoute(route.name, route.type)"
                    >
                      {{ route.name }}
                      <span class="text-[10px] opacity-60">node</span>
                      <ExternalLink class="h-3 w-3 opacity-60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="w-64 p-2">
                    <p class="text-xs text-muted-foreground mb-2 px-1">
                      选择节点
                    </p>
                    <div class="space-y-0.5 max-h-48 overflow-y-auto">
                      <button
                        v-for="uuid in nodeUuids"
                        :key="uuid"
                        class="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                        @click="pickNode(uuid)"
                      >
                        <span class="font-medium">{{
                          nodeNames[uuid] || "未命名节点"
                        }}</span>
                        <span
                          class="block font-mono text-[10px] text-muted-foreground truncate"
                          >{{ uuid }}</span
                        >
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </template>
            </div>
          </div>
        </div>

        <!-- README -->
        <div
          v-if="extension.readme"
          class="rounded border p-3 prose prose-sm prose-neutral dark:prose-invert max-w-none text-sm overflow-y-auto"
          v-html="renderMarkdown(extension.readme)"
        />
        <div
          v-else
          class="rounded border p-3 text-xs text-muted-foreground italic"
        >
          无 README
        </div>
      </div>
    </TabsContent>

    <!-- ── 文件 ── -->
    <TabsContent value="files" class="flex-1 min-h-0">
      <div class="grid grid-cols-3 gap-4 h-full">
        <div class="col-span-1 rounded-lg border p-3 flex flex-col min-h-0">
          <p class="text-xs text-muted-foreground mb-2 shrink-0">普通文件</p>
          <div class="flex-1 overflow-y-auto space-y-0.5">
            <component
              :is="ExtensionFileNode"
              v-for="node in resourceFiles"
              :key="node.path"
              :node="node"
              :selected="selectedFile"
              @select="loadFileContent"
            />
            <p
              v-if="!resourceFiles.length"
              class="text-xs text-muted-foreground italic"
            >
              无资源文件
            </p>
            <p class="text-xs text-muted-foreground mt-3 mb-2">特殊文件</p>
            <button
              v-for="sf in specialFiles"
              :key="sf.path"
              class="flex items-center gap-1.5 w-full text-left text-xs px-2 py-1 rounded hover:bg-muted transition-colors"
              :class="{ 'bg-muted': selectedFile === sf.path }"
              @click="loadFileContent(sf.path)"
            >
              <File class="h-3 w-3 text-muted-foreground" />{{ sf.name }}
            </button>
          </div>
        </div>

        <div class="col-span-2 rounded-lg border p-3 flex flex-col min-h-0">
          <div class="flex items-center justify-between mb-2 shrink-0">
            <p class="text-xs text-muted-foreground">内容预览</p>
            <div
              v-if="
                selectedFile && !fileLoading && !fileError && !isSpecialFile
              "
              class="flex items-center gap-1"
            >
              <input
                ref="fileUploadInputRef"
                type="file"
                class="hidden"
                @change="handleFileUpload"
              />
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                @click="fileUploadInputRef?.click()"
              >
                <Upload class="h-3 w-3 mr-1" />上传替换
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 px-2 text-xs"
                :disabled="!isDirty || fileSaving"
                @click="saveFile"
              >
                <Loader2 v-if="fileSaving" class="h-3 w-3 mr-1 animate-spin" />
                <Save v-else class="h-3 w-3 mr-1" />保存
              </Button>
            </div>
          </div>
          <div
            v-if="!selectedFile"
            class="text-xs text-muted-foreground italic"
          >
            选择左侧文件查看内容
          </div>
          <div
            v-else-if="fileLoading"
            class="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 class="h-3 w-3 animate-spin" />加载中...
          </div>
          <div
            v-else-if="fileError"
            class="flex items-center gap-1 text-xs text-destructive"
          >
            <AlertCircle class="h-3 w-3" />{{ fileError }}
          </div>
          <div v-else class="flex-1 min-h-0 rounded overflow-hidden border">
            <Codemirror
              v-model="editedContent"
              :extensions="editorExtensions"
              :disabled="isSpecialFile"
              :style="{ height: '100%', fontSize: '12px' }"
            />
          </div>
        </div>
      </div>
    </TabsContent>

    <!-- ── 设置 ── -->
    <TabsContent value="settings" class="space-y-5">
      <!-- 启用 -->
      <div class="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <Label class="text-sm font-medium">启用</Label>
        <span class="text-xs text-muted-foreground"
          >（当前是{{ extension.disabled ? "disabled" : "enabled" }}状态）</span
        >
        <button
          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
          :class="extension.disabled ? 'bg-input' : 'bg-primary'"
          :disabled="toggling"
          @click="handleToggle(!extension.disabled)"
        >
          <span
            class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
            :class="extension.disabled ? 'translate-x-0.5' : 'translate-x-4'"
          />
        </button>
      </div>

      <!-- Token -->
      <div class="space-y-1.5">
        <Label class="text-sm font-medium">Token</Label>
        <div class="flex gap-2">
          <div class="relative flex-1 min-w-0">
            <Input
              v-model="tokenInput"
              :type="showToken ? 'text' : 'password'"
              class="font-mono text-xs pr-8"
              placeholder="xxxx:yyyy"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              @click="showToken = !showToken"
            >
              <Eye v-if="!showToken" class="h-4 w-4" />
              <EyeOff v-else class="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            class="shrink-0"
            :disabled="savingToken"
            @click="handleSaveToken"
          >
            <Loader2 v-if="savingToken" class="h-3 w-3 animate-spin mr-1" />
            <Save v-else class="h-3 w-3 mr-1" />确认
          </Button>
        </div>
      </div>

      <!-- 路由 -->
      <div class="space-y-1.5">
        <Label class="text-sm font-medium">路由</Label>
        <div class="rounded-md border overflow-hidden">
          <table class="w-full text-xs">
            <thead class="bg-muted/50">
              <tr>
                <th
                  class="text-left px-3 py-2 font-medium text-muted-foreground"
                >
                  name
                </th>
                <th
                  class="text-left px-3 py-2 font-medium text-muted-foreground"
                >
                  type
                </th>
                <th
                  class="text-left px-3 py-2 font-medium text-muted-foreground"
                >
                  entry
                </th>
                <th
                  class="text-left px-3 py-2 font-medium text-muted-foreground"
                >
                  icon path
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(route, i) in editableRoutes"
                :key="i"
                class="border-t"
              >
                <td class="px-2 py-1">
                  <input
                    v-model="route.name"
                    class="w-full bg-transparent font-mono border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring transition-colors"
                    @input="onRouteInput"
                  />
                </td>
                <td class="px-2 py-1">
                  <input
                    v-model="route.type"
                    class="w-full bg-transparent font-mono border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring transition-colors"
                    @input="onRouteInput"
                  />
                </td>
                <td class="px-2 py-1">
                  <input
                    v-model="route.entry"
                    class="w-full bg-transparent font-mono border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring transition-colors text-muted-foreground"
                    @input="onRouteInput"
                  />
                </td>
                <td class="px-2 py-1">
                  <input
                    v-model="route.icon"
                    class="w-full bg-transparent font-mono border border-border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-ring transition-colors text-muted-foreground"
                    @input="onRouteInput"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex justify-end">
          <Button size="sm" :disabled="savingRoutes" @click="handleSaveRoutes">
            <Loader2 v-if="savingRoutes" class="h-3 w-3 animate-spin mr-1" />
            <Save v-else class="h-3 w-3 mr-1" />确认
          </Button>
        </div>
      </div>
    </TabsContent>
  </Tabs>
</template>
