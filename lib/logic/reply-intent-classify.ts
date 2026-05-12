/**
 * تصنيف نوايا ردود واتساب — كلمات مفتاحية (عربي مصري + لاتيني).
 * يمكن تعزيز النتيجة عبر LLM في `lib/services/ai/intent-classifier.service.ts`.
 */
export type ReplyIntent =
  | "confirm"
  | "cancel"
  | "address_change"
  | "ask_shipping"
  | "complaint"
  | "greeting"
  | "return_request"
  | "exchange_request"
  | "unknown";

export type EscalationDepartment =
  | "confirmation"
  | "shipping"
  | "support"
  | "returns";

export type HeuristicClassification = {
  intent: ReplyIntent;
  /** 0–1; تحت عتبة المستأجر يُوجَّه لموظف. */
  confidence: number;
  departmentHint?: EscalationDepartment;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

const STRONG: Record<ReplyIntent, string[]> = {
  confirm: [
    "أكد",
    "اكد",
    "موافق",
    "تمام",
    "تمام كده",
    "yes",
    "ok",
    "okay",
    "confirm",
    "confirmed",
    "أكد الطلب",
  ],
  cancel: ["إلغاء", "الغاء", "الغي", "ألغي", "الغي الطلب", "cancel", "cancelled"],
  address_change: [
    "غير العنوان",
    "تغيير العنوان",
    "عنوان جديد",
    "عايز أغير العنوان",
    "change address",
    "new address",
  ],
  ask_shipping: [],
  complaint: ["شكوى", "شكوي", "مشكلة", "complaint"],
  greeting: [
    "السلام",
    "سلام",
    "اهلا",
    "أهلا",
    "مرحبا",
    "مرحباً",
    "صباح",
    "مساء",
    "hello",
    "hi ",
    "hey",
  ],
  return_request: ["مرتجع", "إرجاع", "ارجاع", "return", "استرجاع"],
  exchange_request: ["استبدال", "تبديل", "exchange", "غير المقاس"],
  unknown: [],
};

const WEAK: Record<ReplyIntent, string[]> = {
  confirm: ["تمام", "حاضر", "تمام يا فندم"],
  cancel: [],
  address_change: ["العنوان", "address"],
  ask_shipping: [
    "فين",
    "وين",
    "فين الطلب",
    "فين الأوردر",
    "وين الطلب",
    "متى",
    "؟",
    "?",
    "how much",
    "price",
    "shipping",
    "شحن",
  ],
  complaint: ["زعلان", "مش راضي"],
  greeting: ["ازيك", "إزيك", "عامل ايه", "كيفك"],
  return_request: [],
  exchange_request: [],
  unknown: [],
};

const DEPT_SHIPPING = [
  "فين الأوردر",
  "فين الطلب",
  "وين الطلب",
  "tracking",
  "تتبع",
  "الشحن",
  "موصل",
  "delivery",
];

const DEPT_RETURNS = ["مرتجع", "إرجاع", "ارجاع", "return", "استبدال"];

function scoreIntent(t: string, intent: ReplyIntent): number {
  let best = 0;
  for (const k of STRONG[intent]) {
    if (k && t.includes(norm(k))) best = Math.max(best, 0.92);
  }
  for (const k of WEAK[intent]) {
    if (k && t.includes(norm(k))) best = Math.max(best, 0.84);
  }
  return best;
}

function detectDepartment(t: string): EscalationDepartment | undefined {
  if (DEPT_RETURNS.some((k) => t.includes(norm(k)))) return "returns";
  if (DEPT_SHIPPING.some((k) => t.includes(norm(k)))) return "shipping";
  if (STRONG.complaint.some((k) => t.includes(norm(k)))) return "support";
  if (STRONG.address_change.some((k) => t.includes(norm(k)))) return "confirmation";
  return undefined;
}

export function classifyReplyHeuristic(body: string): HeuristicClassification {
  const t = norm(body);
  if (!t) {
    return { intent: "unknown", confidence: 0.35 };
  }

  const scored: { intent: ReplyIntent; c: number }[] = [
    { intent: "confirm", c: scoreIntent(t, "confirm") },
    { intent: "cancel", c: scoreIntent(t, "cancel") },
    { intent: "address_change", c: scoreIntent(t, "address_change") },
    { intent: "complaint", c: scoreIntent(t, "complaint") },
    { intent: "greeting", c: scoreIntent(t, "greeting") },
    { intent: "return_request", c: scoreIntent(t, "return_request") },
    { intent: "exchange_request", c: scoreIntent(t, "exchange_request") },
    { intent: "ask_shipping", c: scoreIntent(t, "ask_shipping") },
  ];
  const scores = scored.filter((x) => x.c > 0);

  scores.sort((a, b) => b.c - a.c);
  const top = scores[0];
  const second = scores[1];

  if (!top) {
    const dept = detectDepartment(t);
    return {
      intent: "unknown",
      confidence: 0.55,
      ...(dept ? { departmentHint: dept } : {}),
    };
  }

  if (second && top.c - second.c < 0.06) {
    return {
      intent: "unknown",
      confidence: 0.48,
      departmentHint: detectDepartment(t),
    };
  }

  const departmentHint =
    detectDepartment(t) ??
    (top.intent === "address_change"
      ? "confirmation"
      : top.intent === "complaint"
        ? "support"
        : top.intent === "return_request" || top.intent === "exchange_request"
          ? "returns"
          : top.intent === "ask_shipping"
            ? "shipping"
            : undefined);

  return {
    intent: top.intent,
    confidence: top.c,
    ...(departmentHint ? { departmentHint } : {}),
  };
}
