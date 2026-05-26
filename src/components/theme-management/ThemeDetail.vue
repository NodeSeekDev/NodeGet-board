<script setup lang="ts">
import { ref, watch, computed, onMounted } from "vue";
import { Loader2, Plus, Trash2, RotateCcw, Check } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Codemirror } from "vue-codemirror";
import { json } from "@codemirror/lang-json";
import { javascript } from "@codemirror/lang-javascript";
import { StreamLanguage } from "@codemirror/language";
import { css } from "@codemirror/legacy-modes/mode/css";
import { oneDark } from "@codemirror/theme-one-dark";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useThemeStore } from "@/stores/theme";
import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import { useKv } from "@/composables/useKv";
import type { ThemeToken } from "@/types/theme";

type UserPrefFormItem = {
  key?: string;
  name: string;
  type: "string" | "number" | "select" | "switch" | "title";
  default?: unknown;
  help?: string;
  required?: boolean;
  options?: string;
};

type SiteToken = ThemeToken;
type TokenPreset = ThemeToken;

const props = defineProps<{
  bucketName: string;
}>();

const themeStore = useThemeStore();
const sbf = useStaticBucketFile();
const kv = useKv();

const activeTab = ref("overview");
const KV_NAMESPACE = "global";

const themeJson = ref<Record<string, unknown>>({});
const overviewLoading = ref(false);

const loadThemeJson = async () => {
  overviewLoading.value = true;
  try {
    const text = await sbf.readTextFile(props.bucketName, "nodeget-theme.json");
    themeJson.value = text ? JSON.parse(text) : {};
  } catch {
    themeJson.value = {};
  } finally {
    overviewLoading.value = false;
  }
};

const configJson = ref<{
  user_preferences?: Record<string, unknown>;
  site_tokens?: SiteToken[];
}>({});

const loadConfigJson = async () => {
  try {
    const text = await sbf.readTextFile(props.bucketName, "config.json");
    configJson.value = text ? JSON.parse(text) : {};
  } catch {
    configJson.value = {};
  }
};

const patchAndSaveConfigJson = async (
  patch: Partial<{
    user_preferences: Record<string, unknown>;
    site_tokens: SiteToken[];
  }>,
) => {
  const updated = { ...configJson.value, ...patch };
  const content = JSON.stringify(updated, null, 2);
  await sbf.saveTextFile(props.bucketName, "config.json", content);
  configJson.value = updated;
};

const overviewEntries = computed(() =>
  Object.entries(themeJson.value).filter(
    ([k]) => k !== "user_preferences_form",
  ),
);

const userPrefFormItems = computed<UserPrefFormItem[]>(() => {
  const form = themeJson.value["user_preferences_form"] as
    | { items?: UserPrefFormItem[] }
    | undefined;
  if (form && Array.isArray(form.items)) return form.items;
  return [];
});

const userPrefValues = ref<Record<string, unknown>>({});
const userPrefJsonEditor = ref("");
const userPrefSaving = ref(false);

const initUserPrefValues = () => {
  const stored = configJson.value.user_preferences ?? {};
  if (userPrefFormItems.value.length > 0) {
    const values: Record<string, unknown> = {};
    for (const field of userPrefFormItems.value) {
      if (field.type === "title" || !field.key) continue;
      values[field.key] = stored[field.key] ?? field.default;
    }
    userPrefValues.value = values;
  } else {
    userPrefValues.value = stored;
    userPrefJsonEditor.value = JSON.stringify(stored, null, 2);
  }
};

const saveUserPrefs = async () => {
  userPrefSaving.value = true;
  try {
    const valueToSave: Record<string, unknown> =
      userPrefFormItems.value.length > 0
        ? userPrefValues.value
        : JSON.parse(userPrefJsonEditor.value);
    await patchAndSaveConfigJson({ user_preferences: valueToSave });
    toast.success("用户配置已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    userPrefSaving.value = false;
  }
};

const cssContent = ref("");
const cssLoading = ref(false);
const cssSaving = ref(false);

const loadCss = async () => {
  cssLoading.value = true;
  try {
    cssContent.value = await sbf.readTextFile(props.bucketName, "custom.css");
  } finally {
    cssLoading.value = false;
  }
};

const saveCss = async () => {
  cssSaving.value = true;
  try {
    await sbf.saveTextFile(props.bucketName, "custom.css", cssContent.value);
    toast.success("custom.css 已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    cssSaving.value = false;
  }
};

const jsContent = ref("");
const jsLoading = ref(false);
const jsSaving = ref(false);

const JS_DEFAULT = `// 你可以自定义这里
console.log(
  "%c✨ NodeGet ✨",
  "background: linear-gradient(to right, #ff007f, #7f00ff); color: white; font-size: 24px; font-weight: bold; padding: 10px 20px; border-radius: 5px; text-shadow: 0 0 10px rgba(255,255,255,0.5);"
);`;

const loadJs = async () => {
  jsLoading.value = true;
  try {
    const text = await sbf.readTextFile(props.bucketName, "custom.js");
    jsContent.value = text || JS_DEFAULT;
  } finally {
    jsLoading.value = false;
  }
};

const saveJs = async () => {
  jsSaving.value = true;
  try {
    await sbf.saveTextFile(props.bucketName, "custom.js", jsContent.value);
    toast.success("custom.js 已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    jsSaving.value = false;
  }
};

const authEntries = ref<SiteToken[]>([]);
const authSaving = ref(false);
const tokenPresets = ref<TokenPreset[]>([]);

const initAuth = () => {
  authEntries.value = configJson.value.site_tokens ?? [];
};

const loadTokenPresets = async () => {
  try {
    kv.namespace.value = KV_NAMESPACE;
    const raw = await kv.getValue("theme_token");
    if (Array.isArray(raw)) {
      tokenPresets.value = raw as TokenPreset[];
    } else {
      tokenPresets.value = [];
    }
  } catch {
    tokenPresets.value = [];
  }
};

const saveAuth = async () => {
  authSaving.value = true;
  try {
    await patchAndSaveConfigJson({ site_tokens: authEntries.value });
    toast.success("Token 授权已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    authSaving.value = false;
  }
};

const addAuthRow = () => {
  authEntries.value.push({ name: "", backend_url: "", token: "" });
};

const removeAuthRow = (index: number) => {
  authEntries.value.splice(index, 1);
};

const addPreset = (preset: TokenPreset) => {
  const exists = authEntries.value.some(
    (e) => e.name === preset.name && e.token === preset.token,
  );
  if (!exists) {
    authEntries.value.push({ ...preset });
  }
};

watch(activeTab, (tab) => {
  if (tab === "user-prefs") initUserPrefValues();
  else if (tab === "custom-css") loadCss();
  else if (tab === "custom-js") loadJs();
  else if (tab === "token-auth") {
    initAuth();
    loadTokenPresets();
  }
});

onMounted(async () => {
  await Promise.all([loadThemeJson(), loadConfigJson()]);
  loadTokenPresets();
});

watch(
  () => props.bucketName,
  async () => {
    activeTab.value = "overview";
    themeJson.value = {};
    configJson.value = {};
    await Promise.all([loadThemeJson(), loadConfigJson()]);
  },
);

const jsonExtensions = computed(() => [
  json(),
  ...(themeStore.isDark ? [oneDark] : []),
]);
const cssExtensions = computed(() => [
  StreamLanguage.define(css),
  ...(themeStore.isDark ? [oneDark] : []),
]);
const jsExtensions = computed(() => [
  javascript(),
  ...(themeStore.isDark ? [oneDark] : []),
]);
</script>

<template>
  <div class="mt-2 border rounded-lg p-4 bg-background">
    <Tabs v-model="activeTab">
      <TabsList class="mb-4">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="user-prefs">用户配置</TabsTrigger>
        <TabsTrigger value="custom-css">自定义 CSS</TabsTrigger>
        <TabsTrigger value="custom-js">自定义 JS</TabsTrigger>
        <TabsTrigger value="token-auth">Token 授权</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div
          v-if="overviewLoading"
          class="flex items-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>
        <div
          v-else-if="!overviewEntries.length"
          class="py-4 text-muted-foreground text-sm"
        >
          未找到 nodeget-theme.json
        </div>
        <div v-else class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <template v-for="[key, value] in overviewEntries" :key="key">
            <span class="text-muted-foreground font-medium shrink-0">{{
              key
            }}</span>
            <span class="break-all">{{
              typeof value === "object" ? JSON.stringify(value) : String(value)
            }}</span>
          </template>
        </div>
      </TabsContent>

      <TabsContent value="user-prefs">
        <div
          v-if="overviewLoading"
          class="flex items-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>
        <div v-else>
          <div v-if="userPrefFormItems.length" class="space-y-3">
            <template
              v-for="field in userPrefFormItems"
              :key="field.key ?? field.name"
            >
              <p
                v-if="field.type === 'title'"
                class="font-medium text-sm mt-2 text-foreground"
              >
                {{ field.name }}
              </p>
              <div
                v-else-if="field.key"
                class="grid grid-cols-[180px_1fr] items-center gap-4"
              >
                <Label class="text-right">{{ field.name }}</Label>
                <div>
                  <Input
                    v-if="field.type === 'string'"
                    :model-value="
                      String(userPrefValues[field.key] ?? field.default ?? '')
                    "
                    :placeholder="field.help ?? ''"
                    @update:model-value="userPrefValues[field.key!] = $event"
                  />
                  <Input
                    v-else-if="field.type === 'number'"
                    type="number"
                    :model-value="
                      String(userPrefValues[field.key] ?? field.default ?? 0)
                    "
                    :placeholder="field.help ?? ''"
                    @update:model-value="
                      userPrefValues[field.key!] = Number($event)
                    "
                  />
                  <button
                    v-else-if="field.type === 'switch'"
                    class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                    :class="
                      (userPrefValues[field.key] ?? field.default)
                        ? 'bg-primary'
                        : 'bg-input'
                    "
                    @click="
                      userPrefValues[field.key!] = !(
                        userPrefValues[field.key] ?? field.default
                      )
                    "
                  >
                    <span
                      class="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
                      :class="
                        (userPrefValues[field.key] ?? field.default)
                          ? 'translate-x-4'
                          : 'translate-x-0.5'
                      "
                    />
                  </button>
                  <Select
                    v-else-if="field.type === 'select'"
                    :model-value="
                      String(userPrefValues[field.key] ?? field.default ?? '')
                    "
                    @update:model-value="userPrefValues[field.key!] = $event"
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in field.options?.split(',') ?? []"
                        :key="opt.trim()"
                        :value="opt.trim()"
                      >
                        {{ opt.trim() }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p
                    v-if="field.help && field.type !== 'switch'"
                    class="text-xs text-muted-foreground mt-1"
                  >
                    {{ field.help }}
                  </p>
                </div>
              </div>
            </template>
          </div>

          <div v-else class="space-y-2">
            <p class="text-xs text-muted-foreground">
              该主题未定义 user_preferences_form，可直接编辑 JSON
            </p>
            <Codemirror
              v-model="userPrefJsonEditor"
              :extensions="jsonExtensions"
              :style="{ height: '200px', fontSize: '13px' }"
            />
          </div>

          <div class="flex justify-end mt-4">
            <Button :disabled="userPrefSaving" @click="saveUserPrefs">
              <Loader2
                v-if="userPrefSaving"
                class="h-4 w-4 animate-spin mr-1"
              />
              <Check v-else class="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="custom-css">
        <div
          v-if="cssLoading"
          class="flex items-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>
        <div v-else class="space-y-3">
          <Codemirror
            v-model="cssContent"
            :extensions="cssExtensions"
            :style="{ height: '300px', fontSize: '13px' }"
          />
          <div class="flex justify-end">
            <Button :disabled="cssSaving" @click="saveCss">
              <Loader2 v-if="cssSaving" class="h-4 w-4 animate-spin mr-1" />
              <Check v-else class="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="custom-js">
        <div
          v-if="jsLoading"
          class="flex items-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>
        <div v-else class="space-y-3">
          <Codemirror
            v-model="jsContent"
            :extensions="jsExtensions"
            :style="{ height: '300px', fontSize: '13px' }"
          />
          <div class="flex justify-end">
            <Button :disabled="jsSaving" @click="saveJs">
              <Loader2 v-if="jsSaving" class="h-4 w-4 animate-spin mr-1" />
              <Check v-else class="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="token-auth">
        <div
          v-if="overviewLoading"
          class="flex items-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <Loader2 class="h-4 w-4 animate-spin" />
          加载中...
        </div>
        <div v-else class="space-y-3">
          <div
            v-if="authEntries.length"
            class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground px-1"
          >
            <span>名称</span>
            <span>后端 URL</span>
            <span>Token</span>
            <span />
          </div>

          <div
            v-for="(entry, i) in authEntries"
            :key="i"
            class="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
          >
            <Input v-model="entry.name" placeholder="名称" />
            <Input v-model="entry.backend_url" placeholder="https://..." />
            <Input v-model="entry.token" placeholder="token" />
            <Button
              variant="ghost"
              size="icon"
              class="shrink-0"
              @click="removeAuthRow(i)"
            >
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>

          <div
            v-if="!authEntries.length"
            class="text-center text-muted-foreground text-sm py-3"
          >
            暂无授权配置
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" @click="addAuthRow">
              <Plus class="h-4 w-4 mr-1" />
              添加空白
            </Button>
            <template v-if="tokenPresets.length">
              <Button
                v-for="preset in tokenPresets"
                :key="preset.name"
                variant="outline"
                size="sm"
                @click="addPreset(preset)"
              >
                <Plus class="h-4 w-4 mr-1" />
                {{ preset.name }}
              </Button>
            </template>
            <Button
              variant="ghost"
              size="sm"
              @click="
                initAuth();
                loadTokenPresets();
              "
            >
              <RotateCcw class="h-4 w-4 mr-1" />
              刷新
            </Button>
            <div class="flex-1" />
            <Button :disabled="authSaving" @click="saveAuth">
              <Loader2 v-if="authSaving" class="h-4 w-4 animate-spin mr-1" />
              <Check v-else class="h-4 w-4 mr-1" />
              确定
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
