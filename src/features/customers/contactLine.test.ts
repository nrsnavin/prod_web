import { describe, it, expect } from "vitest";
import { contactLine } from "./types";

// ══════════════════════════════════════════════════════════════════
//  A CUSTOMER'S NAMED CONTACTS: THE PHONE NUMBER WAS NEVER SHOWN
//
//  The purchase, accounts and merchandiser contacts are kept as
//  { name, mobile, email } — that is what the phone app's form saves.
//  The customer page read `phoneNumber` off them, a field they do not
//  have: a contact entered with a number showed as a name alone, and
//  the purchase contact was not shown at all.
// ══════════════════════════════════════════════════════════════════

describe("a customer's named contact", () => {
  it("reads with its number and its email", () => {
    // Before: "Meena" — the number is under `mobile`, and the page looked for `phoneNumber`.
    expect(contactLine({ name: "Meena", mobile: "98400 12345", email: "accounts@slg.in" })).toBe("Meena · 98400 12345 · accounts@slg.in");
  });

  it("is a number alone when no name was given", () => {
    expect(contactLine({ name: "", mobile: "98400 12345" })).toBe("98400 12345");
  });

  it("still reads a record that kept the number under the older name", () => {
    expect(contactLine({ name: "Meena", phoneNumber: "98400 12345" })).toBe("Meena · 98400 12345");
  });

  it("is nothing when nothing was entered", () => {
    expect(contactLine({ name: "", mobile: "", email: "" })).toBeUndefined();
    expect(contactLine(undefined)).toBeUndefined();
    expect(contactLine(null)).toBeUndefined();
  });
});
