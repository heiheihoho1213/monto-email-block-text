import React, { CSSProperties } from 'react';
import { z } from 'zod';

import EmailMarkdown from './EmailMarkdown';

const FONT_FAMILY_SCHEMA = z
  .enum([
    'MODERN_SANS',
    'BOOK_SANS',
    'ORGANIC_SANS',
    'GEOMETRIC_SANS',
    'HEAVY_SANS',
    'ROUNDED_SANS',
    'MODERN_SERIF',
    'BOOK_SERIF',
    'MONOSPACE',
  ])
  .nullable()
  .optional();

function getFontFamily(fontFamily: z.infer<typeof FONT_FAMILY_SCHEMA>) {
  switch (fontFamily) {
    case 'MODERN_SANS':
      return '"Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif';
    case 'BOOK_SANS':
      return 'Optima, Candara, "Noto Sans", source-sans-pro, sans-serif';
    case 'ORGANIC_SANS':
      return 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif';
    case 'GEOMETRIC_SANS':
      return 'Avenir, "Avenir Next LT Pro", Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif';
    case 'HEAVY_SANS':
      return 'Bahnschrift, "DIN Alternate", "Franklin Gothic Medium", "Nimbus Sans Narrow", sans-serif-condensed, sans-serif';
    case 'ROUNDED_SANS':
      return 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif';
    case 'MODERN_SERIF':
      return 'Charter, "Bitstream Charter", "Sitka Text", Cambria, serif';
    case 'BOOK_SERIF':
      return '"Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif';
    case 'MONOSPACE':
      return '"Nimbus Mono PS", "Courier New", "Cutive Mono", monospace';
  }
  return undefined;
}

const COLOR_SCHEMA = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

const PADDING_SCHEMA = z
  .object({
    top: z.number(),
    bottom: z.number(),
    right: z.number(),
    left: z.number(),
  })
  .optional()
  .nullable();

const getPadding = (padding: z.infer<typeof PADDING_SCHEMA>) =>
  padding ? `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px` : undefined;

const TEXT_DECORATION_SCHEMA = z
  .enum(['none', 'underline', 'line-through', 'underline line-through'])
  .optional()
  .nullable();

const INLINE_RUN_STYLE_SCHEMA = z.object({
  color: COLOR_SCHEMA.optional(),
  backgroundColor: COLOR_SCHEMA.optional(),
  fontSize: z.number().gte(0).optional().nullable(),
  fontFamily: FONT_FAMILY_SCHEMA.optional(),
  fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
  fontStyle: z.enum(['normal', 'italic']).optional().nullable(),
  textDecoration: TEXT_DECORATION_SCHEMA.optional(),
  lineHeight: z.number().gte(0).optional().nullable(),
  letterSpacing: z.union([z.number(), z.string()]).optional().nullable(),
});

const INLINE_LINK_SCHEMA = z.object({
  start: z.number(),
  end: z.number(),
  href: z.string().min(1),
  targetBlank: z.boolean().optional().nullable(),
});

export const TextPropsSchema = z.object({
  style: z
    .object({
      color: COLOR_SCHEMA,
      backgroundColor: COLOR_SCHEMA,
      fontSize: z.number().gte(0).optional().nullable(),
      fontFamily: FONT_FAMILY_SCHEMA,
      fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
      fontStyle: z.enum(['normal', 'italic']).optional().nullable(),
      textDecoration: TEXT_DECORATION_SCHEMA,
      lineHeight: z.number().gte(0).optional().nullable(),
      letterSpacing: z.union([z.number(), z.string()]).optional().nullable(),
      textAlign: z.enum(['left', 'center', 'right']).optional().nullable(),
      padding: PADDING_SCHEMA,
    })
    .optional()
    .nullable(),
  props: z
    .object({
      markdown: z.boolean().optional().nullable(),
      text: z.string().optional().nullable(),
      inlineRuns: z
        .array(
          z.object({
            start: z.number(),
            end: z.number(),
            style: INLINE_RUN_STYLE_SCHEMA,
          })
        )
        .optional()
        .nullable(),
      inlineLinks: z
        .array(INLINE_LINK_SCHEMA)
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

export type TextProps = z.infer<typeof TextPropsSchema>;

export const TextPropsDefaults = {
  text: '',
};

function getLetterSpacing(v: number | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return `${v}px`;
  return String(v);
}

type TextStyle = NonNullable<TextProps['style']>;
type InlineRun = { start: number; end: number; style: Record<string, unknown> };
type InlineLink = { start: number; end: number; href: string; targetBlank?: boolean | null };

function getEffectiveStyleAt(global: TextStyle | null | undefined, runs: InlineRun[] | null | undefined, index: number): TextStyle {
  const s: TextStyle = { ...global } as TextStyle;
  if (!runs) return s;
  for (const run of runs) {
    if (index >= run.start && index < run.end && run.style) {
      Object.assign(s, run.style);
    }
  }
  return s;
}

function getEffectiveLinkAt(links: InlineLink[] | null | undefined, index: number): InlineLink | null {
  if (!links) return null;
  for (const l of links) {
    if (index >= l.start && index < l.end) return l;
  }
  return null;
}

function getSafeHref(href: string): string | null {
  if (!href) return null;
  const v = href.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^mailto:/i.test(v)) return v;
  return null;
}

function styleToCss(s: TextStyle | null | undefined): CSSProperties {
  if (!s) return {};
  return {
    color: s.color ?? undefined,
    backgroundColor: s.backgroundColor ?? undefined,
    fontSize: s.fontSize ?? undefined,
    fontFamily: getFontFamily(s.fontFamily),
    fontWeight: s.fontWeight ?? undefined,
    fontStyle: s.fontStyle ?? undefined,
    textDecoration: s.textDecoration && s.textDecoration !== 'none' ? s.textDecoration : undefined,
    lineHeight: s.lineHeight ?? undefined,
    letterSpacing: getLetterSpacing(s.letterSpacing),
  };
}

export function Text({ style, props }: TextProps) {
  const text = props?.text ?? TextPropsDefaults.text;
  const inlineRuns = props?.inlineRuns ?? null;
  const inlineLinks = props?.inlineLinks ?? null;
  const baseStyle: CSSProperties = {
    ...styleToCss(style),
    textAlign: style?.textAlign ?? undefined,
    padding: getPadding(style?.padding),
    whiteSpace: 'pre-line',
  };

  if (props?.markdown) {
    return <EmailMarkdown style={baseStyle} markdown={text} />;
  }

  const len = text.length;
  const runs = (inlineRuns ?? [])
    .filter((r) => r.end > r.start && r.start < len)
    .map((r) => ({
      start: Math.max(0, r.start),
      end: Math.min(len, r.end),
      style: r.style || {},
    }));

  const links = inlineLinks
    ?.filter((l) => l.end > l.start && l.start < len)
    .map((l) => ({
      start: Math.max(0, l.start),
      end: Math.min(len, l.end),
      href: l.href,
      targetBlank: l.targetBlank ?? null,
    })) ?? null;

  const segments: { start: number; end: number }[] = [];
  let segStart = 0;
  for (let i = 1; i <= len; i++) {
    const styleA = JSON.stringify(styleToCss(getEffectiveStyleAt(style, runs, segStart)));
    const styleB = JSON.stringify(styleToCss(getEffectiveStyleAt(style, runs, i < len ? i : len - 1)));
    const linkA = getEffectiveLinkAt(links, segStart);
    const linkB = getEffectiveLinkAt(links, i < len ? i : len - 1);
    const linkKeyA = linkA ? `${linkA.href}|${linkA.targetBlank ? '1' : '0'}` : '';
    const linkKeyB = linkB ? `${linkB.href}|${linkB.targetBlank ? '1' : '0'}` : '';
    const keyA = `${styleA}|${linkKeyA}`;
    const keyB = `${styleB}|${linkKeyB}`;
    if (keyA !== keyB) {
      segments.push({ start: segStart, end: i });
      segStart = i;
    }
  }
  if (segStart < len) segments.push({ start: segStart, end: len });

  return (
    <div style={baseStyle}>
      {segments.map((seg, idx) => (
        (() => {
          const effectiveStyle = getEffectiveStyleAt(style, runs, seg.start);
          const effectiveLink = getEffectiveLinkAt(links, seg.start);
          const segmentText = text.slice(seg.start, seg.end);
          const span = (
            <span key={idx} style={styleToCss(effectiveStyle)}>
              {segmentText}
            </span>
          );
          if (!effectiveLink) return span;
          const safeHref = getSafeHref(effectiveLink.href);
          if (!safeHref) return span;
          return (
            <a
              key={idx}
              href={safeHref}
              target={effectiveLink.targetBlank ? '_blank' : undefined}
              rel={effectiveLink.targetBlank ? 'noopener noreferrer' : undefined}
              style={{ color: 'inherit', textDecoration: 'inherit' }}
            >
              {span}
            </a>
          );
        })()
      ))}
    </div>
  );
}
