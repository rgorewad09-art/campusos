import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  animate?: boolean;
  as?: React.ElementType;
}

const roundedMap = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

/**
 * Base atomic Skeleton component.
 * Uses a subtle monochromatic shimmer effect, respects prefers-reduced-motion,
 * and hides decorative shapes from assistive technologies via aria-hidden="true".
 */
export default function Skeleton({
  className = '',
  rounded = 'md',
  animate = true,
  as: Component = 'div',
  ...rest
}: SkeletonProps) {
  const roundedClass = roundedMap[rounded] || 'rounded-md';
  const animationClass = animate ? 'shimmer-effect' : 'bg-[#EAEAEA]';

  return (
    <Component
      aria-hidden="true"
      className={`${animationClass} ${roundedClass} ${className}`}
      {...rest}
    />
  );
}
