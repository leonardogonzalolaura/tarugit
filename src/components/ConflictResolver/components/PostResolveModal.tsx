import { useEffect, useState } from 'react';
import { OperationContext } from '../ConflictResolver.types';

interface PostResolveModalProps {
  operationContext?: OperationContext;
  onAction: (action: 'continue' | 'abort' | 'done') => void;
  busy: boolean;
  onClose?: () => void;
}

export function PostResolveModal({
  operationContext,
  onAction,
  busy,
  onClose
}: PostResolveModalProps) {
  const [countdown, setCountdown] = useState(0);
  const [selectedAction, setSelectedAction] = useState<'continue' | 'abort' | 'done' | null>(null);

  // Auto-cerrar después de 5 segundos si no hay operación en curso
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

  // Obtener el título y descripción según el contexto
  const getModalContent = () => {
    if (!operationContext) {
      return {
        icon: '✅',
        title: 'Conflicto Resuelto',
        description: 'Has resuelto todos los conflictos en este archivo.',
        hint: 'Cerrando automáticamente...'
      };
    }

    switch (operationContext.type) {
      case 'merge':
        return {
          icon: '🔀',
          title: 'Merge en Progreso',
          description: 'Has resuelto los conflictos. ¿Qué deseas hacer?',
          hint: 'Después de resolver todos los conflictos, puedes hacer commit para completar el merge.'
        };
      case 'rebase':
        return {
          icon: '🔄',
          title: 'Rebase en Progreso',
          description: 'Has resuelto los conflictos de este commit.',
          hint: 'Continúa el rebase para aplicar el siguiente commit o aborta para cancelar todo.'
        };
      case 'cherry-pick':
        return {
          icon: '🍒',
          title: 'Cherry-Pick en Progreso',
          description: 'Has resuelto los conflictos de este commit.',
          hint: 'Continúa el cherry-pick para aplicar el siguiente commit o aborta para cancelar.'
        };
      default:
        return {
          icon: '✅',
          title: 'Conflicto Resuelto',
          description: 'Los cambios han sido guardados.',
          hint: ''
        };
    }
  };

  const content = getModalContent();
  const hasOperation = !!operationContext;

  // Renderizar botones según el tipo de operación
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
              padding: '8px 24px',
              fontSize: '13px'
            }}
          >
            {busy ? <span className="spinner-sm" /> : '✓'} Entendido
          </button>
          {countdown > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Cerrando en {countdown}s...
            </div>
          )}
        </div>
      );
    }

    switch (operationContext.type) {
      case 'merge':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedAction('abort');
                  if (confirm('¿Estás seguro de que quieres abortar el merge? Se perderán todos los cambios.')) {
                    onAction('abort');
                  }
                }}
                disabled={busy}
                style={{
                  flex: 1,
                  borderColor: 'var(--red-border)',
                  color: 'var(--red)'
                }}
              >
                {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : '🚫'} Abortar Merge
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setSelectedAction('done');
                  onAction('done');
                }}
                disabled={busy}
                style={{
                  flex: 1,
                  background: 'var(--green-bg)',
                  color: 'var(--green)',
                  borderColor: 'var(--green-border)'
                }}
              >
                {busy && selectedAction === 'done' ? <span className="spinner-sm" /> : '📝'} Hacer Commit
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Una vez que todos los conflictos estén resueltos, haz commit para finalizar el merge.
            </div>
          </div>
        );

      case 'rebase':
        return (
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedAction('abort');
                if (confirm('¿Estás seguro de que quieres abortar el rebase? Se perderán todos los cambios aplicados hasta ahora.')) {
                  onAction('abort');
                }
              }}
              disabled={busy}
              style={{
                flex: 1,
                borderColor: 'var(--red-border)',
                color: 'var(--red)'
              }}
            >
              {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : '🚫'} Abortar Rebase
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedAction('continue');
                onAction('continue');
              }}
              disabled={busy}
              style={{
                flex: 1,
                background: 'var(--green-bg)',
                color: 'var(--green)',
                borderColor: 'var(--green-border)'
              }}
            >
              {busy && selectedAction === 'continue' ? <span className="spinner-sm" /> : '✅'} Continuar Rebase
            </button>
          </div>
        );

      case 'cherry-pick':
        return (
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setSelectedAction('abort');
                if (confirm('¿Estás seguro de que quieres abortar el cherry-pick? Se perderán los cambios aplicados.')) {
                  onAction('abort');
                }
              }}
              disabled={busy}
              style={{
                flex: 1,
                borderColor: 'var(--red-border)',
                color: 'var(--red)'
              }}
            >
              {busy && selectedAction === 'abort' ? <span className="spinner-sm" /> : '🚫'} Abortar
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setSelectedAction('continue');
                onAction('continue');
              }}
              disabled={busy}
              style={{
                flex: 1,
                background: 'var(--green-bg)',
                color: 'var(--green)',
                borderColor: 'var(--green-border)'
              }}
            >
              {busy && selectedAction === 'continue' ? <span className="spinner-sm" /> : '✅'} Continuar Cherry-Pick
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  // Información adicional según el tipo de operación
  const renderAdditionalInfo = () => {
    if (!operationContext) return null;

    switch (operationContext.type) {
      case 'merge':
        return (
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '6px',
            padding: '8px 12px',
            marginTop: '8px',
            fontSize: '11px'
          }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              💡 <strong>Tip:</strong> Puedes hacer commit después de resolver todos los conflictos.
            </div>
          </div>
        );
      case 'rebase':
        return (
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '6px',
            padding: '8px 12px',
            marginTop: '8px',
            fontSize: '11px'
          }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              💡 <strong>Tip:</strong> Continuar aplicará el siguiente commit del rebase.
              Si hay más conflictos, tendrás que resolverlos uno por uno.
            </div>
          </div>
        );
      case 'cherry-pick':
        return (
          <div style={{
            background: 'var(--bg-elevated)',
            borderRadius: '6px',
            padding: '8px 12px',
            marginTop: '8px',
            fontSize: '11px'
          }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              💡 <strong>Tip:</strong> Continuar aplicará el siguiente commit del cherry-pick.
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{
          maxWidth: '460px',
          animation: 'modalSlideUp 0.25s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-icon" style={{ fontSize: '52px' }}>
          {content.icon}
        </div>

        <h3 className="modal-title" style={{ fontSize: '18px', marginBottom: '4px' }}>
          {content.title}
        </h3>

        <p className="modal-desc" style={{ marginBottom: '4px', fontSize: '13px' }}>
          {content.description}
        </p>

        {content.hint && (
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '8px' }}>
            {content.hint}
          </p>
        )}

        <div style={{ width: '100%', marginTop: '16px', marginBottom: '8px' }}>
          {renderButtons()}
        </div>

        {renderAdditionalInfo()}

        {/* Indicador de progreso si está ocupado */}
        {busy && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '12px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}>
            <span className="spinner-sm" />
            Procesando...
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
