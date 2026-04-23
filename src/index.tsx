import React, { CSSProperties } from 'react';
import { z } from 'zod';

import {
  DEFAULT_TEXT_HTML,
  buildTemplateHtmlFromMessageAndVariables,
  legacyMessageToHtml,
  legacyTextToHtml,
  sanitizeTextHtml,
} from './sanitizeTextHtml';

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

export function getFontFamily(fontFamily: z.infer<typeof FONT_FAMILY_SCHEMA>) {
  switch (fontFamily) {
    case 'MODERN_SANS':
      return 'Helvetica, Arial, sans-serif';
    case 'BOOK_SANS':
      return 'Optima, Candara, source-sans-pro, sans-serif';
    case 'ORGANIC_SANS':
      return 'Seravek, Ubuntu, Calibri, source-sans-pro, sans-serif';
    case 'GEOMETRIC_SANS':
      return 'Avenir, Montserrat, Corbel, source-sans-pro, sans-serif';
    case 'HEAVY_SANS':
      return 'Bahnschrift, sans-serif-condensed, sans-serif';
    case 'ROUNDED_SANS':
      return 'ui-rounded, Quicksand, Comfortaa, Manjari, Calibri, source-sans-pro, sans-serif';
    case 'MODERN_SERIF':
      return 'Charter, Cambria, serif';
    case 'BOOK_SERIF':
      return 'P052, serif';
    case 'MONOSPACE':
      return 'monospace';
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

/** Text 块内「插入式变量」清单：与 message 中 token 顺序一致，用于 JSON 还原时区分手打 {{}} */
export const TextTemplateVariableEntrySchema = z.object({
  variableInstanceId: z.string().optional().nullable(),
  attribute: z.string(),
  variable: z.string(),
  type: z.enum(['user', 'system']).optional().nullable(),
});

export type TextTemplateVariableEntry = z.infer<typeof TextTemplateVariableEntrySchema>;

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
      /** 正文 HTML：内层 div + 多个 p，无 \\n 存储换行 */
      html: z.string().optional().nullable(),
      /** 纯文本 message：用于落库/索引/模板渲染（包含 {{}} / {% %} token），不含编辑器占位符 */
      message: z.string().optional().nullable(),
      /** 旧版纯文本（无换行），读时迁移为 html */
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
      inlineLinks: z.array(INLINE_LINK_SCHEMA).optional().nullable(),
      markdown: z.boolean().optional().nullable(),
      /** 变量默认值：key 为 span data-variable-instance-id（同一变量名多次插入各自独立），value 为默认展示文本 */
      variableDefaults: z.record(z.string()).optional().nullable(),
      /**
       * 插入式变量声明（与 `message` 中线性顺序一致）。解析模板时仅这些位置的 `{{}}`/`{% %}` 会还原为变量 span；
       * 未列入的同类字符视为手打纯文本。
       */
      variables: z.array(TextTemplateVariableEntrySchema).optional().nullable(),
    })
    .optional()
    .nullable(),
});

export type TextProps = z.infer<typeof TextPropsSchema>;

export const TextPropsDefaults = {
  html: DEFAULT_TEXT_HTML,
};

function getLetterSpacing(v: number | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return `${v}px`;
  return String(v);
}

type TextStyle = NonNullable<TextProps['style']>;

export function styleToCss(s: TextStyle | null | undefined): CSSProperties {
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

export function getResolvedTextBodyHtml(props: TextProps['props'] | null | undefined): string {
  const html = props?.html;
  if (typeof html === 'string' && html.trim()) {
    return sanitizeTextHtml(html);
  }

  const msg = typeof props?.message === 'string' ? props.message : '';
  const txt = typeof props?.text === 'string' ? props.text : '';
  const source = msg !== '' ? msg : txt;
  const variables = props?.variables;

  if (source !== '') {
    if (Array.isArray(variables) && variables.length > 0) {
      return sanitizeTextHtml(buildTemplateHtmlFromMessageAndVariables(source, variables));
    }
    if (msg !== '') {
      return sanitizeTextHtml(legacyMessageToHtml(msg));
    }
    return sanitizeTextHtml(legacyTextToHtml(txt));
  }

  return sanitizeTextHtml(DEFAULT_TEXT_HTML);
}

function resolveBodyHtml(props: TextProps['props']): string {
  return getResolvedTextBodyHtml(props ?? null);
}

export function Text({ style, props }: TextProps) {
  const baseStyle: CSSProperties = {
    ...styleToCss(style),
    textAlign: style?.textAlign ?? undefined,
    padding: getPadding(style?.padding),
    margin: 0,
  };

  const innerHtml = resolveBodyHtml(props ?? null);

  return (
    <div style={baseStyle}>
      <div dangerouslySetInnerHTML={{ __html: innerHtml }} />
    </div>
  );
}

export {
  DEFAULT_TEXT_HTML,
  buildTemplateHtmlFromMessageAndVariables,
  legacyMessageToHtml,
  legacyTextToHtml,
  sanitizeTextHtml,
} from './sanitizeTextHtml';
