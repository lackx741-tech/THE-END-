import { modalDesignSchema, type ModalDesign } from "@/lib/schema";

const canonicalDefaults = modalDesignSchema.parse({});

export function getCanonicalModalDefaults(): ModalDesign {
  return structuredClone(canonicalDefaults);
}

export function resolveModalDesign(input: unknown): ModalDesign {
  if (!input || typeof input !== "object") {
    return getCanonicalModalDefaults();
  }

  const merged = {
    ...getCanonicalModalDefaults(),
    ...(input as Record<string, unknown>),
  };

  const parsed = modalDesignSchema.safeParse(merged);
  return parsed.success ? parsed.data : getCanonicalModalDefaults();
}
