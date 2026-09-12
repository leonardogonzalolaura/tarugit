interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div style={{
      padding: compact ? '16px 12px' : '24px 16px',
      textAlign: 'center',
      color: 'var(--text-muted)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
    }}>
      {icon && <div style={{ fontSize: compact ? 24 : 28, opacity: 0.35, lineHeight: 1 }}>{icon}</div>}
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {description && <div style={{ fontSize: 11, maxWidth: 260, lineHeight: 1.5 }}>{description}</div>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
