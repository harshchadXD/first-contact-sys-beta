import React from 'react';
import type { DispersionCell, SpacecraftProfile } from '../science/types';

interface DispersionGrid500mProps {
  cells: DispersionCell[];
  selectedCellIndex: number;
  spacecraft: SpacecraftProfile;
  onSelectCell: (index: number) => void;
}

const STATUS_STYLE: Record<
  DispersionCell['status'],
  { border: string; bg: string; tag: string; text: string }
> = {
  SAFE: {
    border: 'border-[#6EE7B7]',
    bg: 'bg-[#ECFDF5] hover:bg-[#D1FAE5]',
    tag: 'SAFE',
    text: 'text-[#047857]',
  },
  MARGINAL: {
    border: 'border-[#FCD34D]',
    bg: 'bg-[#FFFBEB] hover:bg-[#FEF3C7]',
    tag: 'MARG',
    text: 'text-[#B45309]',
  },
  MISSION_LOSS_TRAP: {
    border: 'border-[#FDA4AF]',
    bg: 'bg-[#FFF1F2] hover:bg-[#FFE4E6]',
    tag: 'LOSS',
    text: 'text-[#BE123C]',
  },
};

export const DispersionGrid500m: React.FC<DispersionGrid500mProps> = ({
  cells,
  selectedCellIndex,
  spacecraft,
  onSelectCell,
}) => {
  // Display top row = +200m Northing down to bottom row = -200m Northing
  const orderedRows = [4, 3, 2, 1, 0];
  const safeCount = cells.filter((c) => c.status === 'SAFE').length;
  const lossCount = cells.filter((c) => c.status === 'MISSION_LOSS_TRAP').length;

  return (
    <section
      aria-label="500 Meter Landing Dispersion Safety Grid"
      className="bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-5 flex flex-col justify-between"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">
            500m Landing Dispersion Safety Grid
          </h2>
          <p className="text-[11px] text-[#64748B]">
            100m spatial offsets (-200m to +200m) · Slope limit ≤{spacecraft.maxSlopeDeg}° ({spacecraft.name})
          </p>
        </div>
        <div className="text-[11px] font-mono tabular-nums font-semibold text-[#64748B]">
          <span className="text-[#059669]">{safeCount} Safe</span>
          <span className="mx-1.5" aria-hidden="true">·</span>
          <span className="text-[#E11D48]">{lossCount} Loss Traps</span>
        </div>
      </div>

      {/* 5x5 Interactive Matrix */}
      <div className="grid grid-cols-5 gap-2" role="grid" aria-label="25 landing dispersion cells">
        {orderedRows.map((row) =>
          [0, 1, 2, 3, 4].map((col) => {
            const cell = cells[row * 5 + col];
            if (!cell) return null;
            const style = STATUS_STYLE[cell.status];
            const isSelected = cell.index === selectedCellIndex;
            const isCenter = cell.dxM === 0 && cell.dyM === 0;

            return (
              <button
                key={cell.index}
                type="button"
                data-testid={`dispersion-cell-${cell.dxM}-${cell.dyM}`}
                onClick={() => onSelectCell(cell.index)}
                aria-pressed={isSelected}
                aria-label={`Offset ${cell.dxM}m East, ${cell.dyM}m North: ${cell.status}, slope ${cell.slopeDeg} degrees, sun ${cell.pSunPct}%`}
                className={`p-2 rounded-lg border text-left transition-all focus-visible:outline-2 focus-visible:outline-[#0284C7] ${
                  style.bg
                } ${
                  isSelected
                    ? 'border-[#2563EB] ring-2 ring-[#2563EB]/75 shadow-sm'
                    : style.border
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums mb-1">
                  <span className="text-[#475569] font-medium">
                    {isCenter ? 'TARGET' : `${cell.dxM},${cell.dyM}`}
                  </span>
                  <span className={`font-semibold ${style.text}`}>{style.tag}</span>
                </div>
                <div className="text-xs font-mono tabular-nums font-semibold text-[#0F172A]">
                  {cell.pSunPct.toFixed(0)}% Sun
                </div>
                <div className="text-[10px] font-mono tabular-nums text-[#475569]">
                  {cell.slopeDeg.toFixed(1)}° · {cell.longestDarknessHrs}h dk
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
