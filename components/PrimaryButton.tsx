import { classNames } from '../utils';

interface Props {
  text: string,
  disabled?: boolean,
  loading?: boolean,
  onClick?: () => void,
  pulse?: boolean,
}

function PrimaryButton({
  text, onClick, disabled, loading, pulse = false,
}: Props) {
  return (
    <>
      {/* <button
        type="button"
        className="rounded bg-indigo-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Button text
      </button> */}
      {/* <button
        type="button"
        className="rounded bg-indigo-500 px-2 py-1 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Button text
      </button> */}
      {/* <button
        type="button"
        className="rounded-md bg-indigo-500 px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Button text
      </button> */}
      <button
        type="button"
        disabled={!!disabled || !!loading}
        onClick={(!!loading || !!disabled) ? undefined : onClick}
        className={classNames('rounded-md flex bg-primary-button px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-button/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2', (!!disabled && !loading) && 'opacity-50 cursor-not-allowed', !!loading && 'cursor-not-allowed', !!pulse && 'animate-pulse')}
      >
        {!!loading && (
          <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {text}
      </button>
      {/* <button
        type="button"
        onClick={onClick}
        className="rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      >
        Button text
      </button> */}
    </>
  );
}

export default PrimaryButton;
