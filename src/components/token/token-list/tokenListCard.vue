<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Eye, Pencil, Trash2, RotateCcw } from "lucide-vue-next";
import { useTokenListHook, type Token } from "./useTokenList";

const useTokenList = useTokenListHook();
const router = useRouter();
const { t } = useI18n();

const tokensList = ref<Token[]>([]);
const fetchLoading = ref(false);
const deleteLoading = ref(false);
const page = ref(1);
const pageSize = 10;
// 控制重置token弹窗显隐
const resetTokenOpen = ref(false);
// 控制重置token loading
const resetTokenLoading = ref(false);
// 控制是否显示重置Token结果
const showResetTokenResult = ref(false);

const total = computed(() => tokensList.value.length);
const pagedTokens = computed(() => {
  const start = (page.value - 1) * pageSize;
  return tokensList.value.slice(start, start + pageSize);
});

const pageLabel = computed(() => {
  if (total.value === 0) return "0 - 0";
  const start = (page.value - 1) * pageSize + 1;
  const end = Math.min(page.value * pageSize, total.value);
  return `${start} - ${end}`;
});

onMounted(() => {
  //   fetchLoading.value = true;
  //   useTokenList
  //     .getTokenList()
  //     .then((res) => {
  //       tokensList.value = res;
  //       page.value = 1;
  //     })
  //     .finally(() => {
  //       fetchLoading.value = false;
  //     });
  handleGetTokenList();
});

// 获取token列表
const handleGetTokenList = () => {
  fetchLoading.value = true;
  useTokenList
    .getTokenList()
    .then((res) => {
      tokensList.value = res;
      page.value = 1;
    })
    .finally(() => {
      fetchLoading.value = false;
    });
};

const toCreateToken = () => {
  router.push("/dashboard/tokenCeate");
};

const toImportToken = () => {
  router.push("/dashboard/tokenImport");
};

// 编辑token
const handleEditToken = (token: Token) => {
  router.push({
    path: "/dashboard/tokenEdit",
    query: { token: `${token.token_key}` },
  });
};

const handleViewTokenDetail = (token: Token) => {
  router.push({
    path: "/dashboard/tokenDetail",
    query: { token: `${token.token_key}` },
  });
};

// 删除Token
const handleDeleteToken = (deleteToken: Token) => {
  deleteLoading.value = true;
  useTokenList
    .deleteToken(deleteToken)
    .then(() => {
      fetchLoading.value = true;
      useTokenList
        .getTokenList()
        .then((res) => {
          tokensList.value = res;
          page.value = 1;
        })
        .finally(() => {
          fetchLoading.value = false;
        });
    })
    .finally(() => {
      deleteLoading.value = false;
    });
};

// 打开重置Token弹窗
const handleOpenResetToken = (token: Token) => {
  resetTokenOpen.value = true;
};
// 确认重置Token操作
const handleConfirmResetToken = (token: Token) => {};
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="w-full lg:max-w-sm">
        <Input :placeholder="t('dashboard.token.list.searchPlaceholder')" />
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button type="button" @click="handleGetTokenList" variant="outline">
          <span class="inline-flex items-center justify-center">{{
            t("dashboard.token.list.resetButton")
          }}</span>
        </Button>
        <Button type="button" class="min-w-24" @click="handleGetTokenList">
          <span class="inline-flex w-full items-center justify-center gap-2">
            <Spinner v-if="fetchLoading" />
            {{
              fetchLoading
                ? t("dashboard.token.list.searchingButton")
                : t("dashboard.token.list.searchButton")
            }}
          </span>
        </Button>
        <Button type="button" @click="toCreateToken">
          <span class="inline-flex items-center justify-center">{{
            t("dashboard.token.list.createButton")
          }}</span>
        </Button>
        <Button type="button" @click="toImportToken">
          <span class="inline-flex items-center justify-center">{{
            t("dashboard.token.list.importButton")
          }}</span>
        </Button>
      </div>
    </div>

    <div v-if="fetchLoading" class="mt-20 flex w-full flex-col items-center">
      <Spinner />
      <div class="text-sm text-muted-foreground">
        {{ t("dashboard.token.list.table.loading") }}
      </div>
    </div>

    <div v-else class="space-y-4">
      <Table class="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>{{ t("dashboard.token.list.table.version") }}</TableHead>
            <TableHead>
              {{ t("dashboard.token.list.table.username") }}
            </TableHead>
            <TableHead>
              {{ t("dashboard.token.list.table.tokenKey") }}
            </TableHead>
            <TableHead>
              {{ t("dashboard.token.list.table.tokenLimit") }}
            </TableHead>
            <TableHead>
              {{ t("dashboard.token.list.table.actions") }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="token in pagedTokens" :key="token.token_key">
            <TableCell>{{ token.version }}</TableCell>
            <TableCell>{{ token.username }}</TableCell>
            <TableCell class="font-mono">{{ token.token_key }}</TableCell>
            <TableCell>{{ token.token_limit?.length ?? 0 }}</TableCell>
            <TableCell class="flex gap-2 w-20">
              <!-- 查看按钮 -->
              <Button
                variant="ghost"
                size="sm"
                @click="handleViewTokenDetail(token)"
              >
                <Eye />
              </Button>
              <!-- 编辑按钮 -->
              <Button variant="ghost" size="sm" @click="handleEditToken(token)">
                <Pencil />
              </Button>
              <!-- 重置token按钮 -->
              <Button
                variant="ghost"
                size="sm"
                @click="handleOpenResetToken(token)"
              >
                <RotateCcw />
              </Button>
              <!-- 删除操作 -->
              <Dialog>
                <DialogTrigger as-child>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-red-500"
                    :disabled="token.username == 'root'"
                  >
                    <Trash2 />
                  </Button>
                </DialogTrigger>
                <DialogContent class="w-400">
                  <DialogTitle>
                    {{ t("dashboard.token.list.deleteDialog.title") }}
                  </DialogTitle>
                  <DialogDescription>
                    {{ t("dashboard.token.list.deleteDialog.confirm") }}
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose as-child>
                      <Button variant="outline">
                        {{ t("dashboard.token.cancel") }}
                      </Button>
                    </DialogClose>
                    <Button
                      @click="handleDeleteToken(token)"
                      :disabled="deleteLoading"
                    >
                      <div v-if="deleteLoading" class="flex items-center">
                        <Spinner />{{ t("dashboard.token.deleting") }}
                      </div>
                      <div v-else>{{ t("dashboard.token.delete") }}</div>
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TableCell>
          </TableRow>
          <TableRow v-if="pagedTokens.length === 0">
            <TableCell
              colspan="5"
              class="py-8 text-center text-muted-foreground"
            >
              {{ t("dashboard.token.list.table.noToken") }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div class="w-full flex content-between">
        <Pagination
          v-slot="{ page: currentPage }"
          v-model:page="page"
          :items-per-page="pageSize"
          :total="total"
          :sibling-count="1"
          show-edges
          class="flex justify-between gap-4"
        >
          <div class="flex items-center justify-center gap-2">
            <div class="text-sm text-muted-foreground">
              <!-- Showing {{ pageLabel }} of {{ total }} tokens -->
              {{
                t("dashboard.token.list.table.pageShow", {
                  pageLabel: pageLabel,
                  total: total,
                })
              }}
            </div>
          </div>
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious />
            <template v-for="(item, index) in items" :key="index">
              <PaginationItem
                v-if="item.type === 'page'"
                :value="item.value"
                :is-active="item.value === currentPage"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else />
            </template>

            <PaginationNext />
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  </div>
  <!-- 重置 Token 弹窗 -->
  <Dialog v-model:open="resetTokenOpen">
    <DialogContent class="w-400">
      <DialogTitle>
        {{ t("dashboard.token.list.resetDialog.title") }}
      </DialogTitle>
      <DialogDescription>
        {{ t("dashboard.token.list.resetDialog.description") }}
      </DialogDescription>
      <!-- {{ t('dashboard.token.list.resetDialog.confirm') }} -->
      开发中......
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline"> {{ t("dashboard.token.cancel") }} </Button>
        </DialogClose>
        <Button @click="handleConfirmResetToken">
          <div v-if="resetTokenLoading" class="flex items-center">
            <Spinner />{{
              t("dashboard.token.list.resetDialog.confirmingButton")
            }}
          </div>
          <div v-else>
            {{ t("dashboard.token.list.resetDialog.confirmButton") }}
          </div>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
