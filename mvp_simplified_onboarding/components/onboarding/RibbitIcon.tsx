/**
 * Ribbit icon - uses ribbit.png for consistent branding
 */

import Image from "next/image";

type RibbitIconProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: 20,
  md: 24,
  lg: 32,
};

export function RibbitIcon({ size = "md", className = "" }: RibbitIconProps) {
  const px = sizeMap[size];
  return (
    <Image
      src="/images/ribbit.png"
      alt=""
      width={px}
      height={px}
      className={`inline-block shrink-0 ${className}`}
      aria-hidden
    />
  );
}
