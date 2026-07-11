"use client";

import { useState, useRef, useEffect } from "react";

type Suggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DEBOUNCE_MS = 400;

export function AddressAutocomplete({
  value,
  onChange,
  onSelectCoords,
  placeholder,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectCoords?: (lat: number, lng: number) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value.trim() || value.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetch(
        `${NOMINATIM_URL}?q=${encodeURIComponent(value)}&format=json&addressdetails=1&limit=5`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "LittleLibraryExchange/1.0 (address autocomplete)",
          },
        }
      )
        .then((r) => r.json())
        .then((data: Suggestion[]) => {
          setSuggestions(data);
          setOpen(data.length > 0);
        })
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(s: Suggestion) {
    onChange(s.display_name);
    onSelectCoords?.(parseFloat(s.lat), parseFloat(s.lon));
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim().length >= 3 && suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-10 w-full mt-1 py-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-auto"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.display_name}-${i}`}
              role="option"
              className="px-3 py-2 text-sm text-stone-800 cursor-pointer hover:bg-amber-50"
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
            >
              {s.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
