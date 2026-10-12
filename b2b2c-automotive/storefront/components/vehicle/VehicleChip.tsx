// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.

/** The active vehicle as a chip: success tint fill (locked, ignores the reseller theme), "2016 Volkswagen Golf · 2.0 TDI". */
export function VehicleChip({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`inline-block max-w-full truncate rounded-xs bg-success-50 px-3 py-1 font-ui text-sm font-semibold text-text ${className}`.trim()} title={label}>
      {label}
    </span>
  );
}
