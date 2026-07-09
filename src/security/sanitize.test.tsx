import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CITY_INPUT_MAX_LENGTH,
  DISPLAY_TEXT_MAX_LENGTH,
  INJECTION_TEST_STRINGS,
  normalizeUserText,
  safeCityInput,
  safeDisplayText
} from "./sanitize";

function TextSink({ value }: { value: string }) {
  return <div>{value}</div>;
}

describe("security text sanitizers", () => {
  it("keeps normal city names usable", () => {
    expect(safeCityInput(" São Paulo ")).toBe("São Paulo");
    expect(safeCityInput("Xi'an")).toBe("Xi'an");
    expect(safeCityInput("New York")).toBe("New York");
    expect(safeCityInput("北京")).toBe("北京");
    expect(safeCityInput("上海")).toBe("上海");
  });

  it("normalizes control characters and repeated whitespace", () => {
    expect(normalizeUserText(" New\u0000\u0008   York\nCity ")).toBe("New York City");
  });

  it("limits manual city input length", () => {
    const longInput = "A".repeat(520);
    expect(safeCityInput(longInput)).toHaveLength(CITY_INPUT_MAX_LENGTH);
  });

  it("neutralizes HTML-like markers for display text", () => {
    for (const input of INJECTION_TEST_STRINGS) {
      const output = safeDisplayText(input);
      expect(output.length).toBeLessThanOrEqual(DISPLAY_TEXT_MAX_LENGTH);
      expect(output).not.toContain("<");
      expect(output).not.toContain(">");
    }
  });

  it("renders injection strings as text, not raw HTML", () => {
    for (const input of INJECTION_TEST_STRINGS) {
      const output = safeDisplayText(input);
      const html = renderToStaticMarkup(<TextSink value={output} />);
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("<svg");
      expect(html).not.toContain("onerror=");
      expect(html).not.toContain("onload=");
    }
  });

  it("does not use dangerous React raw HTML insertion in source files", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = join(process.cwd(), "src");
    const files: string[] = [];

    async function collect(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await collect(path);
        if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(path);
      }
    }

    await collect(root);
    const forbidden = ["dangerously", "SetInnerHTML"].join("");
    for (const file of files) {
      const source = await readFile(file, "utf8");
      expect(source.includes(forbidden), file).toBe(false);
    }
  });
});
