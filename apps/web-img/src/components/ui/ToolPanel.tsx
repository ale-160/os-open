'use client';

import React from 'react';

interface ToolPanelProps {
  children: React.ReactNode;
}

export function ToolPanel({ children }: ToolPanelProps) {
  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      <div className="flex-1 overflow-auto p-3 scrollbar-thin">
        {children}
      </div>
    </div>
  );
}
