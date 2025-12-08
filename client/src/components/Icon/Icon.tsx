import './Icon.css';

export type IconName =
  | 'ingredient'
  | 'result'
  | 'catalyst'
  | 'fire'
  | 'cold'
  | 'pill'
  | 'skull'
  | 'sparkle'
  | 'heart'
  | 'bolt'
  | 'search'
  | 'alert'
  | 'chevron-right'
  | 'chevron-down'
  | 'plus'
  | 'minus'
  | 'tree';

interface IconProps {
  name: IconName;
  size?: number | string;
  className?: string;
}

export function Icon({ name, size = 16, className = '' }: IconProps) {
  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      className={`icon icon--${name} ${className}`}
      width={sizeValue}
      height={sizeValue}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {getIconPath(name)}
    </svg>
  );
}

function getIconPath(name: IconName): JSX.Element {
  switch (name) {
    case 'ingredient':
      return (
        <>
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 17h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );

    case 'result':
      return (
        <>
          <path
            d="M12 15V3m0 0L8 7m4-4l4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 17h14v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );

    case 'catalyst':
      return (
        <path
          d="M9 3h6v5l4 9a2 2 0 01-1.8 2.9H6.8A2 2 0 015 17l4-9V3zm0 0h6M8 14h8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'fire':
      return (
        <path
          d="M12 22c4-2 6-5.5 6-9 0-2.5-1.5-4.5-3-6-.5 2-2 3-3 3s-2-1.5-2-3c0-1 .5-2 1-3-3 1-5 4.5-5 8 0 4 2.5 7.5 6 10z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );

    case 'cold':
      return (
        <>
          <path
            d="M12 2v20M2 12h20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 6l-2-2m2 2l2-2m-2 14l-2 2m2-2l2 2M6 12l-2-2m2 2l-2 2m14-2l2-2m-2 2l2 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </>
      );

    case 'pill':
      return (
        <path
          d="M8.5 8.5l7 7M5.636 18.364a4.95 4.95 0 010-7l7.728-7.728a4.95 4.95 0 117 7l-7.728 7.728a4.95 4.95 0 01-7 0z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'skull':
      return (
        <>
          <circle cx="12" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="9" r="1.5" fill="currentColor" />
          <circle cx="15" cy="9" r="1.5" fill="currentColor" />
          <path
            d="M9 17v4h2v-2h2v2h2v-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 13h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case 'sparkle':
      return (
        <path
          d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'heart':
      return (
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );

    case 'bolt':
      return (
        <path
          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case 'alert':
      return (
        <>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case 'chevron-right':
      return (
        <path
          d="M9 18l6-6-6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'chevron-down':
      return (
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );

    case 'plus':
      return (
        <path
          d="M12 5v14m-7-7h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );

    case 'minus':
      return (
        <path
          d="M5 12h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      );

    case 'tree':
      return (
        <>
          <path
            d="M12 3v18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 8h6m-6 4h5m-5 4h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="18" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="17" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="16" r="2" stroke="currentColor" strokeWidth="2" />
        </>
      );

    default:
      return <></>;
  }
}
