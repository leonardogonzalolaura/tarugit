import { useEffect, useState } from 'react';
import { OperationContext } from '../ConflictResolver.types';

interface PostResolveModalProps {
  operationContext?: OperationContext;
  onAction: (action: 'continue' | 'abort' | 'done') => void;
  busy: boolean;
  onClose?: () => void;
}

const SvgCheckCircle = () => <svg width="44" height="44" viewBox="0 0 16 16" fill="var(--green)"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.72a.75.75 0 0 0-1.06-1.06L6.75 8.63 5.28 7.16a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z"/></svg>;
const SvgMerge = () => <svg width="44" height="44" viewBox="0 0 16 16" fill="var(--accent)"><path d="M5.45 5.975A5.5 5.5 0 0 1 6.5 3.55V1.75a.75.75 0 0 1 1.5 0v10a.75.75 0 0 1-1.5 0v-2.5a3.5 3.5 0 0 0-3.5 3.5.75.75 0 0 1-1.5 0 5 5 0 0 1 3.45-4.775ZM3 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm5-1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2ZM12 2a1 1 0 0 0-1 1v.5a5.5 5.5 0 0 1-3.45 5.025.75.75 0 1 0 .5 1.415A7 7 0 0 0 12.5 5.25V4.5h.25a.75.75 0 0 1 .75.75v1a.25.25 0 0 0 .5 0v-1A1.75 1.75 0 0 0 12.5 3.5H12V3a1 1 0 0 0-1-1Z"/></svg>;
const SvgRebase = () => <svg width="44" height="44" viewBox="0 0 16 16" fill="var(--accent)"><path d="M2.5 2a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1ZM2.5 7a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1ZM3 4.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm5.5-.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1ZM11.5 2a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Zm0 5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Zm2-2.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1ZM6 6.5a.75.75 0 0 1-.75-.75V2.56L3.78 4.03a.75.75 0 0 1-1.06-1.06l2.5-2.5a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 0 1-1.06 1.06L6.75 2.56v3.19a.75.75 0 0 1-.75.75Zm4.5 3.25a.75.75 0 0 1 .75.75v3.19l1.47-1.47a.75.75 0 0 1 1.06 1.06l-2.5 2.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.47 1.47V10.5a.75.75 0 0 1 .75-.75Z"/></svg>;
const SvgCherry = () => <svg width="44" height="44" viewBox="0 0 16 16" fill="var(--accent)"><path d="M8 1.5a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-1 0V2a.5.5 0 0 1 .5-.5ZM3.5 4a.5.5 0 0 0 0 1h9a.5.5 0 0 0 0-1h-9ZM3 6.5a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5H3Zm7.25 3.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm-4.5 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Z"/></svg>;
const SvgBan = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM2.936 3.633A6.5 6.5 0 0 0 12.367 13.07L2.936 3.633ZM3.633 2.936l9.434 9.434a6.5 6.5 0 0 0-9.434-9.434Z"/></svg>;
const SvgCheckSmall = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>;
const SvgCommit = () => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentcolor"><path d="M12 5.5a3.5 3.5 0 0 1-3.25 3.495V15a.75.75 0 0 1-1.5 0V8.995A3.502 3.502 0 0 1 4.044 5.78a3.498 3.498 0 0 1 6.802-.145c.1.274.154.57.154.865Z"/></svg>;
const SvgLightbulb = () => <svg width="11" height="11" viewBox="0 0 16 16" fill="currentcolor"><path d="M8 1.5a4.5 4.5 0 0 0-2.828 8.015c.75.56 1.328 1.47 1.328 2.485v.5a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V12c0-1.015.578-1.925 1.328-2.485A4.5 4.5 0 0 0 8 1.5ZM5.324 8.88l-.017.013h0Zm.127.078a6.019 6.019 0 0 1 .549 1.042H6.25v.5h3.5V10c0-.36.076-.704.212-1.014A3.001 3.001 0 1 0 5.451 8.959ZM6 13.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Z"/></svg>;

export function PostResolveModal({
  operationContext,
  onAction,
  busy,
  onClose
}: PostResolveModalProps) {
  const [countdown, setCountdown] = useState(0);
  const [selectedAction, setSelectedAction] = useState<'continue' | 'abort' | 'done' | null>(null);

  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!operationContext && countdown === 0) {
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onAction('done');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [operationContext, countdown, onAction]);

  const getModalContent = () => {
    if (!operationContext) {
      return {
        icon: <SvgCheckCircle />,
        title: 'Conflicto Resuelto',
        description: 'Has resuelto todos los conflictos en este archivo.',
        hint: 'Cerrando automáticamente...'
      };
    }

    switch (operationContext.type) {
      case 'merge':
        return {
          icon: <SvgMerge />,
          title: 'Merge en Progreso',
          description: 'Has resuelto los conflictos. ¿Qué deseas hacer?',
          hint: 'Después de resolver todos los conflictos, puedes hacer commit para completar el merge.'
        };
      case 'rebase':
        return {
          icon: <SvgRebase />,
          title: 'Rebase en Progreso',
          description: 'Has resuelto los conflictos de este commit.',
          hint: 'Continúa el rebase para aplicar el siguiente commit o aborta para cancelar todo.'
        };
      case 'cherry-pick':
        return {
          icon: <SvgCherry />,
          title: 'Cherry-Pick en Progreso',
          description: 'Has resuelto los conflictos de este commit.',
          hint: 'Continúa el cherry-pick para aplicar el siguiente commit o aborta para cancelar.'
        };
      default:
        return {
          icon: <SvgCheckCircle />,
          title: 'Conflicto Resuelto',
          description: 'Los cambios han sido guardados.',
          hint: ''
        };
    }
  };

  const content = getModalContent();
  const hasOperation = !!operationContext;

  const renderButtons = () => {
    if (!hasOperation) {
      return (
        <div style={{ textAlign: 'center' }}>
          <button
            className="btn-primary"
            onClick={() => onAction('done')}
            disabled={busy}
            style={{
              background: 'var(--green)',
              color: '#000',
              padding: '7px 22px',
              fontSize: '12px'
            }}
          >
            {busy ? <span className="spinner-sm" /> : <SvgCheckSmall />} Entendido
          </button>
          {countdown > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Cerrando en {countdown}s...
            </div>
          )}
        </div>
      );
    }

    switch (operationContext.type) {
      case 'merge':
        return (
          <div className="cr-post-modal-actions col">
            <div className="cr-post-modal-actions row">
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedAction('abort');
                  if (confirm('¿Estás seguro de que quieres abortar el merge? Se perderán todos los cambios.')) {
                    onAction('abort');
                  }
                }}
                disabled={busy}
                style={{ flex: 1, borderColor: 'var(--red-border)', color: 'var(--red)' }}
              >
                {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : <SvgBan />} Abortar Merge
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedAction('done');
                  onAction('done');
                }}
                disabled={busy}
                style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
              >
                {busy && selectedAction === 'done' ? <span className="spinner-sm" /> : <SvgCommit />} Hacer Commit
              </button>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Una vez que todos los conflictos estén resueltos, haz commit para finalizar el merge.
            </div>
          </div>
        );

      case 'rebase':
        return (
          <div className="cr-post-modal-actions row">
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedAction('abort');
                if (confirm('¿Estás seguro de que quieres abortar el rebase? Se perderán todos los cambios aplicados hasta ahora.')) {
                  onAction('abort');
                }
              }}
              disabled={busy}
              style={{ flex: 1, borderColor: 'var(--red-border)', color: 'var(--red)' }}
            >
              {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : <SvgBan />} Abortar Rebase
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedAction('continue');
                onAction('continue');
              }}
              disabled={busy}
              style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
            >
              {busy && selectedAction === 'continue' ? <span className="spinner-sm" /> : <SvgCheckSmall />} Continuar Rebase
            </button>
          </div>
        );

      case 'cherry-pick':
        return (
          <div className="cr-post-modal-actions row">
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedAction('abort');
                if (confirm('¿Estás seguro de que quieres abortar el cherry-pick? Se perderán los cambios aplicados.')) {
                  onAction('abort');
                }
              }}
              disabled={busy}
              style={{ flex: 1, borderColor: 'var(--red-border)', color: 'var(--red)' }}
            >
              {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : <SvgBan />} Abortar
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedAction('continue');
                onAction('continue');
              }}
              disabled={busy}
              style={{ flex: 1, background: 'var(--green-bg)', color: 'var(--green)', borderColor: 'var(--green-border)' }}
            >
              {busy && selectedAction === 'continue' ? <span className="spinner-sm" /> : <SvgCheckSmall />} Continuar Cherry-Pick
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderAdditionalInfo = () => {
    if (!operationContext) return null;

    const tips: Record<string, string> = {
      'merge': 'Puedes hacer commit después de resolver todos los conflictos.',
      'rebase': 'Continuar aplicará el siguiente commit del rebase. Si hay más conflictos, tendrás que resolverlos uno por uno.',
      'cherry-pick': 'Continuar aplicará el siguiente commit del cherry-pick.'
    };

    const tip = tips[operationContext.type];
    if (!tip) return null;

    return (
      <div className="cr-post-modal-tip">
        <SvgLightbulb /> <strong>Tip:</strong> {tip}
      </div>
    );
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cr-post-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">
          {content.icon}
        </div>

        <h3 className="cr-post-modal-title">{content.title}</h3>
        <p className="cr-post-modal-desc">{content.description}</p>

        {content.hint && (
          <p className="cr-post-modal-hint">{content.hint}</p>
        )}

        <div className="cr-post-modal-actions">
          {renderButtons()}
        </div>

        {renderAdditionalInfo()}

        {busy && (
          <div className="cr-post-modal-busy">
            <span className="spinner-sm" />
            Procesando...
          </div>
        )}
      </div>
    </div>
  );
}
