export const DEFAULT_MARKDOWN = `# Welcome to Markdown to PDF

A clean, **beautiful** markdown editor with live preview and instant PDF export.

## Features

- **Live preview** — see your formatted output as you type
- **PDF export** — download a polished PDF with one click
- **Toolbar shortcuts** — format text without remembering syntax
- **Auto-save** — your work is preserved between visits

## Quick Start

1. Write markdown in the editor on the left
2. Watch the preview update in real time on the right
3. Click **Download PDF** to save your document

### Markdown Cheatsheet

You can use all standard markdown syntax:

> "The best way to predict the future is to invent it." — Alan Kay

#### Code Blocks

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('World'));
\`\`\`

#### Tables

| Feature        | Status | Notes              |
| -------------- | :----: | ------------------ |
| Live preview   |  Done  | Real-time render   |
| PDF export     |  Done  | Multi-page support |
| Auto-save      |  Done  | Local storage      |

#### Inline Elements

Here is some \`inline code\`, a [link](https://example.com), and ~~strikethrough~~ text.

---

Start editing to make this your own!
`;

export type ToolbarAction =
  | "h1"
  | "h2"
  | "bold"
  | "italic"
  | "code"
  | "ul"
  | "ol"
  | "quote"
  | "link"
  | "image";

export interface FormatResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Apply a formatting action to the markdown text at the given selection.
 * Returns the new full text and the new selection range.
 */

export function formatToolbarAction(
  action: ToolbarAction,
  text: string,
  start: number,
  end: number,
): FormatResult {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  const wrap = (prefix: string, suffix: string = prefix): FormatResult => {
    const value = before + prefix + selected + suffix + after;
    const selectionStart = start + prefix.length;
    const selectionEnd = end + prefix.length;

    return { value, selectionStart, selectionEnd };
  };

  const blockWrap = (prefix: string): FormatResult => {
    const lineStart = before.lastIndexOf(`\n`) + 1;
    const sectionBefore = text.slice(0, lineStart);
    const sectionAfter = text.slice(lineStart);
    const lines = sectionAfter.split("\n");
    const prefixed = lines.map((line) => `${prefix}${line}`).join("\n");
    const value = sectionBefore + prefixed;

    return {
      value,
      selectionStart: sectionBefore.length,
      selectionEnd: value.length,
    };
  };

  const blockTemplate = (
    template: string,
    placeholder: string,
  ): FormatResult => {
    if (selected) {
      const value = before + template.replace("{text}", selected) + after;

      return {
        value,
        selectionStart: start,
        selectionEnd: start + value.length - before.length - after.length,
      };
    }

    const value = before + template.replace("{text}", placeholder) + after;
    const phStart = value.indexOf(placeholder);

    return {
      value,
      selectionStart: phStart,
      selectionEnd: phStart + placeholder.length,
    };
  };

  switch (action) {
    case "bold":
      return wrap("**");
    case "italic":
      return wrap("*");
    case "code":
      return wrap("`");
    case "h1":
      return blockWrap("# ");
    case "h2":
      return blockWrap("## ");
    case "ul":
      return blockWrap("- ");
    case "ol": {
      const lineStart = before.lastIndexOf("\n") + 1;
      const sectionBefore = text.slice(0, lineStart);
      const sectionAfter = text.slice(lineStart);
      const lines = sectionAfter.split("\n");
      const prefixed = lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
      const value = sectionBefore + prefixed;

      return {
        value,
        selectionStart: sectionBefore.length,
        selectionEnd: value.length,
      };
    }
    case "quote":
      return blockWrap("> ");
    case "link":
      return blockTemplate("[{text}](https://)", "link text");
    case "image":
      return blockTemplate("![{text}](https://)", "alt text");
    default:
      return { value: text, selectionStart: start, selectionEnd: end };
  }
}
