'use client';

interface PlanInputProps {
  plan: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function PlanInput({ plan, onChange, onSubmit, loading }: PlanInputProps) {
  const charCount = plan.length;
  const maxChars = 100_000;
  const isOverLimit = charCount > maxChars;

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!loading && plan.trim() && !isOverLimit) onSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label htmlFor="plan-input" className="text-sm font-medium text-gray-300">
          Paste your Terraform plan output
        </label>
        <span suppressHydrationWarning className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-gray-500'}`}>
          {charCount.toLocaleString('en-US')} / {maxChars.toLocaleString('en-US')} chars
        </span>
      </div>

      <textarea
        suppressHydrationWarning
        id="plan-input"
        value={plan}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Paste the output of \`terraform plan\` here...\n\nExample:\n  # aws_instance.web will be destroyed\n  - resource "aws_instance" "web" {\n      ...`}
        rows={16}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-mono text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
        disabled={loading}
        spellCheck={false}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Tip: press <kbd className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">Ctrl+Enter</kbd> to analyze
        </p>
        <button
          onClick={onSubmit}
          disabled={loading || !plan.trim() || isOverLimit}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Spinner />
              Analyzing...
            </>
          ) : (
            'Analyze Plan'
          )}
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
