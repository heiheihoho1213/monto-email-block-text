import insane, { AllowedTags } from 'insane';

const ALLOWED_TAGS: AllowedTags[] = [
  'a',
  'b',
  'br',
  'div',
  'em',
  'i',
  'p',
  'span',
  'strong',
  'u',
];

const GENERIC_ALLOWED_ATTRIBUTES = ['style', 'title'];

/** 空段落：ZWSP + br（与编辑器 normalize 一致，便于扁平 offset） */
export const DEFAULT_TEXT_HTML =
  '<div style="margin:0;padding:0;"><p style="margin:0;">\u200B<br /></p></div>';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 旧版纯 text（无换行）→ 单段 HTML */
export function legacyTextToHtml(text: string): string {
  if (!text) {
    return DEFAULT_TEXT_HTML;
  }
  return `<div style="margin:0;padding:0;"><p style="margin:0;">${escapeHtml(text)}</p></div>`;
}

/** message 按 \\n 拆段，与编辑器 computeMessage 对齐；空行 → 占位段 */
export function legacyMessageToHtml(message: string): string {
  if (!message) return DEFAULT_TEXT_HTML;
  const lines = message.split('\n');
  let body = '<div style="margin:0;padding:0;">';
  for (const line of lines) {
    if (line === '') {
      body += `<p style="margin:0;">\u200B<br /></p>`;
    } else {
      body += `<p style="margin:0;">${escapeHtml(line)}</p>`;
    }
  }
  body += '</div>';
  return body;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '&#10;');
}

function createVariableInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

const VARIABLE_TOKEN_IN_TEXT_RE = /\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}|\{\%([A-Za-z_][A-Za-z0-9_]*)\%\}/g;

const VARIABLE_SPAN_STYLE =
  'white-space:nowrap;display:inline-block;overflow-wrap:normal;word-break:normal;border:1px solid rgba(25, 118, 210, 0.55);border-radius:4px;padding:0 4px;box-shadow:inset 0 -999px 0 rgba(25, 118, 210, 0.08);user-select:all;-webkit-user-select:all';

function variableSpanHtml(tokenText: string, instanceId: string): string {
  const dt = escapeHtmlAttr(tokenText);
  const di = escapeHtmlAttr(instanceId);
  return `<span data-text-variable="${dt}" data-variable-instance-id="${di}" contenteditable="false" contentEditable="false" style="${VARIABLE_SPAN_STYLE}">${escapeHtml(tokenText)}</span>`;
}

/**
 * 由 message + props.variables 还原正文 HTML：仅与 variables 数组顺序、token 完全一致的 `{{}}`/`{% %}` 会变为插入式变量 span，其余手打 token 保持纯文本。
 */
export function buildTemplateHtmlFromMessageAndVariables(
  message: string,
  variables: ReadonlyArray<{
    variableInstanceId?: string | null;
    attribute: string;
    variable: string;
  }>,
): string {
  if (!message) return DEFAULT_TEXT_HTML;
  const lines = message.split('\n');
  let qi = 0;
  let body = '<div style="margin:0;padding:0;">';
  for (const line of lines) {
    if (line === '') {
      body += `<p style="margin:0;">\u200B<br /></p>`;
      continue;
    }
    body += '<p style="margin:0;">';
    let last = 0;
    VARIABLE_TOKEN_IN_TEXT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VARIABLE_TOKEN_IN_TEXT_RE.exec(line))) {
      if (m.index > last) body += escapeHtml(line.slice(last, m.index));
      const raw = m[0];
      const name = (m[1] || m[2])!;
      const builtin = !!m[2];
      const spec = variables[qi];
      const specAttr = (spec?.attribute ?? '').trim();
      const specVar = (spec?.variable ?? '').trim();
      const specOk =
        !!spec &&
        specAttr === name &&
        specVar === raw &&
        (builtin ? specVar.startsWith('{%') : specVar.startsWith('{{'));
      if (specOk) {
        const iid = (spec.variableInstanceId ?? '').trim() || createVariableInstanceId();
        body += variableSpanHtml(raw, iid);
        qi += 1;
      } else {
        body += escapeHtml(raw);
      }
      last = m.index + raw.length;
    }
    if (last < line.length) body += escapeHtml(line.slice(last));
    body += '</p>';
  }
  body += '</div>';
  return body;
}

export function sanitizeTextHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return DEFAULT_TEXT_HTML;
  }
  return insane(trimmed, {
    allowedTags: ALLOWED_TAGS,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedAttributes: {
      ...ALLOWED_TAGS.reduce<Record<string, string[]>>((res, tag) => {
        res[tag] = [...GENERIC_ALLOWED_ATTRIBUTES];
        return res;
      }, {}),
      // 编辑器编辑态外层容器：会动态写入 contenteditable="true"
      div: ['contenteditable', ...GENERIC_ALLOWED_ATTRIBUTES],
      // 编辑器插入式变量：使用 span[data-text-variable][data-variable-instance-id][contenteditable="false"] 表示“原子 token”
      span: ['data-text-variable', 'data-variable-instance-id', 'contenteditable', ...GENERIC_ALLOWED_ATTRIBUTES],
      a: ['href', 'target', 'rel', ...GENERIC_ALLOWED_ATTRIBUTES],
      br: [] as string[],
    },
    filter: (token) => {
      if (token.tag === 'a' && 'href' in token.attrs && token.attrs.href === undefined) {
        token.attrs.href = '';
      }
      return true;
    },
  });
}
