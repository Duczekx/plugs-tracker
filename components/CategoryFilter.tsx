"use client";

import { useEffect, useRef, useState } from "react";

export type CategoryOption = { value: string; label: string };

type CategoryFilterProps = {
  options: CategoryOption[];
  activeValue: string;
  allLabel: string;
  label: string;
  onChange: (value: string) => void;
};

export default function CategoryFilter({
  options,
  activeValue,
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
    activeValue === "all"
      ? allLabel
      : options.find((option) => option.value === activeValue)?.label ?? allLabel;

  return (
    <div className="category-filter">
      <div className="category-chips">
        <button
          type="button"
          className={`chip ${activeValue === "all" ? "active" : ""}`}
          onClick={() => onChange("all")}
        >
          {allLabel}
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`chip ${activeValue === option.value ? "active" : ""}`}
            onClick={() => onChange(option.value)}
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
              className={`category-option ${activeValue === "all" ? "active" : ""}`}
              onClick={() => {
                onChange("all");
                setIsOpen(false);
              }}
            >
              {allLabel}
            </button>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`category-option ${
                  activeValue === option.value ? "active" : ""
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
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
