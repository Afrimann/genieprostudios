import "server-only";
import { randomInt } from "crypto";

// Triumph Music Global's human-typeable project identifier, format
// TMG-XXXXXX. Alphabet excludes 0/O/1/I (easy to confuse when read aloud or
// typed on a phone). Paired with the project's email at lookup time (see
// lib/repositories/triumph-projects-repository.ts) — not a secret on its
// own, so crypto-grade entropy isn't required, but randomInt is used over
// Math.random() since this doubles as half of an access credential.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export function generateProjectCode(): string {
  let suffix = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    suffix += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `TMG-${suffix}`;
}
