"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface SketchPadProps {
  onSketchCapture: (dataUrl: string) => void;
}

export default function SketchPad({ onSketchCapture }: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [strokeSize, setStrokeSize] = useState(4);
  const [color, setColor] = useState("#f5dc89");
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    if (!pos) return;
    setIsDrawing(true);
    lastPos.current = pos;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, strokeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#1c1917" : color;
    ctx.fill();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || !lastPos.current) return;

    const pos = getPos(e, canvas);
    if (!pos) return;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#1c1917" : color;
    ctx.lineWidth = strokeSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const sendSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSketchCapture(dataUrl);
  };

  const colors = ["#f5dc89", "#e8ad22", "#ffffff", "#94a3b8", "#f87171", "#86efac", "#60a5fa", "#c084fc"];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setTool("pen")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tool === "pen" ? "bg-gold-600 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            ✏️ Pen
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tool === "eraser" ? "bg-stone-500 text-white" : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            ◻ Eraser
          </button>
        </div>

        {/* Colors */}
        <div className="flex gap-2 flex-wrap">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool("pen"); }}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${
                color === c && tool === "pen" ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Size */}
        <div className="flex items-center gap-2">
          <span className="text-stone-400 text-sm">Size:</span>
          <input
            type="range"
            min="2"
            max="20"
            value={strokeSize}
            onChange={(e) => setStrokeSize(parseInt(e.target.value))}
            className="w-20 accent-gold-500"
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-stone-700">
        <canvas
          ref={canvasRef}
          width={600}
          height={350}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={clear}
          className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl py-3 font-medium transition-colors"
        >
          Clear Canvas
        </button>
        <button
          onClick={sendSketch}
          className="flex-1 bg-gold-600 hover:bg-gold-500 text-white rounded-xl py-3 font-semibold transition-colors"
        >
          Send Sketch to Assistant
        </button>
      </div>
      <p className="text-stone-500 text-sm text-center">
        Sketch your ring idea and send it to the assistant for personalised suggestions.
      </p>
    </div>
  );
}
