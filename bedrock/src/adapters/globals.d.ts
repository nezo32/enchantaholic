/**
 * The Bedrock script runtime provides `console`, but tsconfig.json uses `lib: ["ES2022"]` and no
 * DOM/node types. `var` + interface merging keeps this compatible with @types/node in tests.
 */
interface Console {
  info(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
  log(...data: unknown[]): void;
}
// eslint-disable-next-line no-var -- must be `var` to merge with @types/node in tests
declare var console: Console;
