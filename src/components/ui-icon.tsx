import type { LucideIcon } from "lucide-react";

type UiIconSize = 12 | 14 | 16 | 18 | 20 | 28 | 32;

export function UiIcon({
  icon: Icon,
  size = 16,
  className,
}: {
  icon: LucideIcon;
  size?: UiIconSize;
  className?: string;
}) {
  return <Icon
    className={className ? `ui-icon ${className}` : "ui-icon"}
    size={size}
    strokeWidth={2}
    aria-hidden="true"
    focusable="false"
  />;
}
