import { z } from "zod";

/**
 * Dynamic business rules — shape is open-ended.
 * Never hardcode coupon_discount / coupon_expiry columns in the DB schema.
 * New rule kinds (Minimum Order, Buy X Get Y, …) are just more entries.
 */
export const BusinessRuleSchema = z.object({
  /** Stable slug derived from the label, e.g. "discount", "minimum_order" */
  key: z.string().min(1),
  /** Human label shown in UI, e.g. "Discount", "Maximum Discount" */
  label: z.string().min(1),
  /** Canonical value as string for display + comparison */
  value: z.string().min(1),
  /** Optional unit / qualifier, e.g. "THB", "%", "times" */
  unit: z.string().optional(),
  /** Optional structured payload without constraining the key set */
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type BusinessRule = z.infer<typeof BusinessRuleSchema>;

export const BusinessRulesSchema = z.array(BusinessRuleSchema);

export function parseBusinessRules(raw: unknown): BusinessRule[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return BusinessRulesSchema.parse(JSON.parse(trimmed));
    } catch {
      // Legacy plain-text rules → single freeform entry
      return [
        {
          key: "note",
          label: "Note",
          value: trimmed,
        },
      ];
    }
  }
  return BusinessRulesSchema.parse(raw);
}

export function rulesPresent(rules: BusinessRule[]): boolean {
  return rules.length > 0;
}

export function slugifyRuleKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_")
    .replace(/^_|_$/g, "") || "rule";
}
