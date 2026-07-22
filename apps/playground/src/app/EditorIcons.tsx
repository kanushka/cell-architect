interface ControlIconProps {
  size?: number;
}

function ControlIcon({ children, size = 16 }: ControlIconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M0 0h32v32H0z" fill="none" />
      {children}
    </svg>
  );
}

export function CodeHideIcon({ size }: ControlIconProps) {
  return (
    <ControlIcon size={size}>
      <path
        fill="currentColor"
        d="m17.713 13.471l1.863-6.953L17.645 6l-1.565 5.838zm6.494 6.494l1.414 1.414L31 16l-7-7l-1.414 1.414L28.172 16zM30 28.586L3.414 2L2 3.414l5.793 5.793L1 16l7 7l1.414-1.414L3.828 16l5.379-5.379l5.677 5.677l-2.461 9.184l1.932.518l2.162-8.069L28.586 30z"
      />
    </ControlIcon>
  );
}

export function CodeShowIcon({ size }: ControlIconProps) {
  return (
    <ControlIcon size={size}>
      <path
        fill="currentColor"
        d="m31 16l-7 7l-1.41-1.41L28.17 16l-5.58-5.59L24 9zM1 16l7-7l1.41 1.41L3.83 16l5.58 5.59L8 23zm11.42 9.484L17.64 6l1.932.517L14.352 26z"
      />
    </ControlIcon>
  );
}
