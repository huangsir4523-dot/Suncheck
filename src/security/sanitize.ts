export const CITY_INPUT_MAX_LENGTH = 80;
export const DISPLAY_TEXT_MAX_LENGTH = 120;

const CONTROL_AND_FORMAT_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/gu;
const WHITESPACE = /\s+/gu;

const HTML_MARKERS: Record<string, string> = {
  "<": "‹",
  ">": "›"
};

export const INJECTION_TEST_STRINGS = [
  '<script>alert("suncheck-test")</script>',
  '"><img src=x onerror=alert("suncheck-test")>',
  '<svg onload=alert("suncheck-test")>',
  '{{constructor.constructor("alert(1)")()}}',
  "../../../../etc/passwd",
  'javascript:alert("suncheck-test")',
  "New York<script>bad</script>",
  "北京<script>bad</script>",
  "A".repeat(520)
] as const;

export function normalizeUserText(input: string): string {
  return input.normalize("NFC").replace(CONTROL_AND_FORMAT_CHARS, " ").replace(WHITESPACE, " ").trim();
}

export function safeCityInput(input: string): string {
  return normalizeUserText(input).slice(0, CITY_INPUT_MAX_LENGTH);
}

export function safeDisplayText(input: unknown): string {
  if (typeof input !== "string" && typeof input !== "number") return "";
  return normalizeUserText(String(input))
    .slice(0, DISPLAY_TEXT_MAX_LENGTH)
    .replace(/[<>]/gu, (marker) => HTML_MARKERS[marker] ?? "")
    .replace(/\b(on[a-z]+)\s*=/giu, "$1＝")
    .replace(/\bjavascript\s*:/giu, "javascript꞉");
}

export function isSafeDisplayText(input: unknown): boolean {
  const value = safeDisplayText(input);
  return value.length > 0 && value.length <= DISPLAY_TEXT_MAX_LENGTH && !/[<>\u0000-\u001f\u007f-\u009f]/u.test(value);
}
