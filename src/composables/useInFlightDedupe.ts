import { ref } from "vue";

export function useInFlightDedupe<T, A extends any[]>(
  fn: (...args: A) => Promise<T>,
) {
  const data = ref<T | null>(null);
  const error = ref<any>(null);
  const isLoading = ref(false);

  let currentPromise: Promise<T> | null = null;

  async function execute(...args: A): Promise<T> {
    // 如果已有请求在进行，直接复用
    if (currentPromise) {
      return currentPromise;
    }

    isLoading.value = true;

    currentPromise = fn(...args)
      .then((res) => {
        data.value = res;
        error.value = null;
        return res;
      })
      .catch((err) => {
        error.value = err;
        throw err;
      })
      .finally(() => {
        isLoading.value = false;
        currentPromise = null;
      });

    return currentPromise;
  }

  return {
    data,
    error,
    isLoading,
    execute,
  };
}
