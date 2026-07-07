export function getFramework(score: LiveScore): FrameworkTag | null {
  const fw = score.framework?.trim().toUpperCase();
  if (fw === "G(M)") return "G(m)";
  if (fw === "G") return "G";
  if (fw === "H") return "H";
  if (fw === "F") return "F";
  return null;
}
