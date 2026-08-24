import React from 'react';
import { WarehouseType, WAREHOUSES } from '@/lib/types';
import { Building2 } from 'lucide-react';

interface WarehouseBadgeProps {
  warehouse: WarehouseType;
  showFullName?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const WarehouseBadge: React.FC<WarehouseBadgeProps> = ({
  warehouse,
  showFullName = false,
  size = 'md',
}) => {
  const info = WAREHOUSES[warehouse] || WAREHOUSES.MBI;
  const isMBI = warehouse === 'MBI';

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold rounded-md',
    md: 'px-2.5 py-1 text-xs font-bold rounded-lg',
    lg: 'px-3.5 py-1.5 text-sm font-bold rounded-xl',
  }[size];

  const colorClasses = isMBI
    ? 'bg-sky-50 text-sky-700 border border-sky-200'
    : 'bg-purple-50 text-purple-700 border border-purple-200';

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} ${colorClasses} shadow-sm`}>
      <Building2 className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{showFullName ? `${info.code} - ${info.fullName}` : info.code}</span>
    </span>
  );
};
