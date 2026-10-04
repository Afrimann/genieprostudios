// Stub for the `server-only` package in Vitest.
//
// `server-only` deliberately throws on import outside a React Server
// Component. Several modules under test (triumph-tracking-cookie.ts,
// triumph-email-verification.ts) import it to guarantee their secrets never
// reach a client bundle — that guard is correct and should stay. This
// no-op replaces it only inside the test runner, via the alias in
// vitest.config.ts.
export {};
