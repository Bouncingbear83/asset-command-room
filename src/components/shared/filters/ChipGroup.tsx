import { CSSProperties, ReactNode } from "react";

/**
 * Horizontal chip row with overflow-scroll on narrow viewports.
 * Renders children verbatim — caller composes <Chip /> instances.
 */

interface Props {
  children: ReactNode;
  ariaLabel?: string;
}

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "nowrap",
  overflowX: "auto",
  paddingBottom: 2,
};

export function ChipGroup({ children, ariaLabel }: Props) {
  return (
    <div role="group" aria-label={ariaLabel} style={rowStyle}>
      {children}
    </div>
  );
}

export default ChipGroup;
