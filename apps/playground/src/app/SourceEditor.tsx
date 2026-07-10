import CodeMirror from "@uiw/react-codemirror";
import { cellDslLanguageExtension } from "./cellDslLanguage";
import { SOURCE_EDITOR_BASIC_SETUP } from "./sourceEditorConfig";

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
        basicSetup={SOURCE_EDITOR_BASIC_SETUP}
        theme="light"
        extensions={cellDslLanguageExtension}
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
