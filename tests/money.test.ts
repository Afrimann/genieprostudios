import { describe, it, expect } from "vitest";

import { formatKobo, koboToNaira, nairaToKobo, estimateDepositKobo } from "@/lib/utils/money";

// Money arithmetic underpins every amount shown to a customer and every
// amount sent to Paystack. Float drift here is a real-money bug.
describe("money utils", () => {
  describe("formatKobo", () => {
    it("formats whole naira with thousands separators", () => {
      expect(formatKobo(10_000_000)).toBe("₦100,000");
    });

    it("formats zero", () => {
      expect(formatKobo(0)).toBe("₦0");
    });

    it("accepts the string form bigint columns arrive as over the wire", () => {
      // Supabase returns bigint as a JS string in some client configs —
      // this is the documented reason KoboAmount is a union type.
      expect(formatKobo("10000000")).toBe("₦100,000");
    });

    it("accepts native bigint", () => {
      // BigInt(...) rather than a `10_000_000n` literal — tsconfig targets
      // below ES2020, where bigint literals are a compile error.
      expect(formatKobo(BigInt(10_000_000))).toBe("₦100,000");
    });

    it("throws on a non-numeric amount rather than rendering NaN to a customer", () => {
      expect(() => formatKobo("not-a-number")).toThrow();
    });
  });

  describe("nairaToKobo", () => {
    it("converts whole naira", () => {
      expect(nairaToKobo(1000)).toBe(100_000);
    });

    it("rounds to whole kobo rather than leaving a float", () => {
      // 0.1 + 0.2 style drift must never reach a bigint column.
      expect(nairaToKobo(1500.555)).toBe(150_056);
      expect(Number.isInteger(nairaToKobo(99.999))).toBe(true);
    });

    it("round-trips with koboToNaira", () => {
      expect(koboToNaira(nairaToKobo(2_000_000))).toBe(2_000_000);
    });
  });

  describe("estimateDepositKobo", () => {
    it("matches the DB's ceil(price_kobo * 0.7)", () => {
      // Must agree with book_slot_and_create_booking's server-side
      // computation (0013_book_slot_rpc.sql) or the customer is quoted a
      // deposit different from what they're actually charged.
      expect(estimateDepositKobo(10_000_000)).toBe(7_000_000);
    });

    it("rounds UP, never down (never under-quotes the deposit)", () => {
      expect(estimateDepositKobo(3_000_001)).toBe(Math.ceil(3_000_001 * 0.7));
      expect(estimateDepositKobo(1)).toBe(1);
    });

    it("throws on invalid input", () => {
      expect(() => estimateDepositKobo("abc")).toThrow();
    });
  });
});
