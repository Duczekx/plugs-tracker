"use client";

import { useEffect, useRef, useState } from "react";

export type CategoryOption = { value: string; label: string };

type CategoryFilterProps = {
  options: CategoryOption[];
  activeValues: string[];
  allLabel: string;
  label: string;
  onChange: (values: string[]) => void;
};

export default function CategoryFilter({
  options,
  activeValues,
  allLabel,
  label,
  onChange,
}: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!dropdownRef.current) {
        return;
      }
      if (!dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const activeLabel =
    activeValues.length === 0
      ? allLabel
      : activeValues.length === 1
        ? options.find((option) => option.value === activeValues[0])?.label ?? allLabel
        : `${label} (${activeValues.length})`;

  const isActive = (value: string) => activeValues.includes(value);

  return (
    <div className="category-filter">
      <div className="category-chips">
        <button
          type="button"
          className={`chip ${activeValues.length === 0 ? "active" : ""}`}
          onClick={() => onChange([])}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip ${isActive(option.value) ? "active" : ""}`}
            aria-pressed={isActive(option.value)}
            onClick={() => {
              if (isActive(option.value)) {
                onChange(activeValues.filter((value) => value !== option.value));
              } else {
                onChange([...activeValues, option.value]);
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="category-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className="button button-ghost category-trigger"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="category-trigger-label">{label}</span>
          <span className="category-trigger-value">{activeLabel}</span>
        </button>
        {isOpen && (
          <div className="category-menu">
            <button
              type="button"
              className={`category-option ${activeValues.length === 0 ? "active" : ""}`}
              onClick={() => {
                onChange([]);
                setIsOpen(false);
              }}
            >
              {allLabel}
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`category-option ${isActive(option.value) ? "active" : ""}`}
                onClick={() => {
                  if (isActive(option.value)) {
                    onChange(activeValues.filter((value) => value !== option.value));
                  } else {
                    onChange([...activeValues, option.value]);
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
