import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  FileCheck2,
  Image as ImageIcon,
  Layers,
  Settings2,
  CheckCircle2,
  Loader2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AnnotationItem } from '../types/pdf';
import { executeExport, downloadBlob, ExportSettings } from '../utils/exportHelper';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBytes: Uint8Array;
  totalPages: number;
  currentPage: number;
  annotationsByPage: Record<number, AnnotationItem[]>;
  currentFilename: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  pdfBytes,
  totalPages,
  currentPage,
  annotationsByPage,
  currentFilename,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'docx' | 'jpg' | 'png'>('pdf');
  const [filename, setFilename] = useState<string>(
    currentFilename.replace(/\.[^/.]+$/, '') || 'document'
  );
  const [pageScope, setPageScope] = useState<'all' | 'current' | 'custom'>('all');
  const [customRange, setCustomRange] = useState<string>('1');
  const [includeAnnotations, setIncludeAnnotations] = useState<boolean>(true);

  // JPG / PNG settings
  const [imageQuality, setImageQuality] = useState<number>(0.85); // 85%
  const [imageScale, setImageScale] = useState<number>(1.5); // 1.5x

  // DOCX settings
  const [docxTitle, setDocxTitle] = useState<string>('');
  const [includePageBreaks, setIncludePageBreaks] = useState<boolean>(true);

  // Status
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isDone, setIsDone] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setIsDone(false);
    setProgress(5);
    setStatusMessage('Инициализация экспорта...');

    try {
      const settings: ExportSettings = {
        format: selectedFormat,
        filename: filename.trim() || 'document',
        pageScope,
        currentPage,
        customPageRange: customRange,
        includeAnnotations,
        imageQuality,
        imageScale,
        includePageBreaks,
        docxTitle,
      };

      const result = await executeExport(
        pdfBytes,
        settings,
        annotationsByPage,
        (pct, msg) => {
          setProgress(pct);
          setStatusMessage(msg);
        }
      );

      setIsDone(true);
      downloadBlob(result.blob, result.filename);
      setTimeout(() => {
        setIsExporting(false);
        setIsDone(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Export error:', err);
      setStatusMessage(`Ошибка: ${err.message || 'Не удалось завершить экспорт'}`);
      setIsExporting(false);
    }
  };

  const formats = [
    {
      id: 'pdf',
      name: 'PDF Документ',
      ext: '.pdf',
      desc: 'Сохранение всех страниц с добавленным текстом, штампами и подписями.',
      icon: FileCheck2,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    },
    {
      id: 'docx',
      name: 'Word Документ',
      ext: '.docx',
      desc: 'Извлечение текста, заголовков и структуры страниц в редактируемый .docx.',
      icon: FileText,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      id: 'jpg',
      name: 'JPG Изображения',
      ext: '.jpg',
      desc: 'Сжатые растровые страницы с регулируемым качеством и выбором масштаба.',
      icon: ImageIcon,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      id: 'png',
      name: 'PNG Изображения',
      ext: '.png',
      desc: 'Четкие изображения страниц без потерь качества в высоком разрешении.',
      icon: Layers,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-100">
                Экспорт документа в другой формат
              </h3>
              <p className="text-xs text-neutral-400">
                Выберите целевой формат и настройте параметры вывода
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-neutral-400 hover:text-neutral-200 transition-colors p-1.5 rounded-lg hover:bg-neutral-800 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6 text-sm">
          {/* Format selection cards */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2.5">
              1. Выберите формат файла
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id as any)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500/80 bg-blue-500/10 ring-1 ring-blue-500/40 shadow-sm'
                        : 'border-neutral-800 bg-neutral-950/60 hover:bg-neutral-800/50 hover:border-neutral-700'
                    }`}
                  >
                    <div className={`p-2 rounded-lg border shrink-0 ${fmt.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium text-neutral-200">{fmt.name}</span>
                        <span className="font-mono text-xs text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-800">
                          {fmt.ext}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                        {fmt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filename input */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
              Имя итогового файла
            </label>
            <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 focus-within:border-blue-500">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Имя файла"
                className="bg-transparent text-neutral-100 text-sm focus:outline-hidden w-full"
              />
              <span className="font-mono text-xs text-neutral-400 select-none">
                .{selectedFormat}
              </span>
            </div>
          </div>

          {/* Page scope selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2">
              2. Диапазон страниц для экспорта
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPageScope('all')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-colors ${
                  pageScope === 'all'
                    ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                Все страницы ({totalPages})
              </button>
              <button
                type="button"
                onClick={() => setPageScope('current')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-colors ${
                  pageScope === 'current'
                    ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                Только текущая (Стр. {currentPage})
              </button>
              <button
                type="button"
                onClick={() => setPageScope('custom')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium text-center transition-colors ${
                  pageScope === 'custom'
                    ? 'bg-neutral-800 border-neutral-600 text-white shadow-xs'
                    : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                Выборочные страницы...
              </button>
            </div>

            {pageScope === 'custom' && (
              <div className="mt-2.5">
                <input
                  type="text"
                  value={customRange}
                  onChange={(e) => setCustomRange(e.target.value)}
                  placeholder="Например: 1-3, 5, 8"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-100 text-xs focus:outline-hidden focus:border-blue-500"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Укажите номера страниц через запятую или диапазон через дефис (от 1 до {totalPages})
                </span>
              </div>
            )}
          </div>

          {/* Format-specific Parameters */}
          <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950/70 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              <Settings2 className="w-4 h-4 text-neutral-400" />
              Параметры формата {selectedFormat.toUpperCase()}
            </div>

            {/* JPG Parameters */}
            {selectedFormat === 'jpg' && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-neutral-300">Качество сжатия JPEG:</span>
                    <span className="font-mono font-medium text-amber-400">
                      {Math.round(imageQuality * 100)}% {imageQuality >= 0.85 ? '(Высокое)' : imageQuality >= 0.6 ? '(Среднее)' : '(Компактный вес)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={imageQuality}
                    onChange={(e) => setImageQuality(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                    <span>30% (Мин. вес)</span>
                    <span>85% (Оптимально)</span>
                    <span>100% (Макс. детализация)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-neutral-300 mb-1.5">
                    Разрешение / Масштаб:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 1.0, label: 'Стандарт (72 DPI)' },
                      { val: 1.5, label: 'Четкое (108 DPI)' },
                      { val: 2.0, label: 'Печатное (144 DPI)' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setImageScale(opt.val)}
                        className={`py-1.5 px-2 text-xs rounded border transition-colors ${
                          imageScale === opt.val
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PNG Parameters */}
            {selectedFormat === 'png' && (
              <div>
                <label className="block text-xs text-neutral-300 mb-1.5">
                  Разрешение рендеринга (без потери качества):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 1.0, label: '1x (Стандарт)' },
                    { val: 1.5, label: '1.5x (HD Четкость)' },
                    { val: 2.0, label: '2x (Ultra HD)' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setImageScale(opt.val)}
                      className={`py-1.5 px-2 text-xs rounded border transition-colors ${
                        imageScale === opt.val
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DOCX Parameters */}
            {selectedFormat === 'docx' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs text-neutral-300 mb-1">
                    Заголовок документа Word (опционально):
                  </label>
                  <input
                    type="text"
                    value={docxTitle}
                    onChange={(e) => setDocxTitle(e.target.value)}
                    placeholder="Например: Акт или Договор"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={includePageBreaks}
                    onChange={(e) => setIncludePageBreaks(e.target.checked)}
                    className="rounded border-neutral-700 bg-neutral-900 text-blue-600 focus:ring-0"
                  />
                  <span>Вставлять разрывы страниц Word (Page Break) между страницами PDF</span>
                </label>
              </div>
            )}

            {/* General annotation toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 pt-1 border-t border-neutral-800/80">
              <input
                type="checkbox"
                checked={includeAnnotations}
                onChange={(e) => setIncludeAnnotations(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-blue-600 focus:ring-0"
              />
              <span>Включать наложенные надписи, подписи, штампы и правки редактора</span>
            </label>
          </div>

          {/* Export note for multi-page images */}
          {(selectedFormat === 'jpg' || selectedFormat === 'png') &&
            (pageScope === 'all' || pageScope === 'custom') && (
              <div className="text-xs text-neutral-400 bg-neutral-800/40 p-3 rounded-lg border border-neutral-800 flex items-center gap-2">
                <span className="text-blue-400 font-bold">ℹ</span>
                При экспорте нескольких страниц изображения будут упакованы в удобный ZIP-архив.
              </div>
            )}

          {/* Progress bar when exporting */}
          {isExporting && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300 font-medium flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                  {statusMessage}
                </span>
                <span className="font-mono text-blue-400 tabular-nums">{progress}%</span>
              </div>
              <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-neutral-950/80 border-t border-neutral-800 shrink-0">
          <div className="text-xs text-neutral-400">
            Формат:{' '}
            <span className="font-semibold text-neutral-200 uppercase">{selectedFormat}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-800 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleStartExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors rounded-lg shadow-sm disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Экспортировать и скачать
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
