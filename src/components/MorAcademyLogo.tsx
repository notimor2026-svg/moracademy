import logo from "@/assets/mor-academy-logo.png";
import { cn } from "@/lib/utils";

type Variant = "full" | "shield" | "wordmark";

export function MorAcademyLogo({
  className,
  variant = "full",
  size = 48,
}: {
  className?: string;
  variant?: Variant;
  size?: number;
}) {
  if (variant === "wordmark") {
    return (
      <span
        className={cn(
          "font-display font-bold tracking-tight text-primary",
          className,
        )}
        style={{ fontSize: size * 0.5 }}
      >
        MOR <span className="font-sans font-medium opacity-80">ACADEMY</span>
      </span>
    );
  }
  return (
    <img
      src={logo}
      alt="MOR ACADEMY"
      className={cn("object-contain", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}
