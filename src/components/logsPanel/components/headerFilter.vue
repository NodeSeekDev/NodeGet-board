<script setup lang="ts">
import { ref } from "vue";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-vue-next";

type SelectValueType = {
  target: string | null;
  level: string | null;
};

const selectValue = ref<SelectValueType>({
  target: null,
  level: null,
});
const SearchParams = ref<SelectValueType[]>([]);

const addSearchParams = (value: SelectValueType) => {
  if (!value.target) return;
  const isDuplicate = SearchParams.value.some(
    (item) => item.target === value.target && item.level === value.level,
  );

  if (!isDuplicate) {
    SearchParams.value.push(value);
  }

  selectValue.value = {
    target: null,
    level: null,
  };
};
</script>

<template>
  <div class="space-y-4">
    <div
      class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex flex-1 flex-wrap items-center gap-2">
        <div class="w-[220px] max-w-full">
          <Select v-model="selectValue.target" placeholder="请选择">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="请选择目标" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>请选择目标</SelectLabel>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="w-[220px] max-w-full">
          <Select v-model="selectValue.level" placeholder="请选择">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="请选择级别" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>请选择级别</SelectLabel>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button @click="addSearchParams(selectValue)">
            <Plus />
            添加条件
          </Button>
        </div>
      </div>

      <div></div>
    </div>

    <div class="flex flex-wrap gap-2">
      <Badge
        v-for="(item, index) in SearchParams"
        :key="index"
        variant="secondary"
        class="h-6 gap-1 px-2 text-[11px]"
      >
        {{ item.target }}: {{ item.level }}
        <Button
          variant="ghost"
          size="icon-sm"
          class="m-0 size-4 rounded-full p-0 hover:bg-transparent"
          @click="SearchParams.splice(index, 1)"
        >
          <X class="size-3" />
        </Button>
      </Badge>
    </div>
  </div>
</template>
