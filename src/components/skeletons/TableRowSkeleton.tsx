import React from 'react';
import Skeleton from './Skeleton';

interface TableRowSkeletonProps {
  columns?: number;
  cellClasses?: string[];
  className?: string;
}

/**
 * Reusable table row skeleton matching standard CampusOS table row heights and borders.
 */
export default function TableRowSkeleton({
  columns = 5,
  cellClasses = [],
  className = '',
}: TableRowSkeletonProps) {
  return (
    <tr aria-hidden="true" className={`border-b border-[#E5E5E5] ${className}`}>
      {Array.from({ length: columns }).map((_, idx) => {
        const customClass = cellClasses[idx] || 'h-3.5 w-24';
        return (
          <td key={idx} className="py-3.5 px-4">
            <Skeleton className={customClass} />
          </td>
        );
      })}
    </tr>
  );
}
