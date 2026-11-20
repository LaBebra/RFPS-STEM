import { useRef, type KeyboardEvent } from 'react';

interface Props {
  id: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  invalid?: boolean;
  describedBy?: string;
  readOnly?: boolean;
  label?: string;
}

/** Легкий редактор коду: нумерація рядків, Tab вставляє 2 пробіли, моноширинний шрифт. */
export function CodeEditor({ id, value, onChange, rows = 10, invalid, describedBy, readOnly, label }: Props) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(rows, value.split('\n').length);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !e.shiftKey && !readOnly) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = el;
      const next = `${value.slice(0, s)}  ${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
    }
  };

  return (
    <div className={`code-editor${invalid ? ' is-invalid' : ''}`}>
      <div className="code-editor__gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <textarea
        id={id}
        className="code-editor__input"
        value={value}
        rows={rows}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        readOnly={readOnly}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}
