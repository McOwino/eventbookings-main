import { SITE_IDENTITY_SRC, SITE_NAME } from "@/lib/site-branding";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

type SiteIdentityMarkProps = {
  className?: string;
  /** Render height in px; width scales automatically */
  height?: number;
  /** Light backing for use on brand-red surfaces (logo asset has a dark field) */
  onBrandRed?: boolean;
  /** When true the mark becomes a link to the public home page */
  linkToHome?: boolean;
};

export function SiteIdentityMark({
  className,
  height = 40,
  onBrandRed = false,
  linkToHome = false,
}: SiteIdentityMarkProps) {
  const img = (
    <img
      src={SITE_IDENTITY_SRC}
      alt={SITE_NAME}
      height={height}
      className={cn("block w-auto object-contain", className)}
      style={{ height, maxHeight: height }}
    />
  );

  if (!onBrandRed) return img;
  const wrapped = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-2 py-1"
      style={{ lineHeight: 0 }}
    >
      {img}
    </span>
  );

  if (linkToHome) return <Link to="/">{wrapped}</Link>;
  return wrapped;
}
