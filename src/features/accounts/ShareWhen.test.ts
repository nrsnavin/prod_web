import { describe, expect, it } from "vitest";
import { noteShareable, paymentShareable } from "./Share";

// The WhatsApp button on a voucher drafted "Thank you — we have
// received…" whatever had become of the voucher: for a receipt whose
// cheque had come back, and for one cancelled as a mistake. The server
// now drafts "your cheque was returned" for the first and refuses the
// second; the button follows.

describe("when there is something to tell the party", () => {
  it("a voucher that stands", () => {
    expect(paymentShareable({ status: "posted", partyType: "customer" })).toBe(true);
    expect(paymentShareable({ status: "posted", partyType: "supplier", cheque: { status: "held" } })).toBe(true);
  });

  it("a receipt whose cheque came back: that it was returned", () => {
    expect(paymentShareable({ status: "cancelled", partyType: "customer", kind: "receipt", cheque: { status: "bounced" } })).toBe(true);
  });

  it("not a voucher cancelled for any other reason", () => {
    expect(paymentShareable({ status: "cancelled", partyType: "customer", kind: "receipt" })).toBe(false);
    expect(paymentShareable({ status: "cancelled", partyType: "customer", kind: "receipt", cheque: { status: "deposited" } })).toBe(false);
    // Our own cheque returned is ours to put right, not news for the supplier.
    expect(paymentShareable({ status: "cancelled", partyType: "supplier", kind: "payment", cheque: { status: "bounced" } })).toBe(false);
  });

  it("not a voucher with no party on file (unchanged)", () => {
    expect(paymentShareable({ status: "posted", partyType: "other" })).toBe(false);
  });

  it("a note that stands, and not one that was cancelled", () => {
    expect(noteShareable({ status: "issued" })).toBe(true);
    expect(noteShareable({ status: "cancelled" })).toBe(false);
  });
});
