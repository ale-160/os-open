'use client';

import React, { useState, useEffect, useCallback, memo } from 'react';

interface SliderWithInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  onChangeEnd: () => void;
  min: number;
  max: number;
  suffix?: string;
  labelClass?: string;
}

export const SliderWithInput = memo(function SliderWithInput({
  label,
  value,
  onChange,
  onChangeEnd,
  min,
  max,
  suffix = '%',
  labelClass = '',
}: SliderWithInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    if (!isEditing) {
      setInputValue(String(value));
    }
  }, [value, isEditing]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleInputBlur = useCallback(() => {
    let val = Number(inputValue);
    if (isNaN(val)) val = value;
    val = Math.max(min, Math.min(max, val));
    onChange(val);
    setIsEditing(false);
    onChangeEnd();
  }, [inputValue, value, min, max, onChange, onChangeEnd]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setInputValue(String(value));
      setIsEditing(false);
    }
  }, [handleInputBlur, value]);

  // 拖拽滑块时直接更新，不触发 apply；松开时才触发 apply
  const handleRangeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  }, [onChange]);

  const handleRangeEnd = useCallback(() => {
    onChangeEnd();
  }, [onChangeEnd]);

  return (
    <div>
      <div className={`flex items-center mb-1 ${labelClass}`}>
        <span className="text-sm font-medium">{label}：</span>
        {isEditing ? (
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-12 px-1 py-0 text-sm bg-background border border-border rounded text-center focus:outline-none focus:ring-2 focus:ring-ring/30"
            min={min}
            max={max}
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {value}{suffix}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleRangeChange}
        onMouseUp={handleRangeEnd}
        onTouchEnd={handleRangeEnd}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            handleRangeEnd();
          }
        }}
        className="w-full"
      />
    </div>
  );
});
