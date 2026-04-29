import type { NodeMetadata } from "@/types/node";
import type { useKv } from "@/composables/useKv";

export function useNodeMetadata(kv: ReturnType<typeof useKv>) {
  function parseMetadataFields(
    entries: { key: string; value: unknown }[],
    fallbackName = "",
  ): NodeMetadata {
    const get = (key: string) => entries.find((e) => e.key === key)?.value;
    return {
      name: String(get("metadata_name") ?? "") || fallbackName,
      tags: (Array.isArray(get("metadata_tags"))
        ? (get("metadata_tags") as string[])
        : []
      ).filter(Boolean),
      price: Number(get("metadata_price") ?? 0),
      priceUnit: String(get("metadata_price_unit") ?? "$"),
      priceCycle: Number(get("metadata_price_cycle") ?? 30),
      expireTime: String(get("metadata_expire_time") ?? ""),
      region: String(get("metadata_region") ?? ""),
      hidden: Boolean(get("metadata_hidden") ?? false),
      order: Number(get("metadata_order") ?? 0),
    };
  }

  function buildMetadataBatch(f: NodeMetadata) {
    return [
      { key: "metadata_name", value: f.name },
      { key: "metadata_tags", value: f.tags },
      { key: "metadata_price", value: f.price },
      { key: "metadata_price_unit", value: f.priceUnit },
      { key: "metadata_price_cycle", value: f.priceCycle },
      { key: "metadata_expire_time", value: f.expireTime },
      { key: "metadata_region", value: f.region },
      { key: "metadata_hidden", value: f.hidden },
      { key: "metadata_order", value: f.order },
    ];
  }

  async function initDefaultMetadata(uuid: string) {
    kv.namespace.value = uuid;
    const defaultName = "节点" + uuid.slice(-6);
    await Promise.all([
      kv.setValue("metadata_name", defaultName),
      kv.setValue("metadata_tags", []),
      kv.setValue("metadata_price", 0),
      kv.setValue("metadata_price_unit", "$"),
      kv.setValue("metadata_price_cycle", 30),
      kv.setValue("metadata_expire_time", ""),
      kv.setValue("metadata_region", ""),
      kv.setValue("metadata_hidden", false),
      kv.setValue("metadata_order", Date.now()),
    ]);
  }

  return { parseMetadataFields, buildMetadataBatch, initDefaultMetadata };
}
