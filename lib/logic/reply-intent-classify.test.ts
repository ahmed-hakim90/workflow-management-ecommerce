import { describe, expect, it } from "vitest";
import { classifyReplyHeuristic } from "@/lib/logic/reply-intent-classify";

describe("classifyReplyHeuristic", () => {
  it("detects confirm", () => {
    const r = classifyReplyHeuristic("تمام أكد الطلب");
    expect(r.intent).toBe("confirm");
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects cancel", () => {
    const r = classifyReplyHeuristic("عايز ألغي الطلب");
    expect(r.intent).toBe("cancel");
  });

  it("flags shipping department for tracking question", () => {
    const r = classifyReplyHeuristic("فين الأوردر بتاعي");
    expect(r.departmentHint).toBe("shipping");
  });

  it("returns unknown for empty", () => {
    const r = classifyReplyHeuristic("   ");
    expect(r.intent).toBe("unknown");
  });
});
