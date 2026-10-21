import React from 'react';
import {
  FileText,
  Edit3,
  Layers,
  Merge,
  Download,
  Upload,
  FileCode2,
  Sparkles,
} from 'lucide-react';
import { ActiveTab } from '../types/pdf';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenExportModal: () => void;
  onOpenInstallModal: () => void;
  onQuickDownloadPdf: () => void;
  onLoadSample: () => void;
  onUploadNewFile: (file: File) => void;
  hasDocument: boolean;
  pageCount: number;
  fileName: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenExportModal,
  onOpenInstallModal,
  onQuickDownloadPdf,
  onLoadSample,
  onUploadNewFile,
  hasDocument,
  pageCount,
  fileName,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadNewFile(e.target.files[0]);
    }
  };

  return (
    <header className="h-16 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur-md px-6 flex items-center justify-between gap-8 shrink-0 select-none z-30">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-base tracking-tight text-white leading-tight">
            PDF Мастер
          </span>
          {hasDocument ? (
            <span className="text-xs text-neutral-400 truncate max-w-[220px]">
              {fileName} · {pageCount} {pageCount === 1 ? 'стр.' : 'стр.'}
            </span>
          ) : (
            <span className="text-xs text-neutral-400">Редактор & Менеджер</span>
          )}
        </div>
      </div>

      {/* Zone 2: Navigation Links (single line, clean buttons) */}
      <nav className="flex items-center gap-1.5 p-1 bg-neutral-950/70 rounded-xl border border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'editor'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
          <span>Редактор</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pages')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'pages'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Страницы</span>
          {pageCount > 0 && (
            <span className="text-[11px] font-mono text-neutral-400 ml-0.5">
              ({pageCount})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('merge')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'merge'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Merge className="w-3.5 h-3.5 text-amber-400" />
          <span>Объединить файлы</span>
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Install / Download App button (not needed inside the desktop program) */}
        {import.meta.env.MODE !== 'electron' && (
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:text-white bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors whitespace-nowrap shrink-0"
            title="Как скачать или установить приложение"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Скачать приложение</span>
          </button>
        )}

        {!hasDocument && (
          <button
            type="button"
            onClick={onLoadSample}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700/80 rounded-lg border border-neutral-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Демо-образец</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700/80 rounded-lg border border-neutral-700/80 transition-colors whitespace-nowrap shrink-0"
          title="Открыть другой PDF-файл"
        >
          <Upload className="w-3.5 h-3.5 text-neutral-400" />
          <span>Открыть файл</span>
        </button>

        {hasDocument && (
          <>
            <button
              type="button"
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:text-white bg-neutral-800 border border-neutral-700 rounded-lg hover:border-neutral-600 transition-colors whitespace-nowrap shrink-0"
              title="Экспорт в DOCX, JPG, PNG или PDF"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Экспорт...</span>
            </button>

            <button
              type="button"
              onClick={onQuickDownloadPdf}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm shadow-blue-600/30 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Скачать PDF</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
