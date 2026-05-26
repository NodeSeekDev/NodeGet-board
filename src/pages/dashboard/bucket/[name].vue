<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useStaticBucketFile } from "@/composables/useStaticBucketFile";
import { bufToBase64, base64ToBuf } from "@/utils/base64";
import { isBinaryBuffer, triggerBlobDownload } from "@/utils/file";
import StaticBucketFileView from "@/components/static-bucket/StaticBucketFileView.vue";
import StaticBucketFileUploadDialog from "@/components/static-bucket/StaticBucketFileUploadDialog.vue";
import StaticBucketUploadDirDialog from "@/components/static-bucket/StaticBucketUploadDirDialog.vue";

definePage({ meta: { title: "", hidden: true } });

const route = useRoute("/dashboard/bucket/[name]");
const router = useRouter();
const bucketFile = useStaticBucketFile();

const bucketName = (route.params as { name: string }).name;

const deletingFilePath = ref<string | null>(null);
const savingFile = ref(false);

const uploadFileOpen = ref(false);
const uploadFileLoading = ref(false);
const uploadFileError = ref<string | null>(null);

const uploadDirOpen = ref(false);
const uploadDirLoading = ref(false);
const uploadDirError = ref<string | null>(null);

const fileViewRef = ref<InstanceType<typeof StaticBucketFileView> | null>(null);

onMounted(() => bucketFile.fetchList(bucketName));

const downloadBucketZip = () => bucketFile.downloadBucketZip(bucketName);

const handleReadFile = async (path: string) => {
  if (!fileViewRef.value) return;
  try {
    const base64 = await bucketFile.readFile(bucketName, path);
    const buf = base64ToBuf(base64);
    if (isBinaryBuffer(buf)) {
      fileViewRef.value.onFileContentUnsupported();
      return;
    }
    fileViewRef.value.onFileContentLoaded(new TextDecoder().decode(buf));
  } catch (e: unknown) {
    fileViewRef.value?.onFileContentError(
      e instanceof Error ? e.message : String(e),
    );
  }
};

const handleSaveFile = async (path: string, content: string) => {
  savingFile.value = true;
  try {
    const base64 = bufToBase64(new TextEncoder().encode(content));
    await bucketFile.uploadFile(bucketName, path, base64);
    toast.success("已保存");
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    savingFile.value = false;
  }
};

const handleReplaceFile = async (path: string, base64: string) => {
  if (!fileViewRef.value) return;
  savingFile.value = true;
  try {
    await bucketFile.uploadFile(bucketName, path, base64);
    toast.success("已上传替换");
    await handleReadFile(path);
    await bucketFile.fetchList(bucketName);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "上传失败");
  } finally {
    savingFile.value = false;
  }
};

const handleDownloadFile = async (path: string) => {
  try {
    const base64 = await bucketFile.readFile(bucketName, path);
    triggerBlobDownload(
      new Blob([base64ToBuf(base64).buffer as ArrayBuffer], {
        type: "application/octet-stream",
      }),
      path.split("/").pop() ?? path,
    );
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "下载失败");
  }
};

const handleRenameFile = async (from: string, to: string) => {
  if (bucketFile.files.value.some((f) => f.path === to)) {
    toast.error("目标路径已存在同名文件");
    return;
  }
  try {
    await bucketFile.renameFile(bucketName, from, to);
    await bucketFile.fetchList(bucketName);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "移动失败");
  }
};

const handleDeleteFile = async (path: string) => {
  deletingFilePath.value = path;
  try {
    await bucketFile.deleteFile(bucketName, path);
    toast.success(`「${path}」已删除`);
  } catch (e: unknown) {
    toast.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deletingFilePath.value = null;
  }
};

const handleUploadFile = async (path: string, base64: string) => {
  uploadFileError.value = null;
  uploadFileLoading.value = true;
  try {
    await bucketFile.uploadFile(bucketName, path, base64);
    toast.success(`文件「${path}」上传成功`);
    uploadFileOpen.value = false;
    await bucketFile.fetchList(bucketName);
  } catch (e: unknown) {
    uploadFileError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadFileLoading.value = false;
  }
};

const handleUploadDir = async (
  files: Array<{ path: string; base64: string }>,
) => {
  uploadDirLoading.value = true;
  uploadDirError.value = null;
  try {
    const { uploaded, deleted } = await bucketFile.syncBucketDir(
      bucketName,
      files,
    );
    toast.success(
      `已同步到「${bucketName}」：上传 ${uploaded} 个，删除 ${deleted} 个`,
    );
    uploadDirOpen.value = false;
    await bucketFile.fetchList(bucketName);
  } catch (e: unknown) {
    uploadDirError.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploadDirLoading.value = false;
  }
};
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <StaticBucketFileView
      ref="fileViewRef"
      class="flex-1 overflow-hidden"
      :bucket-name="bucketName"
      :files="bucketFile.files.value"
      :loading="bucketFile.loading.value"
      :saving-file="savingFile"
      :deleting-path="deletingFilePath"
      @back="router.push('/dashboard/static-bucket')"
      @upload-file="uploadFileOpen = true"
      @upload-dir="uploadDirOpen = true"
      @download-zip="downloadBucketZip"
      @download-file="handleDownloadFile"
      @delete-file="handleDeleteFile"
      @read-file="handleReadFile"
      @save-file="handleSaveFile"
      @replace-file="handleReplaceFile"
      @rename-file="handleRenameFile"
    />

    <StaticBucketFileUploadDialog
      :open="uploadFileOpen"
      :loading="uploadFileLoading"
      :error="uploadFileError"
      @update:open="uploadFileOpen = $event"
      @upload="handleUploadFile"
    />

    <StaticBucketUploadDirDialog
      :open="uploadDirOpen"
      :loading="uploadDirLoading"
      :error="uploadDirError"
      :target-bucket="bucketName"
      @update:open="uploadDirOpen = $event"
      @upload="handleUploadDir"
    />
  </div>
</template>
