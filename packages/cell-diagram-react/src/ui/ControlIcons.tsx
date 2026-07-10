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

export function ZoomInIcon({ size }: ControlIconProps) {
  return (
    <ControlIcon size={size}>
      <path fill="currentColor" d="M17 15V8h-2v7H8v2h7v7h2v-7h7v-2z" />
    </ControlIcon>
  );
}

export function ZoomOutIcon({ size }: ControlIconProps) {
  return (
    <ControlIcon size={size}>
      <path fill="currentColor" d="M8 15h16v2H8z" />
    </ControlIcon>
  );
}

export function FitScreenIcon({ size }: ControlIconProps) {
  return (
    <ControlIcon size={size}>
      <path
        fill="currentColor"
        d="M8 2H2v6h2V4h4zm16 0h6v6h-2V4h-4zM8 30H2v-6h2v4h4zm16 0h6v-6h-2v4h-4zm0-6H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2M8 10v12h16V10Z"
      />
    </ControlIcon>
  );
}
