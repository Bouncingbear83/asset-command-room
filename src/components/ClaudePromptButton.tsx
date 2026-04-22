import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  buildPrompt,
  openClaudeWithPrompt,
  type PromptContext,
  type PromptTemplateKey,
} from "@/lib/claudePromptUrl";

interface Props {
  templateKey: PromptTemplateKey;
  context?: PromptContext;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
  disabled?: boolean;
  stopPropagation?: boolean;
  hoverSide?: "top" | "right" | "bottom" | "left";
  onAfter?: () => void;
}

/**
 * Reusable "Deep Dive" trigger that wraps every Claude-bound CTA.
 *
 * - Hover/focus shows a HoverCard with the EXACT prompt that will be copied.
 *   The card stays open while you move the cursor into it so the inline
 *   "Copy prompt" button is reachable without firing the open-Claude flow.
 * - Click on the main button copies + opens the Claude project in a new tab.
 * - Click on inline "Copy prompt" copies only.
 */
export default function ClaudePromptButton({
  templateKey,
  context = {},
  children = "Deep Dive ➜",
  style,
  className,
  disabled,
  stopPropagation = false,
  hoverSide = "top",
  onAfter,
}: Props) {
  const promptPreview = useMemo(
    () => buildPrompt(templateKey, context),
    [templateKey, context],
  );
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (disabled) return;
    await openClaudeWithPrompt(templateKey, context, (m) => toast(m));
    onAfter?.();
  };

  const handleCopyOnly = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(promptPreview);
      setCopied(true);
      toast("Prompt copied to clipboard");
      window.setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn("Clipboard write failed", err);
      toast("Copy failed — clipboard blocked");
    }
  };

  const defaultStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    letterSpacing: "0.08em",
    background: "none",
    border: "1px solid var(--accent)",
    color: "var(--accent)",
    cursor: disabled ? "not-allowed" : "pointer",
    padding: "4px 12px",
    borderRadius: 2,
    whiteSpace: "nowrap",
    opacity: disabled ? 0.4 : 1,
  };

  return (
    <HoverCard openDelay={180} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className={className}
          style={{ ...defaultStyle, ...style }}
        >
          {children}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side={hoverSide}
        align="end"
        sideOffset={6}
        className="w-auto p-0"
        style={{
          maxWidth: 460,
          width: "max-content",
          background: "hsl(var(--popover))",
          border: "1px solid var(--rim)",
          color: "hsl(var(--popover-foreground))",
          padding: 0,
        }}
      >
        <div style={{ padding: "10px 12px 8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 8,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--gold)",
              }}
            >
              Prompt preview
            </span>
            <button
              type="button"
              onClick={handleCopyOnly}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "1px solid var(--rim)",
                color: copied ? "var(--green)" : "var(--text-mid)",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 2,
                cursor: "pointer",
              }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--text-mid)",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {promptPreview}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-dim)",
            }}
          >
            Click button → copy + open Claude · Copy prompt → copy only
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
