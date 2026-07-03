import CodeMirror from "@uiw/react-codemirror";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function SourceEditor({ value, onChange }: SourceEditorProps) {
  return (
    <div className="source-editor" data-editor-theme="light">
      <label className="source-editor__label" htmlFor="cell-source">
        Cell DSL source
      </label>
      <CodeMirror
        value={value}
        height="100%"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true
        }}
        theme="light"
        onChange={onChange}
        className="source-editor__codemirror"
      />
      <textarea
        id="cell-source"
        aria-label="Cell DSL source"
        className="source-editor__test-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
