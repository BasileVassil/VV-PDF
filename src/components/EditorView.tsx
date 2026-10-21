import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Type,
  Image as ImageIcon,
  PenTool,
  Stamp,
  Eraser,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Trash2,
  Bold,
  Italic,
  Check,
  Move,
  CornerDownRight,
  Square,
  Sparkles,
  Palette,
} from 'lucide-react';
import { AnnotationItem, TextAnnotation, ImageAnnotation, ShapeAnnotation } from '../types/pdf';
import { renderPdfPage } from '../utils/pdfHelper';
import { SignatureModal } from './SignatureModal';

interface EditorViewProps {
  pdfBytes: Uint8Array;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  annotationsByPage: Record<number, AnnotationItem[]>;
  setAnnotationsByPage: React.Dispatch<
    React.SetStateAction<Record<number, AnnotationItem[]>>
  >;
  onRotateCurrentPage: () => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
  pdfBytes,
  totalPages,
  currentPage,
  setCurrentPage,
  annotationsByPage,
  setAnnotationsByPage,
  onRotateCurrentPage,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [scale, setScale] = useState<number>(1.25);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<
    'select' | 'text' | 'image' | 'stamp' | 'whiteout' | 'highlight'
  >('select');

  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Resizing state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  // Current page's annotations
  const currentAnnotations = annotationsByPage[currentPage] || [];

  const updateCurrentAnnotations = useCallback(
    (newAnnotations: AnnotationItem[]) => {
      setAnnotationsByPage((prev) => ({
        ...prev,
        [currentPage]: newAnnotations,
      }));
    },
    [currentPage, setAnnotationsByPage]
  );

  // Render the PDF page to canvas
  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !pdfBytes) return;

    renderPdfPage(pdfBytes, currentPage, canvas, scale)
      .then(() => {
        if (!isCancelled && overlayRef.current) {
          overlayRef.current.style.width = `${canvas.width / (window.devicePixelRatio || 1)}px`;
          overlayRef.current.style.height = `${canvas.height / (window.devicePixelRatio || 1)}px`;
        }
      })
      .catch((err) => {
        console.error('Failed to render page:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, currentPage, scale]);

  // Click on overlay to add text or shape if tool is active
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId || resizingId) return;

    // If clicking on existing annotation item, don't create new one
    if ((e.target as HTMLElement).closest('.annotation-item')) return;

    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (activeTool === 'text') {
      const newText: TextAnnotation = {
        id: `text-${Date.now()}`,
        type: 'text',
        x: Math.round(xPct),
        y: Math.round(yPct),
        text: 'Новый текст',
        fontSize: 16,
        fontColor: '#0f172a',
        bgColor: 'transparent',
        isBold: false,
        isItalic: false,
      };
      updateCurrentAnnotations([...currentAnnotations, newText]);
      setSelectedId(newText.id);
      setActiveTool('select');
    } else if (activeTool === 'whiteout') {
      const newShape: ShapeAnnotation = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: Math.round(xPct),
        y: Math.round(yPct),
        width: 20, // 20% of page width
        height: 4, // 4% of page height
        fillColor: '#ffffff',
        borderColor: '#e2e8f0',
        opacity: 1,
      };
      updateCurrentAnnotations([...currentAnnotations, newShape]);
      setSelectedId(newShape.id);
      setActiveTool('select');
    } else if (activeTool === 'highlight') {
      const newShape: ShapeAnnotation = {
        id: `shape-${Date.now()}`,
        type: 'shape',
        x: Math.round(xPct),
        y: Math.round(yPct),
        width: 25,
        height: 3,
        fillColor: '#fef08a',
        opacity: 0.5,
      };
      updateCurrentAnnotations([...currentAnnotations, newShape]);
      setSelectedId(newShape.id);
      setActiveTool('select');
    } else {
      setSelectedId(null);
    }
  };

  // Add Image Handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        const widthPct = 25;
        // height in percentage of page assuming roughly 1.41 aspect for A4
        const heightPct = widthPct / (aspect * 1.41);

        const newImg: ImageAnnotation = {
          id: `img-${Date.now()}`,
          type: 'image',
          x: 35,
          y: 40,
          width: widthPct,
          height: Math.max(5, heightPct),
          dataUrl,
          originalWidth: img.width,
          originalHeight: img.height,
          label: file.name,
        };
        updateCurrentAnnotations([...currentAnnotations, newImg]);
        setSelectedId(newImg.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Add Stamp preset
  const addStamp = (label: string, color: string, border: string) => {
    // Generate SVG stamp
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d')!;

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 288, 88);

    // Inner dashed line
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(12, 12, 276, 76);

    // Text
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 150, 50);

    const dataUrl = canvas.toDataURL('image/png');
    const newStamp: ImageAnnotation = {
      id: `stamp-${Date.now()}`,
      type: 'image',
      x: 35,
      y: 40,
      width: 25,
      height: 8,
      dataUrl,
      originalWidth: 300,
      originalHeight: 100,
      label,
    };
    updateCurrentAnnotations([...currentAnnotations, newStamp]);
    setSelectedId(newStamp.id);
    setActiveTool('select');
  };

  // Signature saved callback
  const handleSignatureSave = (dataUrl: string, w: number, h: number) => {
    const aspect = w / h;
    const widthPct = 20;
    const heightPct = widthPct / (aspect * 1.41);

    const newSig: ImageAnnotation = {
      id: `sig-${Date.now()}`,
      type: 'image',
      x: 40,
      y: 70,
      width: widthPct,
      height: Math.max(5, heightPct),
      dataUrl,
      originalWidth: w,
      originalHeight: h,
      label: 'Личная подпись',
    };
    updateCurrentAnnotations([...currentAnnotations, newSig]);
    setSelectedId(newSig.id);
  };

  // Dragging logic
  const handleMouseDownItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setDraggingId(id);

    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const item = currentAnnotations.find((a) => a.id === id);
    if (!item) return;

    const itemPxX = (item.x / 100) * rect.width;
    const itemPxY = (item.y / 100) * rect.height;

    setDragOffset({
      x: e.clientX - rect.left - itemPxX,
      y: e.clientY - rect.top - itemPxY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();

    if (draggingId) {
      const xPx = e.clientX - rect.left - dragOffset.x;
      const yPx = e.clientY - rect.top - dragOffset.y;
      const xPct = Math.max(0, Math.min(95, (xPx / rect.width) * 100));
      const yPct = Math.max(0, Math.min(95, (yPx / rect.height) * 100));

      updateCurrentAnnotations(
        currentAnnotations.map((a) =>
          a.id === draggingId ? { ...a, x: Math.round(xPct), y: Math.round(yPct) } : a
        )
      );
    } else if (resizingId) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      const deltaWPct = (deltaX / rect.width) * 100;
      const deltaHPct = (deltaY / rect.height) * 100;

      const newW = Math.max(5, Math.min(95, resizeStart.w + deltaWPct));
      const newH = Math.max(2, Math.min(95, resizeStart.h + deltaHPct));

      updateCurrentAnnotations(
        currentAnnotations.map((a) =>
          a.id === resizingId ? { ...a, width: Math.round(newW), height: Math.round(newH) } : a
        )
      );
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
  };

  // Resizing start
  const handleStartResize = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const item = currentAnnotations.find((a) => a.id === id) as
      | ImageAnnotation
      | ShapeAnnotation
      | undefined;
    if (!item) return;

    setResizingId(id);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      w: item.width,
      h: item.height,
    });
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    updateCurrentAnnotations(currentAnnotations.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // Selected item reference
  const selectedItem = currentAnnotations.find((a) => a.id === selectedId);

  return (
    <div
      className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Hidden file input for images */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Primary Toolbar */}
      <div className="h-14 border-b border-neutral-800 bg-neutral-900/90 px-6 flex items-center justify-between gap-4 shrink-0 z-20">
        {/* Left: Tools */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveTool('text');
              setSelectedId(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              activeTool === 'text'
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-neutral-800/80 border-neutral-700/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80'
            }`}
            title="Кликните на документ для добавления надписи"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Добавить текст</span>
          </button>

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700/80 bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80 transition-colors"
            title="Вставить картинку, логотип или скан"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Изображение</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSigModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700/80 bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80 transition-colors"
            title="Нарисовать и вставить личную подпись"
          >
            <PenTool className="w-3.5 h-3.5 text-blue-400" />
            <span>Подпись</span>
          </button>

          {/* Stamps dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700/80 bg-neutral-800/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80 transition-colors"
            >
              <Stamp className="w-3.5 h-3.5 text-amber-400" />
              <span>Штампы</span>
            </button>
            <div className="absolute left-0 top-full mt-1.5 w-44 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-1.5 hidden group-hover:flex flex-col gap-1 z-30">
              <button
                type="button"
                onClick={() => addStamp('ОДОБРЕНО', '#16a34a', '#16a34a')}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>ОДОБРЕНО</span>
                <span className="text-[10px] text-emerald-500 border border-emerald-500/30 px-1 rounded">Зеленый</span>
              </button>
              <button
                type="button"
                onClick={() => addStamp('ОПЛАЧЕНО', '#2563eb', '#2563eb')}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>ОПЛАЧЕНО</span>
                <span className="text-[10px] text-blue-500 border border-blue-500/30 px-1 rounded">Синий</span>
              </button>
              <button
                type="button"
                onClick={() => addStamp('КОПИЯ ВЕРНА', '#4338ca', '#4338ca')}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>КОПИЯ ВЕРНА</span>
                <span className="text-[10px] text-indigo-500 border border-indigo-500/30 px-1 rounded">Индиго</span>
              </button>
              <button
                type="button"
                onClick={() => addStamp('КОНФИДЕНЦИАЛЬНО', '#dc2626', '#dc2626')}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>КОНФИДЕНЦИАЛЬНО</span>
                <span className="text-[10px] text-rose-500 border border-rose-500/30 px-1 rounded">Красный</span>
              </button>
              <button
                type="button"
                onClick={() => addStamp('ЧЕРНОВИК', '#64748b', '#64748b')}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-neutral-400 hover:bg-neutral-800 rounded-lg transition-colors flex items-center justify-between"
              >
                <span>ЧЕРНОВИК</span>
                <span className="text-[10px] text-neutral-400 border border-neutral-700 px-1 rounded">Серый</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveTool('whiteout');
              setSelectedId(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              activeTool === 'whiteout'
                ? 'bg-neutral-200 text-neutral-900 border-white shadow-xs'
                : 'bg-neutral-800/80 border-neutral-700/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80'
            }`}
            title="Закрасить/скрыть текст белой плашкой"
          >
            <Square className="w-3.5 h-3.5 text-neutral-400" />
            <span>Замазка (Скрыть)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTool('highlight');
              setSelectedId(null);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              activeTool === 'highlight'
                ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-xs'
                : 'bg-neutral-800/80 border-neutral-700/80 text-neutral-300 hover:text-white hover:bg-neutral-700/80'
            }`}
            title="Выделить текст маркером"
          >
            <Palette className="w-3.5 h-3.5 text-amber-300" />
            <span>Выделитель</span>
          </button>
        </div>

        {/* Center: Page switcher */}
        <div className="flex items-center gap-2 bg-neutral-950/70 border border-neutral-800 px-3 py-1 rounded-lg">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
            title="Предыдущая страница"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-neutral-300 font-mono tabular-nums">
            Стр. <span className="font-semibold text-white">{currentPage}</span> из{' '}
            <span>{totalPages}</span>
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            className="text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
            title="Следующая страница"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom & Rotate & Clear */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-neutral-950/70 border border-neutral-800 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              className="p-1 text-neutral-400 hover:text-white rounded"
              title="Уменьшить"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-neutral-300 px-1 text-[11px] tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              className="p-1 text-neutral-400 hover:text-white rounded"
              title="Увеличить"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setScale(1.25)}
              className="px-1.5 py-0.5 text-[11px] text-neutral-400 hover:text-white rounded"
              title="Сбросить масштаб"
            >
              100%
            </button>
          </div>

          <button
            type="button"
            onClick={onRotateCurrentPage}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800/80 border border-neutral-700/80 rounded-lg hover:bg-neutral-700/80 transition-colors"
            title="Повернуть страницу на 90° по часовой стрелке"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>90°</span>
          </button>

          {currentAnnotations.length > 0 && (
            <button
              type="button"
              onClick={() => updateCurrentAnnotations([])}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition-colors"
              title="Очистить все добавленные элементы на этой странице"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Очистить</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Item Inspector Sub-bar */}
      {selectedItem && (
        <div className="h-11 border-b border-neutral-800 bg-neutral-900 px-6 flex items-center justify-between gap-4 shrink-0 text-xs text-neutral-300 z-10 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="font-medium text-neutral-400 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" />
              Настройка элемента:
            </span>

            {/* If Text */}
            {selectedItem.type === 'text' && (
              <div className="flex items-center gap-2">
                {/* Text input */}
                <input
                  type="text"
                  value={selectedItem.text}
                  onChange={(e) => {
                    const newText = e.target.value;
                    updateCurrentAnnotations(
                      currentAnnotations.map((a) =>
                        a.id === selectedItem.id ? { ...a, text: newText } : a
                      )
                    );
                  }}
                  className="bg-neutral-950 border border-neutral-700 rounded px-2 py-0.5 text-xs text-white w-48 focus:border-blue-500 focus:outline-hidden"
                />

                {/* Font Size */}
                <select
                  value={selectedItem.fontSize}
                  onChange={(e) => {
                    const sz = parseInt(e.target.value, 10);
                    updateCurrentAnnotations(
                      currentAnnotations.map((a) =>
                        a.id === selectedItem.id ? { ...a, fontSize: sz } : a
                      )
                    );
                  }}
                  className="bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-neutral-200 focus:outline-hidden"
                >
                  {[12, 14, 16, 18, 20, 24, 28, 32, 40].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} pt
                    </option>
                  ))}
                </select>

                {/* Color Presets */}
                <div className="flex items-center gap-1">
                  {[
                    { c: '#0f172a', name: 'Черный' },
                    { c: '#1e40af', name: 'Синий' },
                    { c: '#b91c1c', name: 'Красный' },
                    { c: '#15803d', name: 'Зеленый' },
                    { c: '#ffffff', name: 'Белый' },
                  ].map((color) => (
                    <button
                      key={color.c}
                      type="button"
                      onClick={() => {
                        updateCurrentAnnotations(
                          currentAnnotations.map((a) =>
                            a.id === selectedItem.id ? { ...a, fontColor: color.c } : a
                          )
                        );
                      }}
                      className={`w-4 h-4 rounded-full border transition-transform ${
                        selectedItem.fontColor === color.c
                          ? 'scale-125 border-blue-400 ring-1 ring-blue-400'
                          : 'border-neutral-700'
                      }`}
                      style={{ backgroundColor: color.c }}
                      title={color.name}
                    />
                  ))}
                </div>

                {/* Bold */}
                <button
                  type="button"
                  onClick={() => {
                    updateCurrentAnnotations(
                      currentAnnotations.map((a) =>
                        a.id === selectedItem.id ? { ...a, isBold: !selectedItem.isBold } : a
                      )
                    );
                  }}
                  className={`p-1 rounded ${
                    selectedItem.isBold
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Жирный"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                {/* Italic */}
                <button
                  type="button"
                  onClick={() => {
                    updateCurrentAnnotations(
                      currentAnnotations.map((a) =>
                        a.id === selectedItem.id ? { ...a, isItalic: !selectedItem.isItalic } : a
                      )
                    );
                  }}
                  className={`p-1 rounded ${
                    selectedItem.isItalic
                      ? 'bg-blue-600 text-white'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Курсив"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>

                {/* Background Whiteout toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const nextBg =
                      selectedItem.bgColor === '#ffffff'
                        ? '#fef08a'
                        : selectedItem.bgColor === '#fef08a'
                        ? 'transparent'
                        : '#ffffff';
                    updateCurrentAnnotations(
                      currentAnnotations.map((a) =>
                        a.id === selectedItem.id ? { ...a, bgColor: nextBg } : a
                      )
                    );
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                    selectedItem.bgColor === '#ffffff'
                      ? 'bg-white text-neutral-900 border-white'
                      : selectedItem.bgColor === '#fef08a'
                      ? 'bg-yellow-200 text-neutral-900 border-yellow-300'
                      : 'border-neutral-700 text-neutral-400 hover:text-white'
                  }`}
                  title="Подложка текста (прозрачная, белая замазка или желтый выделитель)"
                >
                  Фон:{' '}
                  {selectedItem.bgColor === '#ffffff'
                    ? 'Белый'
                    : selectedItem.bgColor === '#fef08a'
                    ? 'Желтый'
                    : 'Нет'}
                </button>
              </div>
            )}

            {/* If Image */}
            {selectedItem.type === 'image' && (
              <div className="flex items-center gap-3">
                <span className="text-neutral-400">
                  {selectedItem.label || 'Изображение'} ({selectedItem.width}% × {selectedItem.height}%)
                </span>
                <span className="text-neutral-400 text-[11px]">
                  Потяните за правый нижний угол рамки для изменения размера
                </span>
              </div>
            )}

            {/* If Shape */}
            {selectedItem.type === 'shape' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-400">Тип:</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentAnnotations(
                        currentAnnotations.map((a) =>
                          a.id === selectedItem.id
                            ? { ...a, fillColor: '#ffffff', opacity: 1 }
                            : a
                        )
                      );
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      selectedItem.fillColor === '#ffffff'
                        ? 'bg-white text-neutral-950 border-white font-medium'
                        : 'border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Белая замазка
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateCurrentAnnotations(
                        currentAnnotations.map((a) =>
                          a.id === selectedItem.id
                            ? { ...a, fillColor: '#fef08a', opacity: 0.5 }
                            : a
                        )
                      );
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] border ${
                      selectedItem.fillColor === '#fef08a'
                        ? 'bg-yellow-300 text-neutral-950 border-yellow-300 font-medium'
                        : 'border-neutral-700 text-neutral-400'
                    }`}
                  >
                    Маркер-выделитель
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleDeleteItem(selectedItem.id)}
            className="flex items-center gap-1 text-rose-400 hover:text-rose-300 transition-colors p-1"
            title="Удалить выбранный элемент"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Удалить элемент</span>
          </button>
        </div>
      )}

      {/* Main Document Scroll Viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-8 flex items-start justify-center relative bg-neutral-950"
      >
        <div className="relative inline-block shadow-2xl rounded-sm overflow-hidden bg-white">
          {/* Base PDF Canvas */}
          <canvas ref={canvasRef} className="block pointer-events-none" />

          {/* Interactive Annotation Overlay */}
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={`absolute inset-0 select-none ${
              activeTool === 'text'
                ? 'cursor-text'
                : activeTool === 'whiteout' || activeTool === 'highlight'
                ? 'cursor-crosshair'
                : 'cursor-default'
            }`}
          >
            {currentAnnotations.map((ann) => {
              const isSelected = selectedId === ann.id;

              if (ann.type === 'text') {
                return (
                  <div
                    key={ann.id}
                    onMouseDown={(e) => handleMouseDownItem(e, ann.id)}
                    className={`annotation-item absolute cursor-move group transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-1 rounded-xs'
                        : 'hover:ring-1 hover:ring-blue-400/60'
                    }`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      backgroundColor: ann.bgColor || 'transparent',
                      padding: '4px 6px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: `${ann.fontSize * (scale / 1.5)}px`,
                        color: ann.fontColor,
                        fontWeight: ann.isBold ? 'bold' : 'normal',
                        fontStyle: ann.isItalic ? 'italic' : 'normal',
                        lineHeight: 1.35,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {ann.text}
                    </div>

                    {isSelected && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(ann.id);
                        }}
                        className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-500"
                        title="Удалить"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              }

              if (ann.type === 'image') {
                return (
                  <div
                    key={ann.id}
                    onMouseDown={(e) => handleMouseDownItem(e, ann.id)}
                    className={`annotation-item absolute cursor-move group transition-shadow ${
                      isSelected
                        ? 'ring-2 ring-blue-500 rounded-xs'
                        : 'hover:ring-1 hover:ring-blue-400/60'
                    }`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: `${ann.width}%`,
                      height: `${ann.height}%`,
                    }}
                  >
                    <img
                      src={ann.dataUrl}
                      alt={ann.label || 'PDF Stamp'}
                      className="w-full h-full object-contain pointer-events-none"
                    />

                    {isSelected && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(ann.id);
                          }}
                          className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-500"
                          title="Удалить"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        {/* Resize handle */}
                        <div
                          onMouseDown={(e) => handleStartResize(e, ann.id)}
                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border border-white rounded-xs cursor-nwse-resize shadow-md"
                          title="Потяните для изменения размера"
                        />
                      </>
                    )}
                  </div>
                );
              }

              if (ann.type === 'shape') {
                return (
                  <div
                    key={ann.id}
                    onMouseDown={(e) => handleMouseDownItem(e, ann.id)}
                    className={`annotation-item absolute cursor-move group ${
                      isSelected
                        ? 'ring-2 ring-blue-500'
                        : 'hover:ring-1 hover:ring-blue-400/60'
                    }`}
                    style={{
                      left: `${ann.x}%`,
                      top: `${ann.y}%`,
                      width: `${ann.width}%`,
                      height: `${ann.height}%`,
                      backgroundColor: ann.fillColor,
                      opacity: ann.opacity ?? 1,
                      border: ann.borderColor ? `1px dashed ${ann.borderColor}` : undefined,
                    }}
                  >
                    {isSelected && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(ann.id);
                          }}
                          className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-md hover:bg-rose-500"
                          title="Удалить"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <div
                          onMouseDown={(e) => handleStartResize(e, ann.id)}
                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-600 border border-white rounded-xs cursor-nwse-resize shadow-md"
                          title="Потяните для изменения размера"
                        />
                      </>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
};
