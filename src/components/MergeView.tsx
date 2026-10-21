import React, { useState, useRef } from 'react';
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  FileText,
  Merge,
  Download,
  Eye,
  CheckCircle2,
  AlertCircle,
  Upload,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { MergeFileItem } from '../types/pdf';
import { mergePdfDocuments, downloadPdfBytes } from '../utils/pdfHelper';

interface MergeViewProps {
  currentPdfBytes?: Uint8Array | null;
  currentFilename?: string;
  onLoadMergedPdf: (mergedBytes: Uint8Array, name: string) => void;
}

export const MergeView: React.FC<MergeViewProps> = ({
  currentPdfBytes,
  currentFilename,
  onLoadMergedPdf,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<MergeFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Initialize with current file if present and queue is empty
  React.useEffect(() => {
    if (currentPdfBytes && files.length === 0) {
      addPdfBytesToQueue(
        currentPdfBytes,
        currentFilename || 'Текущий документ.pdf'
      );
    }
  }, [currentPdfBytes]);

  const addPdfBytesToQueue = async (data: Uint8Array, name: string) => {
    try {
      const bytesCopy = new Uint8Array(data);
      const loadingTask = pdfjsLib.getDocument({ data: bytesCopy });
      const pdfDoc = await loadingTask.promise;
      const pageCount = pdfDoc.numPages;

      const item: MergeFileItem = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name,
        size: data.byteLength,
        pageCount,
        data,
      };

      setFiles((prev) => [...prev, item]);
    } catch (err) {
      console.error('Error adding PDF to queue:', err);
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        continue;
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await addPdfBytesToQueue(bytes, file.name);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= files.length) return;

    setFiles((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated;
    });
  };

  const removeItem = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const totalCombinedPages = files.reduce((acc, f) => acc + f.pageCount, 0);

  const handleExecuteMerge = async (openInEditor: boolean = true) => {
    if (files.length < 2) {
      alert('Для объединения добавьте как минимум 2 PDF файла.');
      return;
    }

    setIsProcessing(true);
    try {
      const byteArrays = files.map((f) => f.data);
      const mergedBytes = await mergePdfDocuments(byteArrays);
      const mergedName = `Объединенный_${files[0].name.replace(/\.[^/.]+$/, '')}_и_еще_${files.length - 1}.pdf`;

      if (openInEditor) {
        onLoadMergedPdf(mergedBytes, mergedName);
        setSuccessNotice('Файлы успешно объединены и открыты в редакторе!');
      } else {
        downloadPdfBytes(mergedBytes, mergedName);
        setSuccessNotice('Объединенный PDF успешно сформирован и скачан!');
      }

      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err: any) {
      console.error('Merge error:', err);
      alert(`Ошибка при объединении: ${err.message || 'Проверьте файлы'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 overflow-y-auto p-8 select-none">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />

        {/* Title & Introduction */}
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Merge className="w-5 h-5 text-blue-400" />
            Объединение PDF файлов
          </h2>
          <p className="text-xs text-neutral-400">
            Соединяйте несколько документов PDF в единый файл в нужном порядке.
          </p>
        </div>

        {/* Success toast notice */}
        {successNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Drop zone / Add files button */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
            dragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900/80 hover:border-neutral-700'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-200">
              Перетащите PDF файлы сюда или нажмите для выбора
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Поддерживается одновременный выбор нескольких файлов
            </p>
          </div>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить файлы PDF
          </button>
        </div>

        {/* Files queue list */}
        {files.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-400 px-1">
              <span>Очередь файлов ({files.length}):</span>
              <span className="font-mono tabular-nums text-neutral-300">
                Всего страниц в итоге: <strong>{totalCombinedPages}</strong>
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {files.map((file, idx) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/80 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-md bg-neutral-800 text-neutral-400 text-xs font-mono flex items-center justify-center font-semibold shrink-0">
                      {idx + 1}
                    </span>
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-200 truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span>{file.pageCount} {file.pageCount === 1 ? 'страница' : 'страниц'}</span>
                        <span>·</span>
                        <span className="font-mono">{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ordering and remove actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, 'up')}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-20"
                      title="Переместить вверх"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === files.length - 1}
                      onClick={() => moveItem(idx, 'down')}
                      className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded disabled:opacity-20"
                      title="Переместить вниз"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(file.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded ml-1"
                      title="Удалить из очереди"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom merge action bar */}
            <div className="mt-4 p-5 rounded-xl border border-neutral-800 bg-neutral-900 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-neutral-100">
                  Готово к объединению {files.length} {files.length === 1 ? 'файла' : 'файлов'}
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Итоговый документ будет содержать {totalCombinedPages} стр.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={files.length < 2 || isProcessing}
                  onClick={() => handleExecuteMerge(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg border border-neutral-700 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать объединенный</span>
                </button>

                <button
                  type="button"
                  disabled={files.length < 2 || isProcessing}
                  onClick={() => handleExecuteMerge(true)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors disabled:opacity-40"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Объединить и открыть в редакторе</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
