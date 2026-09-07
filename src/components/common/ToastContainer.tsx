/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToastMessage } from '../../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

/**
 * Toast 通知容器組件
 * 提供統一的錯誤和成功消息顯示 UI
 */
export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  const getToastStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-black';
      case 'info':
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getToastIcon = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div 
      className="fixed top-4 right-4 z-50 flex flex-col gap-2"
      role="region"
      aria-label="通知消息"
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            ${getToastStyles(toast.type)}
            px-4 py-3 rounded-lg shadow-lg
            flex items-center gap-3 min-w-[300px] max-w-md
            animate-slide-in-right
          `}
          role="alert"
          aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        >
          <span className="text-xl font-bold" aria-hidden="true">
            {getToastIcon(toast.type)}
          </span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-2 hover:opacity-75 transition-opacity"
            aria-label="關閉通知"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
