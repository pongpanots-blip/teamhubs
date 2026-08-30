import {
  BusinessRulesSchema,
  slugifyRuleKey,
  type BusinessRule,
} from "@/lib/business-rules";
import { callModel, hasAiKey } from "@/lib/ai/model-client";

const SYSTEM = `You extract product business rules from a PM's free-form requirement.
Return ONLY valid JSON:
{
  "titleHint": string,
  "requirement": string,
  "businessRules": [
    { "key": string, "label": string, "value": string, "unit"?: string }
  ]
}

Rules:
- Do NOT invent a fixed schema. Keys/labels come from THIS text only.
- Different features may have completely different rule sets (coupon vs shipping vs loyalty).
- Prefer short labels like "Discount", "Usage", "Maximum Discount", "Minimum Order", "New Customer Only".
- key must be snake_case derived from the label.
- value is a concise canonical string (e.g. "10%", "1 time / customer", "500").
- unit is optional (e.g. "THB", "%").
- Never output hardcoded coupon-only fields if the text is about something else.`;

export type ExtractedRequirement = {
  titleHint: string;
  requirement: string;
  businessRules: BusinessRule[];
};

/** Offline heuristic for common coupon / promo phrasing (no API key). */
export function extractBusinessRulesHeuristic(text: string): ExtractedRequirement {
  const rules: BusinessRule[] = [];
  const t = text.trim();

  const pct = t.match(/ลด\s*(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)?/i);
  if (pct) {
    const n = pct[1] ?? pct[2]!;
    rules.push({ key: "discount", label: "Discount", value: `${n}%`, unit: "%" });
  }

  if (/ครั้งเดียว|one\s*time|once\s*per\s*customer|1\s*time/i.test(t)) {
    rules.push({
      key: "usage",
      label: "Usage",
      value: "1 time / customer",
    });
  } else {
    const usage = t.match(/(?:ใช้ได้|ใช้ได้สูงสุด|limit)\s*(\d+)\s*(?:ครั้ง|times?)/i);
    if (usage) {
      rules.push({
        key: "usage",
        label: "Usage",
        value: `${usage[1]} times`,
      });
    }
  }

  const max = t.match(
    /(?:ไม่ให้ลดเกิน|สูงสุด|max(?:imum)?(?:\s*discount)?|cap)\s*(\d+(?:[.,]\d+)?)\s*(บาท|thb|฿)?/i,
  );
  if (max) {
    rules.push({
      key: "maximum_discount",
      label: "Maximum Discount",
      value: max[1]!.replace(",", ""),
      unit: "THB",
    });
  }

  const minOrder = t.match(
    /(?:ขั้นต่ำ|minimum\s*order|min\s*order)\s*(\d+(?:[.,]\d+)?)\s*(บาท|thb|฿)?/i,
  );
  if (minOrder) {
    rules.push({
      key: "minimum_order",
      label: "Minimum Order",
      value: minOrder[1]!.replace(",", ""),
      unit: minOrder[2] ? "THB" : undefined,
    });
  }

  if (/ลูกค้าใหม่|new\s*customer/i.test(t)) {
    rules.push({
      key: "new_customer_only",
      label: "New Customer Only",
      value: "true",
    });
  }

  if (/ไม่\s*stack|ห้าม\s*ใช้ร่วม|no\s*stacking|cannot\s*stack/i.test(t)) {
    rules.push({
      key: "promotion_stacking",
      label: "Promotion Stacking",
      value: "not allowed",
    });
  } else if (/stack|ใช้ร่วมกับ/i.test(t)) {
    rules.push({
      key: "promotion_stacking",
      label: "Promotion Stacking",
      value: "allowed",
    });
  }

  const category = t.match(/(?:หมวด|category)\s*[:：]?\s*([^\n,]+)/i);
  if (category) {
    rules.push({
      key: "product_category",
      label: "Product Category",
      value: category[1]!.trim(),
    });
  }

  const expiry = t.match(
    /(?:หมดอายุ|expiry|expires?)\s*[:：]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d+\s*วัน|\d+\s*days?)/i,
  );
  if (expiry) {
    rules.push({ key: "expiry", label: "Expiry", value: expiry[1]!.trim() });
  }

  const buyX = t.match(/buy\s*(\d+)\s*get\s*(\d+)|ซื้อ\s*(\d+)\s*แถม\s*(\d+)/i);
  if (buyX) {
    const x = buyX[1] ?? buyX[3]!;
    const y = buyX[2] ?? buyX[4]!;
    rules.push({
      key: "buy_x_get_y",
      label: "Buy X Get Y",
      value: `Buy ${x} Get ${y}`,
      meta: { buy: Number(x), get: Number(y) },
    });
  }

  if (/ค่าส่ง|shipping/i.test(t) && /ลด|free|ฟรี|discount/i.test(t)) {
    rules.push({
      key: "shipping_discount",
      label: "Shipping Discount",
      value: /ฟรี|free/i.test(t) ? "free shipping" : "discounted shipping",
    });
  }

  // If nothing matched, keep one freeform rule so the array stays the source of truth
  if (rules.length === 0 && t) {
    rules.push({
      key: "intent",
      label: "Intent",
      value: t.slice(0, 280),
    });
  }

  const titleHint = /coupon|คูปอง/i.test(t)
    ? "Coupon rule"
    : t.slice(0, 48).trim() || "New requirement";

  return {
    titleHint,
    requirement: t,
    businessRules: rules.map((r) => ({
      ...r,
      key: r.key || slugifyRuleKey(r.label),
    })),
  };
}

export async function extractDynamicRequirement(text: string): Promise<ExtractedRequirement> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { titleHint: "", requirement: "", businessRules: [] };
  }

  if (!hasAiKey()) {
    return extractBusinessRulesHeuristic(trimmed);
  }

  const rawText = await callModel({
    system: SYSTEM,
    messages: [{ role: "user", content: trimmed }],
    maxTokens: 1500,
  });
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return extractBusinessRulesHeuristic(trimmed);
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    titleHint?: string;
    requirement?: string;
    businessRules?: unknown;
  };

  const businessRules = BusinessRulesSchema.parse(parsed.businessRules ?? []).map((r) => ({
    ...r,
    key: slugifyRuleKey(r.key || r.label),
  }));

  return {
    titleHint: parsed.titleHint?.trim() || extractBusinessRulesHeuristic(trimmed).titleHint,
    requirement: parsed.requirement?.trim() || trimmed,
    businessRules: businessRules.length
      ? businessRules
      : extractBusinessRulesHeuristic(trimmed).businessRules,
  };
}
