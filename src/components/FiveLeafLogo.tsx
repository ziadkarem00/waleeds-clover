import React from "react";

interface FiveLeafEmblemProps {
  className?: string;
}

export function FiveLeafEmblem({ className = "w-7 h-7" }: FiveLeafEmblemProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 5th Top Leaf — Crimson Anti-Magic */}
      <path
        d="M32 30 C27.5 21 27 11.5 32 9.5 C37 11.5 36.5 21 32 30 Z"
        fill="#DC2626"
      />
      {/* Upper Right Leaf */}
      <path
        d="M33.2 31.2 C40 25 49.5 22 52 27.2 C52 32.5 42.5 34.2 33.2 31.2 Z"
        fill="#E4E4E7"
      />
      {/* Upper Left Leaf */}
      <path
        d="M30.8 31.2 C24 25 14.5 22 12 27.2 C12 32.5 21.5 34.2 30.8 31.2 Z"
        fill="#E4E4E7"
      />
      {/* Lower Right Leaf */}
      <path
        d="M33 33 C41.5 36 48.5 42.5 45 48 C39.5 50 35 41.5 33 33 Z"
        fill="#E4E4E7"
      />
      {/* Lower Left Leaf */}
      <path
        d="M31 33 C22.5 36 15.5 42.5 19 48 C24.5 50 29 41.5 31 33 Z"
        fill="#E4E4E7"
      />
      {/* Stem */}
      <path
        d="M32 34 C32 43 31 49.5 28.5 55"
        stroke="#A1A1AA"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Center Seal */}
      <circle cx="32" cy="32" r="3" fill="#09090B" stroke="#E4E4E7" strokeWidth="1.4" />
    </svg>
  );
}

interface FiveLeafLogoProps {
  onClick?: () => void;
}

export function FiveLeafLogo({ onClick }: FiveLeafLogoProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-2.5 text-left focus:outline-none sm:gap-3"
      aria-label="Waleed's Clover Home"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface transition-colors group-hover:border-zinc-700 sm:h-9 sm:w-9">
        <FiveLeafEmblem className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>

      <div className="min-w-0 flex flex-col">
        <div className="flex items-center gap-2.5">
          <span className="truncate text-xs font-semibold tracking-[0.12em] text-zinc-100 sm:text-[15px] sm:tracking-[0.14em]">
            WALEED&apos;S CLOVER
          </span>
          <span className="hidden border-l border-hairline pl-2.5 text-[11px] font-medium text-zinc-500 sm:inline">
            Dedicated to Walid
          </span>
        </div>
        <span className="truncate text-[10px] text-zinc-500 sm:text-[11px]">
          Black Clover · Season 1 (1–170)
        </span>
      </div>
    </button>
  );
}
