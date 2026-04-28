import { toast } from "vue-sonner";
import { registerSW } from "virtual:pwa-register";

export function setupPwa(t: (key: string) => string) {
  const updateSW = registerSW({
    onNeedRefresh() {
      toast(t("pwa.newVersion"), {
        description: t("pwa.refreshToUpdate"),
        duration: Infinity,
        action: {
          label: t("pwa.update"),
          onClick: () => {
            updateSW(true);
          },
        },
      });
    },
    onOfflineReady() {
      toast.success(t("pwa.offlineReady"));
    },
    onRegisterError(error) {
      console.error("pwa register failed", error);
    },
  });
}
