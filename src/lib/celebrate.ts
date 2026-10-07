import confetti from "canvas-confetti";

/** Короткий праздничный момент при выигранной сделке; уважает «уменьшение движения» */
export function celebrate() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  void confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 32,
    origin: { y: 0.7 },
    colors: ["#6047e0", "#8c88f7", "#0ca30c", "#fab219"],
    scalar: 0.9,
    disableForReducedMotion: true,
  });
}
