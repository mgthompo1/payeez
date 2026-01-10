/**
 * Atlas Elements - Card Brand Icons
 *
 * SVG icons for all supported card brands with consistent sizing and styling.
 *
 * @packageDocumentation
 */

"use client";

import React from 'react';
import type { CardBrand } from '../lib/types';

interface CardBrandIconProps {
  /** The card brand to display */
  brand: CardBrand;
  /** Icon size in pixels */
  size?: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Card brand icon component with support for 15+ card networks
 */
export const CardBrandIcon: React.FC<CardBrandIconProps> = ({
  brand,
  size = 32,
  className,
}) => {
  const height = size * 0.667; // Maintain card aspect ratio
  const width = size;

  const icons: Record<CardBrand, JSX.Element> = {
    visa: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#1A1F71" width="48" height="32" rx="4"/>
        <path fill="#fff" d="M19.5 21h-2.7l1.7-10.5h2.7L19.5 21zm-5.1 0h-2.8l-2.3-8.2-.3 1.5-.8 4.3s-.1.6-.6.6H5l-.1-.3c.8-.3 1.7-.7 2.2-1l1.8 7.1h2.9l4.5-10.5h-2.9l-3.1 6.5zm17.1.1h2.5l-2.2-10.5h-2.2c-.5 0-.9.3-1.1.7l-4 9.8h2.8l.6-1.6h3.4l.2 1.6zm-3-3.8l1.4-3.9.8 3.9h-2.2zm-5.8-6.8l.4-2.1s-1-.4-2-.4c-1.1 0-3.7.5-3.7 2.9 0 2.3 3.1 2.3 3.1 3.5s-2.8.9-3.7.2l-.4 2.2s1 .5 2.5.5c1.5 0 3.9-.8 3.9-3 0-2.3-3.1-2.5-3.1-3.5s2.2-.8 3-.3z"/>
      </svg>
    ),
    mastercard: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#000" width="48" height="32" rx="4"/>
        <circle fill="#EB001B" cx="18" cy="16" r="10"/>
        <circle fill="#F79E1B" cx="30" cy="16" r="10"/>
        <path fill="#FF5F00" d="M24 8.8a10 10 0 0 0-3.8 7.2A10 10 0 0 0 24 23.2a10 10 0 0 0 3.8-7.2A10 10 0 0 0 24 8.8z"/>
      </svg>
    ),
    amex: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#006FCF" width="48" height="32" rx="4"/>
        <path fill="#fff" d="M8 12l-3 8h2.5l.5-1.3h3l.5 1.3H14l-3-8H8zm1.5 2l1 2.7h-2l1-2.7zm7.5-2h2.5l1.5 5 1.5-5H25l-2.5 8H20l-1.5-5.5-1.5 5.5h-2.5l-2.5-8h2.5l1.5 5 1.5-5zm10 0h6v1.5h-3.5v1.5h3.5v1.5h-3.5V19H33v1h-6v-8zm9 0h2.5l2 3 2-3H45l-3 4 3 4h-2.5l-2-3-2 3H36l3-4-3-4z"/>
      </svg>
    ),
    discover: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#fff" width="48" height="32" rx="4" stroke="#e5e7eb"/>
        <path fill="#F76F00" d="M0 20h48v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-8z"/>
        <circle fill="#F76F00" cx="28" cy="14" r="6"/>
        <text x="8" y="18" fontSize="8" fontWeight="bold" fill="#000">DISCOVER</text>
      </svg>
    ),
    diners: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#0079BE" width="48" height="32" rx="4"/>
        <circle fill="#fff" cx="24" cy="16" r="10" stroke="#0079BE" strokeWidth="2"/>
        <path fill="#0079BE" d="M24 8c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm-6 8c0-2.8 1.9-5.2 4.5-5.9v11.8c-2.6-.7-4.5-3.1-4.5-5.9zm7.5 5.9V10.1c2.6.7 4.5 3.1 4.5 5.9s-1.9 5.2-4.5 5.9z"/>
      </svg>
    ),
    jcb: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#fff" width="48" height="32" rx="4" stroke="#e5e7eb"/>
        <rect fill="#0B4EA2" x="8" y="6" width="10" height="20" rx="3"/>
        <rect fill="#E51523" x="19" y="6" width="10" height="20" rx="3"/>
        <rect fill="#009B3A" x="30" y="6" width="10" height="20" rx="3"/>
        <text x="10" y="20" fontSize="6" fontWeight="bold" fill="#fff">J</text>
        <text x="22" y="20" fontSize="6" fontWeight="bold" fill="#fff">C</text>
        <text x="33" y="20" fontSize="6" fontWeight="bold" fill="#fff">B</text>
      </svg>
    ),
    unionpay: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#034A82" width="48" height="32" rx="4"/>
        <path fill="#01798A" d="M16 4h12l-4 24H12z"/>
        <path fill="#DD0228" d="M24 4h12l-4 24H20z"/>
        <path fill="#034A82" d="M32 4h12l-4 24H28z"/>
        <text x="12" y="20" fontSize="6" fontWeight="bold" fill="#fff">银联</text>
      </svg>
    ),
    maestro: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#000" width="48" height="32" rx="4"/>
        <circle fill="#6C6BBD" cx="18" cy="16" r="10"/>
        <circle fill="#EB001B" cx="30" cy="16" r="10"/>
        <path fill="#6C6BBD" opacity="0.6" d="M24 8.8a10 10 0 0 0-3.8 7.2A10 10 0 0 0 24 23.2a10 10 0 0 0 3.8-7.2A10 10 0 0 0 24 8.8z"/>
      </svg>
    ),
    elo: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#000" width="48" height="32" rx="4"/>
        <circle fill="#FFCB05" cx="16" cy="16" r="6"/>
        <circle fill="#00A3DF" cx="24" cy="16" r="6"/>
        <circle fill="#EF4036" cx="32" cy="16" r="6"/>
        <text x="20" y="28" fontSize="6" fontWeight="bold" fill="#fff">elo</text>
      </svg>
    ),
    mir: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#0F754E" width="48" height="32" rx="4"/>
        <path fill="#fff" d="M8 12h4l2 4 2-4h4v8h-3v-5l-2 4h-2l-2-4v5H8v-8zm16 0h4l2 8h-3l-.3-1.5h-2.4l-.3 1.5h-3l3-8zm2 2.5l-.7 2.5h1.4l-.7-2.5zm6-2.5h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4v-8zm3 2v4h1c1.1 0 2-.9 2-2s-.9-2-2-2h-1z"/>
      </svg>
    ),
    hiper: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#F37421" width="48" height="32" rx="4"/>
        <text x="8" y="20" fontSize="10" fontWeight="bold" fill="#fff">Hiper</text>
      </svg>
    ),
    hipercard: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#822124" width="48" height="32" rx="4"/>
        <text x="6" y="20" fontSize="8" fontWeight="bold" fill="#fff">Hipercard</text>
      </svg>
    ),
    cartes_bancaires: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#1E3764" width="48" height="32" rx="4"/>
        <text x="8" y="18" fontSize="6" fontWeight="bold" fill="#fff">Cartes</text>
        <text x="8" y="24" fontSize="6" fontWeight="bold" fill="#fff">Bancaires</text>
      </svg>
    ),
    unknown: (
      <svg viewBox="0 0 48 32" width={width} height={height} className={className}>
        <rect fill="#E5E7EB" width="48" height="32" rx="4"/>
        <rect x="8" y="10" width="32" height="4" rx="1" fill="#9CA3AF"/>
        <rect x="8" y="18" width="20" height="4" rx="1" fill="#9CA3AF"/>
      </svg>
    ),
  };

  return icons[brand] || icons.unknown;
};

export default CardBrandIcon;
