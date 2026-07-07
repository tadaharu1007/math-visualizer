"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// ==========================================
// 共通設定・ヘルパー関数
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

// 小数を綺麗な分数に変換する関数（近似アルゴリズム付き・統合版）
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

// ==========================================
// 微分・積分用 ヘルパー関数
// ==========================================
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
    let x1 = intervals[i];
    let x2 = intervals[i+1];
    let y1 = f(x1), y2 = f(x2);
    if (Math.abs(y1) < 0.0001) { roots.push(x1); continue; }
    if (Math.abs(y2) < 0.0001) { roots.push(x2); continue; }
    if (y1 * y2 < 0) {
      for(let j=0; j<50; j++){
        let mid = (x1+x2)/2;
        let ymid = f(mid);
        if(Math.abs(ymid) < 0.0000001) { x1 = mid; break; }
        if(y1*ymid < 0) { x2 = mid; y2 = ymid; }
        else { x1 = mid; y1 = ymid; }
      }
      roots.push((x1+x2)/2);
    }
  }
  return Array.from(new Set(roots.map(r => Math.round(r*1000)/1000))).sort((a,b)=>a-b);
};

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
// 三角関数・指数・対数関数用 ヘルパー関数
// ==========================================
const generateExpPath = (base: number, alpha: number = 0, minX: number = -10, maxX: number = 10) => {
  let path = "";
  for (let x = minX; x <= maxX; x += 0.05) {
    const y = Math.pow(base, x - alpha);
    const px = CX + x * UNIT;
    const py = CY - y * UNIT;
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
    const px = CX + x * UNIT;
    const py = CY - y * UNIT;
    if (py < -100 || py > SVG_HEIGHT + 100) continue;
    if (path === "") path += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
    else path += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
  }
  return path;
};

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

const getExactValueTex = (deg: number, type: 'sin' | 'cos' | 'tan') => {
  const normalizedDeg = ((deg % 360) + 360) % 360; 
  const exactMap = {
    sin: { 0: "0", 30: "\\frac{1}{2}", 45: "\\frac{\\sqrt{2}}{2}", 60: "\\frac{\\sqrt{3}}{2}", 90: "1", 120: "\\frac{\\sqrt{3}}{2}", 135: "\\frac{\\sqrt{2}}{2}", 150: "\\frac{1}{2}", 180: "0", 210: "-\\frac{1}{2}", 225: "-\\frac{\\sqrt{2}}{2}", 240: "-\\frac{\\sqrt{3}}{2}", 270: "-1", 300: "-\\frac{\\sqrt{3}}{2}", 315: "-\\frac{\\sqrt{2}}{2}", 330: "-\\frac{1}{2}" },
    cos: { 0: "1", 30: "\\frac{\\sqrt{3}}{2}", 45: "\\frac{\\sqrt{2}}{2}", 60: "\\frac{1}{2}", 90: "0", 120: "-\\frac{1}{2}", 135: "-\\frac{\\sqrt{2}}{2}", 150: "-\\frac{\\sqrt{3}}{2}", 180: "-1", 210: "-\\frac{\\sqrt{3}}{2}", 225: "-\\frac{\\sqrt{2}}{2}", 240: "-\\frac{1}{2}", 270: "0", 300: "\\frac{1}{2}", 315: "\\frac{\\sqrt{2}}{2}", 330: "\\frac{\\sqrt{3}}{2}" },
    tan: { 0: "0", 30: "\\frac{1}{\\sqrt{3}}", 45: "1", 60: "\\sqrt{3}", 90: "\\text{なし}(\\infty)", 120: "-\\sqrt{3}", 135: "-1", 150: "-\\frac{1}{\\sqrt{3}}", 180: "0", 210: "\\frac{1}{\\sqrt{3}}", 225: "1", 240: "\\sqrt{3}", 270: "\\text{なし}(-\\infty)", 300: "-\\sqrt{3}", 315: "-1", 330: "-\\frac{1}{\\sqrt{3}}" }
  };
  return (exactMap[type] as Record<number, string>)[normalizedDeg] || null;
};

const describePie = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
  const startRad = (startDeg * Math.PI) / 180;
  const endRad = (endDeg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad); const y1 = cy - r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad); const y2 = cy - r * Math.sin(endRad);
  const largeArc = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2} Z`;
};

// ==========================================
// 【第1部】微積分ビジュアライザー
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
            <div>
              <p className="text-[10px] text-gray-500 font-bold mb-1">平均変化率 (割線 AB の傾き)</p>
              <div className="text-base text-red-600 font-bold overflow-x-auto text-center py-2 bg-white rounded border border-gray-100 shadow-sm min-h-[52px] flex items-center justify-center">
                <BlockMath math={`\\frac{f(a+h) - f(a)}{h} = ${getFractionTex(slopeSecant)} \\vphantom{\\frac{1}{2}}`} />
              </div>
            </div>
            {h === 0 ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-inner">
                <p className="text-[10px] text-blue-600 font-bold mb-1">微分係数 (接線の傾き)</p>
                <div className="text-base text-blue-700 font-bold overflow-x-auto min-h-[40px] flex items-center justify-center">
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
          <SvgMath x={CX + 150} y={40} width={100} height={30} math={`y = ${fTex}`} color="text-slate-600" />

          <path d={getLinePath(slopeTangent, a, fa)} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" opacity={h === 0 ? 1 : 0.4} />
          
          {h !== 0 && (
            <path d={getLinePath(slopeSecant, a, fa)} fill="none" stroke="#ef4444" strokeWidth="2" />
          )}

          <line x1={pAx} y1={CY + 100} x2={pAx} y2={pAy} stroke="#94a3b8" strokeDasharray="3" />
          <circle cx={pAx} cy={pAy} r="5" fill="#3b82f6" />
          <SvgMath x={pAx - 20} y={CY + 105} width={40} height={20} math="a" color="text-blue-600" />
          <SvgMath x={pAx - 35} y={pAy - 20} width={40} height={20} math="A" color="text-blue-600" />

          {h !== 0 && (
            <>
              <line x1={pBx} y1={CY + 100} x2={pBx} y2={pBy} stroke="#94a3b8" strokeDasharray="3" />
              <line x1={pAx} y1={pAy} x2={pBx} y2={pAy} stroke="#ef4444" strokeDasharray="3" opacity="0.6"/>
              <line x1={pBx} y1={pAy} x2={pBx} y2={pBy} stroke="#ef4444" strokeDasharray="3" opacity="0.6"/>
              
              <circle cx={pBx} cy={pBy} r="5" fill="#ef4444" />
              <SvgMath x={pBx - 20} y={CY + 105} width={40} height={20} math="a+h" color="text-red-500" />
              <SvgMath x={pBx + 5} y={pBy - 20} width={40} height={20} math="B" color="text-red-500" />
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

  const roots = useMemo(() => {
    return getRoots3(4*c4, 3*c3, 2*c2, c1);
  }, [c4, c3, c2, c1]);

  const testPoints = useMemo(() => {
    const pts = [];
    if (roots.length === 0) {
      pts.push(0);
    } else {
      pts.push(roots[0] - 1);
      for(let i=0; i<roots.length-1; i++) pts.push((roots[i]+roots[i+1])/2);
      pts.push(roots[roots.length-1] + 1);
    }
    return pts;
  }, [roots]);

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
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2">最高次数を選択</h3>
            <div className="flex bg-gray-100 p-1.5 rounded-xl gap-1">
              {[2, 3, 4].map(d => (
                <button 
                  key={d} 
                  onClick={() => { setDegree(d as any); if(d<4) setC4(0); if(d<3) setC3(0); }} 
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition shadow-sm ${degree === d ? 'bg-white text-emerald-700 border border-emerald-100' : 'text-gray-500 hover:bg-gray-200/50'}`}
                >
                  {d}次関数
                </button>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl shadow-inner text-center border border-emerald-200">
            <p className="text-[10px] text-emerald-700 font-bold mb-1">現在の関数</p>
            <div className="text-emerald-900 overflow-x-auto text-base font-bold bg-white rounded shadow-sm min-h-[48px] flex items-center justify-center">
              <BlockMath math={`f(x) = ${fTex} \\vphantom{\\frac{1}{2}}`} />
            </div>
            <div className="text-rose-600 overflow-x-auto text-base mt-2 border-t border-emerald-200 font-bold min-h-[48px] flex items-center justify-center">
              <BlockMath math={`f'(x) = ${dfTex} \\vphantom{\\frac{1}{2}}`} />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {degree >= 4 && <SliderRow label="x⁴ の係数" value={c4} min={-3} max={3} step={0.1} onChange={setC4} accentColor="accent-emerald-500" textColor="text-emerald-600" />}
            {degree >= 3 && <SliderRow label="x³ の係数" value={c3} min={-3} max={3} step={0.1} onChange={setC3} accentColor="accent-emerald-500" textColor="text-emerald-600" />}
            <SliderRow label="x² の係数" value={c2} min={-3} max={3} step={0.1} onChange={setC2} accentColor="accent-emerald-500" textColor="text-emerald-600" />
            <SliderRow label="x の係数" value={c1} min={-5} max={5} step={0.1} onChange={setC1} accentColor="accent-emerald-500" textColor="text-emerald-600" />
            <SliderRow label="定数項" value={c0} min={-5} max={5} step={0.1} onChange={setC0} accentColor="accent-emerald-500" textColor="text-emerald-600" />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-3">📊 増減表</h3>
            {roots.length > 0 ? (
              <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm p-1">
                <table className="w-full text-center text-sm border-collapse text-gray-800">
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-1.5 bg-gray-50 font-bold text-gray-600"><InlineMath math="x" /></td>
                      <td className="border border-gray-200 p-1.5">...</td>
                      {roots.map((r, i) => (
                        <React.Fragment key={`x-${i}`}>
                          <td className="border border-gray-200 p-1.5 text-blue-600 font-bold">{getFractionTex(r)}</td>
                          <td className="border border-gray-200 p-1.5">...</td>
                        </React.Fragment>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-1.5 bg-gray-50 font-bold text-gray-600"><InlineMath math="f'(x)" /></td>
                      <td className="border border-gray-200 p-1.5 text-rose-500 font-bold">{df(testPoints[0]) > 0.01 ? '+' : (df(testPoints[0]) < -0.01 ? '-' : '0')}</td>
                      {roots.map((r, i) => (
                        <React.Fragment key={`df-${i}`}>
                          <td className="border border-gray-200 p-1.5 text-rose-500 font-extrabold">0</td>
                          <td className="border border-gray-200 p-1.5 text-rose-500 font-bold">{df(testPoints[i+1]) > 0.01 ? '+' : (df(testPoints[i+1]) < -0.01 ? '-' : '0')}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-1.5 bg-gray-50 font-bold text-gray-600"><InlineMath math="f(x)" /></td>
                      <td className="border border-gray-200 p-1.5 font-bold text-gray-500">{df(testPoints[0]) > 0.01 ? '↗' : (df(testPoints[0]) < -0.01 ? '↘' : '→')}</td>
                      {roots.map((r, i) => {
                        const isExtremum = df(testPoints[i]) * df(testPoints[i+1]) < -0.001; 
                        return (
                        <React.Fragment key={`f-${i}`}>
                          <td className={`border border-gray-200 p-1.5 font-bold text-xs ${isExtremum ? 'bg-emerald-50 text-emerald-700 shadow-inner' : 'text-gray-400'}`}>{isExtremum ? '極値' : '変曲'}</td>
                          <td className="border border-gray-200 p-1.5 font-bold text-gray-500">{df(testPoints[i+1]) > 0.01 ? '↗' : (df(testPoints[i+1]) < -0.01 ? '↘' : '→')}</td>
                        </React.Fragment>
                      )})}
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 text-center shadow-sm">
                極値をもたない（単調増加・単調減少）ため<br/>増減表を省略しています
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px] flex items-center justify-center p-4">
        <div className="absolute top-4 left-4 z-10 space-y-2">
          <div className="font-bold text-gray-700 bg-white/90 px-4 py-1.5 rounded-full text-sm border border-gray-200 shadow-sm flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span> <InlineMath math="y = f(x)" />
          </div>
          <div className="font-bold text-gray-700 bg-white/90 px-4 py-1.5 rounded-full text-sm border border-gray-200 shadow-sm flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500"></span> <InlineMath math="y = f'(x)" /> <span className="text-xs text-gray-400 font-normal">(導関数)</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-full max-h-[500px] object-contain">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />

          {roots.map((r, idx) => {
            const rx = CX + r * UNIT_X;
            return (
              <g key={`root-${idx}`}>
                <line x1={rx} y1={0} x2={rx} y2={SVG_HEIGHT} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4" opacity="0.5"/>
                <circle cx={rx} cy={CY - f(r)*UY} r="6" fill="#10b981" />
                <circle cx={rx} cy={CY} r="5" fill="#f43f5e" />
              </g>
            );
          })}

          <path d={curvePathF} fill="none" stroke="#10b981" strokeWidth="3.5" />
          <path d={curvePathDF} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="5" />
        </svg>
      </div>
    </div>
  );
};

const IntegralAreaTab = () => {
  const [mode, setMode] = useState<'single' | 'double'>('double');
  const [a, setA] = useState<number>(-1);
  const [b, setB] = useState<number>(2);

  const [fP, setFP] = useState<number>(-1);
  const [fQ, setFQ] = useState<number>(0);
  const [fR, setFR] = useState<number>(4);

  const [gP, setGP] = useState<number>(1);
  const [gQ, setGQ] = useState<number>(-2);
  const [gR, setGR] = useState<number>(0);

  const f = (x: number) => fP * x*x + fQ * x + fR;
  const g = (x: number) => gP * x*x + gQ * x + gR;

  const fTex = formatPoly({c: fP, p: 2}, {c: fQ, p: 1}, {c: fR, p: 0});
  const gTex = formatPoly({c: gP, p: 2}, {c: gQ, p: 1}, {c: gR, p: 0});
  
  const effGP = mode === 'single' ? 0 : gP;
  const effGQ = mode === 'single' ? 0 : gQ;
  const effGR = mode === 'single' ? 0 : gR;
  const fgTex = formatPoly({c: fP - effGP, p: 2}, {c: fQ - effGQ, p: 1}, {c: fR - effGR, p: 0});

  const { purpleArea, redArea, integralValue } = useMemo(() => {
    let pArea = 0;
    let rArea = 0;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    
    const hRoots = getRoots2(fP - effGP, fQ - effGQ, fR - effGR);
    const pts = [start, ...hRoots.filter(r => r > start && r < end).sort((x,y)=>x-y), end];

    const F_h = (x: number) => ((fP-effGP)/3)*Math.pow(x,3) + ((fQ-effGQ)/2)*Math.pow(x,2) + (fR-effGR)*x;

    for(let i=0; i<pts.length-1; i++){
      const v = F_h(pts[i+1]) - F_h(pts[i]); 
      const contrib = (a <= b) ? v : -v; 
      if(contrib >= 0) pArea += contrib;
      else rArea += Math.abs(contrib);
    }
    return { purpleArea: pArea, redArea: rArea, integralValue: pArea - rArea };
  }, [a, b, mode, fP, fQ, fR, gP, gQ, gR, effGP, effGQ, effGR]);

  const shadeElements = useMemo(() => {
    const elements = [];
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    const step = 0.02;
    
    for (let x = start; x <= end; x += step) {
      const y1 = mode === 'single' ? 0 : g(x);
      const y2 = f(x);
      
      let isPositiveContribution = y2 >= y1;
      if (a > b) isPositiveContribution = !isPositiveContribution;

      const strokeColor = isPositiveContribution ? "rgba(147, 51, 234, 0.4)" : "rgba(239, 68, 68, 0.4)";
      
      elements.push(
        <line 
          key={x.toFixed(3)} 
          x1={CX + x*UNIT_X} 
          y1={CY - y1*UNIT_Y} 
          x2={CX + x*UNIT_X} 
          y2={CY - y2*UNIT_Y} 
          stroke={strokeColor} 
          strokeWidth="1.5" 
        />
      );
    }
    return elements;
  }, [a, b, mode, fP, fQ, fR, gP, gQ, gR]);

  const fPath = useMemo(() => {
    let p = "";
    for(let x=-10; x<=10; x+=0.1) {
      const px = CX + x*UNIT_X; const py = CY - f(x)*UNIT_Y;
      p += p==="" ? `M ${px} ${py} ` : `L ${px} ${py} `;
    } return p;
  }, [fP, fQ, fR]);

  const gPath = useMemo(() => {
    let p = "";
    for(let x=-10; x<=10; x+=0.1) {
      const px = CX + x*UNIT_X; const py = CY - g(x)*UNIT_Y;
      p += p==="" ? `M ${px} ${py} ` : `L ${px} ${py} `;
    } return p;
  }, [gP, gQ, gR]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full lg:w-[420px] shrink-0 space-y-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-purple-100 space-y-5">
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-3">対象のグラフ設定</h3>
            <div className="flex bg-gray-100 p-1.5 rounded-xl mb-4 gap-1">
              <button onClick={() => setMode('single')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition shadow-sm ${mode === 'single' ? 'bg-white text-purple-700 border border-purple-100' : 'text-gray-500 hover:bg-gray-200/50'}`}>x軸との面積</button>
              <button onClick={() => setMode('double')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition shadow-sm ${mode === 'double' ? 'bg-white text-purple-700 border border-purple-100' : 'text-gray-500 hover:bg-gray-200/50'}`}>2曲線間の面積</button>
            </div>

            <div className="space-y-2 bg-purple-50/70 p-4 rounded-xl border border-purple-100 mb-4 shadow-inner">
              <div className="text-xs font-bold text-purple-800 bg-white inline-block px-2 py-1 rounded shadow-sm">
                関数 <InlineMath math={`\\textcolor{#9333ea}{f(x)}=${fTex}`} />
              </div>
              <div className="flex gap-2 pt-2">
                <input type="number" step="0.1" value={fP} onChange={(e) => setFP(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none" placeholder="x²" title="x²の係数" />
                <input type="number" step="0.1" value={fQ} onChange={(e) => setFQ(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none" placeholder="x" title="xの係数" />
                <input type="number" step="0.1" value={fR} onChange={(e) => setFR(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none" placeholder="定数" title="定数項" />
              </div>
            </div>

            {mode === 'double' && (
              <div className="space-y-2 bg-blue-50/70 p-4 rounded-xl border border-blue-100 mb-4 shadow-inner">
                <div className="text-xs font-bold text-blue-800 bg-white inline-block px-2 py-1 rounded shadow-sm">
                  関数 <InlineMath math={`\\textcolor{#2563eb}{g(x)}=${gTex}`} />
                </div>
                <div className="flex gap-2 pt-2">
                  <input type="number" step="0.1" value={gP} onChange={(e) => setGP(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="x²" title="x²の係数" />
                  <input type="number" step="0.1" value={gQ} onChange={(e) => setGQ(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="x" title="xの係数" />
                  <input type="number" step="0.1" value={gR} onChange={(e) => setGR(Number(e.target.value))} className="w-1/3 p-2 border border-gray-300 rounded-md text-sm text-center text-gray-900 bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="定数" title="定数項" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <SliderRow label="積分区間 下端 (a)" value={a} min={-4} max={4} step={0.1} onChange={setA} accentColor="accent-purple-500" textColor="text-purple-600" />
            <SliderRow label="積分区間 上端 (b)" value={b} min={-4} max={4} step={0.1} onChange={setB} accentColor="accent-purple-500" textColor="text-purple-600" />
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 text-center space-y-3 shadow-md mt-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">定積分の計算過程</p>
            
            <div className="text-base text-gray-800 font-bold overflow-x-auto py-2 flex flex-col items-center gap-3">
              {mode === 'double' && (
                <BlockMath math={`\\int_{${getFractionTex(a)}}^{${getFractionTex(b)}} \\{ \\textcolor{#9333ea}{f(x)} - \\textcolor{#2563eb}{g(x)} \\} dx`} />
              )}
              <BlockMath math={`= \\int_{${getFractionTex(a)}}^{${getFractionTex(b)}} (${fgTex}) dx \\vphantom{\\frac{1}{2}}`} />
            </div>

            <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex flex-col items-center gap-2">
              <BlockMath math={`= \\textcolor{#9333ea}{(\\text{紫の面積})} - \\textcolor{#ef4444}{(\\text{赤の面積})} \\vphantom{\\frac{1}{2}}`} />
              <BlockMath math={`= \\textcolor{#9333ea}{${getFractionTex(purpleArea)}} - \\textcolor{#ef4444}{${getFractionTex(redArea)}} \\vphantom{\\frac{1}{2}}`} />
            </div>

            <div className="text-3xl text-purple-700 font-extrabold border-t border-gray-100 pt-4 pb-2">
              <InlineMath math={`= ${getFractionTex(integralValue)}`} />
            </div>
            
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[400px] flex items-center justify-center p-4">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full h-full max-h-[500px] object-contain">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#cbd5e1" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />

          {/* Area Shade */}
          <g>{shadeElements}</g>

          <path d={fPath} fill="none" stroke="#9333ea" strokeWidth="3.5" />
          
          {mode === 'double' && (
            <path d={gPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          )}

          <line x1={CX + a*UNIT_X} y1={0} x2={CX + a*UNIT_X} y2={SVG_HEIGHT} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4" opacity="0.6"/>
          <SvgMath x={CX + a*UNIT_X - 25} y={CY + 15} width={50} height={25} math="x = a" color="text-pink-600 bg-white/80 rounded" />
          
          <line x1={CX + b*UNIT_X} y1={0} x2={CX + b*UNIT_X} y2={SVG_HEIGHT} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="4" opacity="0.6"/>
          <SvgMath x={CX + b*UNIT_X - 25} y={CY + 15} width={50} height={25} math="x = b" color="text-pink-600 bg-white/80 rounded" />
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
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('limit')} 
            className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'limit' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            1. 微分係数と接線
          </button>
          <button 
            onClick={() => setActiveTab('graph')} 
            className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'graph' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            2. 導関数とグラフ
          </button>
          <button 
            onClick={() => setActiveTab('integral')} 
            className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'integral' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            3. 定積分と面積
          </button>
        </div>
      </div>

      <div className={activeTab === 'limit' ? 'block' : 'hidden'}>
        <DerivativeLimitTab />
      </div>
      <div className={activeTab === 'graph' ? 'block' : 'hidden'}>
        <FunctionGraphTab />
      </div>
      <div className={activeTab === 'integral' ? 'block' : 'hidden'}>
        <IntegralAreaTab />
      </div>
    </div>
  );
};


// ==========================================
// 【第2部】三角関数ビジュアライザー
// ==========================================
const presetAngles = [-180, -90, -45, 0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const sinCosPresets = [{ val: 1, tex: "1" }, { val: 0.866, tex: "\\frac{\\sqrt{3}}{2}" }, { val: 0.707, tex: "\\frac{\\sqrt{2}}{2}" }, { val: 0.5, tex: "\\frac{1}{2}" }, { val: 0, tex: "0" }, { val: -0.5, tex: "-\\frac{1}{2}" }, { val: -0.707, tex: "-\\frac{\\sqrt{2}}{2}" }, { val: -0.866, tex: "-\\frac{\\sqrt{3}}{2}" }, { val: -1, tex: "-1" }];
const tanPresets = [{ val: 1.732, tex: "\\sqrt{3}" }, { val: 1, tex: "1" }, { val: 0.577, tex: "\\frac{1}{\\sqrt{3}}" }, { val: 0, tex: "0" }, { val: -0.577, tex: "-\\frac{1}{\\sqrt{3}}" }, { val: -1, tex: "-1" }, { val: -1.732, tex: "-\\sqrt{3}" }];
const synPresets = [{ a: 1, b: 1, tex: "(1, 1)" }, { a: 1, b: 1.732, tex: "(1, \\sqrt{3})" }, { a: 1.732, b: 1, tex: "(\\sqrt{3}, 1)" }, { a: 1, b: -1, tex: "(1, -1)" }, { a: -1, b: 1.732, tex: "(-1, \\sqrt{3})" }];

const TrigGraphSet = ({ type, angle, minRange, maxRange }: { type: 'sin' | 'cos' | 'tan', angle: number, minRange: number, maxRange: number }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 240;
  const cx = 150; const cy = 120; const r = 80;
  const graphStartX = 350; const graphWidth = 400; const graphAxisY = 120;

  const currentRad = (angle * Math.PI) / 180;
  const px = cx + r * Math.cos(currentRad); const py = cy - r * Math.sin(currentRad);
  const sinVal = Math.sin(currentRad); const cosVal = Math.cos(currentRad); const tanVal = Math.tan(currentRad);
  const clampedTanVal = Math.max(-5, Math.min(5, tanVal)); const tanTargetY = cy - r * clampedTanVal;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';
  const title = type === 'sin' ? 'y = \\sin\\theta' : type === 'cos' ? 'y = \\cos\\theta' : 'y = \\tan\\theta';
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
      <div className="absolute top-4 left-4 font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full text-sm border border-gray-200 shadow-sm z-10 flex items-center gap-1.5">
        <span style={{ color }}>●</span> <InlineMath math={title} />
      </div>
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
        <SvgMath x={graphStartX - 35} y={graphAxisY - r - 15} width={30} height={30} math="1" justify="end" color="text-gray-400" />
        <SvgMath x={graphStartX - 35} y={graphAxisY + r - 15} width={30} height={30} math="-1" justify="end" color="text-gray-400" />
        {specialPoints.map((pt, idx) => (
          <g key={`special-${idx}`}>
            {pt.isAsymptote ? (
              <><line x1={pt.x} y1={20} x2={pt.x} y2={SVG_HEIGHT - 20} stroke={color} strokeWidth="1.5" strokeDasharray="4" opacity="0.4" />
              <SvgMath x={pt.x - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(pt.deg)} color="text-gray-500" /></>
            ) : (
              <><circle cx={pt.x} cy={pt.y} r="3" fill="#94a3b8" />{pt.y !== graphAxisY && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={graphAxisY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2" />}
              <SvgMath x={pt.x - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(pt.deg)} color="text-gray-500" /></>
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

const TransformGraphSet = ({ type, a, b, c, dParam, minRange, maxRange }: { type: 'sin' | 'cos' | 'tan', a: number, b: number, c: number, dParam: number, minRange: number, maxRange: number }) => {
  const SVG_WIDTH = 800; const SVG_HEIGHT = 360;
  const graphStartX = 40; const graphWidth = 720; const graphAxisY = 180; const r = 50;
  const color = type === 'sin' ? '#ef4444' : type === 'cos' ? '#3b82f6' : '#10b981';

  const maxVal = dParam + Math.abs(a); const minVal = dParam - Math.abs(a);
  const maxGraphY = graphAxisY - r * maxVal; const minGraphY = graphAxisY - r * minVal;
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
      let isJump = false; if (type === 'tan') { if (prevVal !== null && baseVal < prevVal) isJump = true; }
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
            <SvgMath x={clampedYAxisX - 35} y={graphAxisY - r * v - 15} width={30} height={30} math={v.toString()} justify="end" color="text-gray-400" />
          </g>
        ))}
        <line x1={graphStartX - 20} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#94a3b8" strokeWidth="2" />
        <line x1={yAxisX} y1={20} x2={yAxisX} y2={SVG_HEIGHT - 20} stroke="#94a3b8" strokeWidth="2" />
        
        {type !== 'tan' && (
          <g>
            <line x1={graphStartX - 10} y1={maxGraphY} x2={graphStartX + graphWidth + 20} y2={maxGraphY} stroke={color} strokeWidth="1" strokeDasharray="4" opacity="0.6"/>
            <SvgMath x={graphStartX - 45} y={maxGraphY - 15} width={40} height={30} math={getFractionTex(maxVal)} justify="end" color="text-gray-600" />
            
            <line x1={graphStartX - 10} y1={minGraphY} x2={graphStartX + graphWidth + 20} y2={minGraphY} stroke={color} strokeWidth="1" strokeDasharray="4" opacity="0.6"/>
            <SvgMath x={graphStartX - 45} y={minGraphY - 15} width={40} height={30} math={getFractionTex(minVal)} justify="end" color="text-gray-600" />
          </g>
        )}

        {axisPoints.map((pt, idx) => (
          <g key={`axis-${idx}`}>
            <circle cx={pt.x} cy={graphAxisY} r="2" fill="#64748b" />
            <SvgMath x={pt.x - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(pt.deg)} color="text-gray-500" />
          </g>
        ))}
        <path d={baseCurvePath} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4" />
        <path d={transformCurvePath} fill="none" stroke={color} strokeWidth="3" />

        {0 >= minRange && 0 <= maxRange && (
          <g className="opacity-80">
            <circle cx={startGraphX} cy={startGraphY} r="4" fill="#ec4899" />
            <line x1={startGraphX} y1={graphAxisY} x2={startGraphX} y2={startGraphY} stroke="#ec4899" strokeWidth="1.5" strokeDasharray="2" />
            <SvgMath x={startGraphX - 25} y={startGraphY < graphAxisY ? startGraphY - 20 : startGraphY + 5} width={50} height={30} math="\theta=0" color="text-pink-600" />
          </g>
        )}
      </svg>
    </div>
  );
};

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

  const exactKLabel = useMemo(() => {
    const arr = type === 'tan' ? tanPresets : sinCosPresets;
    const match = arr.find(p => Math.abs(p.val - kValue) < 0.01);
    return match ? match.tex : kValue.toFixed(2);
  }, [kValue, type]);

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
            <SvgMath x={startCX + (startCX > cx ? 4 : -44)} y={startCY + (startCY > cy ? 4 : -34)} width={40} height={30} math="\theta=0" color="text-pink-600" />
          </g>
        )}

        <line x1={graphStartX - 10} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={graphStartX} y1={graphAxisY - r - 20} x2={graphStartX} y2={graphAxisY + r + 20} stroke="#cbd5e1" strokeWidth="2" />
        
        <SvgMath x={graphStartX - 35} y={graphAxisY - r - 15} width={30} height={30} math="1" justify="end" color="text-gray-400" />
        <SvgMath x={graphStartX - 35} y={graphAxisY + r - 15} width={30} height={30} math="-1" justify="end" color="text-gray-400" />

        {specialPoints.map((pt, idx) => (
          <g key={`eq-special-${idx}`}>
            {pt.isAsymptote ? (
              <><line x1={pt.x} y1={20} x2={pt.x} y2={SVG_HEIGHT - 20} stroke={color} strokeWidth="1.5" strokeDasharray="4" opacity="0.4" />
              <SvgMath x={pt.x - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(pt.deg)} color="text-gray-500" /></>
            ) : (
              <><circle cx={pt.x} cy={pt.y} r="3" fill="#94a3b8" />{pt.y !== graphAxisY && <line x1={pt.x} y1={pt.y} x2={pt.x} y2={graphAxisY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2" />}
              <SvgMath x={pt.x - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(pt.deg)} color="text-gray-500" /></>
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
          const shiftText = alpha > 0 ? `+${getRadianTex(alpha)}` : getRadianTex(alpha);
          const midDeg = baseDeg + alpha / 2;
          const shiftTextX = cx + (r + 16) * Math.cos(midDeg * Math.PI / 180); const shiftTextY = cy - (r + 16) * Math.sin(midDeg * Math.PI / 180);

          return (
            <g key={`solution-${idx}`}>
              {isActiveShifted && alpha !== 0 && <line x1={cx} y1={cy} x2={ghostCX} y2={ghostCY} stroke={arrowColor} strokeWidth="1.2" strokeDasharray="3" opacity="0.4" />}
              <line x1={cx} y1={cy} x2={activeCX} y2={activeCY} stroke="#d97706" strokeWidth="2.5" />
              <circle cx={activeCX} cy={activeCY} r="5" fill="#d97706" />
              <SvgMath x={activeCX + (activeCX > cx ? 4 : -44)} y={activeCY + (activeCY > cy ? 4 : -34)} width={40} height={30} math={getRadianTex(activeDeg)} color="text-amber-700" />

              {activeDeg >= minRange && activeDeg <= maxRange && (
                <><circle cx={activeGraphX} cy={kGraphY} r="5" fill="#d97706" /><line x1={activeGraphX} y1={graphAxisY} x2={activeGraphX} y2={kGraphY} stroke="#d97706" strokeWidth="1.2" strokeDasharray="2" />
                <SvgMath x={activeGraphX - 20} y={graphAxisY + 5} width={40} height={30} math={getRadianTex(activeDeg)} color="text-amber-700" /></>
              )}

              {alpha !== 0 && (
                <g className="opacity-90">
                  {viewMode === 'theta' ? (
                    <><circle cx={ghostCX} cy={ghostCY} r="4" fill="none" stroke={arrowColor} strokeWidth="1.5" strokeDasharray="2" opacity="0.5" /><path d={arcPath} fill="none" stroke={arrowColor} strokeWidth="2" markerEnd="url(#shift-arrow)" />
                    <SvgMath x={shiftTextX - 20} y={shiftTextY - 15} width={40} height={30} math={shiftText} color="text-purple-600" /></>
                  ) : (
                    <>{activeDeg >= minRange && activeDeg <= maxRange && deg >= minRange && deg <= maxRange && (
                        <><circle cx={ghostGraphX} cy={kGraphY} r="4" fill="none" stroke={arrowColor} strokeWidth="1.5" strokeDasharray="2" /><line x1={activeGraphX} y1={kGraphY} x2={ghostGraphX} y2={kGraphY} stroke={arrowColor} strokeWidth="2" markerEnd="url(#shift-arrow)" />
                        <SvgMath x={(activeGraphX + ghostGraphX) / 2 - 20} y={kGraphY - 25} width={40} height={30} math={shiftText} color="text-purple-600" />
                        <line x1={ghostGraphX} y1={kGraphY} x2={ghostGraphX} y2={graphAxisY} stroke={arrowColor} strokeWidth="1" strokeDasharray="2" />
                        <SvgMath x={ghostGraphX - 30} y={graphAxisY + 20} width={60} height={30} math={`\\theta=${getRadianTex(deg)}`} color="text-purple-600" /></>
                    )}</>
                  )}
                </g>
              )}
            </g>
          );
        })}
        <SvgMath x={graphStartX - 50} y={kGraphY - 15} width={40} height={30} math={exactKLabel} justify="end" color="text-amber-600" />
      </svg>
    </div>
  );
};

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
      <div className="absolute top-4 left-4 font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full text-sm border border-gray-200 shadow-sm z-10 flex items-center gap-1.5">
        <span style={{ color: '#8b5cf6' }}>●</span> <InlineMath math="y = a\sin\theta + b\cos\theta" />
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
        
        <SvgMath x={(cx + px)/2 - 10} y={cy + (b > 0 ? 5 : -25)} width={20} height={20} math="a" color="text-red-500" />
        <SvgMath x={px + (a > 0 ? 5 : -25)} y={(cy + py)/2 - 10} width={20} height={20} math="b" color="text-blue-500" />
        
        {R > 0 && (
          <path d={`M ${cx + 20} ${cy} A 20 20 0 0 ${alphaRad > 0 ? 0 : 1} ${cx + 20 * Math.cos(alphaRad)} ${cy - 20 * Math.sin(alphaRad)}`} fill="none" stroke="#8b5cf6" strokeWidth="2" />
        )}
        <SvgMath x={cx + 35 * Math.cos(alphaRad/2) - 10} y={cy - 35 * Math.sin(alphaRad/2) - 15} width={20} height={30} math="\alpha" color="text-purple-600" />

        <line x1={graphStartX - 10} y1={graphAxisY} x2={graphStartX + graphWidth + 20} y2={graphAxisY} stroke="#cbd5e1" strokeWidth="2" />
        <line x1={graphStartX} y1={graphAxisY - 4 * unit} x2={graphStartX} y2={graphAxisY + 4 * unit} stroke="#cbd5e1" strokeWidth="2" />
        {[-4, -2, 2, 4].map(v => (
          <text key={`gy-${v}`} x={graphStartX - 6} y={graphAxisY - v * unit + 3} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">{v}</text>
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

const TrigVisualizer = () => {
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

  const baseSolutions = useMemo(() => {
    if (eqType !== 'tan' && (kValue > 1 || kValue < -1)) return [];
    const angles: number[] = [];
    const baseRad = eqType === 'tan' ? Math.atan(kValue) : (eqType === 'sin' ? Math.asin(kValue) : Math.acos(kValue));
    let degX1 = Math.round((baseRad * 180) / Math.PI);
    
    if (eqType === 'tan') {
      degX1 = (degX1 + 180) % 180;
      angles.push(degX1 + paramAlpha);
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
          let simplified = `\\sqrt{${R2_int}}`;
          for (let i = 4; i >= 2; i--) {
            if (R2_int % (i * i) === 0) {
              simplified = `${i === 1 ? '' : i}\\sqrt{${R2_int / (i * i)}}`;
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
      {v: 0, s: "0"}, {v: 1/6, s: "\\frac{\\pi}{6}"}, {v: 1/4, s: "\\frac{\\pi}{4}"}, {v: 1/3, s: "\\frac{\\pi}{3}"}, {v: 1/2, s: "\\frac{\\pi}{2}"},
      {v: 2/3, s: "\\frac{2\\pi}{3}"}, {v: 3/4, s: "\\frac{3\\pi}{4}"}, {v: 5/6, s: "\\frac{5\\pi}{6}"}, {v: 1, s: "\\pi"},
      {v: -1/6, s: "-\\frac{\\pi}{6}"}, {v: -1/4, s: "-\\frac{\\pi}{4}"}, {v: -1/3, s: "-\\frac{\\pi}{3}"}, {v: -1/2, s: "-\\frac{\\pi}{2}"},
      {v: -2/3, s: "-\\frac{2\\pi}{3}"}, {v: -3/4, s: "-\\frac{3\\pi}{4}"}, {v: -5/6, s: "-\\frac{5\\pi}{6}"}, {v: -1, s: "-\\pi"}
    ];
    let alphaStr = alphaRad.toFixed(2);
    for (let f of fractions) {
      if (Math.abs(alphaPi - f.v) < 0.02) { alphaStr = f.s; break; }
    }

    return { exactSynR: rStr, exactSynAlpha: alphaStr };
  }, [synA, synB]);

  const transformEqTex = useMemo(() => {
    let tex = `y = `;
    if (paramA !== 1) tex += (paramA === -1 ? "-" : getFractionTex(paramA));
    tex += `\\${transformType}`;
    let inner = ``;
    if (paramB !== 1) inner += getFractionTex(paramB);
    let thetaPart = `\\theta`;
    if (paramC !== 0) {
      const sign = paramC > 0 ? "-" : "+";
      thetaPart = `(\\theta ${sign} ${getRadianTex(Math.abs(paramC))})`;
    }
    if (paramB !== 1 && paramC !== 0) inner += thetaPart;
    else if (paramB !== 1 && paramC === 0) inner += `\\theta`;
    else if (paramB === 1 && paramC !== 0) inner += `\\theta ${paramC > 0 ? "-" : "+"} ${getRadianTex(Math.abs(paramC))}`;
    else inner += `\\theta`;
    if (paramB !== 1 || paramC !== 0) tex += `(${inner})`; else tex += ` \\theta`;
    if (paramD !== 0) tex += ` ${paramD > 0 ? "+" : "-"} ${getFractionTex(Math.abs(paramD))}`;
    return tex;
  }, [transformType, paramA, paramB, paramC, paramD]);

  const solvingEqTex = useMemo(() => {
    let tex = `\\${eqType}`;
    if (paramAlpha !== 0) {
      tex += `(\\theta ${paramAlpha > 0 ? "-" : "+"} ${getRadianTex(Math.abs(paramAlpha))})`;
    } else {
      tex += `\\theta`;
    }
    const modeStr = eqMode === '>=' ? '\\geqq' : eqMode === '<=' ? '\\leqq' : '=';
    const match = currentKPresets.find(p => Math.abs(p.val - kValue) < 0.01);
    const kTex = match ? match.tex : kValue.toFixed(2);
    return `${tex} ${modeStr} ${kTex}`;
  }, [eqType, eqMode, kValue, paramAlpha, currentKPresets]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-blue-900">📐 三角関数</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
          <button onClick={() => { setActiveTab('basic'); setMinRange(0); setMaxRange(360); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'basic' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>1. 基本</button>
          <button onClick={() => { setActiveTab('transform'); setMinRange(-180); setMaxRange(540); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'transform' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>2. 変形</button>
          <button onClick={() => { setActiveTab('equation'); setMinRange(0); setMaxRange(360); setDomainPreset("0,360"); setParamAlpha(0); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'equation' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>3. 方程式・不等式</button>
          <button onClick={() => { setActiveTab('synthesis'); setMinRange(0); setMaxRange(360); }} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'synthesis' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>4. 合成</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-80 md:sticky md:top-6 md:shrink-0 space-y-4">
          <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
            <div className="bg-white p-5 rounded-2xl shadow-md border border-blue-100 space-y-5 animate-fade-in">
              <div>
                <h2 className="text-sm font-bold text-gray-500 mb-1">角度操作 (<InlineMath math="\theta" />)</h2>
                <div className="text-2xl font-extrabold text-blue-600 mb-2 flex items-center gap-2">
                  {angle}° / <InlineMath math={`${getRadianTex(angle)} \\text{ rad}`} />
                </div>
                <input type="range" min={minRange} max={maxRange} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                {presetAngles.map((preset) => (
                  <button key={preset} onClick={() => setAngle(preset)} className={`px-2 py-1 rounded text-[11px] font-medium transition ${angle === preset ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}><InlineMath math={getRadianTex(preset)} /></button>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 mb-2">👁️ 表示する関数</h3>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showSin} onChange={(e) => setShowSin(e.target.checked)} className="accent-red-500" /><span className="text-xs font-bold text-red-600 font-mono">sin</span></label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showCos} onChange={(e) => setShowCos(e.target.checked)} className="accent-blue-500" /><span className="text-xs font-bold text-blue-600 font-mono">cos</span></label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={showTan} onChange={(e) => setShowTan(e.target.checked)} className="accent-emerald-500" /><span className="text-xs font-bold text-emerald-600 font-mono">tan</span></label>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 mb-1.5">⚙️ グラフの定義域</h3>
                <select value={domainPreset} onChange={(e) => { setDomainPreset(e.target.value); if (e.target.value !== "custom") { const [min, max] = e.target.value.split(','); setMinRange(Number(min)); setMaxRange(Number(max)); } }} className="w-full p-1.5 border border-blue-200 rounded text-xs text-gray-700 outline-none">
                  <option value="0,360">0° 〜 360° (1周)</option>
                  <option value="-180,180">-180° 〜 180°</option>
                  <option value="-360,360">-360° 〜 360° (2周)</option>
                </select>
              </div>
            </div>
          </div>

          <div className={activeTab === 'transform' ? 'block' : 'hidden'}>
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
                  <div className="flex justify-between items-center mb-1 flex-wrap"><span className="font-bold text-teal-900 flex items-center gap-1">c (θ軸移動) = <InlineMath math={getRadianTex(paramC)} /></span></div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {[-180, -90, -45, 0, 45, 90, 180].map(v => (
                      <button key={v} onClick={() => setParamC(v)} className={`text-[10px] px-1.5 py-0.5 rounded border ${paramC === v ? 'bg-teal-600 text-white border-teal-700 font-bold' : 'bg-white text-gray-600'}`}><InlineMath math={getRadianTex(v)} /></button>
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
          </div>

          <div className={activeTab === 'equation' ? 'block' : 'hidden'}>
            <div className="bg-white p-5 rounded-2xl shadow-md border border-amber-100 space-y-4 animate-fade-in">
              <div className="space-y-2">
                <h2 className="text-xs font-bold text-gray-500">関数と不等号の向き</h2>
                <div className="flex gap-2">
                  <select value={eqType} onChange={(e) => { setEqType(e.target.value as 'sin'|'cos'|'tan'); setKValue(e.target.value === 'tan' ? 1 : 0.5); }} className="flex-1 p-1.5 border rounded text-xs font-bold text-gray-700 bg-white outline-none">
                    <option value="sin">sin</option><option value="cos">cos</option><option value="tan">tan</option>
                  </select>
                  <div className="flex bg-white rounded border overflow-hidden text-xs">
                    <button onClick={() => setEqMode('=')} className={`px-2.5 py-1 font-bold ${eqMode === '=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>＝</button>
                    <button onClick={() => setEqMode('>=')} className={`px-2.5 py-1 font-bold border-l border-r ${eqMode === '>=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>≧</button>
                    <button onClick={() => setEqMode('<=')} className={`px-2.5 py-1 font-bold ${eqMode === '<=' ? 'bg-amber-100 text-amber-700' : 'text-gray-500'}`}>≦</button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-100 text-xs space-y-1.5">
                <span className="font-bold text-amber-900 flex items-center gap-1">平行移動 (α) = <InlineMath math={getRadianTex(paramAlpha)} /></span>
                <div className="flex flex-wrap gap-1">
                  {[-90, -60, -45, -30, 0, 30, 45, 60, 90].map(v => (
                    <button key={v} onClick={() => setParamAlpha(v)} className={`text-[10px] px-1.5 py-0.5 rounded border ${paramAlpha === v ? 'bg-amber-600 text-white border-amber-700 font-bold' : 'bg-white text-gray-600'}`}><InlineMath math={getRadianTex(v)} /></button>
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
                <input type="range" min={eqType === 'tan' ? -3 : -1} max={eqType === 'tan' ? 3 : 1} step={eqType === 'tan' ? 0.1 : 0.01} value={kValue} onChange={(e) => setKValue(Number(e.target.value))} className="w-full accent-amber-500" />
              </div>

              <div className="grid grid-cols-3 gap-1">
                {currentKPresets.map(preset => (
                  <button key={preset.tex} onClick={() => setKValue(preset.val)} className={`py-1 rounded text-xs border flex items-center justify-center transition ${Math.abs(kValue - preset.val) < 0.01 ? 'bg-amber-500 text-white font-bold shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <InlineMath math={preset.tex} />
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-xs font-bold text-gray-500 mb-1.5">⚙️ 考える定義域</h3>
                <select value={domainPreset} onChange={(e) => { const p = e.target.value; setDomainPreset(p); if (p === "none") { setMinRange(0); setMaxRange(360); } else if (p !== "custom") { const [min, max] = p.split(','); setMinRange(Number(min)); setMaxRange(Number(max)); } }} className="w-full p-1.5 border border-amber-200 rounded text-xs text-gray-700 bg-amber-50/50 outline-none">
                  <option value="none">制限なし (一般解を表示)</option>
                  <option value="0,360">0° ≦ θ ≦ 360° (1周)</option>
                  <option value="0,180">0° ≦ θ ≦ 180° (上半分)</option>
                  <option value="-180,180">-180° ≦ θ ≦ 180° (負の角)</option>
                  <option value="0,720">0° ≦ θ ≦ 720° (2周分)</option>
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
          </div>

          <div className={activeTab === 'synthesis' ? 'block' : 'hidden'}>
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
                    <button key={preset.tex} onClick={() => { setSynA(preset.a); setSynB(preset.b); }} className={`py-1.5 rounded text-xs border flex items-center justify-center transition ${(Math.abs(synA - preset.a) < 0.01 && Math.abs(synB - preset.b) < 0.01) ? 'bg-purple-500 text-white border-purple-600 font-bold shadow-sm' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'}`}>
                      <InlineMath math={preset.tex} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">数学的ステータス</h3>
            
            {activeTab === 'basic' && (
              <div className="grid grid-cols-3 gap-1.5 text-center items-center">
                <div className="bg-gray-50 p-2 rounded border border-gray-100"><p className="text-[10px] font-mono text-gray-400 mb-1">sin θ</p>
                  <div className="text-red-600"><BlockMath math={getExactValueTex(angle, 'sin') || Math.sin((angle * Math.PI) / 180).toFixed(3)} /></div>
                </div>
                <div className="bg-gray-50 p-2 rounded border border-gray-100"><p className="text-[10px] font-mono text-gray-400 mb-1">cos θ</p>
                  <div className="text-blue-600"><BlockMath math={getExactValueTex(angle, 'cos') || Math.cos((angle * Math.PI) / 180).toFixed(3)} /></div>
                </div>
                <div className="bg-gray-50 p-2 rounded border border-gray-100"><p className="text-[10px] font-mono text-gray-400 mb-1">tan θ</p>
                  <div className="text-emerald-600"><BlockMath math={getExactValueTex(angle, 'tan') || Math.tan((angle * Math.PI) / 180).toFixed(3)} /></div>
                </div>
              </div>
            )}

            {activeTab === 'transform' && (
              <div className="bg-gray-800 p-3 rounded-xl shadow-inner text-center border border-gray-900">
                <p className="text-[10px] text-gray-400 mb-1.5">現在の方程式</p>
                <div className="text-base text-green-400 flex justify-center items-center overflow-x-auto">
                  <BlockMath math={transformEqTex} />
                </div>
              </div>
            )}

            {activeTab === 'equation' && (
              <div className="bg-gray-800 p-3 rounded-xl shadow-inner border border-gray-900 text-center">
                <div className="text-sm text-amber-400 mb-2 flex justify-center items-center">
                  <BlockMath math={solvingEqTex} />
                </div>
                
                {domainPreset === "none" ? (
                  <>
                    <p className="text-[10px] text-gray-400 mb-1.5">一般解（n は任意の整数）</p>
                    <div className="flex flex-col items-center justify-center gap-1 min-h-[28px]">
                      {baseSolutions.length === 0 ? <span className="text-xs text-gray-500 font-bold">解なし</span> : eqMode === '=' ? (
                        baseSolutions.map((sol, i) => (
                          <div key={i} className="flex items-center justify-center bg-gray-900 px-3 py-1 rounded border border-gray-700 text-amber-400">
                            <InlineMath math={`\\theta = ${getRadianTex(sol)} ${eqType === 'tan' ? '+ n\\pi' : '+ 2n\\pi'}`} />
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] font-sans text-amber-300 leading-tight font-bold">不等式の一般解表現は複雑なため<br/>右の単位円(1周分)を参考に解説</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-400 mb-1.5">条件を満たす解 <InlineMath math="\theta" /></p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[28px]">
                      {equationSolutions.length === 0 ? <span className="text-xs text-gray-500 font-bold">この範囲に解なし</span> : eqMode === '=' ? (
                        equationSolutions.map((sol, i) => (
                          <span key={i} className="bg-gray-900 px-2 py-1 rounded border border-gray-700 text-amber-400">
                            <InlineMath math={`\\theta = ${getRadianTex(sol)}`} />
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] font-sans text-amber-300 font-bold">右側のハイライト領域を表示中</span>
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
                  <div className="text-sm text-gray-200 flex justify-center items-center">
                    <BlockMath math={`y = ${getFractionTex(synA)}\\sin\\theta ${synB >= 0 ? '+' : '-'} ${getFractionTex(Math.abs(synB))}\\cos\\theta`} />
                  </div>
                </div>
                
                <div className="border-t border-gray-700 pt-2">
                  <p className="text-[10px] text-purple-300 mb-1">合成後</p>
                  <div className="text-lg text-purple-400 flex justify-center items-center">
                    {exactSynR === "0" ? <BlockMath math="y = 0" /> : (
                      <BlockMath math={`y = ${exactSynR !== "1" ? exactSynR : ""}\\sin(\\theta ${exactSynAlpha !== "0" && exactSynAlpha !== "0.00" ? (exactSynAlpha.startsWith("-") ? exactSynAlpha : `+ ${exactSynAlpha}`) : ""})`} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 w-full space-y-4">
          <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
            <div className="space-y-4 animate-fade-in w-full">
              {showSin && <TrigGraphSet type="sin" angle={angle} minRange={minRange} maxRange={maxRange} />}
              {showCos && <TrigGraphSet type="cos" angle={angle} minRange={minRange} maxRange={maxRange} />}
              {showTan && <TrigGraphSet type="tan" angle={angle} minRange={minRange} maxRange={maxRange} />}
            </div>
          </div>

          <div className={activeTab === 'transform' ? 'block' : 'hidden'}>
            <div className="animate-fade-in w-full">
              <TransformGraphSet type={transformType} a={paramA} b={paramB} c={paramC} dParam={paramD} minRange={minRange} maxRange={maxRange} />
            </div>
          </div>

          <div className={activeTab === 'equation' ? 'block' : 'hidden'}>
            <div className="animate-fade-in w-full">
              <EquationGraphSet type={eqType} kValue={kValue} mode={eqMode} minRange={minRange} maxRange={maxRange} alpha={paramAlpha} viewMode={eqViewMode} solutions={equationSolutions} />
            </div>
          </div>

          <div className={activeTab === 'synthesis' ? 'block' : 'hidden'}>
            <div className="animate-fade-in w-full">
              <SynthesisGraphSet a={synA} b={synB} minRange={minRange} maxRange={maxRange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 【第3部】指数関数・対数関数ビジュアライザー
// ==========================================
const BasicRelationTab = () => {
  const [base, setBase] = useState<number>(2);
  const [showExp, setShowExp] = useState(true);
  const [showLog, setShowLog] = useState(true);
  const [pointX, setPointX] = useState<number>(1);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);

  const expY = Math.pow(base, pointX);
  const logX = expY;
  const logY = pointX;

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full md:w-80 shrink-0 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-md border border-blue-100 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-gray-500 mb-2">📐 底 (<InlineMath math="a" />) の設定</h3>
            <div className="flex gap-2 mb-2">
              {[0.5, 1, 2, 3, 10].map(v => (
                <button key={v} onClick={() => setBase(v)} className={`px-2 py-1 rounded text-xs font-bold transition ${base === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{v === 0.5 ? '1/2' : v}</button>
              ))}
            </div>
            <input type="range" min="0.1" max="5" step="0.1" value={base} onChange={(e) => setBase(Number(e.target.value))} className="w-full accent-blue-600" />
            <div className="text-right text-xs font-bold text-blue-600 mt-1"><InlineMath math="a" /> = {base.toFixed(1)}</div>
            {base === 1 && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 font-bold leading-tight">
                ※ a = 1 のとき、対数関数 y = log₁ x は底の条件 (a ≠ 1) を満たさず定義されません。
              </div>
            )}
          </div>
          
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">👁️ 表示するグラフ</h3>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={showExp} onChange={e => setShowExp(e.target.checked)} className="accent-red-500" />
              <span className="text-sm font-bold text-red-600 tracking-wider">
                <InlineMath math="y = a^x" />
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showLog} onChange={e => setShowLog(e.target.checked)} className="accent-emerald-500" disabled={base === 1} />
              <span className={`text-sm font-bold tracking-wider ${base === 1 ? 'text-gray-400' : 'text-emerald-600'}`}>
                <InlineMath math="y = \log_a x" />
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">🔴 点Pを動かす (<InlineMath math="x" />)</h3>
            <input type="range" min="-2" max="3" step="0.1" value={pointX} onChange={(e) => setPointX(Number(e.target.value))} className="w-full accent-gray-500" />
            <div className="text-right text-xs font-bold text-gray-500 mt-1"><InlineMath math="x" /> = {pointX.toFixed(1)}</div>
            
            <div className="mt-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <p className="text-[10px] text-gray-500 font-bold mb-1.5 uppercase tracking-widest">現在の値と座標</p>
              <div className="flex flex-col gap-2">
                {showExp && (
                  <div className="bg-white p-2 rounded border border-red-100 shadow-sm">
                    <p className="text-sm text-red-700 font-bold mb-1">
                      <InlineMath math={`y = ${base.toFixed(1)}^{${pointX.toFixed(1)}} = ${expY.toFixed(2)}`} />
                    </p>
                    <p className="text-xs font-mono text-gray-600">P: ({pointX.toFixed(2)}, {expY.toFixed(2)})</p>
                  </div>
                )}
                {showLog && base !== 1 && (
                  <div className="bg-white p-2 rounded border border-emerald-100 shadow-sm">
                    <p className="text-sm text-emerald-700 font-bold mb-1">
                      <InlineMath math={`x = ${base.toFixed(1)}^{${logY.toFixed(1)}} = ${logX.toFixed(2)}`} />
                    </p>
                    <p className="text-xs font-mono text-gray-600">Q: ({logX.toFixed(2)}, {logY.toFixed(2)})</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {base !== 1 && (
            <div className="pt-3 border-t border-gray-100">
              <button 
                onClick={() => setIsFlipping(!isFlipping)}
                className={`w-full py-2.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 ${isFlipping ? 'bg-red-50 text-red-700 border border-red-300' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
              >
                {isFlipping ? '🔙 元に戻す' : '🔄 y=x でひっくり返す (対称性)'}
              </button>
              <p className="text-[9px] text-gray-400 mt-1.5 text-center leading-tight">
                ※ 指数関数のグラフと点Pが、y=xを軸に180度回転して対数関数に重なる動きを確認できます。
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
          {Array.from({length: 21}).map((_, i) => {
            const pos = (i - 10) * UNIT;
            return (
              <g key={`grid-${i}`}>
                <line x1={0} y1={CY + pos} x2={SVG_WIDTH} y2={CY + pos} stroke="#e2e8f0" strokeWidth="1" />
                <line x1={CX + pos} y1={0} x2={CX + pos} y2={SVG_HEIGHT} stroke="#e2e8f0" strokeWidth="1" />
              </g>
            )
          })}
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#94a3b8" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#94a3b8" strokeWidth="2" />
          
          <SvgMath x={CX + 8} y={CY + 5} width={20} height={20} math="0" color="text-gray-500" />
          <SvgMath x={SVG_WIDTH - 25} y={CY - 30} width={20} height={20} math="x" color="text-gray-500" />
          <SvgMath x={CX + 8} y={5} width={20} height={20} math="y" color="text-gray-500" />

          <line x1={CX - 200} y1={CY + 200} x2={CX + 200} y2={CY - 200} stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6" />
          <SvgMath x={CX + 160} y={CY - 200} width={40} height={30} math="y=x" color="text-gray-400" />

          {showLog && base !== 1 && (
            <g opacity={isFlipping ? 0.4 : 1} className="transition-opacity duration-500">
              <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#818cf8" strokeWidth="2" strokeDasharray="6" opacity="0.4"/>
              <SvgMath x={CX + 5} y={30} width={60} height={30} math="x=0" color="text-indigo-400" />
              <path d={generateLogPath(base, 0, -10, 10)} fill="none" stroke="#10b981" strokeWidth="3" />
              <line x1={CX + logX*UNIT} y1={CY} x2={CX + logX*UNIT} y2={CY - logY*UNIT} stroke="#10b981" strokeDasharray="3" />
              <line x1={CX} y1={CY - logY*UNIT} x2={CX + logX*UNIT} y2={CY - logY*UNIT} stroke="#10b981" strokeDasharray="3" />
              <circle cx={CX + logX*UNIT} cy={CY - logY*UNIT} r="5" fill="#10b981" />
              <SvgMath x={CX + logX*UNIT + 5} y={CY - logY*UNIT + 10} width={20} height={20} math="Q" color="text-emerald-700" />
            </g>
          )}

          {showExp && (
            <g style={{ 
              transformOrigin: `${CX}px ${CY}px`, 
              transform: isFlipping ? 'rotate3d(1, -1, 0, 180deg)' : 'none', 
              transition: 'transform 1.5s ease-in-out' 
            }}>
              <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#f43f5e" strokeWidth="2" strokeDasharray="6" opacity="0.4"/>
              <SvgMath x={SVG_WIDTH - 60} y={CY - 25} width={60} height={30} math="y=0" color="text-rose-500" />
              
              <path d={generateExpPath(base, 0, -10, 10)} fill="none" stroke="#ef4444" strokeWidth="3" />
              
              <line x1={CX + pointX*UNIT} y1={CY} x2={CX + pointX*UNIT} y2={CY - expY*UNIT} stroke="#ef4444" strokeDasharray="3" />
              <line x1={CX} y1={CY - expY*UNIT} x2={CX + pointX*UNIT} y2={CY - expY*UNIT} stroke="#ef4444" strokeDasharray="3" />
              <circle cx={CX + pointX*UNIT} cy={CY - expY*UNIT} r="5" fill="#ef4444" />
              <SvgMath x={CX + pointX*UNIT + 5} y={CY - expY*UNIT - 25} width={20} height={20} math="P" color="text-red-700" />
            </g>
          )}

          {showExp && showLog && base !== 1 && !isFlipping && (
            <line x1={CX + pointX*UNIT} y1={CY - expY*UNIT} x2={CX + logX*UNIT} y2={CY - logY*UNIT} stroke="#94a3b8" strokeDasharray="4" strokeWidth="1" />
          )}
        </svg>
      </div>
    </div>
  );
};

const ExpLogEquationTab = () => {
  const [funcType, setFuncType] = useState<'exp'|'log'>('exp');
  const [base, setBase] = useState<number>(2);
  const [kValue, setKValue] = useState<number>(4);
  const [alpha, setAlpha] = useState<number>(0);
  const [ineqType, setIneqType] = useState<'='|'>'|'<'>('=');
  const [hasEqual, setHasEqual] = useState<boolean>(true);

  const exactSolution = funcType === 'exp' 
    ? (Math.log(kValue) / Math.log(base)) + alpha 
    : Math.pow(base, kValue) + alpha;

  const eqSignStr = ineqType === '=' ? '=' :
                    ineqType === '>' ? (hasEqual ? '\\geqq' : '>') :
                                       (hasEqual ? '\\leqq' : '<');

  let isGreater = false;
  if (ineqType !== '=') {
    isGreater = (base > 1 && ineqType === '>') || (base < 1 && ineqType === '<');
  }

  let ansTex = "";
  if (ineqType === '=') {
    ansTex = `x = ${exactSolution.toFixed(2)}`;
  } else {
    const signTex = isGreater ? (hasEqual ? '\\geqq' : '>') : (hasEqual ? '\\leqq' : '<');
    if (funcType === 'log' && !isGreater) {
       ansTex = `${alpha} < x ${signTex} ${exactSolution.toFixed(2)}`;
    } else {
       ansTex = `x ${signTex} ${exactSolution.toFixed(2)}`;
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full md:w-80 shrink-0 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-md border border-amber-100 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-1">関数タイプ</h3>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button onClick={() => {setFuncType('exp'); setKValue(4);}} className={`flex-1 py-1 text-sm font-bold rounded ${funcType === 'exp' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500'}`}>指数</button>
              <button onClick={() => {setFuncType('log'); setKValue(2);}} className={`flex-1 py-1 text-sm font-bold rounded ${funcType === 'log' ? 'bg-white shadow-sm text-emerald-600' : 'text-gray-500'}`}>対数</button>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-1">等号・不等号</h3>
            <div className="flex bg-gray-100 p-1 rounded-lg text-sm font-bold">
              <button onClick={() => setIneqType('=')} className={`flex-1 py-1 rounded ${ineqType === '=' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>＝</button>
              <button onClick={() => setIneqType('>')} className={`flex-1 py-1 rounded border-l border-r border-gray-200 ${ineqType === '>' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>＞</button>
              <button onClick={() => setIneqType('<')} className={`flex-1 py-1 rounded ${ineqType === '<' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500'}`}>＜</button>
            </div>
            {ineqType !== '=' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={hasEqual} onChange={(e) => setHasEqual(e.target.checked)} className="accent-amber-600" />
                <span className="text-[11px] font-bold text-gray-600">等号を含む (≧, ≦ にする)</span>
              </label>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">底 (<InlineMath math="a" />) = {base.toFixed(1)}</h3>
            <input type="range" min="0.1" max="4" step="0.1" value={base} onChange={(e) => { const v = Number(e.target.value); if(v !== 1) setBase(v); }} className="w-full accent-amber-500" />
            {ineqType !== '=' && (
              <p className="text-[10px] text-gray-400 mt-1 leading-tight">
                {base > 1 ? "a > 1 (単調増加) なので不等号の向きはそのまま" : "0 < a < 1 (単調減少) なので不等号の向きが反転"}
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">平行移動 (<InlineMath math="\alpha" />) = {alpha.toFixed(1)}</h3>
            <input type="range" min="-5" max="5" step="0.5" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="w-full accent-indigo-400" />
          </div>
          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-2">境界値 (<InlineMath math="k" />) = {kValue.toFixed(1)}</h3>
            <input type="range" min={funcType==='exp'? 0.1 : -4} max={8} step="0.1" value={kValue} onChange={(e) => setKValue(Number(e.target.value))} className="w-full accent-amber-500" />
          </div>
          
          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-center">
            <p className="text-[10px] text-gray-500 mb-1">現在の{ineqType === '=' ? '方程式' : '不等式'}</p>
            <div className="text-lg text-amber-800 mb-3 tracking-wide overflow-x-auto">
              {funcType === 'exp' ? (
                <BlockMath math={`${base.toFixed(1)}^{${alpha !== 0 ? `x ${alpha > 0 ? '-' : '+'} ${Math.abs(alpha)}` : 'x'}} ${eqSignStr} ${kValue.toFixed(1)}`} />
              ) : (
                <BlockMath math={`\\log_{${base.toFixed(1)}}(${alpha !== 0 ? `x ${alpha > 0 ? '-' : '+'} ${Math.abs(alpha)}` : 'x'}) ${eqSignStr} ${kValue.toFixed(1)}`} />
              )}
            </div>
            <p className="text-[10px] text-gray-500 mb-1">解</p>
            <div className="text-base text-red-600 tracking-wide overflow-x-auto">
              <BlockMath math={ansTex} />
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full bg-slate-50">
          <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#94a3b8" strokeWidth="2" />
          <line x1={CX} y1={0} x2={CX} y2={SVG_HEIGHT} stroke="#94a3b8" strokeWidth="2" />
          
          {funcType === 'exp' && (
            <g>
              <line x1={0} y1={CY} x2={SVG_WIDTH} y2={CY} stroke="#f43f5e" strokeWidth="3" strokeDasharray="6" opacity="0.4"/>
              <SvgMath x={SVG_WIDTH - 85} y={CY - 25} width={80} height={30} math="y = 0" color="text-rose-500" justify="end" />
            </g>
          )}
          {funcType === 'log' && (
            <g>
              <line x1={CX + alpha*UNIT} y1={0} x2={CX + alpha*UNIT} y2={SVG_HEIGHT} stroke="#818cf8" strokeWidth="2" strokeDasharray="4" opacity="0.6"/>
              <SvgMath x={CX + alpha*UNIT + 5} y={30} width={80} height={30} math={`x = ${alpha}`} color="text-indigo-400" justify="start" />
            </g>
          )}

          <line x1={0} y1={CY - kValue*UNIT} x2={SVG_WIDTH} y2={CY - kValue*UNIT} stroke="#d97706" strokeWidth="2" strokeDasharray="6" />
          
          <circle cx={CX} cy={CY - kValue*UNIT} r="4" fill="#d97706" />
          <SvgMath x={CX - 45} y={CY - kValue*UNIT - 15} width={40} height={30} math={kValue.toFixed(1)} justify="end" color="text-amber-700" />
          
          <circle 
            cx={CX + exactSolution*UNIT} 
            cy={CY} 
            r="4" 
            fill={(ineqType === '=' || hasEqual) ? "#ef4444" : "#ffffff"} 
            stroke="#ef4444" 
            strokeWidth={(ineqType === '=' || hasEqual) ? "0" : "2"} 
          />
          <SvgMath x={CX + exactSolution*UNIT - 20} y={CY + 5} width={40} height={30} math={exactSolution.toFixed(2)} color="text-red-600" />

          {ineqType !== '=' && (() => {
            const startX = isGreater ? CX + exactSolution*UNIT : (funcType === 'log' ? CX + alpha*UNIT : 0);
            const endX = isGreater ? SVG_WIDTH : CX + exactSolution*UNIT;
            return (
              <rect x={startX} y={CY - 4} width={Math.max(0, endX - startX)} height={8} fill="#ef4444" opacity="0.4" />
            );
          })()}

          <line x1={CX + exactSolution*UNIT} y1={CY} x2={CX + exactSolution*UNIT} y2={CY - kValue*UNIT} stroke="#64748b" strokeDasharray="3" />
          <circle 
            cx={CX + exactSolution*UNIT} 
            cy={CY - kValue*UNIT} 
            r="5" 
            fill={(ineqType === '=' || hasEqual) ? "#ef4444" : "#ffffff"} 
            stroke="#ef4444" 
            strokeWidth="2" 
          />

          <path d={funcType === 'exp' ? generateExpPath(base, alpha, -10, 10) : generateLogPath(base, alpha, -10, 10)} fill="none" stroke={funcType === 'exp' ? "#ef4444" : "#10b981"} strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
};

const CommonLogTab = () => {
  const [baseM, setBaseM] = useState<number>(3);
  const [exponentN, setExponentN] = useState<number>(20);

  const isValid = baseM > 0;
  
  const log10M = isValid ? Math.log10(baseM) : 0;
  const totalLog = isValid ? exponentN * log10M : 0;
  
  const floorVal = Math.floor(totalLog);
  const digits = totalLog >= 0 ? floorVal + 1 : null;
  const decimalPos = totalLog < 0 ? Math.abs(floorVal) : null;

  const [scaleCenter, setScaleCenter] = useState<number>(20 * Math.log10(3));
  const [scaleZoom, setScaleZoom] = useState<number>(100);
  
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartCenter = useRef<number>(0);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartCenter.current = scaleCenter;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX.current;
    setScaleCenter(dragStartCenter.current - dx / scaleZoom);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const getScaleX = (val: number) => 300 + (val - scaleCenter) * scaleZoom;

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start animate-fade-in">
      <div className="w-full md:w-80 shrink-0 space-y-4">
        <div className="bg-white p-5 rounded-2xl shadow-md border border-purple-100 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 mb-2 flex items-center flex-wrap gap-2">
              <span>対象の数: <InlineMath math="M^n" /></span>
              {isValid && (
                <span className="text-sm font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 shadow-sm">
                  <InlineMath math={`${baseM}^{${exponentN}}`} />
                </span>
              )}
            </h3>
            
            <div className="flex gap-4 items-center mb-2">
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">底 (<InlineMath math="M" />)</label>
                <input type="number" step="0.1" value={baseM} onChange={(e) => setBaseM(Number(e.target.value))} className={`w-full p-1 border rounded text-sm text-center ${!isValid ? 'border-red-500 bg-red-50' : ''}`} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500">指数 (<InlineMath math="n" />)</label>
                <input type="number" value={exponentN} onChange={(e) => setExponentN(Number(e.target.value))} className="w-full p-1 border rounded text-sm text-center" />
              </div>
            </div>
            
            {!isValid && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 font-bold leading-tight mb-2">
                ⚠️ 真数条件により、底 M は正の数（M &gt; 0）である必要があります。
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => {setBaseM(3); setExponentN(20);}} className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">3²⁰</button>
              <button onClick={() => {setBaseM(0.5); setExponentN(20);}} className="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">(1/2)²⁰</button>
            </div>
          </div>
          
          {isValid && (
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 animate-fade-in">
              <p className="text-[10px] text-gray-500 mb-1">対数をとる</p>
              <div className="text-xs text-purple-800 mb-2 overflow-x-auto">
                <BlockMath math={`\\log_{10}(${baseM}^{${exponentN}}) = ${exponentN} \\times \\log_{10}(${baseM})`} />
                <BlockMath math={`\\approx ${exponentN} \\times ${log10M.toFixed(4)} = ${totalLog.toFixed(4)}`} />
              </div>
              <div className="border-t border-purple-200 pt-2">
                {totalLog >= 0 ? (
                  <p className="text-sm font-bold text-gray-800">
                    <InlineMath math={`${floorVal} \\leqq \\log_{10} N < ${floorVal + 1}`} /><br/>
                    ∴ <span className="text-red-600 text-lg">{digits} 桁</span> の数
                  </p>
                ) : (
                  <p className="text-sm font-bold text-gray-800">
                    <InlineMath math={`${floorVal} \\leqq \\log_{10} N < ${floorVal + 1}`} /><br/>
                    ∴ 小数第 <span className="text-blue-600 text-lg">{decimalPos} 位</span> に初めて0でない数字が現れる
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 mb-3">🔍 スケール操作</h3>
            <div className="flex items-center justify-between gap-2 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
              <button onClick={() => setScaleZoom(z => Math.max(30, z - 20))} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-600 font-bold hover:bg-gray-100 transition shadow-sm">－</button>
              <div className="text-xs font-bold text-gray-500">目盛り間隔</div>
              <button onClick={() => setScaleZoom(z => Math.min(250, z + 20))} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded text-gray-600 font-bold hover:bg-gray-100 transition shadow-sm">＋</button>
            </div>
            <button 
              onClick={() => { if(isValid) setScaleCenter(totalLog); }} 
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
            >
              📍 現在の値の位置へジャンプ
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative flex flex-col justify-center items-center p-4 md:p-8 min-h-[300px]">
        {isValid ? (
          <>
            <div className="w-full flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-700">常用対数 (<InlineMath math="\log_{10}" />) のスケール</h3>
              <p className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">左右にドラッグして移動 ↔️</p>
            </div>
            
            <svg 
              viewBox="0 0 600 150" 
              className={`w-full max-w-2xl overflow-visible animate-fade-in ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <line x1={0} y1={75} x2={600} y2={75} stroke="#cbd5e1" strokeWidth="4" />
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L9,3 z" fill="#cbd5e1" />
                </marker>
              </defs>
              <line x1={0} y1={75} x2={610} y2={75} stroke="#cbd5e1" strokeWidth="4" markerEnd="url(#arrow)" />

              {(() => {
                const minK = Math.floor(scaleCenter - 600 / scaleZoom) - 1;
                const maxK = Math.ceil(scaleCenter + 600 / scaleZoom) + 1;
                
                return Array.from({length: maxK - minK + 1}).map((_, i) => {
                  const k = minK + i;
                  const x = getScaleX(k);
                  if (x < -scaleZoom || x > 600 + scaleZoom) return null;

                  const isTarget = k === floorVal;
                  const regionText = k >= 0 ? `${k + 1}桁の領域` : `小数第${Math.abs(k)}位の領域`;

                  return (
                    <g key={`region-${k}`}>
                      <rect x={x} y={65} width={scaleZoom} height={20} fill={isTarget ? "#ef4444" : "#f1f5f9"} opacity={isTarget ? 0.2 : 0.8} stroke={isTarget ? "#ef4444" : "#e2e8f0"} strokeWidth="1" />
                      {scaleZoom > 60 && (
                        <text x={x + scaleZoom/2} y={55} textAnchor="middle" className={`text-[10px] font-bold ${isTarget ? 'fill-red-500' : 'fill-gray-400'}`}>
                          {regionText}
                        </text>
                      )}
                    </g>
                  );
                });
              })()}
              
              {(() => {
                const minK = Math.floor(scaleCenter - 600 / scaleZoom) - 1;
                const maxK = Math.ceil(scaleCenter + 600 / scaleZoom) + 1;
                
                return Array.from({length: maxK - minK + 1}).map((_, i) => {
                  const val = minK + i;
                  const x = getScaleX(val);
                  if (x < -20 || x > 620) return null;

                  return (
                    <g key={`scale-${val}`}>
                      <line x1={x} y1={65} x2={x} y2={85} stroke="#64748b" strokeWidth="2" />
                      <SvgMath x={x - 20} y={90} width={40} height={20} math={val.toString()} color="text-gray-600" />
                      <SvgMath x={x - 20} y={115} width={40} height={20} math={`10^{${val}}`} color="text-gray-400" />
                    </g>
                  );
                });
              })()}

              {(() => {
                const x = getScaleX(totalLog);
                if (x >= -50 && x <= 650) {
                  return (
                    <g>
                      <circle cx={x} cy={75} r="8" fill="#9333ea" className="drop-shadow-md" />
                      <SvgMath x={x - 30} y={25} width={60} height={20} math={totalLog.toFixed(4)} color="text-purple-700 bg-white" />
                      <line x1={x} y1={45} x2={x} y2={65} stroke="#a855f7" strokeWidth="2" strokeDasharray="2" />
                    </g>
                  );
                }
                return null;
              })()}
            </svg>
          </>
        ) : (
          <div className="text-gray-400 font-bold animate-fade-in flex flex-col items-center gap-2">
            <span className="text-3xl">🚫</span>
            <span>M ≤ 0 のため、スケールを描画できません</span>
          </div>
        )}
      </div>
    </div>
  );
};

const ExpLogVisualizer = () => {
  const [activeTab, setActiveTab] = useState<'basic' | 'ineq' | 'common'>('basic');

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-xl font-bold text-emerald-900">📈 指数関数・対数関数</h2>
        <div className="flex bg-gray-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
          <button onClick={() => setActiveTab('basic')} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'basic' ? 'bg-white shadow-sm text-emerald-700' : 'text-gray-500 hover:text-gray-700'}`}>1. 基本と対称性</button>
          <button onClick={() => setActiveTab('ineq')} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'ineq' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500 hover:text-gray-700'}`}>2. 方程式・不等式</button>
          <button onClick={() => setActiveTab('common')} className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition ${activeTab === 'common' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>3. 常用対数と桁数</button>
        </div>
      </div>

      <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
        <BasicRelationTab />
      </div>
      <div className={activeTab === 'ineq' ? 'block' : 'hidden'}>
        <ExpLogEquationTab />
      </div>
      <div className={activeTab === 'common' ? 'block' : 'hidden'}>
        <CommonLogTab />
      </div>
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
      
      {/* 画面上部のマスターカテゴリー切り替えトグル */}
      <div className="max-w-2xl mx-auto mb-8 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row">
        <button 
          onClick={() => setCategory('trig')} 
          className={`flex-1 py-2.5 px-4 text-center text-sm font-bold rounded-lg transition ${category === 'trig' ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📐 三角関数
        </button>
        <button 
          onClick={() => setCategory('explog')} 
          className={`flex-1 py-2.5 px-4 text-center text-sm font-bold rounded-lg transition ${category === 'explog' ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📈 指数・対数関数
        </button>
        <button 
          onClick={() => setCategory('calculus')} 
          className={`flex-1 py-2.5 px-4 text-center text-sm font-bold rounded-lg transition ${category === 'calculus' ? 'bg-purple-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          📉 微分・積分
        </button>
      </div>

      {/* 状態を維持するために hidden で出し分ける */}
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