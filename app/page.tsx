"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// ==========================================
// 共通設定・ユーティリティ関数（統合版）
// ==========================================
const SVG_WIDTH = 800;
const SVG_HEIGHT = 400;
const CX = 400;
const CY = 200;
const UNIT = 40;
const UNIT_X = 40;
const UNIT_Y = 40;

const SvgMath = ({ x, y, width = 40, height = 30, math, color = "text-gray-500", justify = "center" }: { x: number, y: number, width?: number, height?: number, math: string, color?: string, justify?: string }) => (
  <foreignObject x={x} y={y} width={width} height={height} style={{ overflow: 'visible' }}>
    <div className={`flex justify-${justify} items-center w-full h-full text-[12px] font-bold ${color}`}>
      <InlineMath math={math} />
    </div>
  </foreignObject>
);

// 小数を綺麗な分数に変換する関数（近似アルゴリズム付き）
const getFractionTex = (decimal: number) => {
  if (Number.isInteger(decimal)) return decimal.toString();
  const sign = decimal < 0 ? "-" : "";
  const abs = Math.abs(decimal);
  const intPart = Math.floor(abs);
  const frac = abs - intPart;
  
  if (frac < 0.0001) return `${sign}${intPart}`;
  
  let bestDen = 1;
  let bestNum = 0;
  let minErr = 1;
  
  for(let den=1; den<=120; den++) {
    const num = Math.round(frac * den);
    const err = Math.abs(frac - num/den);
    if (err < minErr) {
      minErr = err;
      bestDen = den;
      bestNum = num;
      if (err < 0.00001) break;
    }
  }
  
  if (minErr > 0.01) return decimal.toFixed(2); 
  
  const totalNum = intPart * bestDen + bestNum;
  if (bestDen === 1) return `${sign}${totalNum}`;
  return `${sign}\\frac{${totalNum}}{${bestDen}}`;
};

// ラジアン変換
const getRadianTex = (deg: number) => {
  if (deg === 0) return "0";
  const sign = deg < 0 ? "-" : "";
  const absDeg = Math.abs(deg);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const div = gcd(absDeg, 180);
  const num = absDeg / div;
  const den = 180 / div;
  if (den === 1) return `${sign}${num === 1 ? "\\pi" : `${num}\\pi`}`;
  return `${sign}\\frac{${num === 1 ? "\\pi" : `${num}\\pi`}}{${den}}`;
};

// 多項式を綺麗なKaTeX文字列にフォーマット
const formatPoly = (...terms: {c: number, p: number}[]) => {
  let res = "";
  let isFirst = true;
  for (let i = 0; i < terms.length; i++) {
    const { c, p } = terms[i];
    if (Math.abs(c) < 0.001) continue; 
    
    let sign = c > 0 ? (isFirst ? "" : "+") : "-";
    let absC = Math.abs(c);
    let valStr = (absC === 1 && p !== 0) ? "" : getFractionTex(absC);
    let xStr = p === 0 ? "" : (p === 1 ? "x" : `x^{${p}}`);
    
    res += `${sign}${valStr}${xStr}`;
    isFirst = false;
  }
  return res || "0";
};

// 数値計算：実数解
const getRoots2 = (A: number, B: number, C: number): number[] => {
  if (Math.abs(A) < 0.0001) {
    if (Math.abs(B) < 0.0001) return [];
    return [-C/B];
  }
  const D = B*B - 4*A*C;
  if (D < -0.0001) return [];
  if (Math.abs(D) <= 0.0001) return [-B/(2*A)];
  return [ (-B - Math.sqrt(D))/(2*A), (-B + Math.sqrt(D))/(2*A) ].sort((a,b)=>a-b);
};

const getRoots3 = (A: number, B: number, C: number, D: number): number[] => {
  if (Math.abs(A) < 0.0001) return getRoots2(B, C, D);
  const extrema = getRoots2(3*A, 2*B, C);
  const intervals = [-20, ...extrema.filter(x => x > -20 && x < 20).sort((a,b)=>a-b), 20];
  const roots: number[] = [];
  const f = (x: number) => A*x*x*x + B*x*x + C*x + D;
  
  for (let i=0; i<intervals.length-1; i++) {
    let x1 = intervals[i]; let x2 = intervals[i+1];
    let y1 = f(x1), y2 = f(x2);
    if (Math.abs(y1) < 0.0001) { roots.push(x1); continue; }
    if (Math.abs(y2) < 0.0001) { roots.push(x2); continue; }
    if (y1 * y2 < 0) {
      for(let j=0; j<50; j++){
        let mid = (x1+x2)/2; let ymid = f(mid);
        if(Math.abs(ymid) < 0.0000001) { x1 = mid; break; }
        if(y1*ymid < 0) { x2 = mid; y2 = ymid; } else { x1 = mid; y1 = ymid; }
      }
      roots.push((x1+x2)/2);
    }
  }
  return Array.from(new Set(roots.map(r => Math.round(r*1000)/1000))).sort((a,b)=>a-b);
};

// スライダー統合コンポーネント
const SliderRow = ({ label, value, min, max, step, onChange, accentColor, textColor }: any) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
      <span>{label}</span>
    </div>
    <div className="flex gap-3 items-center bg-gray-50/50 p-2 rounded-lg border border-gray-200">
      <input 
        type="range" min={min} max={max} step={step} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className={`flex-1 ${accentColor}`} 
      />
      <input 
        type="number" step={step} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))} 
        className="w-16 p-1.5 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white shadow-inner focus:outline-none focus:border-blue-500" 
      />
      <div className={`w-12 text-right font-bold ${textColor} text-sm`}>
        <InlineMath math={getFractionTex(value)} />
      </div>
    </div>
  </div>
);

// ==========================================
// 微分積分パーツ 1: 微分係数と導関数
// ==========================================

const DerivativeLimitTab = () => {
  const [p, setP] = useState<number>(0.5); 
  const [a, setA] = useState<number>(1);
  const [h, setH] = useState<number>(2);

  const f = (x: number) => p * x * x;
  const df = (x: number) => 2 * p * x; 

  const fa = f(a);
  const fah = f(a + h);
  const slopeSecant = h !== 0 ? (fah - fa) / h : df(a);
  const slopeTangent = df(a);
  const fTex = formatPoly({c: p, p: 2});

  const curvePath = useMemo(() => {
    let path = "";
    for (let x = -10; x <= 10; x += 0.1) {
      const px = CX + x * UNIT_X;
      const py = CY + 100 - f(x) * UNIT_Y; 
      if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
      else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    return path;
  }, [p]);

  const getLinePath = (slope: number, passX: number, passY: number) => {
    const x1 = -10; const y1 = slope * (x1 - passX) + passY;
    const x2 = 10;  const y2 = slope * (x2 - passX) + passY;
    return `M ${CX + x1 * UNIT_X} ${CY + 100 - y1 * UNIT_Y} L ${CX + x2 * UNIT_X} ${CY + 100 - y2 * UNIT_Y}`;
  };

  const pAx = CX + a * UNIT_X; const pAy = CY + 100 - fa * UNIT_Y;
  const pBx = CX + (a + h) * UNIT_X; const pBy = CY + 100 - fah * UNIT_Y;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full lg:w-[380px] shrink-0 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 space-y-5">
          <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 mb-2">
            <p className="text-[10px] font-bold text-blue-800 mb-1">関数の形</p>
            <div className="text-sm font-bold text-gray-800 mb-2 flex justify-center bg-white py-1 rounded">
              <InlineMath math={`f(x) = ${fTex}`} />
            </div>
            <SliderRow label="係数 (p)" value={p} min={-3} max={3} step={0.1} onChange={setP} accentColor="accent-indigo-500" textColor="text-indigo-600" />
          </div>
          <SliderRow label="基準点 (a)" value={a} min={-4} max={4} step={0.1} onChange={setA} accentColor="accent-blue-600" textColor="text-blue-600" />
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">変化量 <InlineMath math="h" /> (極限の操作)</h3>
            <div className="flex gap-2 mb-2 flex-wrap">
              {[-2, -1, -0.1, 0, 0.1, 1, 2].map(v => (
                <button key={v} onClick={() => setH(v)} className={`px-3 py-1.5 rounded text-xs font-bold transition border shadow-sm ${h === v ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {v === 0 ? 'h→0' : v}
                </button>
              ))}
            </div>
            <SliderRow label="" value={h} min={-4} max={4} step={0.1} onChange={setH} accentColor="accent-red-500" textColor="text-red-500" />
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
            <p className="text-[10px] text-gray-500 font-bold mb-1">平均変化率 (割線 AB の傾き)</p>
            <div className="text-base text-red-600 font-bold text-center py-2 bg-white rounded border border-gray-100 shadow-sm flex items-center justify-center">
              <BlockMath math={`\\frac{f(a+h) - f(a)}{h} = ${getFractionTex(slopeSecant)}`} />
            </div>
            {h === 0 ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-inner">
                <p className="text-[10px] text-blue-600 font-bold mb-1">微分係数 (接線の傾き)</p>
                <div className="text-base text-blue-700 font-bold flex items-center justify-center">
                  <BlockMath math={`f'(a) = \\lim_{h \\to 0} \\frac{f(a+h) - f(a)}{h} = ${getFractionTex(slopeTangent)}`} />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white border border-gray-200 rounded-lg text-center shadow-sm min-h-[70px] flex items-center justify-center">
                <span className="text-xs text-gray-500 font-bold">h を 0 に近づけると<br/>微分係数 (接線) になります</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px] flex items-center justify-center p-4">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-full max-h-[500px] object-contain">
          <line x1={0} y1={CY + 100} x2={SVG_WIDTH} y2={CY + 100} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />
          <path d={curvePath} fill="none" stroke="#475569" strokeWidth="3" />
          <path d={getLinePath(slopeTangent, a, fa)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" opacity={h === 0 ? 1 : 0.4} />
          {h !== 0 && ( <path d={getLinePath(slopeSecant, a, fa)} fill="none" stroke="#ef4444" strokeWidth="2" /> )}
          <line x1={pAx} y1={CY + 100} x2={pAx} y2={pAy} stroke="#94a3b8" strokeDasharray="3" />
          <circle cx={pAx} cy={pAy} r="5" fill="#3b82f6" />
          <SvgMath x={pAx - 20} y={CY + 105} width={40} height={20} math="a" color="text-blue-600" />
          {h !== 0 && (
            <>
              <line x1={pBx} y1={CY + 100} x2={pBx} y2={pBy} stroke="#94a3b8" strokeDasharray="3" />
              <circle cx={pBx} cy={pBy} r="5" fill="#ef4444" />
              <SvgMath x={pBx - 20} y={CY + 105} width={40} height={20} math="a+h" color="text-red-500" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

const FunctionGraphTab = () => {
  const [degree, setDegree] = useState<2|3|4>(3);
  const [c4, setC4] = useState<number>(0);
  const [c3, setC3] = useState<number>(1);
  const [c2, setC2] = useState<number>(0);
  const [c1, setC1] = useState<number>(-3);
  const [c0, setC0] = useState<number>(0);
  const UY = 20;

  const f = (x: number) => c4*x*x*x*x + c3*x*x*x + c2*x*x + c1*x + c0;
  const df = (x: number) => 4*c4*x*x*x + 3*c3*x*x + 2*c2*x + c1;

  const fTex = formatPoly({c: c4, p: 4}, {c: c3, p: 3}, {c: c2, p: 2}, {c: c1, p: 1}, {c: c0, p: 0});
  const dfTex = formatPoly({c: 4*c4, p: 3}, {c: 3*c3, p: 2}, {c: 2*c2, p: 1}, {c: c1, p: 0});
  const roots = useMemo(() => getRoots3(4*c4, 3*c3, 2*c2, c1), [c4, c3, c2, c1]);

  const curvePathF = useMemo(() => {
    let path = "";
    for (let x = -10; x <= 10; x += 0.1) {
      const px = CX + x * UNIT_X; const py = CY - f(x) * UY;
      if (py > -200 && py < SVG_HEIGHT + 200) {
        if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
        else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
      }
    }
    return path;
  }, [c4, c3, c2, c1, c0]);

  const curvePathDF = useMemo(() => {
    let path = "";
    for (let x = -10; x <= 10; x += 0.1) {
      const px = CX + x * UNIT_X; const py = CY - df(x) * UY;
      if (py > -200 && py < SVG_HEIGHT + 200) {
        if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
        else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
      }
    }
    return path;
  }, [c4, c3, c2, c1]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full lg:w-[380px] shrink-0 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-5">
          <div className="bg-emerald-50 p-4 rounded-xl shadow-inner text-center border border-emerald-200">
            <div className="text-emerald-900 overflow-x-auto text-base font-bold bg-white rounded shadow-sm min-h-[48px] flex items-center justify-center">
              <BlockMath math={`f(x) = ${fTex}`} />
            </div>
            <div className="text-rose-600 overflow-x-auto text-base mt-2 border-t border-emerald-200 font-bold min-h-[48px] flex items-center justify-center">
              <BlockMath math={`f'(x) = ${dfTex}`} />
            </div>
          </div>
          <div className="space-y-2">
            {degree >= 4 && <SliderRow label="x⁴ の係数" value={c4} min={-3} max={3} step={0.1} onChange={setC4} accentColor="accent-emerald-500" textColor="text-emerald-600" />}
            {degree >= 3 && <SliderRow label="x³ の係数" value={c3} min={-3} max={3} step={0.1} onChange={setC3} accentColor="accent-emerald-500" textColor="text-emerald-600" />}
            <SliderRow label="x² の係数" value={c2} min={-3} max={3} step={0.1} onChange={setC2} accentColor="accent-emerald-500" textColor="text-emerald-600" />
            <SliderRow label="x の係数" value={c1} min={-5} max={5} step={0.1} onChange={setC1} accentColor="accent-emerald-500" textColor="text-emerald-600" />
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px] flex items-center justify-center p-4">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-full max-h-[500px] object-contain">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />
          <path d={curvePathF} fill="none" stroke="#10b981" strokeWidth="3.5" />
          <path d={curvePathDF} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="5" />
          {roots.map((r, idx) => ( <circle key={idx} cx={CX + r * UNIT_X} cy={CY - f(r)*UY} r="6" fill="#10b981" /> ))}
        </svg>
      </div>
    </div>
  );
};

// 【第1部 終了】
// ==========================================
// 三角関数用 ヘルパー・定数
// ==========================================
const describePie = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad); const y1 = cy - r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad); const y2 = cy - r * Math.sin(endRad);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2} Z`;
};

const presetAngles = [-180, -90, -45, 0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const sinCosPresets = [{ val: 1, tex: "1" }, { val: 0.866, tex: "\\frac{\\sqrt{3}}{2}" }, { val: 0.707, tex: "\\frac{\\sqrt{2}}{2}" }, { val: 0.5, tex: "\\frac{1}{2}" }, { val: 0, tex: "0" }, { val: -0.5, tex: "-\\frac{1}{2}" }, { val: -0.707, tex: "-\\frac{\\sqrt{2}}{2}" }, { val: -0.866, tex: "-\\frac{\\sqrt{3}}{2}" }, { val: -1, tex: "-1" }];
const tanPresets = [{ val: 1.732, tex: "\\sqrt{3}" }, { val: 1, tex: "1" }, { val: 0.577, tex: "\\frac{1}{\\sqrt{3}}" }, { val: 0, tex: "0" }, { val: -0.577, tex: "-\\frac{1}{\\sqrt{3}}" }, { val: -1, tex: "-1" }, { val: -1.732, tex: "-\\sqrt{3}" }];
const synPresets = [{ a: 1, b: 1, tex: "(1, 1)" }, { a: 1, b: 1.732, tex: "(1, \\sqrt{3})" }, { a: 1.732, b: 1, tex: "(\\sqrt{3}, 1)" }, { a: 1, b: -1, tex: "(1, -1)" }, { a: -1, b: 1.732, tex: "(-1, \\sqrt{3})" }];

const getExactValueTex = (deg: number, type: 'sin' | 'cos' | 'tan') => {
  const n = ((deg % 360) + 360) % 360;
  const map = {
    sin: { 0: "0", 30: "\\frac{1}{2}", 45: "\\frac{\\sqrt{2}}{2}", 60: "\\frac{\\sqrt{3}}{2}", 90: "1", 180: "0", 270: "-1" },
    cos: { 0: "1", 30: "\\frac{\\sqrt{3}}{2}", 45: "\\frac{\\sqrt{2}}{2}", 60: "\\frac{1}{2}", 90: "0", 180: "-1", 270: "0" },
    tan: { 0: "0", 30: "\\frac{1}{\\sqrt{3}}", 45: "1", 60: "\\sqrt{3}", 90: "\\infty", 180: "0" }
  };
  return (map[type] as any)[n] || null;
};

// 1. 基本グラフ
const TrigGraphSet = ({ type, angle, minRange, maxRange }: { type: 'sin' | 'cos' | 'tan', angle: number, minRange: number, maxRange: number }) => {
  const cx = 150; const cy = 120; const r = 80;
  const gX = 350; const gW = 400; const gY = 120;
  const rad = (angle * Math.PI) / 180;
  const px = cx + r * Math.cos(rad); const py = cy - r * Math.sin(rad);
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';

  const curvePath = useMemo(() => {
    let p = ""; let prevVal: number | null = null;
    for (let d = minRange; d <= maxRange; d += 2) {
      const r_d = (d * Math.PI) / 180;
      let v = type === 'sin' ? Math.sin(r_d) : type === 'cos' ? Math.cos(r_d) : Math.tan(r_d);
      if (type === 'tan') v = Math.max(-5, Math.min(5, v));
      const x = gX + ((d - minRange) / (maxRange - minRange)) * gW;
      const y = gY - r * v;
      if (d === minRange || (type==='tan' && prevVal!==null && v < prevVal)) p += `M ${x} ${y} `; else p += `L ${x} ${y} `;
      prevVal = v;
    } return p;
  }, [type, minRange, maxRange]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative mb-4">
      <svg viewBox="0 0 800 240" className="w-full bg-slate-50">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#94a3b8" strokeWidth="2" />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#475569" strokeWidth="2" />
        <path d={curvePath} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />
        <circle cx={gX + ((angle - minRange)/(maxRange - minRange))*gW} cy={gY - r*(type==='sin'?Math.sin(rad):type==='cos'?Math.cos(rad):Math.max(-5,Math.min(5,Math.tan(rad))))} r="5" fill={color} />
      </svg>
    </div>
  );
};

// 2. 変形グラフ
const TransformGraphSet = ({ type, a, b, c, dParam, minRange, maxRange }: any) => {
  const gX = 40; const gW = 720; const gY = 180; const r = 50;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';

  const transformCurvePath = useMemo(() => {
    let p = "";
    for (let deg = minRange; deg <= maxRange; deg += 1) {
      const rad = (b * (deg - c) * Math.PI) / 180;
      let v = a * (type === 'sin' ? Math.sin(rad) : type === 'cos' ? Math.cos(rad) : Math.tan(rad)) + dParam;
      if (type === 'tan') v = Math.max(-10, Math.min(10, v));
      const x = gX + ((deg - minRange) / (maxRange - minRange)) * gW;
      const y = gY - r * v;
      if (deg === minRange) p += `M ${x} ${y} `; else p += `L ${x} ${y} `;
    } return p;
  }, [type, a, b, c, dParam, minRange, maxRange]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <svg viewBox="0 0 800 360" className="w-full bg-slate-50">
        <line x1={gX} y1={gY} x2={gX+gW} y2={gY} stroke="#94a3b8" strokeWidth="2" />
        <path d={transformCurvePath} fill="none" stroke={color} strokeWidth="3" />
      </svg>
    </div>
  );
};

// 3. 方程式・不等式
const EquationGraphSet = ({ type, kValue, mode, minRange, maxRange, alpha, viewMode, solutions }: any) => {
  const cx = 150; const cy = 140; const r = 100;
  const gX = 350; const gW = 400; const gY = 140;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <svg viewBox="0 0 800 280" className="w-full bg-slate-50">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#94a3b8" strokeWidth="2" />
        <line x1={gX} y1={gY - r*kValue} x2={gX+gW} y2={gY-r*kValue} stroke="#d97706" strokeWidth="2" strokeDasharray="4" />
        {solutions.map((deg: number, i: number) => (
          <circle key={i} cx={cx + r*Math.cos(deg*Math.PI/180)} cy={cy - r*Math.sin(deg*Math.PI/180)} r="5" fill="#d97706" />
        ))}
      </svg>
    </div>
  );
};

// 4. 合成
const SynthesisGraphSet = ({ a, b, minRange, maxRange }: any) => {
  const cx = 150; const cy = 140; const unit = 25;
  const gX = 350; const gW = 400; const gY = 140;
  const R = Math.sqrt(a*a + b*b);

  const pathR = useMemo(() => {
    let p = "";
    for (let d = minRange; d <= maxRange; d += 2) {
      const rad = (d * Math.PI) / 180;
      const v = a * Math.sin(rad) + b * Math.cos(rad);
      const x = gX + ((d - minRange) / (maxRange - minRange)) * gW;
      const y = gY - unit * v;
      if (d === minRange) p += `M ${x} ${y} `; else p += `L ${x} ${y} `;
    } return p;
  }, [a, b, minRange, maxRange]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
      <svg viewBox="0 0 800 280" className="w-full bg-slate-50">
        <line x1={cx} y1={cy} x2={cx + a*unit} y2={cy - b*unit} stroke="#8b5cf6" strokeWidth="3" />
        <path d={pathR} fill="none" stroke="#8b5cf6" strokeWidth="3" />
      </svg>
    </div>
  );
};

const TrigVisualizer = () => {
  const [activeTab, setActiveTab] = useState<'basic' | 'transform' | 'equation' | 'synthesis'>('basic');
  const [angle, setAngle] = useState(45);
  const [minRange, setMinRange] = useState(0);
  const [maxRange, setMaxRange] = useState(360);
  const [transformType, setTransformType] = useState<'sin'|'cos'|'tan'>('sin');
  const [paramA, setParamA] = useState(1);
  const [paramB, setParamB] = useState(1);
  const [paramC, setParamC] = useState(0);
  const [paramD, setParamD] = useState(0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-blue-900">📐 三角関数</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
          {['basic', 'transform', 'equation', 'synthesis'].map((t: any) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-md text-sm font-bold transition ${activeTab === t ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-80 space-y-4">
           <div className="bg-white p-5 rounded-2xl shadow-md border border-blue-100">
             <SliderRow label="角度 θ" value={angle} min={0} max={360} step={1} onChange={setAngle} accentColor="accent-blue-600" textColor="text-blue-600" />
           </div>
        </div>
        <div className="flex-1">
          {activeTab === 'basic' && <TrigGraphSet type="sin" angle={angle} minRange={minRange} maxRange={maxRange} />}
          {activeTab === 'transform' && <TransformGraphSet type={transformType} a={paramA} b={paramB} c={paramC} dParam={paramD} minRange={minRange} maxRange={maxRange} />}
          {activeTab === 'equation' && <EquationGraphSet type="sin" kValue={0.5} solutions={[30, 150]} minRange={minRange} maxRange={maxRange} />}
          {activeTab === 'synthesis' && <SynthesisGraphSet a={1} b={1} minRange={minRange} maxRange={maxRange} />}
        </div>
      </div>
    </div>
  );
};
// ==========================================
// 指数・対数関数用 パス生成
// ==========================================
const generateExpPath = (base: number, alpha: number = 0, minX: number = -10, maxX: number = 10) => {
  let path = "";
  for (let x = minX; x <= maxX; x += 0.05) {
    const y = Math.pow(base, x - alpha);
    const px = CX + x * UNIT; const py = CY - y * UNIT;
    if (py < -100 || py > SVG_HEIGHT + 100) continue;
    if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
    else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  return path;
};

const generateLogPath = (base: number, alpha: number = 0, minX: number = -10, maxX: number = 10) => {
  if (base === 1) return "";
  let path = "";
  for (let x = alpha + 0.01; x <= maxX; x += 0.05) {
    const y = Math.log(x - alpha) / Math.log(base);
    const px = CX + x * UNIT; const py = CY - y * UNIT;
    if (py < -100 || py > SVG_HEIGHT + 100) continue;
    if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
    else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  return path;
};

// --- 指数・対数 各タブコンポーネント ---
const BasicRelationTab = () => {
  const [base, setBase] = useState(2);
  const [pointX, setPointX] = useState(1);
  const expY = Math.pow(base, pointX);
  return (
    <div className="flex flex-col md:flex-row gap-6 animate-fade-in">
      <div className="w-full md:w-80 bg-white p-5 rounded-2xl shadow-md border border-blue-100">
        <SliderRow label="底 a" value={base} min={0.1} max={5} step={0.1} onChange={setBase} accentColor="accent-blue-600" textColor="text-blue-600" />
        <SliderRow label="点Pのx座標" value={pointX} min={-2} max={3} step={0.1} onChange={setPointX} accentColor="accent-gray-500" textColor="text-gray-500" />
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <svg viewBox="0 0 800 400" className="w-full bg-slate-50">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#94a3b8" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#94a3b8" strokeWidth="2" />
          <path d={generateExpPath(base)} fill="none" stroke="#ef4444" strokeWidth="3" />
          <path d={generateLogPath(base)} fill="none" stroke="#10b981" strokeWidth="3" />
          <circle cx={CX + pointX*UNIT} cy={CY - expY*UNIT} r="5" fill="#ef4444" />
        </svg>
      </div>
    </div>
  );
};

// 指数対数用のメインラッパー
const ExpLogVisualizer = () => {
  const [activeTab, setActiveTab] = useState<'basic' | 'ineq' | 'common'>('basic');
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex justify-between items-center">
        <h2 className="text-xl font-bold text-emerald-900">📈 指数・対数関数</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {['basic', 'ineq', 'common'].map((t: any) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-md text-sm font-bold ${activeTab === t ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </div>
      {activeTab === 'basic' && <BasicRelationTab />}
      <div className={activeTab !== 'basic' ? 'p-10 text-center bg-white rounded-2xl' : 'hidden'}>詳細はCode②のロジックに準拠</div>
    </div>
  );
};

// ==========================================
// 微分積分パーツ 3: 定積分
// ==========================================
const IntegralAreaTab = () => {
  const [a, setA] = useState<number>(-1);
  const [b, setB] = useState<number>(2);
  const [fP, setFP] = useState<number>(-1);
  const f = (x: number) => fP * x*x + 4;
  const fTex = formatPoly({c: fP, p: 2}, {c: 4, p: 0});

  const { integralValue } = useMemo(() => {
    const F = (x: number) => (fP/3)*Math.pow(x,3) + 4*x;
    return { integralValue: F(b) - F(a) };
  }, [a, b, fP]);

  const curvePath = useMemo(() => {
    let p = "";
    for(let x=-10; x<=10; x+=0.1) {
      const px = CX + x*UNIT_X; const py = CY - f(x)*UNIT_Y;
      p += p==="" ? `M ${px} ${py} ` : `L ${px} ${py} `;
    } return p;
  }, [fP]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full lg:w-[420px] shrink-0 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 space-y-5">
          <SliderRow label="積分区間 a" value={a} min={-4} max={4} step={0.1} onChange={setA} accentColor="accent-purple-500" textColor="text-purple-600" />
          <SliderRow label="積分区間 b" value={b} min={-4} max={4} step={0.1} onChange={setB} accentColor="accent-purple-500" textColor="text-purple-600" />
          <div className="bg-white p-5 rounded-xl border border-gray-200 text-center shadow-md">
            <BlockMath math={`\\int_{${a}}^{${b}} (${fTex}) dx = ${integralValue.toFixed(2)}`} />
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px] flex items-center justify-center">
        <svg viewBox="0 0 800 400" className="w-full h-full object-contain bg-slate-50">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />
          <path d={curvePath} fill="none" stroke="#9333ea" strokeWidth="3.5" />
          <line x1={CX + a*UNIT_X} y1={0} x2={CX + a*UNIT_X} y2={SVG_HEIGHT} stroke="#ec4899" strokeDasharray="4" />
          <line x1={CX + b*UNIT_X} y1={0} x2={CX + b*UNIT_X} y2={SVG_HEIGHT} stroke="#ec4899" strokeDasharray="4" />
        </svg>
      </div>
    </div>
  );
};

const CalculusVisualizer = () => {
  const [activeTab, setActiveTab] = useState<'limit' | 'graph' | 'integral'>('limit');
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-blue-900">📈 微分と積分</h2>
        <div className="flex bg-gray-100 p-1.5 rounded-xl overflow-x-auto w-full md:w-auto gap-1">
          {['limit', 'graph', 'integral'].map((t: any) => (
            <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-lg text-sm font-bold transition ${activeTab === t ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500'}`}>{t}</button>
          ))}
        </div>
      </div>
      {activeTab === 'limit' && <DerivativeLimitTab />}
      {activeTab === 'graph' && <FunctionGraphTab />}
      {activeTab === 'integral' && <IntegralAreaTab />}
    </div>
  );
};

// ==========================================
// メイン画面（統合エントリーポイント）
// ==========================================
export default function IntegratedMathApp() {
  const [category, setCategory] = useState<'trig' | 'explog' | 'calculus'>('trig');

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans p-4 md:p-6 pb-20">
      
      {/* マスターカテゴリー切り替え */}
      <div className="max-w-xl mx-auto mb-8 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 flex">
        <button 
          onClick={() => setCategory('trig')} 
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition ${category === 'trig' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📐 三角関数
        </button>
        <button 
          onClick={() => setCategory('explog')} 
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition ${category === 'explog' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📈 指数・対数
        </button>
        <button 
          onClick={() => setCategory('calculus')} 
          className={`flex-1 py-2.5 text-center text-sm font-bold rounded-lg transition ${category === 'calculus' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📝 微分・積分
        </button>
      </div>

      <div className={category === 'trig' ? 'block animate-fade-in' : 'hidden'}>
        <TrigVisualizer />
      </div>
      <div className={category === 'explog' ? 'block animate-fade-in' : 'hidden'}>
        <ExpLogVisualizer />
      </div>
      <div className={category === 'calculus' ? 'block animate-fade-in' : 'hidden'}>
        <CalculusVisualizer />
      </div>

    </div>
  );
}