<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
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
import { Eye, Pencil, Trash2 } from "lucide-vue-next";
import { useTokenListHook, type Token } from "./useTokenList";

const useTokenList = useTokenListHook();
const router = useRouter();

const tokensList = ref<Token[]>([]);
const fetchLoading = ref(false);
const deleteLoading = ref(false);
const page = ref(1);
const pageSize = 10;

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
});

const toCreateToken = () => {
  router.push("/dashboard/tokenCeate");
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
</script>

<template>
  <div>
    <div class="flex justify-between gap-4">
      <div><Input placeholder="输入token_key搜索" /></div>
      <div>
        <Button @click="toCreateToken">创建Token</Button>
      </div>
    </div>

    <div v-if="fetchLoading" class="mt-20 flex w-full flex-col items-center">
      <Spinner />
      <div class="text-sm text-muted-foreground">Loading tokens...</div>
    </div>

    <div v-else class="space-y-4">
      <Table class="w-full">
        <TableHeader>
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Token Key</TableHead>
            <TableHead>Token Limit</TableHead>
            <TableHead>Actions</TableHead>
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
              <Button variant="ghost" size="sm">
                <Eye />
              </Button>
              <!-- 编辑按钮 -->
              <Button variant="ghost" size="sm">
                <Pencil />
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
                  <DialogTitle>删除Token</DialogTitle>
                  <DialogDescription>
                    是否确认删除，此操作不可逆！
                  </DialogDescription>
                  <DialogFooter>
                    <DialogClose as-child>
                      <Button variant="outline"> 取消 </Button>
                    </DialogClose>
                    <Button @click="handleDeleteToken(token)"> 确认 </Button>
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
              No tokens found.
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
              Showing {{ pageLabel }} of {{ total }} tokens
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
</template>
