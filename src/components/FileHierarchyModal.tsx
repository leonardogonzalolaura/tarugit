export function FileHierarchyModal({ path, onClose }: { path: string; onClose: () => void }) {
  const parts = path.replace(/\\/g, '/').split('/');
  const filename = parts.pop() ?? path;

  return (
    <div className="fd-hierarchy-overlay" onClick={onClose}>
      <div className="fd-hierarchy" onClick={e => e.stopPropagation()}>
        <div className="fd-hierarchy-header">
          <span>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" style={{ marginRight: 6, color: 'var(--accent)' }}>
              <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/>
            </svg>
            Ubicación del archivo
          </span>
          <button className="fd-hierarchy-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
            </svg>
          </button>
        </div>
        <div className="fd-hierarchy-tree">
          {parts.map((part, i) => (
            <div key={i} className="fd-hl-item">
              <span className="fd-hl-spacer" />
              <span>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ marginRight: 4, color: 'var(--accent)' }}>
                  <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/>
                </svg>
                {part}
              </span>
            </div>
          ))}
          <div className="fd-hl-item file">
            <span className="fd-hl-spacer" />
            <span>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" style={{ marginRight: 4, color: 'var(--accent)' }}>
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V5.164a.25.25 0 0 0-.073-.177L9.513 2.323a.25.25 0 0 0-.177-.073H10v2.5A1.75 1.75 0 0 0 11.75 6.5H13v7.75a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25V1.75Z"/>
              </svg>
              {filename}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
