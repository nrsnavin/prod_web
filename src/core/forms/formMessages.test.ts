import { describe, it, expect, beforeAll } from "vitest";
import { z } from "zod";
import { formMessage, installFormMessages } from "./formMessages";

// A field with no message of its own used to fall back on the schema
// library's, written for whoever wrote the schema. Held here: the
// fallback is in the form-filler's words, and a field's own message wins.

const first = (schema: z.ZodType, input: unknown) => {
  const r = schema.safeParse(input);
  return r.success ? null : r.error.issues[0].message;
};

describe("the fallback message for a field", () => {
  beforeAll(() => installFormMessages());

  it("says Required for what was left out or left empty", () => {
    expect(first(z.object({ name: z.string() }), {})).toBe("Required");
    expect(first(z.object({ name: z.string().min(1) }), { name: "" })).toBe("Required");
    expect(first(z.object({ items: z.array(z.string()).min(1) }), { items: [] })).toBe("Add at least one");
  });

  it("asks for a number where one is wanted", () => {
    expect(first(z.object({ qty: z.coerce.number() }), { qty: "abc" })).toBe("Enter a number");
    expect(first(z.object({ qty: z.number() }), { qty: "12" })).toBe("Enter a number");
  });

  it("gives the limit that was crossed", () => {
    expect(first(z.object({ qty: z.coerce.number().min(1) }), { qty: "0" })).toBe("Must be at least 1");
    expect(first(z.object({ qty: z.coerce.number().positive() }), { qty: "0" })).toBe("Must be more than 0");
    expect(first(z.object({ pct: z.coerce.number().max(100) }), { pct: "140" })).toBe("Must be at most 100");
    expect(first(z.object({ pin: z.string().min(4) }), { pin: "12" })).toBe("At least 4 characters");
    expect(first(z.object({ note: z.string().max(5) }), { note: "far too long" })).toBe("At most 5 characters");
  });

  it("names an address or a choice that is not one", () => {
    expect(first(z.object({ email: z.string().email() }), { email: "nope" })).toBe("Enter a valid email");
    expect(first(z.object({ shift: z.enum(["DAY", "NIGHT"]) }), { shift: "NOON" })).toBe("Choose one of the options");
  });

  it("CONTROL: a field's own message is the one shown", () => {
    expect(first(z.object({ name: z.string().min(1, "Name is required") }), { name: "" })).toBe("Name is required");
    expect(first(z.object({ email: z.string().email("Enter a valid email address") }), { email: "x" })).toBe("Enter a valid email address");
    expect(first(z.object({ gst: z.string().regex(/^\d+$/, "Digits only") }), { gst: "ab" })).toBe("Digits only");
  });

  it("leaves what it has no words for to the library", () => {
    expect(formMessage({ code: "custom" })).toBeUndefined();
    expect(formMessage({ code: "invalid_format", format: "regex" })).toBeUndefined();
    expect(formMessage({ code: "invalid_type", input: {}, expected: "string" })).toBeUndefined();
  });
});
