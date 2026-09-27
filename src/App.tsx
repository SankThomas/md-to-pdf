import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  Code2,
  Copy,
  Trash2,
  Check,
  Loader2,
  Sparkles,
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import {
  DEFAULT_MARKDOWN,
  formatToolbarAction,
  type ToolbarAction,
} from "./utils/markdown";
import { copyToClipboard } from "./utils/clipboard";
import { markdownToHtml } from "./utils/markdownToHtml";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const STORAGE_KEY = "md-to-pdf";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
  id: number;
}

// CSS text injected into the offscreen PDF render container so it matches preview styling
const PDF_CSS = `
  h1 { font-size: 2.25rem; font-weight: 700; margin: 0 0 1rem; line-height: 1.2; color: #1a1a1a; border-bottom: 2px solid #e0e3e8; padding-bottom: 0.5rem; }
  h2 { font-size: 1.75rem; font-weight: 700; margin: 1.75rem 0 0.75rem; line-height: 1.25; color: #1a1a1a; border-bottom: 1px solid #e0e3e8; padding-bottom: 0.375rem; }
  h3 { font-size: 1.375rem; font-weight: 600; margin: 1.5rem 0 0.625rem; color: #222; }
  h4 { font-size: 1.1875rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: #333; }
  h5, h6 { font-size: 1.0625rem; font-weight: 600; margin: 1rem 0 0.5rem; color: #444; }
  p { margin: 0 0 1rem; }
  a { color: #1a56f0; text-decoration: none; }
  ul, ol { margin: 0 0 1rem; padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
  ul > li { list-style: disc; }
  ol > li { list-style: decimal; }
  blockquote { margin: 0 0 1rem; padding: 0.75rem 1rem; border-left: 4px solid #599cff; background: #f0f2f5; color: #626976; font-style: italic; border-radius: 0 0.375rem 0.375rem 0; }
  code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.875em; background: #e0e3e8; color: #d63384; padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
  pre { margin: 0 0 1rem; padding: 1rem; background: #1e1e2e; color: #cdd6f4; border-radius: 0.5rem; overflow-x: auto; line-height: 1.5; }
  pre code { background: transparent; color: inherit; padding: 0; font-size: 0.875rem; border-radius: 0; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 1rem; font-size: 0.9375rem; }
  th, td { border: 1px solid #c8ccd5; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f0f2f5; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  img { max-width: 100%; height: auto; border-radius: 0.375rem; margin: 0 0 1rem; }
  hr { border: none; border-top: 2px solid #e0e3e8; margin: 1.5rem 0; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  del { text-decoration: line-through; }
`;

export default function App() {
  const [markdown, setMarkdown] = useState<string>(() => {
    const saved =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    return saved ?? DEFAULT_MARKDOWN;
  });
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    markdownToHtml(markdown).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  useEffect(() => {
    const id = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, markdown);
    }, 400);
    return () => clearTimeout(id);
  }, [markdown]);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ message, type, id: Date.now() });
      setTimeout(() => setToast(null), 3000);
    },
    [],
  );

  const handleCopy = async () => {
    const ok = await copyToClipboard(markdown);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast("Markdown copied to clipboard", "success");
    } else {
      showToast("Failed to copy", "error");
    }
  };

  const handleClear = () => {
    setMarkdown("");
    showToast("Editor cleared", "info");
  };

  const handleDownload = async () => {
    if (downloading || !markdown.trim()) return;
    setDownloading(true);
    try {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-99999px";
      container.style.top = "0";
      container.style.width = "523px";
      container.style.padding = "0";
      container.style.margin = "0";
      container.style.background = "#ffffff";
      container.style.color = "#1a1a1a";
      container.style.fontFamily =
        "'Inter', system-ui, -apple-system, sans-serif";
      container.style.fontSize = "16px";
      container.style.lineHeight = "1.6";
      container.innerHTML = html;

      const styleEl = document.createElement("style");
      styleEl.textContent = PDF_CSS;
      container.appendChild(styleEl);

      document.body.appendChild(container);

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 523,
        windowWidth: 523,
      });

      document.body.removeChild(container);

      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const MARGIN = 36;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const CONTENT_H = PAGE_H - MARGIN * 2;

      const scaleRatio = CONTENT_W / canvas.width;
      const totalContentH = canvas.height * scaleRatio;

      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "p" });

      const pageCanvas = document.createElement("canvas");
      const pageCtx = pageCanvas.getContext("2d");
      if (!pageCtx) throw new Error("Canvas context unavailable");

      pageCanvas.width = canvas.width;
      const pageHeightPx = Math.round(CONTENT_H / scaleRatio);

      let yPx = 0;
      let isFirstPage = true;

      while (yPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - yPx);
        pageCanvas.height = sliceHeightPx;

        pageCtx.fillStyle = "#ffffff";
        pageCtx.fillRect(0, 0, pageCanvas.width, sliceHeightPx);
        pageCtx.drawImage(
          canvas,
          0,
          yPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.82);

        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        const sliceHeightPt = sliceHeightPx * scaleRatio;
        pdf.addImage(imgData, "JPEG", MARGIN, MARGIN, CONTENT_W, sliceHeightPt);

        yPx += sliceHeightPx;
      }

      pdf.save("document.pdf");
      showToast("PDF downloaded successfully", "success");
    } catch {
      showToast("Failed to generate PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  const handleToolbar = (action: ToolbarAction) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;

    const result = formatToolbarAction(action, markdown, start, end);
    setMarkdown(result.value);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const wordCount = useMemo(
    () => (markdown.trim() ? markdown.trim().split(/\s+/).length : 0),
    [markdown],
  );

  const charCount = markdown.length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="app-title-icon">
            <FileText size={20} />
          </div>

          <div>
            <div className="app-title">Markdown to PDF</div>
            <div className="app-subtitle">
              Write markdown, export a polished PDF
            </div>
          </div>

          <div className="header-actions">
            <button
              className="btn btn-ghost"
              onClick={handleCopy}
              title="Copy markdown"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span className="btn-secondary-label">Copy</span>
            </button>

            <button
              className="btn btn-ghost"
              onClick={handleClear}
              title="Clear editor"
            >
              <Trash2 size={16} />
              <span className="btn-secondary-label">Clear</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={downloading || !markdown.trim()}
            >
              {downloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Formatting Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("h1")}
            title="Heading 1"
          >
            <Heading1 size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("h2")}
            title="Heading 2"
          >
            <Heading2 size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("bold")}
            title="Bold"
          >
            <Bold size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("italic")}
            title="Italic"
          >
            <Italic size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("ul")}
            title="Bullet list"
          >
            <List size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("ol")}
            title="Numbered list"
          >
            <ListOrdered size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("quote")}
            title="Quote"
          >
            <Quote size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("code")}
            title="Code"
          >
            <Code size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("link")}
            title="Link"
          >
            <LinkIcon size={18} />
          </button>

          <button
            className="toolbar-btn"
            onClick={() => handleToolbar("image")}
            title="Image"
          >
            <ImageIcon size={18} />
          </button>
        </div>

        <div className="flex-1" />

        <div className="status-badge status-badge-ready">
          <Sparkles size={12} />
          <span>
            {wordCount} words &middot; {charCount} chars
          </span>
        </div>
      </div>

      {/* Split view */}
      <div className="split-view">
        {/* Editor */}
        <div className="pane editor-pane">
          <div className="pane-header">
            <div className="pane-label">
              <Code2 size={14} />
              <span>Markdown</span>
            </div>
          </div>

          <textarea
            ref={editorRef}
            className="editor-textarea"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Start typing your markdown here..."
            spellCheck={false}
          />
        </div>

        <div className="pane-divider" />

        {/* Preview */}
        <div className="pane preview-pane">
          <div
            className="pane-header"
            style={{
              background: "var(--color-neutral-200)",
              borderBottom: "1px solid var(--color-neutral-300)",
            }}
          >
            <div
              className="pane-label"
              style={{ color: "var(--color-neutral-600)" }}
            >
              <Eye size={14} />
              <span>Preview</span>
            </div>
            <span className="status-badge status-badge-idle">
              <FileText size={12} />
              <span>PDF Output</span>
            </span>
          </div>

          <div className="preview-scroll-container">
            <div
              ref={previewRef}
              className="preview-content md"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === "success" && <CheckCircle2 size={18} />}
          {toast.type === "error" && <XCircle size={18} />}
          {toast.type === "info" && <Info size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
