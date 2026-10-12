import React from 'react';
import { KpiCategory, KpiCategoryItem, PerspectiveCategory } from '../../types';

export const DEFAULT_PALETTE: { [key: string]: { bg: string; text: string; border: string; hex: string } } = {
  '#0284c7': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', hex: '#0284c7' },
  '#10b981': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981' },
  '#8b5cf6': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', hex: '#8b5cf6' },
  '#f59e0b': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: '#f59e0b' },
  '#ec4899': { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', hex: '#ec4899' },
  '#6366f1': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', hex: '#6366f1' },
  '#14b8a6': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', hex: '#14b8a6' },
  '#f97316': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', hex: '#f97316' },
};

export const COLOR_OPTIONS = [
  { name: 'Sky Blue', hex: '#0284c7', bgClass: 'bg-sky-500' },
  { name: 'Emerald Green', hex: '#10b981', bgClass: 'bg-emerald-500' },
  { name: 'Violet Purple', hex: '#8b5cf6', bgClass: 'bg-purple-500' },
  { name: 'Warm Amber', hex: '#f59e0b', bgClass: 'bg-amber-500' },
  { name: 'Rose Pink', hex: '#ec4899', bgClass: 'bg-pink-500' },
  { name: 'Royal Indigo', hex: '#6366f1', bgClass: 'bg-indigo-500' },
  { name: 'Fresh Teal', hex: '#14b8a6', bgClass: 'bg-teal-500' },
  { name: 'Bright Orange', hex: '#f97316', bgClass: 'bg-orange-500' },
];

export const getCategoryMeta = (
  catNameOrId: string,
  categories: KpiCategoryItem[] = []
): { color: string; bgClass: string; textClass: string; borderClass: string; icon: React.ReactNode; displayName: string } => {
  const normalized = (catNameOrId || '').toLowerCase().trim();
  const matched = categories.find(
    c => c.id.toLowerCase() === normalized || c.name.toLowerCase() === normalized
  );

  let hex = matched?.color || '#0284c7';
  if (!matched) {
    if (normalized.includes('deposit')) hex = '#0284c7';
    else if (normalized.includes('customer')) hex = '#10b981';
    else if (normalized.includes('mobile')) hex = '#8b5cf6';
    else if (normalized.includes('card')) hex = '#f59e0b';
    else if (normalized.includes('internet') || normalized.includes('web')) hex = '#ec4899';
    else if (normalized.includes('forex') || normalized.includes('remittance')) hex = '#14b8a6';
    else if (normalized.includes('loan') || normalized.includes('credit')) hex = '#6366f1';
    else hex = '#f97316';
  }

  const palette = DEFAULT_PALETTE[hex] || {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    hex,
  };

  // Select appropriate icon
  let icon: React.ReactNode = (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );

  if (normalized.includes('deposit') || normalized.includes('saving')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" />
      </svg>
    );
  } else if (normalized.includes('customer') || normalized.includes('account')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.125-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.125-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  } else if (normalized.includes('mobile')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  } else if (normalized.includes('card')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    );
  } else if (normalized.includes('internet') || normalized.includes('web') || normalized.includes('portal')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    );
  } else if (normalized.includes('forex') || normalized.includes('remittance') || normalized.includes('foreign')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  } else if (normalized.includes('loan') || normalized.includes('credit') || normalized.includes('advance')) {
    icon = (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    );
  }

  return {
    color: hex,
    bgClass: palette.bg,
    textClass: palette.text,
    borderClass: palette.border,
    icon,
    displayName: matched?.name || catNameOrId,
  };
};
