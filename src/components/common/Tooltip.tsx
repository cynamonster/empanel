import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  side?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  side = 'top',
  align = 'center',
  className = '',
  children,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap flex flex-col ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } ${
            align === 'right'
              ? 'right-0 items-end'
              : align === 'left'
              ? 'left-0 items-start'
              : 'left-1/2 -translate-x-1/2 items-center'
          } transition-all duration-150`}
        >
          {side === 'bottom' && (
            <div
              className={`w-1.5 h-1.5 rotate-45 bg-slate-950 border-l border-t border-slate-700 -mb-1 z-10 ${
                align === 'right' ? 'mr-2.5' : align === 'left' ? 'ml-2.5' : ''
              }`}
            />
          )}

          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-100 bg-slate-950/95 border border-slate-700/90 rounded-lg shadow-2xl backdrop-blur-md">
            {content}
          </div>

          {side === 'top' && (
            <div
              className={`w-1.5 h-1.5 rotate-45 bg-slate-950 border-r border-b border-slate-700 -mt-1 ${
                align === 'right' ? 'mr-2.5' : align === 'left' ? 'ml-2.5' : ''
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
};
