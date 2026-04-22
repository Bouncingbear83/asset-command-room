import { useMemo, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  tooltipSide?: "top" | "right" | "bottom" | "left";
  /**
   * If set, runs after openClaudeWithPrompt resolves.
   */
  onAfter?: () => void;
}

/**
 * Reusable "Deep Dive" trigger that wraps every Claude-bound CTA.
 *
 * - Hover/focus shows a tooltip with the EXACT prompt that will be copied.
 * - Click copies the prompt to clipboard + opens the Claude project in a new tab.
 * - Falls back gracefully when clipboard is blocked (sonner toast).
 *
 * Use this everywhere a "Deep Dive ➜" button appears so users get a
 * consistent preview of the prompt before pasting in Claude.
 */
export default function ClaudePromptButton({
  templateKey,
  context = {},
  children = "Deep Dive ➜",
  style,
  className,
  disabled,
  stopPropagation = false,
  tooltipSide = "top",
  onAfter,
}: Props) {
  const promptPreview = useMemo(
    () => buildPrompt(templateKey, context),
    [templateKey, context],
  );

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (disabled) return;
    await openClaudeWithPrompt(templateKey, context, (m) => toast(m));
    onAfter?.();
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
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled}
            className={className}
            style={{ ...defaultStyle, ...style }}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={tooltipSide}
          align="end"
          sideOffset={6}
          style={{
            maxWidth: 460,
            background: "hsl(var(--popover))",
            border: "1px solid var(--rim)",
            color: "hsl(var(--popover-foreground))",
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--gold)",
              marginBottom: 6,
            }}
          >
            Prompt preview · click to copy + open Claude
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "var(--text-mid)",
            }}
          >
            {promptPreview}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
