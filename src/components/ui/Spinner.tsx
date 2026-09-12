interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = { sm: 12, md: 16, lg: 20 } as const;

export function Spinner({ size = 'sm', label }: SpinnerProps) {
  const px = sizeMap[size];
  const cls = size === 'sm' ? 'spinner-sm' : 'spinner';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
      <span className={cls} style={size !== 'sm' ? { width: px, height: px } : undefined} />
      {label && <span>{label}</span>}
    </span>
  );
}
