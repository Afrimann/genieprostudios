import { describe, it, expect } from "vitest";

import {
  triumphProjectRequestSchema,
  triumphProjectLookupSchema,
} from "@/lib/validation/triumph-project";
import { recordTriumphPaymentSchema } from "@/lib/validation/triumph-payment";

// These schemas run at Server Action boundaries, where the only guarantee
// is that input is `unknown` — the client-side form validation can be
// bypassed entirely by calling the action directly. Each test below feeds
// the schema something a hostile caller could realistically send.

const VALID_PROJECT_REQUEST = {
  fullName: "Tamar Collins",
  email: "tamar@example.com",
  country: "Nigeria",
  phone: "+2348012345678",
  numberOfSongs: 2,
  serviceId: "mix-master",
  projectDetails: "Two-song EP, gospel, needs vocal tuning.",
};

describe("triumphProjectRequestSchema", () => {
  it("accepts a well-formed submission", () => {
    expect(triumphProjectRequestSchema.safeParse(VALID_PROJECT_REQUEST).success).toBe(true);
  });

  it("rejects an unknown serviceId not in the pricing tiers", () => {
    // Guards against a tampered form POSTing an arbitrary service id.
    const result = triumphProjectRequestSchema.safeParse({
      ...VALID_PROJECT_REQUEST,
      serviceId: "free-everything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      triumphProjectRequestSchema.safeParse({ ...VALID_PROJECT_REQUEST, email: "not-an-email" })
        .success,
    ).toBe(false);
  });

  it("rejects whitespace-only required fields", () => {
    expect(
      triumphProjectRequestSchema.safeParse({ ...VALID_PROJECT_REQUEST, fullName: "   " }).success,
    ).toBe(false);
  });

  it("rejects zero, negative, and fractional song counts", () => {
    for (const numberOfSongs of [0, -5, 1.5]) {
      expect(
        triumphProjectRequestSchema.safeParse({ ...VALID_PROJECT_REQUEST, numberOfSongs }).success,
      ).toBe(false);
    }
  });

  it("rejects a string song count (no silent coercion)", () => {
    expect(
      triumphProjectRequestSchema.safeParse({ ...VALID_PROJECT_REQUEST, numberOfSongs: "2" })
        .success,
    ).toBe(false);
  });

  it("rejects entirely missing input", () => {
    expect(triumphProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(triumphProjectRequestSchema.safeParse(null).success).toBe(false);
    expect(triumphProjectRequestSchema.safeParse("string").success).toBe(false);
  });
});

describe("triumphProjectLookupSchema", () => {
  it("accepts a code + email pair", () => {
    expect(
      triumphProjectLookupSchema.safeParse({ projectCode: "TMG-7F3K2Q", email: "a@b.com" }).success,
    ).toBe(true);
  });

  it("rejects an empty code", () => {
    expect(
      triumphProjectLookupSchema.safeParse({ projectCode: "", email: "a@b.com" }).success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      triumphProjectLookupSchema.safeParse({ projectCode: "TMG-7F3K2Q", email: "nope" }).success,
    ).toBe(false);
  });
});

describe("recordTriumphPaymentSchema", () => {
  const VALID_PAYMENT = {
    projectId: "11111111-1111-4111-8111-111111111111",
    paymentStatus: "deposit_paid",
    amountNaira: 200_000,
    confirmationCode: "123456",
    receiptPath: null,
    receiptName: null,
  };

  it("accepts a well-formed payment record", () => {
    expect(recordTriumphPaymentSchema.safeParse(VALID_PAYMENT).success).toBe(true);
  });

  it("rejects 'pending' as a payment status (not a money event)", () => {
    // Must agree with 0029's triumph_payments_status_is_a_money_event check
    // constraint — a ledger row for "pending" is meaningless.
    expect(
      recordTriumphPaymentSchema.safeParse({ ...VALID_PAYMENT, paymentStatus: "pending" }).success,
    ).toBe(false);
  });

  it("rejects zero and negative amounts", () => {
    for (const amountNaira of [0, -1000]) {
      expect(recordTriumphPaymentSchema.safeParse({ ...VALID_PAYMENT, amountNaira }).success).toBe(
        false,
      );
    }
  });

  it("rejects a non-uuid projectId", () => {
    expect(
      recordTriumphPaymentSchema.safeParse({ ...VALID_PAYMENT, projectId: "../../etc/passwd" })
        .success,
    ).toBe(false);
  });

  it("rejects a blank confirmation code", () => {
    expect(
      recordTriumphPaymentSchema.safeParse({ ...VALID_PAYMENT, confirmationCode: "   " }).success,
    ).toBe(false);
  });
});
