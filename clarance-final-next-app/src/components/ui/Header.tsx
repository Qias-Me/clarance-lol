"use client";

import { useFormContext } from "@/lib/form-context";

interface HeaderProps {
  totalFields: number;
  onDownloadEditable: () => void;
  onDownloadFlattened: () => void;
  onClear: () => void;
  isDownloading?: boolean;
}

export function Header({ totalFields, onDownloadEditable, onDownloadFlattened, onClear, isDownloading = false }: HeaderProps): React.ReactNode {
  const { getFilledFieldCount, isLoading, lastSaved, saveData } = useFormContext();
  const filledCount = getFilledFieldCount();
  const progressPercent = totalFields > 0 ? Math.round((filledCount / totalFields) * 100) : 0;

  // Format last saved time
  const formatLastSaved = (timestamp: number | null): string => {
    if (!timestamp) return "Not saved";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">SF-86 Form Editor</h1>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
            Interactive PDF Mapping
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">
                {filledCount} / {totalFields} fields
              </p>
              <p className="text-xs text-gray-500">{progressPercent}% complete</p>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </div>
            )}
            {!isLoading && (
              <div className="text-sm text-gray-600">
                Last saved: <span className="font-medium">{formatLastSaved(lastSaved)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear All
            </button>

            <div className="flex items-center gap-1 border-l border-gray-300 pl-2">
              <button
                onClick={onDownloadEditable}
                disabled={isDownloading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                title="Download editable PDF (can be modified later)"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Editable PDF
                  </>
                )}
              </button>

              <button
                onClick={onDownloadFlattened}
                disabled={isDownloading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                title="Download flattened PDF (read-only, final version)"
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Flattened PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
