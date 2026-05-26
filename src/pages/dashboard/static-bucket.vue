<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { FolderOpen } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useStaticBucket } from "@/composables/useStaticBucket";
import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import type {
  StaticBucketInput,
  StaticBucket,
} from "@/composables/useStaticBucket";
import StaticBucketTable from "@/components/static-bucket/StaticBucketTable.vue";
import StaticBucketDialog from "@/components/static-bucket/StaticBucketDialog.vue";
import StaticBucketUploadDirDialog from "@/components/static-bucket/StaticBucketUploadDirDialog.vue";

definePage({
  meta: {
    title: "router.staticBucket",
    icon: FolderOpen,
    order: 13,
    group: "router.group.advanced",
  },
});

const router = useRouter();
const staticBucket = useStaticBucket();
const bucketFile = useStaticBucketFile();

const deletingBucketName = ref<string | null>(null);

const bucketDialogOpen = ref(false);
const bucketDialogLoading = ref(false);
const bucketDialogError = ref<string | null>(null);
const bucketDialogInitial = ref<StaticBucketInput | null>(null);

const uploadDirOpen = ref(false);
const uploadDirLoading = ref(false);
const uploadDirError = ref<string | null>(null);
const uploadDirTarget = ref<string | null>(null);

onMounted(() => staticBucket.fetchList());

const openCreateBucket = () => {
  bucketDialogInitial.value = null;
  bucketDialogError.value = null;
  bucketDialogOpen.value = true;
};

const handleBucketSave = async (input: StaticBucketInput) => {
  bucketDialogError.value = null;
  bucketDialogLoading.value = true;
  try {
    if (bucketDialogInitial.value) {
      await staticBucket.updateBucket(input);
      toast.success(`Bucket「${input.name}」已更新`);
    } else {
      await staticBucket.createBucket(input);
      toast.success(`Bucket「${input.name}」已创建`);
    }
    bucketDialogOpen.value = false;
    await staticBucket.fetchList();
  } catch (e: unknown) {
    bucketDialogError.value = e instanceof Error ? e.message : String(e);
  } finally {
    bucketDialogLoading.value = false;
  }
};

const handleToggleHttpRoot = async (bucket: StaticBucket) => {
  try {
    if (bucket.is_http_root) {
      await staticBucket.disableTheme(bucket.name);
    } else {
      await staticBucket.enableTheme(bucket.name);
    }
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "更新失败");
  }
};

const handleToggleCORS = async (bucket: StaticBucket) => {
  try {
    await staticBucket.setCORS(bucket.name, !bucket.cors);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "更新失败");
  }
};

const handleToggleEnable = async (bucket: StaticBucket) => {
  try {
    await staticBucket.setEnable(bucket.name, !bucket.enable);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "更新失败");
  }
};

const handleBucketDelete = async (name: string) => {
  deletingBucketName.value = name;
  try {
    await staticBucket.deleteBucket(name);
    toast.success(`Bucket「${name}」已删除`);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deletingBucketName.value = null;
  }
};

const downloadBucketZip = bucketFile.downloadBucketZip;

const openUploadDir = (targetBucket?: string) => {
  uploadDirTarget.value = targetBucket ?? null;
  uploadDirError.value = null;
  uploadDirOpen.value = true;
};

const handleUploadDir = async (
  files: Array<{ path: string; base64: string }>,
) => {
  const target = uploadDirTarget.value;
  if (!target) return;
  uploadDirLoading.value = true;
  uploadDirError.value = null;
  try {
    const remoteFiles = await bucketFile.fetchList(target);
    const localPaths = new Set(files.map((f) => f.path));
    const extraRemotePaths = remoteFiles
      .map((f) => f.path)
      .filter((p) => !localPaths.has(p));
    for (const file of files) {
      await bucketFile.uploadFile(target, file.path, file.base64);
    }
    for (const path of extraRemotePaths) {
      await bucketFile.deleteFile(target, path);
    }
    toast.success(
      `已同步到「${target}」：上传 ${files.length} 个，删除 ${extraRemotePaths.length} 个`,
    );
    uploadDirOpen.value = false;
  } catch (e: unknown) {
    uploadDirError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadDirLoading.value = false;
  }
};

const handleCreateAndUpload = async (
  bucketName: string,
  files: Array<{ path: string; base64: string }>,
) => {
  uploadDirLoading.value = true;
  uploadDirError.value = null;
  try {
    await staticBucket.createBucket({
      name: bucketName,
      path: bucketName,
      is_http_root: false,
      cors: false,
      enable: true,
    });
    for (const file of files) {
      await bucketFile.uploadFile(bucketName, file.path, file.base64);
    }
    toast.success(`Bucket「${bucketName}」已创建，上传 ${files.length} 个文件`);
    uploadDirOpen.value = false;
    await staticBucket.fetchList();
  } catch (e: unknown) {
    uploadDirError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadDirLoading.value = false;
  }
};
</script>

<template>
  <div class="flex h-full flex-col space-y-4">
    <h1 class="mb-2 text-2xl font-bold">静态资源管理</h1>

    <StaticBucketTable
      :buckets="staticBucket.buckets.value"
      :loading="staticBucket.loading.value"
      :deleting-name="deletingBucketName"
      @select="(name) => router.push(`/dashboard/bucket/${name}`)"
      @create="openCreateBucket"
      @upload-dir="openUploadDir()"
      @reupload="(name) => openUploadDir(name)"
      @download-zip="downloadBucketZip"
      @delete="handleBucketDelete"
      @toggle-http-root="handleToggleHttpRoot"
      @toggleCORS="handleToggleCORS"
      @toggleEnable="handleToggleEnable"
      @refresh="staticBucket.fetchList()"
    />

    <StaticBucketDialog
      :open="bucketDialogOpen"
      :loading="bucketDialogLoading"
      :error="bucketDialogError"
      :initial="bucketDialogInitial"
      @update:open="bucketDialogOpen = $event"
      @save="handleBucketSave"
    />

    <StaticBucketUploadDirDialog
      :open="uploadDirOpen"
      :loading="uploadDirLoading"
      :error="uploadDirError"
      :target-bucket="uploadDirTarget"
      @update:open="uploadDirOpen = $event"
      @create="handleCreateAndUpload"
      @upload="handleUploadDir"
    />
  </div>
</template>
