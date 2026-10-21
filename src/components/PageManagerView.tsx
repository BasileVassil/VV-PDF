import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  Scissors,
  RotateCw,
  Copy,
  CheckSquare,
  Square,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Download,
  FileText,
  Archive,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import {
  deletePagesFromPdf,
  extractPagesFromPdf,
  rotateSinglePage,
  duplicatePage,
  reorderAndRotatePages,
  downloadPdfBytes,
} from '../utils/pdfHelper';
import { downloadBlob } from '../utils/exportHelper';

interface PageManagerViewProps {
  pdfBytes: Uint8Array;
  totalPages: number;
  onPdfBytesChange: (newBytes: Uint8Array, newTotalPages: number) => void;
  onOpenPageInEditor: (pageNumber: number) => void;
  filename: string;
}

export const PageManagerView: React.FC<PageManagerViewProps> = ({
  pdfBytes,
  totalPages,
  onPdfBytesChange,
  onOpenPageInEditor,
  filename,
}) => {
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [isLoadingThumbs, setIsLoadingThumbs] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Render thumbnails for all pages
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingThumbs(true);

    const loadThumbnails = async () => {
      try {
        const bytesCopy = new Uint8Array(pdfBytes);
        const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
        const pdfDoc = await loadingTask.promise;
        const count = pdfDoc.numPages;

        const newThumbs: Record<number, string> = {};

        for (let i = 1; i <= count; i++) {
          if (isCancelled) return;
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: 0.35 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;

          await (page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          } as any) as any).promise;

          newThumbs[i] = canvas.toDataURL('image/jpeg', 0.8);
        }

        if (!isCancelled) {
          setThumbnails(newThumbs);
          setIsLoadingThumbs(false);
        }
      } catch (err) {
        console.error('Error generating thumbnails:', err);
        if (!isCancelled) setIsLoadingThumbs(false);
      }
    };

    loadThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [pdfBytes, totalPages]);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const togglePageSelect = (page: number) => {
    setSelectedPages((prev) =>
      prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].sort((a, b) => a - b)
    );
  };

  const handleSelectAll = () => {
    if (selectedPages.length === totalPages) {
      setSelectedPages([]);
    } else {
      setSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
    }
  };

  // Delete selected or single page
  const handleDeletePages = async (pagesToDelete: number[]) => {
    if (pagesToDelete.length === 0) return;
    if (pagesToDelete.length >= totalPages) {
      alert('Нельзя удалить все страницы документа. Должна остаться хотя бы одна страница.');
      return;
    }

    if (!confirm(`Удалить ${pagesToDelete.length} ${pagesToDelete.length === 1 ? 'страницу' : 'страниц'}?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const newBytes = await deletePagesFromPdf(pdfBytes, pagesToDelete);
      const newCount = totalPages - pagesToDelete.length;
      onPdfBytesChange(newBytes, newCount);
      setSelectedPages([]);
      showNotice(`Успешно удалено страниц: ${pagesToDelete.length}`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении страниц');
    } finally {
      setIsProcessing(false);
    }
  };

  // Extract / Separate selected pages into standalone PDF
  const handleExtractSelectedPages = async () => {
    if (selectedPages.length === 0) return;
    setIsProcessing(true);
    try {
      const extractedBytes = await extractPagesFromPdf(pdfBytes, selectedPages);
      const baseName = filename.replace(/\.[^/.]+$/, '');
      const outName = `${baseName}_отделенные_стр_${selectedPages.join('_')}.pdf`;
      downloadPdfBytes(extractedBytes, outName);
      showNotice(`Отделено и скачано страниц: ${selectedPages.length}`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при извлечении страниц');
    } finally {
      setIsProcessing(false);
    }
  };

  // Rotate single or selected pages
  const handleRotatePage = async (page: number) => {
    setIsProcessing(true);
    try {
      const newBytes = await rotateSinglePage(pdfBytes, page, 90);
      onPdfBytesChange(newBytes, totalPages);
      showNotice(`Страница ${page} повернута на 90°`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при повороте страницы');
    } finally {
      setIsProcessing(false);
    }
  };

  // Duplicate a page
  const handleDuplicatePage = async (page: number) => {
    setIsProcessing(true);
    try {
      const newBytes = await duplicatePage(pdfBytes, page);
      onPdfBytesChange(newBytes, totalPages + 1);
      showNotice(`Страница ${page} успешно продублирована`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при дублировании страницы');
    } finally {
      setIsProcessing(false);
    }
  };

  // Move page left or right
  const handleMovePage = async (pageIndex: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? pageIndex - 1 : pageIndex + 1;
    if (targetIndex < 0 || targetIndex >= totalPages) return;

    const currentOrder = Array.from({ length: totalPages }, (_, i) => i + 1);
    const temp = currentOrder[pageIndex];
    currentOrder[pageIndex] = currentOrder[targetIndex];
    currentOrder[targetIndex] = temp;

    setIsProcessing(true);
    try {
      const newBytes = await reorderAndRotatePages(pdfBytes, currentOrder);
      onPdfBytesChange(newBytes, totalPages);
      showNotice(`Порядок страниц обновлен`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при перемещении страницы');
    } finally {
      setIsProcessing(false);
    }
  };

  // Split entire document into individual 1-page PDF files zipped
  const handleSplitAllIntoZip = async () => {
    if (totalPages <= 1) {
      alert('В документе всего 1 страница. Разделение не требуется.');
      return;
    }

    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const baseName = filename.replace(/\.[^/.]+$/, '');
      const folder = zip.folder(`${baseName}_постранично`) || zip;

      for (let i = 1; i <= totalPages; i++) {
        const singlePageBytes = await extractPagesFromPdf(pdfBytes, [i]);
        const padNum = String(i).padStart(3, '0');
        folder.file(`page_${padNum}.pdf`, singlePageBytes);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, `${baseName}_все_страницы_отдельно.zip`);
      showNotice(`Документ разделен на ${totalPages} отдельных PDF и упакован в ZIP`);
    } catch (err) {
      console.error(err);
      alert('Ошибка при разделении документа');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative select-none">
      {/* Top action bar */}
      <div className="h-14 border-b border-neutral-800 bg-neutral-900/90 px-6 flex items-center justify-between gap-4 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700/80 bg-neutral-800/80 text-neutral-300 hover:text-white transition-colors"
          >
            {selectedPages.length === totalPages ? (
              <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span>
              {selectedPages.length === totalPages ? 'Снять выбор' : 'Выбрать все страницы'}
            </span>
          </button>

          {selectedPages.length > 0 && (
            <span className="text-xs text-neutral-400 font-mono ml-2">
              Выбрано: <strong className="text-white">{selectedPages.length}</strong> из {totalPages}
            </span>
          )}
        </div>

        {/* Selected batch actions */}
        <div className="flex items-center gap-2">
          {selectedPages.length > 0 ? (
            <>
              <button
                type="button"
                onClick={handleExtractSelectedPages}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-500 shadow-xs transition-colors"
                title="Создать и скачать новый PDF файл только с выбранными страницами"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Отделить в отдельный PDF ({selectedPages.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeletePages(selectedPages)}
                disabled={isProcessing || selectedPages.length >= totalPages}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors disabled:opacity-40"
                title="Удалить выбранные страницы из документа"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить выбранные</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSplitAllIntoZip}
              disabled={isProcessing || totalPages <= 1}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-700/80 bg-neutral-800/80 text-neutral-300 hover:text-white transition-colors"
              title="Разделить каждую страницу на отдельный PDF-файл в одном ZIP-архиве"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Разделить весь документ по 1 странице (ZIP)</span>
            </button>
          )}
        </div>
      </div>

      {/* Action feedback notice toast */}
      {actionNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium shadow-xl border border-blue-400/30 animate-bounce">
          {actionNotice}
        </div>
      )}

      {/* Page Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {Array.from({ length: totalPages }, (_, idx) => {
              const pageNum = idx + 1;
              const isSelected = selectedPages.includes(pageNum);
              const thumbUrl = thumbnails[pageNum];

              return (
                <div
                  key={pageNum}
                  className={`group relative rounded-xl border bg-neutral-900 overflow-hidden flex flex-col transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10'
                      : 'border-neutral-800 hover:border-neutral-700 shadow-sm'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-3 py-2 bg-neutral-950/60 border-b border-neutral-800/80 text-xs">
                    <button
                      type="button"
                      onClick={() => togglePageSelect(pageNum)}
                      className="flex items-center gap-1.5 text-neutral-300 hover:text-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-neutral-500" />
                      )}
                      <span className="font-mono font-medium">Стр. {pageNum}</span>
                    </button>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Move left */}
                      <button
                        type="button"
                        disabled={idx === 0 || isProcessing}
                        onClick={() => handleMovePage(idx, 'left')}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
                        title="Переместить левее"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      {/* Move right */}
                      <button
                        type="button"
                        disabled={idx === totalPages - 1 || isProcessing}
                        onClick={() => handleMovePage(idx, 'right')}
                        className="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
                        title="Переместить правее"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Preview */}
                  <div
                    onClick={() => togglePageSelect(pageNum)}
                    className="relative aspect-3/4 bg-neutral-950 p-3 flex items-center justify-center cursor-pointer overflow-hidden"
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Страница ${pageNum}`}
                        className="w-full h-full object-contain shadow-md rounded-xs bg-white"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-600 gap-2">
                        <FileText className="w-8 h-8 animate-pulse text-neutral-500" />
                        <span className="text-[11px]">Загрузка...</span>
                      </div>
                    )}

                    {/* Quick Open in Editor Button overlay */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPageInEditor(pageNum);
                      }}
                      className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-2xs gap-1.5 text-xs text-white font-medium"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-400" />
                      <span>Открыть в редакторе</span>
                    </button>
                  </div>

                  {/* Action Bar per Card */}
                  <div className="flex items-center justify-around px-2 py-2 bg-neutral-950 border-t border-neutral-800 text-neutral-400 text-xs">
                    <button
                      type="button"
                      onClick={() => handleRotatePage(pageNum)}
                      className="p-1.5 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                      title="Повернуть на 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicatePage(pageNum)}
                      className="p-1.5 hover:text-white hover:bg-neutral-800 rounded transition-colors"
                      title="Дублировать страницу"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const singleBytes = await extractPagesFromPdf(pdfBytes, [pageNum]);
                        const baseName = filename.replace(/\.[^/.]+$/, '');
                        downloadPdfBytes(singleBytes, `${baseName}_страница_${pageNum}.pdf`);
                        showNotice(`Страница ${pageNum} скачана как отдельный PDF`);
                      }}
                      className="p-1.5 hover:text-blue-400 hover:bg-neutral-800 rounded transition-colors"
                      title="Отделить и скачать эту страницу отдельно"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={totalPages <= 1}
                      onClick={() => handleDeletePages([pageNum])}
                      className="p-1.5 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title={totalPages <= 1 ? 'Нельзя удалить единственную страницу' : 'Удалить эту страницу'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
