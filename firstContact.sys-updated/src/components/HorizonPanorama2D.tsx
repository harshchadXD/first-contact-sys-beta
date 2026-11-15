import React, { useEffect, useMemo, useRef, useState } from 'react';
import { computeEarthLibrationTrack } from '../science/ephemeris';
import type {
  LunarSiteDefinition,
  PersonaMode,
  TimeSeriesPoint,
} from '../science/types';

interface HorizonPanorama2DProps {
  site: LunarSiteDefinition;
  adjustedHorizonDeg: number[];
  timeSeries: TimeSeriesPoint[];
  currentPoint: TimeSeriesPoint;
  persona: PersonaMode;
  mastHeightM: number;
}

export const HorizonPanorama2D: React.FC<HorizonPanorama2DProps> = ({
  site,
  adjustedHorizonDeg,
  timeSeries,
  currentPoint,
  persona,
  mastHeightM,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverAz, setHoverAz] = useState<number | null>(null);

  const librationTrack = useMemo(
    () =>
      computeEarthLibrationTrack(
        site.metadata.latDeg,
        site.metadata.lonDeg,
        0
      ),
    [site.metadata.latDeg, site.metadata.lonDeg]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const padL = 42;
    const padR = 16;
    const padT = 18;
    const padB = 28;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    const minEl = -3;
    const maxEl = 13;
    const azToX = (az: number) => padL + (az / 360) * plotW;
    const elToY = (el: number) =>
      padT + ((maxEl - el) / (maxEl - minEl)) * plotH;

    // 1. Background sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#FFFFFF');
    skyGrad.addColorStop(1, '#F8FAFC');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Elevation & Azimuth Gridlines (drawn early as background reference)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748B';

    for (let el = -2; el <= 12; el += 2) {
      const y = elToY(el);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillText(`${el}°`, 6, y + 3);
    }

    for (let az = 0; az <= 360; az += 45) {
      const x = azToX(az);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      const label =
        az === 0
          ? '0°N'
          : az === 90
            ? '90°E'
            : az === 180
              ? '180°S'
              : az === 270
                ? '270°W'
                : az === 360
                  ? '360°'
                  : `${az}°`;
      ctx.fillText(label, x - 11, height - 8);
    }

    // 0 deg true geometric horizon reference
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, elToY(0));
    ctx.lineTo(padL + plotW, elToY(0));
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Baseline H0 (0m Mast) dashed profile for comparison
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    for (let az = 0; az < 360; az++) {
      const x = azToX(az);
      const y = elToY(site.horizonH0Deg[az]);
      if (az === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Solar 14-day Grazing Trajectory Arc
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.78)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let prevSunAz = -999;
    for (let i = 0; i < timeSeries.length; i++) {
      const pt = timeSeries[i];
      const x = azToX(pt.sunAzDeg);
      const y = elToY(pt.sunElDeg);
      if (prevSunAz === -999 || Math.abs(pt.sunAzDeg - prevSunAz) > 120) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      prevSunAz = pt.sunAzDeg;
    }
    ctx.stroke();

    // 6. Earth 27.3-Day Figure-Eight Libration Loop
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let prevEarthAz = -999;
    for (let i = 0; i < librationTrack.length; i++) {
      const pt = librationTrack[i];
      const x = azToX(pt.azDeg);
      const y = elToY(pt.elDeg);
      if (prevEarthAz === -999 || Math.abs(pt.azDeg - prevEarthAz) > 120) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      prevEarthAz = pt.azDeg;
    }
    ctx.stroke();

    // 7. Adjusted Terrain Horizon Silhouette Polygon (depends on Mast Height + Cell Offset)
    const terrainGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    terrainGrad.addColorStop(0, '#CBD8E8');
    terrainGrad.addColorStop(1, '#E8EFF7');
    ctx.fillStyle = terrainGrad;
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(azToX(0), padT + plotH);
    for (let az = 0; az < 360; az++) {
      ctx.lineTo(azToX(az), elToY(adjustedHorizonDeg[az]));
    }
    ctx.lineTo(azToX(360), elToY(adjustedHorizonDeg[0]));
    ctx.lineTo(azToX(360), padT + plotH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 7b. Educator Mode: Earth Atmosphere +0.57° Refraction Halo above Terrain Horizon
    if (persona === 'educator') {
      ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.beginPath();
      for (let az = 0; az < 360; az++) {
        const x = azToX(az);
        const y = elToY(adjustedHorizonDeg[az] + 0.57);
        if (az === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(azToX(360), elToY(adjustedHorizonDeg[0] + 0.57));
      for (let az = 359; az >= 0; az--) {
        ctx.lineTo(azToX(az), elToY(adjustedHorizonDeg[az]));
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let az = 0; az < 360; az++) {
        const x = azToX(az);
        const y = elToY(adjustedHorizonDeg[az] + 0.57);
        if (az === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#0369A1';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(
        '+0.57° Earth Atmospheric Refraction Band (Absent in Lunar Vacuum)',
        padL + 8,
        padT + 14
      );
    }

    // 8. Current Sun Disk Marker (0.533 deg apparent angular diameter)
    const sunX = azToX(currentPoint.sunAzDeg);
    const sunY = elToY(currentPoint.sunElDeg);
    const sunRadiusPx = Math.max(
      4.5,
      ((0.266 / (maxEl - minEl)) * plotH)
    );
    ctx.fillStyle =
      currentPoint.sunFraction > 0.5
        ? '#F59E0B'
        : currentPoint.sunFraction > 0
          ? '#EA580C'
          : '#E11D48';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadiusPx, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 9. Current Earth DTE Target Crosshair
    const earthX = azToX(currentPoint.earthAzDeg);
    const earthY = elToY(currentPoint.earthElDeg);
    ctx.strokeStyle = currentPoint.earthVisible ? '#0284C7' : '#E11D48';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(earthX, earthY, 6, 0, Math.PI * 2);
    ctx.moveTo(earthX - 10, earthY);
    ctx.lineTo(earthX + 10, earthY);
    ctx.moveTo(earthX, earthY - 10);
    ctx.lineTo(earthX, earthY + 10);
    ctx.stroke();

    // 10. Interactive Hover Probe
    if (hoverAz !== null) {
      const hx = azToX(hoverAz);
      const hy = elToY(adjustedHorizonDeg[hoverAz]);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(hx, hy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [
    site,
    adjustedHorizonDeg,
    timeSeries,
    currentPoint,
    persona,
    librationTrack,
    hoverAz,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const padL = 42;
    const padR = 16;
    const plotW = rect.width - padL - padR;
    const relX = e.clientX - rect.left - padL;
    if (relX < 0 || relX > plotW) {
      setHoverAz(null);
      return;
    }
    const az = Math.min(359, Math.max(0, Math.round((relX / plotW) * 360)));
    setHoverAz(az);
  };

  return (
    <section
      aria-label="360 Degree Horizon Mask and Earth Libration Panorama"
      className="flex flex-col bg-white border border-[#DCE5F2] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#E8EEF6]">
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">
            360° Horizon Skyline & 27.3d Libration Loop
          </h2>
          <p className="text-[11px] font-mono text-[#64748B]">
            Mast z={mastHeightM.toFixed(1)}m · Dashed line = 0m terrain baseline · Hover to probe
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums font-semibold">
          <span className="text-[#B45309]">
            ● Sun {Math.round(currentPoint.sunFraction * 100)}%
          </span>
          <span className={currentPoint.earthVisible ? 'text-[#0284C7]' : 'text-[#E11D48]'}>
            ⊕ Earth DTE {currentPoint.earthVisible ? 'CLEAR' : 'OCCLUDED'}
          </span>
        </div>
      </div>

      <div className="relative h-[340px] lg:h-[380px] w-full bg-white">
        <canvas
          ref={canvasRef}
          data-testid="horizon-panorama-canvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverAz(null)}
          className="w-full h-full cursor-crosshair block"
        />

        {/* Hover Azimuth Probe Readout */}
        {hoverAz !== null && (
          <div className="pointer-events-none absolute top-3 right-3 px-3 py-1.5 bg-white/95 border border-[#CBD5E1] shadow-sm rounded-lg text-[11px] font-mono tabular-nums text-[#0F172A]">
            Az {hoverAz}° · Horizon {adjustedHorizonDeg[hoverAz].toFixed(2)}° (H₀{' '}
            {site.horizonH0Deg[hoverAz].toFixed(2)}°)
          </div>
        )}

        {/* Educator Mode Explainer Strip */}
        {persona === 'educator' && (
          <div
            data-testid="educator-refraction-callout"
            className="pointer-events-none absolute bottom-9 left-12 right-4 px-3 py-2 bg-white/95 border border-[#0284C7]/40 shadow-sm rounded-lg text-[11px] text-[#334155]"
          >
            <strong className="text-[#0284C7]">Educator Insight:</strong> On Earth, atmosphere bends sunlight by{' '}
            <span className="font-mono font-semibold text-[#0F172A]">+0.57°</span> to create twilight. In the Moon&apos;s vacuum, ridge transitions are razor-sharp, while Earth bobs in a 27.3-day figure-eight libration loop near the polar horizon.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-[#E8EEF6] bg-[#F8FAFC] text-[11px] font-mono tabular-nums text-[#475569]">
        <span>
          Earth Az/El{' '}
          <strong className="text-[#0284C7]">
            {currentPoint.earthAzDeg.toFixed(1)}° / {currentPoint.earthElDeg.toFixed(2)}°
          </strong>
        </span>
        <span>
          Local Horizon @ Sun{' '}
          <strong className="text-[#0F172A]">{currentPoint.horizonSunDeg.toFixed(2)}°</strong>
        </span>
        <span>
          Local Horizon @ Earth{' '}
          <strong className="text-[#0F172A]">{currentPoint.horizonEarthDeg.toFixed(2)}°</strong>
        </span>
      </div>
    </section>
  );
};
