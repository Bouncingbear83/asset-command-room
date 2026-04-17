import { CSSProperties } from "react";
import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const wrap: CSSProperties = {
  position: "relative",
  flex: "1 1 220px",
  maxWidth: 360,
};

const input: CSSProperties = {
  width: "100%",
  padding: "6px 8px 6px 26px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--rim)",
  color: "var(--text-mid)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  borderRadius: 2,
  outline: "none",
};

const icon: CSSProperties = {
  position: "absolute",
  left: 8,
  top: "50%",
  transform: "translateY(-50%)",
  color: "var(--text-dim)",
};

export function SearchBox({ value, onChange, placeholder = "Search ticker or name…", ariaLabel }: Props) {
  return (
    <div style={wrap}>
      <Search size={12} style={icon} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        style={input}
      />
    </div>
  );
}

export default SearchBox;
