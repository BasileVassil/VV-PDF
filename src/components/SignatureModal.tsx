import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, width: number, height: number) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({ isOpen, onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [inkColor, setInkColor] = useState<string>('#1e3a8a'); // classic blue ink
  const [lineWidth, setLineWidth] = useState<number>(2.5);

  useEffect(() => {
    if (isOpen) {
      setTimeout(initCanvas, 50);
    }
  }, [isOpen]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Support high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;

    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = lineWidth;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;

    // Crop signature to bounding box with transparent background
    const dpr = window.devicePixelRatio || 2;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 10) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) {
      onClose();
      return;
    }

    // Add padding around signature
    const pad = Math.round(15 * dpr);
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d')!;
    cropCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = cropCanvas.toDataURL('image/png');
    onSave(dataUrl, cropW / dpr, cropH / dpr);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-neutral-100">Создание личной подписи</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1"
            title="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas area */}
        <div className="p-5 flex flex-col gap-4">
          <div className="relative border-2 border-dashed border-neutral-700 rounded-lg bg-neutral-950 overflow-hidden cursor-crosshair">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-56 block touch-none"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-neutral-500">
                <p className="text-sm">Распишитесь мышью или пальцем здесь</p>
                <div className="w-48 h-px bg-neutral-700/60 mt-8" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Цвет чернил:</span>
              <button
                type="button"
                onClick={() => setInkColor('#1e3a8a')}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  inkColor === '#1e3a8a' ? 'scale-110 border-white ring-2 ring-blue-500/40' : 'border-neutral-700'
                } bg-blue-900`}
                title="Синие чернила"
              />
              <button
                type="button"
                onClick={() => setInkColor('#09090b')}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  inkColor === '#09090b' ? 'scale-110 border-white ring-2 ring-neutral-500/40' : 'border-neutral-700'
                } bg-neutral-950`}
                title="Черные чернила"
              />
              <button
                type="button"
                onClick={() => setInkColor('#4c1d95')}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  inkColor === '#4c1d95' ? 'scale-110 border-white ring-2 ring-purple-500/40' : 'border-neutral-700'
                } bg-purple-900`}
                title="Фиолетовые чернила"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Толщина:</span>
              <button
                type="button"
                onClick={() => setLineWidth(1.8)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  lineWidth === 1.8 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Тонкая
              </button>
              <button
                type="button"
                onClick={() => setLineWidth(2.8)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  lineWidth === 2.8 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Обычная
              </button>
              <button
                type="button"
                onClick={() => setLineWidth(4.0)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  lineWidth === 4.0 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Жирная
              </button>
            </div>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors ml-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Очистить
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-neutral-950/60 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
              hasDrawn ? 'bg-blue-600 hover:bg-blue-500 shadow-sm' : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            Вставить в документ
          </button>
        </div>
      </div>
    </div>
  );
};
