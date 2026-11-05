import { useEffect, useMemo, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Extension, RangeSetBuilder, StateEffect, StateField, Text } from '@codemirror/state';
import { Decoration, DecorationSet } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { getCodeMirrorLang } from '../../../utils/codeLanguage';
import { findDuplicateLines } from '../utils/conflictRelation';

interface ConflictCodeEditorProps {
  value: string;
  filePath?: string;
  onChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  readOnly?: boolean;
  highlightDuplicates?: boolean;
  matchedLines?: number[];
}

const duplicateLineDecoration = Decoration.line({ class: 'cm-dup-line' });
const duplicateExtraDecoration = Decoration.line({ class: 'cm-dup-line cm-dup-line-extra' });
const matchedLineDecoration = Decoration.line({ class: 'cm-matched-line' });
const setMatchedLines = StateEffect.define<number[]>();

function buildLineDecorations(doc: Text, lineIndexes: number[], decoration: Decoration): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const index of [...lineIndexes].sort((a, b) => a - b)) {
    if (index < 0 || index >= doc.lines) continue;
    const line = doc.line(index + 1);
    builder.add(line.from, line.from, decoration);
  }

  return builder.finish();
}

function buildDuplicateDecorations(doc: Text): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const duplicate of findDuplicateLines(doc.toString())) {
    for (let i = 0; i < duplicate.occurrences; i++) {
      const lineNumber = duplicate.index + i + 1;
      if (lineNumber > doc.lines) break;
      const line = doc.line(lineNumber);
      builder.add(line.from, line.from, i === 0 ? duplicateLineDecoration : duplicateExtraDecoration);
    }
  }

  return builder.finish();
}

const duplicateLineField = StateField.define<DecorationSet>({
  create: state => buildDuplicateDecorations(state.doc),
  update(decorations, tr) {
    if (!tr.docChanged) return decorations.map(tr.changes);
    return buildDuplicateDecorations(tr.state.doc);
  },
  provide: field => EditorView.decorations.from(field),
});

const matchedLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    let next = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setMatchedLines)) {
        next = buildLineDecorations(tr.state.doc, effect.value, matchedLineDecoration);
      }
    }
    return next;
  },
  provide: field => EditorView.decorations.from(field),
});

const highlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#c792ea' },
  { tag: [tags.name, tags.propertyName, tags.macroName], color: '#e2e8f0' },
  { tag: [tags.function(tags.variableName), tags.labelName], color: '#82aaff' },
  { tag: [tags.constant(tags.name), tags.standard(tags.name), tags.atom, tags.bool], color: '#ffcb6b' },
  { tag: [tags.definition(tags.name), tags.separator], color: '#f07178' },
  { tag: [tags.typeName, tags.className, tags.number, tags.annotation, tags.modifier, tags.namespace], color: '#f78c6c' },
  { tag: [tags.operator, tags.operatorKeyword, tags.url, tags.escape, tags.regexp], color: '#89ddff' },
  { tag: [tags.meta, tags.comment], color: '#7f8ea3', fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.link, color: '#82aaff', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#82aaff' },
  { tag: [tags.string, tags.inserted], color: '#c3e88d' },
  { tag: [tags.tagName, tags.angleBracket], color: '#f07178' },
  { tag: tags.attributeName, color: '#ffcb6b' },
  { tag: tags.invalid, color: '#f87171' },
]);

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 'var(--cr-editor-font-size, 12px)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono), "Cascadia Code", "Fira Code", Consolas, monospace',
    lineHeight: '1.55',
  },
  '.cm-content': { caretColor: 'var(--text-primary)', padding: '4px 0' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-base)',
    borderRight: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover)' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.025)' },
  '.cm-cursor': { borderLeftColor: 'var(--text-primary)' },
  '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--bg-selected) !important' },
  '.cm-line': { padding: '0 4px' },
  '.cm-matched-line': {
    backgroundColor: 'rgba(251,191,36,.16)',
    boxShadow: 'inset 2px 0 0 var(--yellow)',
  },
  '.cm-dup-line': {
    backgroundColor: 'rgba(248,113,113,.12)',
    boxShadow: 'inset 2px 0 0 var(--red)',
  },
  '.cm-dup-line-extra': { backgroundColor: 'rgba(248,113,113,.22)' },
}, { dark: true });

export function ConflictCodeEditor({
  value,
  filePath,
  onChange,
  className,
  ariaLabel,
  readOnly = false,
  highlightDuplicates = false,
  matchedLines = []
}: ConflictCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isFocusedRef = useRef(false);
  const isSyncingRef = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const lastMatchedKeyRef = useRef('');
  const matchedLinesRef = useRef(matchedLines);

  valueRef.current = value;
  onChangeRef.current = onChange;
  matchedLinesRef.current = matchedLines;

  const language = useMemo(() => getCodeMirrorLang(filePath), [filePath]);
  const matchedKey = matchedLines.join(',');

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions: Extension[] = [
      basicSetup,
      EditorView.lineWrapping,
      editorTheme,
      syntaxHighlighting(highlightStyle),
      matchedLineField,
      EditorView.contentAttributes.of({
        spellcheck: 'false',
        'aria-readonly': readOnly ? 'true' : 'false',
        'aria-label': ariaLabel ?? 'Resultado del conflicto',
      }),
      EditorView.updateListener.of(update => {
        if (update.focusChanged) isFocusedRef.current = update.view.hasFocus;
        if (update.docChanged && !isSyncingRef.current) onChangeRef.current?.(update.state.doc.toString());
      }),
    ];

    if (readOnly) extensions.push(EditorState.readOnly.of(true));
    if (highlightDuplicates) extensions.push(duplicateLineField);
    if (language) extensions.push(language);

    const view = new EditorView({
      state: EditorState.create({ doc: valueRef.current, extensions }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    const initialMatches = matchedLinesRef.current;
    if (initialMatches.length > 0) {
      view.dispatch({ effects: setMatchedLines.of(initialMatches) });
    }
    lastMatchedKeyRef.current = initialMatches.join(',');

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, ariaLabel, readOnly, highlightDuplicates]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (matchedKey === lastMatchedKeyRef.current) return;
    lastMatchedKeyRef.current = matchedKey;
    view.dispatch({ effects: setMatchedLines.of(matchedLines) });
  }, [matchedKey, matchedLines]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || isFocusedRef.current) return;
    if (value === view.state.doc.toString()) return;
    isSyncingRef.current = true;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    isSyncingRef.current = false;
  }, [value]);

  return <div ref={containerRef} className={className} />;
}
