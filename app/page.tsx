"use client";

import React, { useState, useMemo, useEffect } from "react";

// --- 便利関数 ---
const getRadianString = (deg: number) => {
  if (deg === 0) return "0";
  const sign = deg < 0 ? "-" : "";
  const absDeg = Math.abs(deg);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const div = gcd(absDeg, 180);
  const num = absDeg / div;
  const den = 180 / div;
  const numStr = num === 1 ? "π" : `${num}π`;
  return den === 1 ? `${sign}${numStr}` : `${sign}${numStr}/${den}`;
};

const getExactValue = (deg: number, type: 'sin' | 'cos' | 'tan') => {
  const normalizedDeg = ((deg % 360) + 360) % 360; 
  const exactMap = {
    sin: { 0: "0", 30: "1/2", 45: "√2/2", 60: "√3/2", 90: "1", 120: "√3/2", 135: "√2/2", 150: "1/2", 180: "0", 210: "-1/2", 225: "-√2/2", 240: "-√3/2", 270: "-1", 300: "-√3/2", 315: "-√2/2", 330: "-1/2" },
    cos: { 0: "1", 30: "√3/2", 45: "√2/2", 60: "1/2", 90: "0", 120: "-1/2", 135: "-√2/2", 150: "-√3/2", 180: "-1", 210: "-√3/2", 225: "-√2/2", 240: "-1/2", 270: "0", 300: "1/2", 315: "√2/2", 330: "√3/2" },
    tan: { 0: "0", 30: "1/√3", 45: "1", 60: "√3", 90: "なし(∞)", 120: "-√3", 135: "-1", 150: "-1/√3", 180: "0", 210: "1/√3", 225: "1", 240: "√3", 270: "なし(-∞)", 300: "-√3", 315: "-1", 330: "-1/√3" }
  };
  return (exactMap[type] as Record<number, string>)[normalizedDeg] || null;
};

const getFraction = (decimal: number) => {
  if (Number.isInteger(decimal)) return null;
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const len = decimal.toString().split('.')[1]?.length || 0;
  if (len > 3) return null;
  const denominator = Math.pow(10, len);
  const numerator = Math.round(decimal * denominator);
  const divisor = gcd(Math.abs(numerator), denominator);
  return { num: numerator / divisor, den: denominator / divisor };
};

const presetAngles = [-180, -90, -45, 0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const sinCosPresets = [{ val: 1, label: "1" }, { val: 0.866, label: "√3/2" }, { val: 0.707, label: "√2/2" }, { val: 0.5, label: "1/2" }, { val: 0, label: "0" }, { val: -0.5, label: "-1/2" }, { val: -0.707, label: "-√2/2" }, { val: -0.866, label: "-√3/2" }, { val: -1, label: "-1" }];
const tanPresets = [{ val: 1.732, label: "√3" }, { val: 1, label: "1" }, { val: 0.577, label: "1/√3" }, { val: 0, label: "0" }, { val: -0.577, label: "-1/√3" }, { val: -1, label: "-1" }, { val: -1.732, label: "-√3" }];
const synPresets = [{ a: 1, b: 1, label: "(1, 1)" }, { a: 1, b: 1.732, label: "(1, √3)" }, { a: 1.732, b: 1, label: "(√3, 1)" }, { a: 1, b: -1, label: "(1, -1)" }, { a: -1, b: 1.732, label: "(-1, √3)" }];

// --- UIコンポーネント ---
const RenderFractionText = ({ text, colorClass }: { text: string, colorClass: string }) => {
  if (!text) return null;
  const isNegative = text.startsWith("-");
  const cleanText = text.replace("-", "");
  if (cleanText.includes("/")) {
    const [num, den] = cleanText.split("/");
    return (
      <div className={`inline-flex items-center gap-0.5 font-mono font-bold align-middle mx-0.5 ${colorClass}`}>
        {isNegative && <span className="text-base">-</span>}
        <div className="flex flex-col items-center leading-none text-[0.85em]"><span className="pb-[1px]">{num}</span><span className="w-full border-t-[1.5px] border-current"></span><span className="pt-[1px]">{den}</span></div>
      </div>
    );
  }
  return <span className={`font-mono font-bold ${colorClass}`}>{text}</span>;
};

const PrettyMath = ({ exact, val, colorClass }: { exact: string | null, val: string, colorClass: string }) => (
  <div className="flex flex-col items-center justify-center h-16">
    {!exact ? <span className={`font-mono font-bold text-xl ${colorClass}`}>{val}</span> : exact.startsWith("なし") ? <span className={`font-bold text-sm ${colorClass}`}>{exact}</span> : <RenderFractionText text={exact} colorClass={`text-lg ${colorClass}`} />}
    <span className={`text-[10px] mt-1 ${exact && !exact.startsWith("なし") ? "text-gray-400" : "text-transparent"}`}>≈ {val}</span>
  </div>
);

const ParamFraction = ({ value, colorClass }: { value: number, colorClass: string }) => {
  const frac = getFraction(value);
  if (!frac) return <span className={colorClass}>{value}</span>;
  return (
    <div className={`inline-flex items-center gap-1 align-middle ${colorClass}`}>
      {frac.num < 0 && <span>-</span>}
      <div className="flex flex-col items-center leading-none text-[0.8em]"><span className="pb-[1px]">{Math.abs(frac.num)}</span><span className="w-full border-t-[1.5px] border-current"></span><span className="pt-[1px]">{frac.den}</span></div>
    </div>
  );
};

// 扇形描画用のヘルパー関数（不等式のハイライト用）
const describePie = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad); const y1 = cy - r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad); const y2 = cy - r * Math.sin(endRad);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2} Z`;
};

// ==========================================
// [タブ1] 基本グラフ
// ==========================================
const TrigGraphSet = ({ type, angle, minRange, maxRange }: { type: 'sin' | 'cos' | 'tan', angle: number, minRange: number, maxRange: number }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 240;
  const cx = 150; const cy = 120; const r = 80;
  const graphStartX = 350; const graphWidth = 400; const graphAxisY = 120;

  const currentRad = (angle * Math.PI) / 180;
  const px = cx + r * Math.cos(currentRad); const py = cy - r * Math.sin(currentRad);
  const sinVal = Math.sin(currentRad); const cosVal = Math.cos(currentRad); const tanVal = Math.tan(currentRad);
  const clampedTanVal = Math.max(-5, Math.min(5, tanVal)); const tanTargetY = cy - r * clampedTanVal;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';
  const title = type === 'sin' ? '正弦 (sin)' : type === 'cos' ? '余弦 (cos)' : '正接 (tan)';
  const graphPx = graphStartX + ((angle - minRange) / (maxRange - minRange)) * graphWidth;
  const graphPy = type === 'sin' ? graphAxisY - r * sinVal : type === 'cos' ? graphAxisY - r * cosVal : graphAxisY - r * clampedTanVal;

  const curvePath = useMemo(() => {
    let path = ""; let prevVal: number | null = null;
    for (let d = minRange; d <= maxRange; d += 2) {
      const rad = (d * Math.PI) / 180;
      let val = type === 'sin' ? Math.sin(rad) : type === 'cos' ? Math.cos(rad) : Math.tan(rad);
      let isJump = false; if (type === 'tan') { if (prevVal !== null && val < prevVal) isJump = true; val = Math.max(-5, Math.min(5, val)); }
      const x = (graphStartX + ((d - minRange) / (maxRange - minRange)) * graphWidth).toFixed(2);
      const y = (graphAxisY - r * val).toFixed(2);
      if (d === minRange || isJump) path += `M ${x} ${y} `; else path += `L ${x} ${y} `;
      prevVal = type === 'tan' ? Math.tan(rad) : val;
    }
    return path;
  }, [type, minRange, maxRange]);

  const specialPoints = useMemo(() => {
    const points = []; const startDeg = Math.ceil(minRange / 90) * 90;
    for (let d = startDeg; d <= maxRange; d += 90) {
      let val = type === 'sin' ? Math.sin((d * Math.PI) / 180) : type === 'cos' ? Math.cos((d * Math.PI) / 180) : Math.tan((d * Math.PI) / 180);
      const isAsymptote = (type === 'tan' && d % 180 !== 0);
      if (!isAsymptote) val = Math.round(val);
      points.push({ x: graphStartX + ((d - minRange) / (maxRange - minRange)) * graphWidth, y: isAsymptote ? graphAxisY : graphAxisY - r * val, deg: d, isAsymptote });
    }
    return points;
  }, [type, minRange, maxRange]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="absolute top-4 left-4 font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full text-sm border border-gray-200 shadow-sm z-10"><span style={{ color }}>●</span> {title}</div>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
        <line x1={cx - r - 20} y1={cy} x2={cx + r + 30} y2={cy} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={cx} y1={cy - r - 20} x2={cx} y2={cy + r + 20} stroke="#cbd5e1" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#94a3b8" strokeWidth="2" />
        {type === 'tan' && (
          <><line x1={cx + r} y1={cy - r - 20} x2={cx + r} y2={cy + r + 20} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" /><line x1={cx} y1={cy} x2={cx + r} y2={tanTargetY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4" />
          {Math.abs(tanVal) < 10 && <line x1={cx + r} y1={cy} x2={cx + r} y2={tanTargetY} stroke={color} strokeWidth="4" />}<circle cx={cx + r} cy={tanTargetY} r="4" fill={color} /></>
        )}
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#475569" strokeWidth="2" />
        <circle cx={px} cy={py} r="5" fill="#1e293b" />
        {type === 'sin' && <line x1={px} y1={cy} x2={px} y2={py} stroke={color} strokeWidth="4" />}
        {type === 'cos' && <line x1={px} y1={py} x2={cx} y2={py} stroke={color} strokeWidth="4" />}
        <line x1={graphStartX - 10} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={graphStartX} y1={graphAxisY - r - 20} x2={graphStartX} y2={graphAxisY + r + 20} stroke="#cbd5e1" strokeWidth="2" />
        <text x={graphStartX - 8} y={graphAxisY - r + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">1</text>
        <text x={graphStartX - 8} y={graphAxisY + r + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">-1</text>
        {specialPoints.map((pt, idx) => (
          <g key={`special-${idx}`}>
            {pt.isAsymptote ? (
              <><line x1={pt.x} y1={20} x2={pt.x} y2={SVG_HEIGHT - 20} stroke={color} strokeWidth="1.5" strokeDasharray="4" opacity="0.4" /><text x={pt.x} y={graphAxisY + 22} textAnchor="middle" className="text-[12px] font-bold" style={{ fill: color }}>{getRadianString(pt.deg)}</text></>
            ) : (
              <><circle cx={pt.x} cy={pt.y} r="3" fill="#94a3b8" />{pt.y !== graphAxisY && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={graphAxisY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2" />}<text x={pt.x} y={graphAxisY + 18} textAnchor="middle" className="text-[11px] fill-gray-500 font-medium">{getRadianString(pt.deg)}</text></>
            )}
          </g>
        ))}
        <path d={curvePath} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
        {(type !== 'tan' || Math.abs(tanVal) < 10) && (
          <><line x1={type === 'tan' ? cx + r : type === 'sin' ? px : cx} y1={graphPy} x2={graphPx} y2={graphPy} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4" /><circle cx={graphPx} cy={graphPy} r="5" fill={color} /><line x1={graphPx} y1={graphAxisY} x2={graphPx} y2={graphPy} stroke={color} strokeWidth="3" /></>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// [タブ2] グラフの変形
// ==========================================
const TransformGraphSet = ({ type, a, b, c, dParam, minRange, maxRange }: { type: 'sin' | 'cos' | 'tan', a: number, b: number, c: number, dParam: number, minRange: number, maxRange: number }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 360;
  const graphStartX = 40; const graphWidth = 720; const graphAxisY = 180; const r = 50;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';

  const maxVal = dParam + Math.abs(a);
  const minVal = dParam - Math.abs(a);
  const maxGraphY = graphAxisY - r * maxVal;
  const minGraphY = graphAxisY - r * minVal;
  const yAxisX = graphStartX + ((-minRange) / (maxRange - minRange)) * graphWidth;
  const clampedYAxisX = Math.max(graphStartX, Math.min(graphStartX + graphWidth, yAxisX));

  const baseCurvePath = useMemo(() => {
    let path = ""; let prevVal: number | null = null;
    for (let deg = minRange; deg <= maxRange; deg += 2) {
      const rad = (deg * Math.PI) / 180;
      let val = type === 'sin' ? Math.sin(rad) : type === 'cos' ? Math.cos(rad) : Math.tan(rad);
      let isJump = false; if (type === 'tan') { if (prevVal !== null && val < prevVal) isJump = true; val = Math.max(-10, Math.min(10, val)); }
      const x = (graphStartX + ((deg - minRange) / (maxRange - minRange)) * graphWidth).toFixed(2);
      const y = (graphAxisY - r * val).toFixed(2);
      if (deg === minRange || isJump) path += `M ${x} ${y} `; else path += `L ${x} ${y} `;
      prevVal = type === 'tan' ? Math.tan(rad) : val;
    }
    return path;
  }, [type, minRange, maxRange]);

  const transformCurvePath = useMemo(() => {
    let path = ""; let prevVal: number | null = null;
    for (let deg = minRange; deg <= maxRange; deg += 1) {
      const rad = (b * (deg - c) * Math.PI) / 180;
      let baseVal = type === 'sin' ? Math.sin(rad) : type === 'cos' ? Math.cos(rad) : Math.tan(rad);
      let isJump = false; if (type === 'tan' && prevVal !== null && baseVal < prevVal) isJump = true;
      let finalVal = a * baseVal + dParam; if (type === 'tan') finalVal = Math.max(-10, Math.min(10, finalVal));
      const x = (graphStartX + ((deg - minRange) / (maxRange - minRange)) * graphWidth).toFixed(2);
      const y = (graphAxisY - r * finalVal).toFixed(2);
      if (deg === minRange || isJump) path += `M ${x} ${y} `; else path += `L ${x} ${y} `;
      prevVal = type === 'tan' ? baseVal : null;
    }
    return path;
  }, [type, a, b, c, dParam, minRange, maxRange]);

  const axisPoints = useMemo(() => {
    const points = []; const startDeg = Math.ceil(minRange / 90) * 90;
    for (let deg = startDeg; deg <= maxRange; deg += 90) { points.push({ x: graphStartX + ((deg - minRange) / (maxRange - minRange)) * graphWidth, deg }); }
    return points;
  }, [minRange, maxRange]);

  const startRad = (-b * c * Math.PI) / 180;
  const startGraphX = graphStartX + ((0 - minRange) / (maxRange - minRange)) * graphWidth;
  const startGraphY = graphAxisY - r * (a * (type === 'sin' ? Math.sin(startRad) : type === 'cos' ? Math.cos(startRad) : Math.tan(startRad)) + dParam);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
        {[-3, -2, -1, 1, 2, 3].map(v => (
          <g key={`ygrid-${v}`}>
            <line x1={graphStartX} y1={graphAxisY - r * v} x2={graphStartX + graphWidth} y2={graphAxisY - r * v} stroke="#e2e8f0" strokeWidth="1" />
            <text x={clampedYAxisX - 6} y={graphAxisY - r * v + 3} textAnchor="end" className="text-[10px] fill-gray-500 font-bold">{v}</text>
          </g>
        ))}
        
        <line x1={graphStartX - 20} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#94a3b8" strokeWidth="2" />
        <line x1={yAxisX} y1={20} x2={yAxisX} y2={SVG_HEIGHT - 20} stroke="#94a3b8" strokeWidth="2" />
        
        {type !== 'tan' && (
          <g>
            <line x1={graphStartX - 10} y1={maxGraphY} x2={graphStartX + graphWidth + 20} y2={maxGraphY} stroke={color} strokeWidth="1" strokeDasharray="4" opacity="0.6"/>
            <text x={graphStartX - 8} y={maxGraphY + 4} textAnchor="end" className="text-[11px] font-bold" style={{ fill: color }}>{maxVal.toFixed(1)}</text>
            <line x1={graphStartX - 10} y1={minGraphY} x2={graphStartX + graphWidth + 20} y2={minGraphY} stroke={color} strokeWidth="1" strokeDasharray="4" opacity="0.6"/>
            <text x={graphStartX - 8} y={minGraphY + 4} textAnchor="end" className="text-[11px] font-bold" style={{ fill: color }}>{minVal.toFixed(1)}</text>
          </g>
        )}

        {axisPoints.map((pt, idx) => (
          <g key={`axis-${idx}`}>
            <circle cx={pt.x} cy={graphAxisY} r="2" fill="#64748b" />
            <text x={pt.x} y={graphAxisY + 16} textAnchor="middle" className="text-[10px] fill-gray-500">{getRadianString(pt.deg)}</text>
          </g>
        ))}
        <path d={baseCurvePath} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
        <path d={transformCurvePath} fill="none" stroke={color} strokeWidth="3" />

        {0 >= minRange && 0 <= maxRange && (
          <g className="opacity-80">
            <circle cx={startGraphX} cy={startGraphY} r="4" fill="#ec4899" />
            <line x1={startGraphX} y1={graphAxisY} x2={startGraphX} y2={startGraphY} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="2" />
            <text x={startGraphX} y={startGraphY < graphAxisY ? startGraphY - 8 : startGraphY + 16} textAnchor="middle" className="text-[10px] font-bold fill-pink-600">θ=0の始点</text>
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// [タブ3] 方程式・不等式
// ==========================================
const EquationGraphSet = ({ type, kValue, mode, minRange, maxRange, alpha, viewMode, solutions }: { type: 'sin' | 'cos' | 'tan', kValue: number, mode: '=' | '>=' | '<=', minRange: number, maxRange: number, alpha: number, viewMode: 'theta' | 'thetaMinusAlpha', solutions: number[] }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 280;
  const cx = 150; const cy = 140; const r = 100;
  const graphStartX = 350; const graphWidth = 400; const graphAxisY = 140;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';
  const arrowColor = "#a855f7"; 
  
  const kGraphY = graphAxisY - r * kValue;
  const kCircleLine = type === 'sin' ? cy - r * kValue : cx + r * kValue;

  const curvePath = useMemo(() => {
    let path = ""; let prevVal: number | null = null;
    for (let d = minRange; d <= maxRange; d += 2) {
      const evalDeg = viewMode === 'theta' ? (d - alpha) : d;
      const rad = (evalDeg * Math.PI) / 180;
      let val = type === 'sin' ? Math.sin(rad) : type === 'cos' ? Math.cos(rad) : Math.tan(rad);
      let isJump = false;
      if (type === 'tan') {
        if (prevVal !== null && val < prevVal) isJump = true;
        val = Math.max(-10, Math.min(10, val));
      }
      const x = (graphStartX + ((d - minRange) / (maxRange - minRange)) * graphWidth).toFixed(2);
      const y = (graphAxisY - r * val).toFixed(2);
      if (d === minRange || isJump) path += `M ${x} ${y} `; else path += `L ${x} ${y} `;
      prevVal = type === 'tan' ? Math.tan(rad) : val;
    }
    return path;
  }, [type, minRange, maxRange, alpha, viewMode]);

  const specialPoints = useMemo(() => {
    const points = []; const startDeg = Math.ceil((minRange - alpha) / 90) * 90;
    for (let d = startDeg; d <= maxRange - alpha; d += 90) {
      const displayDeg = viewMode === 'theta' ? d + alpha : d;
      if (displayDeg < minRange || displayDeg > maxRange) continue;
      let val = type === 'sin' ? Math.sin((d * Math.PI) / 180) : type === 'cos' ? Math.cos((d * Math.PI) / 180) : Math.tan((d * Math.PI) / 180);
      const isAsymptote = (type === 'tan' && d % 180 !== 0);
      if (!isAsymptote) val = Math.round(val);
      points.push({ x: graphStartX + ((displayDeg - minRange) / (maxRange - minRange)) * graphWidth, y: isAsymptote ? graphAxisY : graphAxisY - r * val, deg: displayDeg, isAsymptote });
    }
    return points;
  }, [type, minRange, maxRange, alpha, viewMode]);

  const isStartVisible = 0 >= minRange && 0 <= maxRange;
  const startEvalDeg = viewMode === 'theta' ? -alpha : 0;
  const startRad = (startEvalDeg * Math.PI) / 180;
  const startCX = cx + r * Math.cos(startRad);
  const startCY = cy - r * Math.sin(startRad);

  const tanPieSlices = useMemo(() => {
    if (type !== 'tan' || mode === '=') return [];
    const slices = [];
    const baseAtanDeg = (Math.atan(kValue) * 180) / Math.PI; 
    const alphaShift = viewMode === 'theta' ? alpha : 0;
    
    if (mode === '>=') {
      slices.push(describePie(cx, cy, r, baseAtanDeg + alphaShift, 90 + alphaShift));
      slices.push(describePie(cx, cy, r, baseAtanDeg + 180 + alphaShift, 270 + alphaShift));
    } else {
      slices.push(describePie(cx, cy, r, -90 + alphaShift, baseAtanDeg + alphaShift));
      slices.push(describePie(cx, cy, r, 90 + alphaShift, baseAtanDeg + 180 + alphaShift));
    }
    return slices;
  }, [type, kValue, mode, alpha, viewMode, cx, cy, r]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
        <defs><marker id="shift-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill={arrowColor} /></marker></defs>

        {mode !== '=' && (
          <g opacity="0.15">
            {type === 'sin' ? ( 
              <rect x={cx - r} y={mode === '>=' ? cy - r : kCircleLine} width={r * 2} height={mode === '>=' ? (kCircleLine - (cy - r)) : ((cy + r) - kCircleLine)} fill={color} />
            ) : type === 'cos' ? ( 
              <rect x={mode === '>=' ? kCircleLine : cx - r} y={cy - r} width={mode === '>=' ? ((cx + r) - kCircleLine) : (kCircleLine - (cx - r))} height={r * 2} fill={color} /> 
            ) : (
              tanPieSlices.map((path, i) => <path key={`tan-pie-${i}`} d={path} fill={color} />)
            )}
            <rect x={graphStartX} y={mode === '>=' ? graphAxisY - r*10 : kGraphY} width={graphWidth} height={mode === '>=' ? (kGraphY - (graphAxisY - r*10)) : ((graphAxisY + r*10) - kGraphY)} fill={color} />
          </g>
        )}

        <line x1={cx - r - 20} y1={cy} x2={cx + r + 20} y2={cy} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={cx} y1={cy - r - 20} x2={cx} y2={cy + r + 20} stroke="#cbd5e1" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#94a3b8" strokeWidth="2" />
        
        {type === 'tan' && (
          <>
            <line x1={cx + r} y1={cy - r * 3} x2={cx + r} y2={cy + r * 3} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
            <line x1={cx - r} y1={cy + r * kValue} x2={cx + r} y2={cy - r * kValue} stroke="#d97706" strokeWidth="2" strokeDasharray="4" />
          </>
        )}

        {isStartVisible && viewMode === 'theta' && alpha !== 0 && (
          <g className="opacity-80">
            <line x1={cx} y1={cy} x2={startCX} y2={startCY} stroke="#ec4899" strokeWidth="2" strokeDasharray="3" />
            <circle cx={startCX} cy={startCY} r="4" fill="#ec4899" />
            <text x={startCX + (startCX > cx ? 12 : -12)} y={startCY + (startCY > cy ? 12 : -12)} textAnchor="middle" className="text-[10px] font-bold fill-pink-600">θ=0の始点</text>
          </g>
        )}

        <line x1={graphStartX - 10} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={graphStartX} y1={graphAxisY - r - 20} x2={graphStartX} y2={graphAxisY + r + 20} stroke="#cbd5e1" strokeWidth="2" />
        <text x={graphStartX - 8} y={graphAxisY - r + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">1</text>
        <text x={graphStartX - 8} y={graphAxisY + r + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">-1</text>

        {specialPoints.map((pt, idx) => (
          <g key={`eq-special-${idx}`}>
            {pt.isAsymptote ? (
              <><line x1={pt.x} y1={20} x2={pt.x} y2={SVG_HEIGHT - 20} stroke={color} strokeWidth="1.5" strokeDasharray="4" opacity="0.4" /><text x={pt.x} y={graphAxisY + 22} textAnchor="middle" className="text-[12px] font-bold" style={{ fill: color }}>{getRadianString(pt.deg)}</text></>
            ) : (
              <><circle cx={pt.x} cy={pt.y} r="3" fill="#94a3b8" />{pt.y !== graphAxisY && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={graphAxisY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2" />}<text x={pt.x} y={graphAxisY + 18} textAnchor="middle" className="text-[11px] fill-gray-500 font-medium">{getRadianString(pt.deg)}</text></>
            )}
          </g>
        ))}

        <path d={curvePath} fill="none" stroke={color} strokeWidth="2" opacity="0.4" />

        {type === 'sin' ? ( <line x1={cx - r - 10} y1={kCircleLine} x2={graphStartX + graphWidth + 10} y2={kCircleLine} stroke="#d97706" strokeWidth="2" strokeDasharray="4" />
        ) : type === 'cos' ? ( <><line x1={kCircleLine} y1={cy - r - 10} x2={kCircleLine} y2={cy + r + 10} stroke="#d97706" strokeWidth="2" strokeDasharray="4" /><line x1={graphStartX - 10} y1={kGraphY} x2={graphStartX + graphWidth + 10} y2={kGraphY} stroke="#d97706" strokeWidth="2" strokeDasharray="4" /></> 
        ) : ( <line x1={graphStartX - 10} y1={kGraphY} x2={graphStartX + graphWidth + 10} y2={kGraphY} stroke="#d97706" strokeWidth="2" strokeDasharray="4" /> )}

        {solutions.map((deg, idx) => {
          const solRad = (deg * Math.PI) / 180;
          const solX = cx + r * Math.cos(solRad); const solY = cy - r * Math.sin(solRad);
          const solGraphX = graphStartX + ((deg - minRange) / (maxRange - minRange)) * graphWidth;

          const baseDeg = deg - alpha; const baseRad = (baseDeg * Math.PI) / 180;
          const baseX = cx + r * Math.cos(baseRad); const baseY = cy - r * Math.sin(baseRad);
          const baseGraphX = graphStartX + ((baseDeg - minRange) / (maxRange - minRange)) * graphWidth;

          const isActiveShifted = viewMode === 'theta';
          const activeDeg = isActiveShifted ? deg : baseDeg;
          const activeCX = isActiveShifted ? solX : baseX; const activeCY = isActiveShifted ? solY : baseY;
          const activeGraphX = isActiveShifted ? solGraphX : baseGraphX;

          const ghostCX = isActiveShifted ? baseX : solX; const ghostCY = isActiveShifted ? baseY : solY;
          const ghostGraphX = isActiveShifted ? baseGraphX : solGraphX;

          const largeArcFlag = Math.abs(alpha) > 180 ? "1" : "0"; const sweepFlag = alpha > 0 ? "0" : "1";
          const arcPath = `M ${ghostCX} ${ghostCY} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${activeCX} ${activeCY}`;
          const shiftText = alpha > 0 ? `+${getRadianString(alpha)}` : getRadianString(alpha);
          const midDeg = baseDeg + alpha / 2;
          const shiftTextX = cx + (r + 16) * Math.cos(midDeg * Math.PI / 180); const shiftTextY = cy - (r + 16) * Math.sin(midDeg * Math.PI / 180);

          return (
            <g key={`solution-${idx}`}>
              {isActiveShifted && alpha !== 0 && <line x1={cx} y1={cy} x2={ghostCX} y2={ghostCY} stroke={arrowColor} strokeWidth="1.2" strokeDasharray="3" opacity="0.4" />}
              <line x1={cx} y1={cy} x2={activeCX} y2={activeCY} stroke="#d97706" strokeWidth="2.5" />
              <circle cx={activeCX} cy={activeCY} r="5" fill="#d97706" />
              <text x={activeCX + (activeCX > cx ? 8 : -28)} y={activeCY + (activeCY > cy ? 14 : -6)} className="text-[11px] font-bold fill-amber-800">{getRadianString(activeDeg)}</text>

              {activeDeg >= minRange && activeDeg <= maxRange && (
                <><circle cx={activeGraphX} cy={kGraphY} r="5" fill="#d97706" /><line x1={activeGraphX} y1={graphAxisY} x2={activeGraphX} y2={kGraphY} stroke="#d97706" strokeWidth="1.2" strokeDasharray="2" /><text x={activeGraphX} y={graphAxisY + 16} textAnchor="middle" className="text-[11px] font-bold fill-amber-800">{getRadianString(activeDeg)}</text></>
              )}

              {alpha !== 0 && (
                <g className="opacity-90">
                  {viewMode === 'theta' ? (
                    <><circle cx={ghostCX} cy={ghostCY} r="4" fill="none" stroke={arrowColor} strokeWidth="1.5" strokeDasharray="2" opacity="0.5" /><path d={arcPath} fill="none" stroke={arrowColor} strokeWidth="2" markerEnd="url(#shift-arrow)" /><text x={shiftTextX} y={shiftTextY + 4} textAnchor="middle" className="text-[11px] font-bold" style={{ fill: arrowColor }}>{shiftText}</text></>
                  ) : (
                    <>{activeDeg >= minRange && activeDeg <= maxRange && deg >= minRange && deg <= maxRange && (
                        <><circle cx={ghostGraphX} cy={kGraphY} r="4" fill="none" stroke={arrowColor} strokeWidth="1.5" strokeDasharray="2" /><line x1={activeGraphX} y1={kGraphY} x2={ghostGraphX} y2={kGraphY} stroke={arrowColor} strokeWidth="2" markerEnd="url(#shift-arrow)" /><text x={(activeGraphX + ghostGraphX) / 2} y={kGraphY - 8} textAnchor="middle" className="text-[11px] font-bold" style={{ fill: arrowColor }}>{shiftText}</text><line x1={ghostGraphX} y1={kGraphY} x2={ghostGraphX} y2={graphAxisY} stroke={arrowColor} strokeWidth="1" strokeDasharray="2" /><text x={ghostGraphX} y={graphAxisY + 28} textAnchor="middle" className="text-[10px] font-bold" style={{ fill: arrowColor }}>解: {getRadianString(deg)}</text></>
                    )}</>
                  )}
                </g>
              )}
            </g>
          );
        })}
        <text x={graphStartX - 15} y={kGraphY + 4} textAnchor="end" className="text-xs font-bold fill-amber-700">{kValue.toFixed(2)}</text>
      </svg>
    </div>
  );
};

// ==========================================
// [タブ4] 三角関数の合成
// ==========================================
const SynthesisGraphSet = ({ a, b, minRange, maxRange }: { a: number, b: number, minRange: number, maxRange: number }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 280;
  const cx = 150; const cy = 140; 
  const unit = 25; 
  const graphStartX = 350; const graphWidth = 400; const graphAxisY = 140;

  const R = Math.sqrt(a * a + b * b);
  const alphaRad = Math.atan2(b, a);

  const px = cx + a * unit;
  const py = cy - b * unit; 

  const paths = useMemo(() => {
    let pathA = ""; let pathB = ""; let pathR = "";
    for (let d = minRange; d <= maxRange; d += 2) {
      const rad = (d * Math.PI) / 180;
      const valA = a * Math.sin(rad);
      const valB = b * Math.cos(rad);
      const valR = valA + valB; 
      
      const x = (graphStartX + ((d - minRange) / (maxRange - minRange)) * graphWidth).toFixed(2);
      const yA = (graphAxisY - unit * valA).toFixed(2);
      const yB = (graphAxisY - unit * valB).toFixed(2);
      const yR = (graphAxisY - unit * valR).toFixed(2);
      
      if (d === minRange) {
        pathA += `M ${x} ${yA} `; pathB += `M ${x} ${yB} `; pathR += `M ${x} ${yR} `;
      } else {
        pathA += `L ${x} ${yA} `; pathB += `L ${x} ${yB} `; pathR += `L ${x} ${yR} `;
      }
    }
    return { pathA, pathB, pathR };
  }, [a, b, minRange, maxRange]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <div className="absolute top-4 left-4 font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full text-sm border border-gray-200 shadow-sm z-10">
        <span style={{ color: '#8b5cf6' }}>●</span> 合成後の波
      </div>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
        {[-4, -2, 2, 4].map(v => (
          <g key={`grid-x-${v}`}>
            <line x1={cx + v * unit} y1={40} x2={cx + v * unit} y2={SVG_HEIGHT - 40} stroke="#e2e8f0" strokeWidth="1" />
            <text x={cx + v * unit} y={cy + 12} textAnchor="middle" className="text-[8px] fill-gray-400">{v}</text>
          </g>
        ))}
        {[-4, -2, 2, 4].map(v => (
          <g key={`grid-y-${v}`}>
            <line x1={50} y1={cy - v * unit} x2={250} y2={cy - v * unit} stroke="#e2e8f0" strokeWidth="1" />
            <text x={cx - 6} y={cy - v * unit + 3} textAnchor="end" className="text-[8px] fill-gray-400">{v}</text>
          </g>
        ))}
        
        <line x1={40} y1={cy} x2={260} y2={cy} stroke="#94a3b8" strokeWidth="2" />
        <line x1={cx} y1={40} x2={cx} y2={SVG_HEIGHT - 40} stroke="#94a3b8" strokeWidth="2" />
        
        <path d={`M ${cx} ${cy} L ${px} ${cy} L ${px} ${py} Z`} fill="#f3e8ff" opacity="0.5" />
        
        <line x1={cx} y1={cy} x2={px} y2={cy} stroke="#ef4444" strokeWidth="3" />
        <line x1={px} y1={cy} x2={px} y2={py} stroke="#3b82f6" strokeWidth="3" />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#8b5cf6" strokeWidth="3" markerEnd="url(#vec-arrow)" />
        <circle cx={px} cy={py} r="4" fill="#8b5cf6" />
        
        <text x={(cx + px)/2} y={cy + (b > 0 ? 14 : -6)} textAnchor="middle" className="text-[11px] font-bold fill-red-600">a</text>
        <text x={px + (a > 0 ? 6 : -6)} y={(cy + py)/2} textAnchor={a > 0 ? "start" : "end"} className="text-[11px] font-bold fill-blue-600">b</text>
        
        {R > 0 && (
          <path d={`M ${cx + 20} ${cy} A 20 20 0 0 ${alphaRad > 0 ? 0 : 1} ${cx + 20 * Math.cos(alphaRad)} ${cy - 20 * Math.sin(alphaRad)}`} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        )}
        <text x={cx + 35 * Math.cos(alphaRad/2)} y={cy - 35 * Math.sin(alphaRad/2)} textAnchor="middle" className="text-[11px] font-bold fill-purple-600">α</text>

        <line x1={graphStartX - 10} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={graphStartX} y1={graphAxisY - 4 * unit} x2={graphStartX} y2={graphAxisY + 4 * unit} stroke="#cbd5e1" strokeWidth="2" />
        {[-4, -2, 2, 4].map(v => (
          <text key={`gy-${v}`} x={graphStartX - 6} y={graphAxisY - v * unit + 3} textAnchor="end" className="text-[8px] fill-gray-400 font-bold">{v}</text>
        ))}

        <path d={paths.pathA} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4" opacity="0.6" />
        <path d={paths.pathB} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" opacity="0.6" />
        <path d={paths.pathR} fill="none" stroke="#8b5cf6" strokeWidth="3" />

        <line x1={graphStartX} y1={graphAxisY - unit * R} x2={graphStartX + graphWidth} y2={graphAxisY - unit * R} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2" opacity="0.5" />
        <line x1={graphStartX} y1={graphAxisY + unit * R} x2={graphStartX + graphWidth} y2={graphAxisY + unit * R} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="2" opacity="0.5" />

        <defs>
          <marker id="vec-arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#8b5cf6" />
          </marker>
        </defs>
      </svg>
    </div>
  );
};


// ==========================================
// メイン画面
// ==========================================
export default function MathVisualizer() {
  const [activeTab, setActiveTab] = useState<'basic' | 'transform' | 'equation' | 'synthesis'>('basic');

  const [minRange, setMinRange] = useState<number>(0);
  const [maxRange, setMaxRange] = useState<number>(360);
  const [domainPreset, setDomainPreset] = useState<string>("0,360");

  const [angle, setAngle] = useState<number>(45);
  const [showSin, setShowSin] = useState<boolean>(true);
  const [showCos, setShowCos] = useState<boolean>(false);
  const [showTan, setShowTan] = useState<boolean>(false);

  const [transformType, setTransformType] = useState<'sin' | 'cos' | 'tan'>('sin');
  const [paramA, setParamA] = useState<number>(1);
  const [paramB, setParamB] = useState<number>(1);
  const [paramC, setParamC] = useState<number>(0);
  const [paramD, setParamD] = useState<number>(0);
  const resetParams = () => { setParamA(1); setParamB(1); setParamC(0); setParamD(0); };

  const [eqType, setEqType] = useState<'sin' | 'cos' | 'tan'>('sin');
  const [kValue, setKValue] = useState<number>(0.5);
  const [eqMode, setEqMode] = useState<'=' | '>=' | '<='>('=');
  const [paramAlpha, setParamAlpha] = useState<number>(0); 
  const [eqViewMode, setEqViewMode] = useState<'theta' | 'thetaMinusAlpha'>('theta');

  const [synA, setSynA] = useState<number>(1);
  const [synB, setSynB] = useState<number>(1);

  const currentKPresets = eqType === 'tan' ? tanPresets : sinCosPresets;

  const exactKLabel = useMemo(() => {
    const match = currentKPresets.find(p => Math.abs(p.val - kValue) < 0.01);
    return match ? match.label : kValue.toFixed(2);
  }, [kValue, currentKPresets]);

  const equationSolutions = useMemo(() => {
    if (eqType !== 'tan' && (kValue > 1 || kValue < -1)) return [];
    const angles: number[] = [];
    const baseRad = eqType === 'tan' ? Math.atan(kValue) : (eqType === 'sin' ? Math.asin(kValue) : Math.acos(kValue));
    let degX1 = Math.round((baseRad * 180) / Math.PI);
    
    if (eqType === 'tan') {
      degX1 = (degX1 + 180) % 180;
      for (let n = -8; n <= 8; n++) {
        const sol = (degX1 + 180 * n) + paramAlpha;
        if (sol >= minRange && sol <= maxRange) angles.push(sol);
      }
    } else {
      const degX2 = eqType === 'sin' ? 180 - degX1 : 360 - degX1;
      for (let n = -4; n <= 4; n++) {
        const sol1 = (degX1 + 360 * n) + paramAlpha;
        const sol2 = (degX2 + 360 * n) + paramAlpha;
        if (sol1 >= minRange && sol1 <= maxRange) angles.push(sol1);
        if (sol2 >= minRange && sol2 <= maxRange) angles.push(sol2);
      }
    }
    return Array.from(new Set(angles)).sort((a, b) => a - b);
  }, [eqType, kValue, minRange, maxRange, paramAlpha]);

  // 🌟 改善: tanの一般解の基準となるベース解を1つだけ出力するよう修正
  const baseSolutions = useMemo(() => {
    if (eqType !== 'tan' && (kValue > 1 || kValue < -1)) return [];
    const angles: number[] = [];
    const baseRad = eqType === 'tan' ? Math.atan(kValue) : (eqType === 'sin' ? Math.asin(kValue) : Math.acos(kValue));
    let degX1 = Math.round((baseRad * 180) / Math.PI);
    
    if (eqType === 'tan') {
      degX1 = (degX1 + 180) % 180;
      angles.push(degX1 + paramAlpha);
      // Removed the second angle push because tan's period is π (nπ already covers it)
    } else {
      degX1 = ((degX1 % 360) + 360) % 360;
      const degX2 = eqType === 'sin' ? (180 - degX1 + 360) % 360 : (360 - degX1 + 360) % 360;
      angles.push(degX1 + paramAlpha);
      angles.push(degX2 + paramAlpha);
    }
    return Array.from(new Set(angles)).sort((a, b) => a - b);
  }, [eqType, kValue, paramAlpha]);

  useEffect(() => {
    const val = `${minRange},${maxRange}`;
    if (["0,360", "-180,180", "0,180", "0,720"].includes(val) && domainPreset !== "none" && domainPreset !== "custom") {
      setDomainPreset(val);
    }
  }, [minRange, maxRange]);

  const { exactSynR, exactSynAlpha } = useMemo(() => {
    const R2 = synA * synA + synB * synB;
    const R2_int = Math.round(R2);
    let rStr = "";
    if (Math.abs(R2 - R2_int) < 0.1) {
      if (R2_int === 0) rStr = "0";
      else {
        const root = Math.sqrt(R2_int);
        if (Number.isInteger(root)) rStr = root.toString();
        else {
          let simplified = `√${R2_int}`;
          for (let i = 4; i >= 2; i--) {
            if (R2_int % (i * i) === 0) {
              simplified = `${i === 1 ? '' : i}√${R2_int / (i * i)}`;
              break;
            }
          }
          rStr = simplified;
        }
      }
    } else {
      rStr = Math.sqrt(R2).toFixed(2);
    }

    let alphaRad = Math.atan2(synB, synA);
    let alphaPi = alphaRad / Math.PI;
    const fractions = [
      {v: 0, s: "0"}, {v: 1/6, s: "π/6"}, {v: 1/4, s: "π/4"}, {v: 1/3, s: "π/3"}, {v: 1/2, s: "π/2"},
      {v: 2/3, s: "2π/3"}, {v: 3/4, s: "3π/4"}, {v: 5/6, s: "5π/6"}, {v: 1, s: "π"},
      {v: -1/6, s: "-π/6"}, {v: -1/4, s: "-π/4"}, {v: -1/3, s: "-π/3"}, {v: -1/2, s: "-π/2"},
      {v: -2/3, s: "-2π/3"}, {v: -3/4, s: "-3π/4"}, {v: -5/6, s: "-5π/6"}, {v: -1, s: "-π"}
    ];
    let alphaStr = alphaRad.toFixed(2);
    for (let f of fractions) {
      if (Math.abs(alphaPi - f.v) < 0.02) { alphaStr = f.s; break; }
    }

    return { exactSynR: rStr, exactSynAlpha: alphaStr };
  }, [synA, synB]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-xl font-bold text-blue-900">📐 三角関数ビジュアライザー</h1>
          <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
            <button onClick={() => { setActiveTab('basic'); setMinRange(0); setMaxRange(360); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'basic' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>1. 基本</button>
            <button onClick={() => { setActiveTab('transform'); setMinRange(-180); setMaxRange(540); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'transform' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>2. 変形</button>
            <button onClick={() => { setActiveTab('equation'); setMinRange(0); setMaxRange(360); setDomainPreset("0,360"); setParamAlpha(0); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'equation' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>3. 方程式・不等式</button>
            <button onClick={() => { setActiveTab('synthesis'); setMinRange(0); setMaxRange(360); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'synthesis' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>4. 合成</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          
          <div className="w-full md:w-80 md:sticky md:top-6 md:shrink-0 space-y-4">
            
            {activeTab === 'basic' && (
              <div className="bg-white p-5 rounded-2xl shadow-md border border-blue-100 space-y-5 animate-fade-in">
                <div>
                  <h2 className="text-sm font-bold text-gray-500 mb-1">角度操作 (θ)</h2>
                  <div className="text-2xl font-extrabold text-blue-600 mb-2">{angle}° / {getRadianString(angle)} rad</div>
                  <input type="range" min={minRange} max={maxRange} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                  {presetAngles.map((preset) => (
                    <button key={preset} onClick={() => setAngle(preset)} className={`px-2 py-1 rounded text-[11px] font-medium transition ${angle === preset ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{getRadianString(preset)}</button>
                  ))}
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-2">👁️ 表示する関数</h3>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showSin} onChange={(e) => setShowSin(e.target.checked)} className="accent-red-500" /><span className="text-xs font-bold text-red-600">sin</span></label>
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showCos} onChange={(e) => setShowCos(e.target.checked)} className="accent-blue-500" /><span className="text-xs font-bold text-blue-600">cos</span></label>
                    <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showTan} onChange={(e) => setShowTan(e.target.checked)} className="accent-emerald-500" /><span className="text-xs font-bold text-emerald-600">tan</span></label>
                  </div>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-1.5">⚙️ グラフの定義域</h3>
                  <select value={domainPreset} onChange={(e) => { setDomainPreset(e.target.value); if (e.target.value !== "custom") { const [min, max] = e.target.value.split(','); setMinRange(Number(min)); setMaxRange(Number(max)); } }} className="w-full p-1.5 border border-blue-200 rounded text-xs text-gray-700 outline-none">
                    <option value="0,360">0 〜 2π (0°〜360°)</option>
                    <option value="-180,180">-π 〜 π (-180°〜180°)</option>
                    <option value="-360,360">-2π 〜 2π (-360°〜360°)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'transform' && (
              <div className="bg-white p-5 rounded-2xl shadow-md border border-indigo-100 space-y-4 animate-fade-in">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 mb-1.5">👁️ 基準の関数</h3>
                  <select value={transformType} onChange={(e) => setTransformType(e.target.value as any)} className="w-full p-1.5 border rounded-lg text-sm font-bold text-gray-700 outline-none">
                    <option value="sin">y = sin θ</option><option value="cos">y = cos θ</option><option value="tan">y = tan θ</option>
                  </select>
                </div>
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-indigo-900">a (縦伸縮) = {paramA.toFixed(1)}</span></div>
                    <div className="flex gap-1 mb-1.5">{[-1, 0.5, 1, 2].map(v => (<button key={v} onClick={() => setParamA(v)} className={`text-[10px] px-1 py-0.5 rounded border ${paramA === v ? 'bg-indigo-600 text-white' : 'bg-white'}`}>{v}</button>))}</div>
                    <input type="range" min="-3" max="3" step="0.1" value={paramA} onChange={(e) => setParamA(Number(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                  <div className="bg-fuchsia-50/70 p-2 rounded-lg border border-fuchsia-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-fuchsia-900">b (横伸縮) = {paramB.toFixed(1)}</span></div>
                    <div className="flex gap-1 mb-1.5">{[0.5, 1, 2].map(v => (<button key={v} onClick={() => setParamB(v)} className={`text-[10px] px-1 py-0.5 rounded border ${paramB === v ? 'bg-fuchsia-600 text-white' : 'bg-white'}`}>{v}</button>))}</div>
                    <input type="range" min="0.5" max="3" step="0.1" value={paramB} onChange={(e) => setParamB(Number(e.target.value))} className="w-full accent-fuchsia-600" />
                  </div>
                  <div className="bg-teal-50/70 p-2 rounded-lg border border-teal-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-teal-900">c (θ軸移動) = {getRadianString(paramC)}</span></div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {[-180, -90, -45, 0, 45, 90, 180].map(v => (
                        <button key={v} onClick={() => setParamC(v)} className={`text-[10px] px-1.5 py-0.5 rounded border ${paramC === v ? 'bg-teal-600 text-white border-teal-700 font-bold' : 'bg-white text-gray-600'}`}>{getRadianString(v)}</button>
                      ))}
                    </div>
                    <input type="range" min="-180" max="180" step="1" value={paramC} onChange={(e) => setParamC(Number(e.target.value))} className="w-full accent-teal-600" />
                  </div>
                  <div className="bg-orange-50/70 p-2 rounded-lg border border-orange-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-orange-900">d (y軸移動) = {paramD.toFixed(1)}</span></div>
                    <div className="flex gap-1 mb-1.5">{[-1, 0, 1].map(v => (<button key={v} onClick={() => setParamD(v)} className={`text-[10px] px-1 py-0.5 rounded border ${paramD === v ? 'bg-orange-600 text-white' : 'bg-white'}`}>{v}</button>))}</div>
                    <input type="range" min="-3" max="3" step="0.1" value={paramD} onChange={(e) => setParamD(Number(e.target.value))} className="w-full accent-orange-600" />
                  </div>
                </div>
                <button onClick={resetParams} className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-600 transition">パラメータをリセット</button>
              </div>
            )}

            {activeTab === 'equation' && (
              <div className="bg-white p-5 rounded-2xl shadow-md border border-amber-100 space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <h2 className="text-xs font-bold text-gray-500">関数と不等号の向き</h2>
                  <div className="flex gap-2">
                    <select 
                      value={eqType} 
                      onChange={(e) => {
                        setEqType(e.target.value as 'sin'|'cos'|'tan');
                        setKValue(e.target.value === 'tan' ? 1 : 0.5);
                      }} 
                      className="flex-1 p-1.5 border rounded text-xs font-bold text-gray-700 bg-white outline-none"
                    >
                      <option value="sin">sin</option>
                      <option value="cos">cos</option>
                      <option value="tan">tan</option>
                    </select>
                    <div className="flex bg-white rounded border overflow-hidden text-xs">
                      <button onClick={() => setEqMode('=')} className={`px-2.5 py-1 font-bold ${eqMode === '=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>＝</button>
                      <button onClick={() => setEqMode('>=')} className={`px-2.5 py-1 font-bold border-l border-r ${eqMode === '>=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>≧</button>
                      <button onClick={() => setEqMode('<=')} className={`px-2.5 py-1 font-bold ${eqMode === '<=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>≦</button>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-xs space-y-1.5">
                  <span className="font-bold text-amber-900">平行移動 (α) = {getRadianString(paramAlpha)}</span>
                  <div className="flex flex-wrap gap-1">
                    {[-90, -60, -45, -30, 0, 30, 45, 60, 90].map(v => (
                      <button key={v} onClick={() => setParamAlpha(v)} className={`text-[10px] px-1.5 py-0.5 rounded border ${paramAlpha === v ? 'bg-amber-600 text-white border-amber-700 font-bold' : 'bg-white text-gray-600'}`}>{getRadianString(v)}</button>
                    ))}
                  </div>
                  <input type="range" min="-180" max="180" step="1" value={paramAlpha} onChange={(e) => setParamAlpha(Number(e.target.value))} className="w-full accent-amber-600" />
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-1.5">👁️ 表示する視点（置き換え）</h3>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 p-0.5 rounded text-xs font-medium">
                    <button onClick={() => setEqViewMode('thetaMinusAlpha')} className={`py-1 rounded ${eqViewMode === 'thetaMinusAlpha' ? 'bg-white font-bold text-amber-700 shadow-xs' : 'text-gray-500'}`}>X = θ - α 基準</button>
                    <button onClick={() => setEqViewMode('theta')} className={`py-1 rounded ${eqViewMode === 'theta' ? 'bg-white font-bold text-amber-700 shadow-xs' : 'text-gray-500'}`}>θ 基準（現実）</button>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-1">境界値 (k)</h3>
                  <input 
                    type="range" 
                    min={eqType === 'tan' ? -3 : -1} 
                    max={eqType === 'tan' ? 3 : 1} 
                    step={eqType === 'tan' ? 0.1 : 0.01} 
                    value={kValue} 
                    onChange={(e) => setKValue(Number(e.target.value))} 
                    className="w-full accent-amber-500" 
                  />
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {currentKPresets.map(preset => (
                    <button key={preset.val} onClick={() => setKValue(preset.val)} className={`py-1 rounded text-xs border flex items-center justify-center transition ${Math.abs(kValue - preset.val) < 0.01 ? 'bg-amber-500 text-white font-bold' : 'bg-white text-gray-600'}`}>
                      <RenderFractionText text={preset.label} colorClass="" />
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-1.5">⚙️ 考える定義域</h3>
                  <select 
                    value={domainPreset} 
                    onChange={(e) => { 
                      const p = e.target.value; setDomainPreset(p);
                      if (p === "none") { setMinRange(0); setMaxRange(360); }
                      else if (p !== "custom") { const [min, max] = p.split(','); setMinRange(Number(min)); setMaxRange(Number(max)); }
                    }} 
                    className="w-full p-1.5 border border-amber-200 rounded text-xs text-gray-700 bg-amber-50/50 outline-none"
                  >
                    <option value="none">制限なし (一般解を表示)</option>
                    <option value="0,360">0 ≦ θ ≦ 2π (標準1周)</option>
                    <option value="0,180">0 ≦ θ ≦ π (上半分)</option>
                    <option value="-180,180">-π ≦ θ ≦ π (負の角含む)</option>
                    <option value="0,720">0 ≦ θ ≦ 4π (2周分)</option>
                    <option value="custom">カスタム自由入力 🛠️</option>
                  </select>
                </div>

                {domainPreset === "custom" && (
                  <div className="pt-1 flex items-center gap-2 animate-fade-in">
                    <input type="number" value={minRange} onChange={(e) => setMinRange(Number(e.target.value))} className="w-full border rounded p-1 text-center text-xs outline-none" placeholder="最小(°)" />
                    <span className="text-gray-400 text-xs">〜</span>
                    <input type="number" value={maxRange} onChange={(e) => setMaxRange(Number(e.target.value))} className="w-full border rounded p-1 text-center text-xs outline-none" placeholder="最大(°)" />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'synthesis' && (
              <div className="bg-white p-5 rounded-2xl shadow-md border border-purple-100 space-y-4 animate-fade-in">
                <div className="space-y-4">
                  <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-red-900">a (sinの係数) = {synA.toFixed(1)}</span></div>
                    <input type="range" min="-3" max="3" step="0.1" value={synA} onChange={(e) => setSynA(Number(e.target.value))} className="w-full accent-red-500" />
                  </div>
                  <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-xs">
                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-blue-900">b (cosの係数) = {synB.toFixed(1)}</span></div>
                    <input type="range" min="-3" max="3" step="0.1" value={synB} onChange={(e) => setSynB(Number(e.target.value))} className="w-full accent-blue-500" />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 mb-2">📌 よく使う組み合わせ (a, b)</h3>
                  <div className="grid grid-cols-2 gap-1.5">
                    {synPresets.map(preset => (
                      <button 
                        key={preset.label} 
                        onClick={() => { setSynA(preset.a); setSynB(preset.b); }} 
                        className={`py-1.5 rounded text-xs border flex items-center justify-center transition ${(Math.abs(synA - preset.a) < 0.01 && Math.abs(synB - preset.b) < 0.01) ? 'bg-purple-500 text-white border-purple-600 font-bold shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ダッシュボード */}
            <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">数学的ステータス</h3>
              
              {activeTab === 'basic' && (
                <div className="grid grid-cols-3 gap-1.5 text-center items-center">
                  <div className="bg-gray-50 p-1.5 rounded border border-gray-100"><p className="text-[10px] text-gray-400 mb-0.5">sin θ</p><PrettyMath exact={getExactValue(angle, 'sin')} val={Math.sin((angle * Math.PI) / 180).toFixed(3)} colorClass="text-red-600" /></div>
                  <div className="bg-gray-50 p-1.5 rounded border border-gray-100"><p className="text-[10px] text-gray-400 mb-0.5">cos θ</p><PrettyMath exact={getExactValue(angle, 'cos')} val={Math.cos((angle * Math.PI) / 180).toFixed(3)} colorClass="text-blue-600" /></div>
                  <div className="bg-gray-50 p-1.5 rounded border border-gray-100"><p className="text-[10px] text-gray-400 mb-0.5">tan θ</p><PrettyMath exact={getExactValue(angle, 'tan')} val={Math.abs(Math.cos((angle * Math.PI) / 180)) < 0.001 ? "なし(∞)" : Math.tan((angle * Math.PI) / 180).toFixed(3)} colorClass="text-emerald-600" /></div>
                </div>
              )}

              {activeTab === 'transform' && (
                <div className="bg-gray-800 p-3 rounded-xl shadow-inner text-center border border-gray-900">
                  <p className="text-[10px] text-gray-400 mb-1.5">現在の方程式</p>
                  <div className="text-base font-mono font-bold text-green-400 flex flex-wrap justify-center items-center gap-0.5 leading-none">
                    <span>y = </span>
                    {paramA !== 1 && <ParamFraction value={paramA} colorClass="text-indigo-300" />}
                    <span>{transformType}</span>
                    <span>{((paramB !== 1) || (paramC !== 0)) ? "(" : ""}</span>
                    {paramB !== 1 && <ParamFraction value={paramB} colorClass="text-fuchsia-300" />}
                    {paramC !== 0 && paramB !== 1 ? "(" : ""}
                    <span>θ</span>
                    {paramC !== 0 && <span className="text-teal-300">{paramC > 0 ? ` - ${getRadianString(paramC)}` : ` + ${getRadianString(Math.abs(paramC))}`}</span>}
                    {paramC !== 0 && paramB !== 1 ? ")" : ""}
                    <span>{((paramB !== 1) || (paramC !== 0)) ? ")" : ""}</span>
                    {paramD !== 0 && <span className="text-orange-300"> {paramD > 0 ? `+ ` : `- `}<ParamFraction value={Math.abs(paramD)} colorClass="" /></span>}
                  </div>
                </div>
              )}

              {activeTab === 'equation' && (
                <div className="bg-gray-800 p-3 rounded-xl shadow-inner border border-gray-900 text-center">
                  <div className="text-xs font-mono font-bold text-amber-400 mb-2 flex justify-center items-center gap-1">
                    <span>{eqType}(θ {paramAlpha > 0 ? `- ${getRadianString(paramAlpha)}` : paramAlpha < 0 ? `+ ${getRadianString(Math.abs(paramAlpha))}` : ''}) {eqMode}</span>
                    <RenderFractionText text={exactKLabel} colorClass="text-amber-400" />
                  </div>
                  
                  {domainPreset === "none" ? (
                    <>
                      <p className="text-[10px] text-gray-400 mb-1.5">一般解（n は任意の整数）</p>
                      <div className="flex flex-col items-center justify-center font-mono font-bold text-amber-400 gap-1 min-h-[28px]">
                        {baseSolutions.length === 0 ? <span className="text-xs text-gray-500">解なし</span> : eqMode === '=' ? (
                          baseSolutions.map((sol, i) => (
                            <div key={i} className="flex items-center gap-1 bg-gray-900 px-2 py-0.5 rounded border border-gray-700 text-xs">
                              <RenderFractionText text={getRadianString(sol)} colorClass="text-amber-400" />
                              <span className="text-[10px] text-amber-500 font-sans">{eqType === 'tan' ? '+ nπ' : '+ 2nπ'}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-[10px] font-sans text-amber-300 leading-tight">不等式の一般解表現は複雑なため<br/>右の単位円(1周分)を参考に解説</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-gray-400 mb-1.5">解 θ （{getRadianString(minRange)} ≦ θ ≦ {getRadianString(maxRange)}）</p>
                      <div className="flex flex-wrap items-center justify-center font-mono font-bold text-amber-400 gap-1.5 min-h-[28px]">
                        {equationSolutions.length === 0 ? <span className="text-xs text-gray-500">この範囲に解なし</span> : eqMode === '=' ? (
                          equationSolutions.map((sol, i) => (
                            <span key={i} className="bg-gray-900 px-2 py-1 rounded border border-gray-700 text-xs">
                              <RenderFractionText text={getRadianString(sol)} colorClass="text-amber-400" />
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] font-sans text-amber-300">右側のハイライト領域を表示中</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'synthesis' && (
                <div className="bg-gray-800 p-3 rounded-xl shadow-inner border border-gray-900 text-center space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">合成前の方程式</p>
                    <div className="text-sm font-mono font-bold text-gray-200 flex justify-center items-center gap-1">
                      <ParamFraction value={synA} colorClass="text-red-400" /><span>sin θ</span>
                      <span>{synB >= 0 ? "+" : "-"}</span>
                      <ParamFraction value={Math.abs(synB)} colorClass="text-blue-400" /><span>cos θ</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-700 pt-2">
                    <p className="text-[10px] text-purple-300 mb-1">合成後</p>
                    <div className="text-lg font-mono font-bold text-purple-400 flex justify-center items-center gap-0.5">
                      {exactSynR !== "1" && exactSynR !== "0" && <span>{exactSynR}</span>}
                      {exactSynR === "0" ? <span>0</span> : (
                        <>
                          <span>sin(θ</span>
                          {exactSynAlpha !== "0" && exactSynAlpha !== "0.00" && (
                            <>
                              <span className="mx-1">{exactSynAlpha.startsWith("-") ? "-" : "+"}</span>
                              <RenderFractionText text={exactSynAlpha.replace("-", "")} colorClass="text-purple-400" />
                            </>
                          )}
                          <span>)</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="flex-1 w-full space-y-4">
            {activeTab === 'basic' && (
              <div className="space-y-4 animate-fade-in w-full">
                {showSin && <TrigGraphSet type="sin" angle={angle} minRange={minRange} maxRange={maxRange} />}
                {showCos && <TrigGraphSet type="cos" angle={angle} minRange={minRange} maxRange={maxRange} />}
                {showTan && <TrigGraphSet type="tan" angle={angle} minRange={minRange} maxRange={maxRange} />}
              </div>
            )}

            {activeTab === 'transform' && (
              <div className="animate-fade-in w-full">
                <TransformGraphSet type={transformType} a={paramA} b={paramB} c={paramC} dParam={paramD} minRange={minRange} maxRange={maxRange} />
              </div>
            )}

            {activeTab === 'equation' && (
              <div className="animate-fade-in w-full">
                <EquationGraphSet type={eqType} kValue={kValue} mode={eqMode} minRange={minRange} maxRange={maxRange} alpha={paramAlpha} viewMode={eqViewMode} solutions={equationSolutions} />
              </div>
            )}

            {activeTab === 'synthesis' && (
              <div className="animate-fade-in w-full">
                <SynthesisGraphSet a={synA} b={synB} minRange={minRange} maxRange={maxRange} />
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}