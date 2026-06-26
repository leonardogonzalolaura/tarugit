import { useState, useEffect, useRef } from 'react';
import { BranchInfo } from '../types';

interface CreateBranchModalProps {
  branches: BranchInfo[];
  currentBranch: string;
  onCreate: (branchName: string, sourceBranch: string) => void;
  onClose: () => void;
}

type BranchType = 'feature' | 'fix' | 'hotfix' | null;

const SvgStar = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.193L.82 6.124a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.418A.75.75 0 0 1 8 .25Z" /></svg>;
const SvgCheckCircle = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.72a.75.75 0 0 0-1.06-1.06L6.75 8.63 5.28 7.16a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" /></svg>;
const SvgAlert = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm2.064.803a.25.25 0 0 0-.441 0L1.998 13.228a.25.25 0 0 0 .22.272h11.563a.25.25 0 0 0 .221-.272ZM8 5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5Zm0 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" /></svg>;
const SvgBranchSm = () => <svg viewBox="0 0 16 16" width="14" height="14" fill="currentcolor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>;
const SvgBranchBtn = () => <svg viewBox="0 0 16 16" width="12" height="12" fill="currentcolor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>;

const branchTypeDefs = [
  { type: 'feature' as BranchType, label: 'Feature', icon: <SvgStar />, prefix: 'feature/', cssClass: 'cbm-feature' },
  { type: 'fix' as BranchType, label: 'Fix', icon: <SvgCheckCircle />, prefix: 'fix/', cssClass: 'cbm-fix' },
  { type: 'hotfix' as BranchType, label: 'Hotfix', icon: <SvgAlert />, prefix: 'hotfix/', cssClass: 'cbm-hotfix' },
];

export function getBranchIcon(name: string) {
  for (const bt of branchTypeDefs) {
    if (name.startsWith(bt.prefix)) return bt.icon;
  }
  return <SvgBranchSm />;
}

export function CreateBranchModal({ branches, currentBranch, onCreate, onClose }: CreateBranchModalProps) {
  const [branchType, setBranchType] = useState<BranchType>('feature');
  const [branchName, setBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState(currentBranch);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleTypeChange = (type: BranchType) => {
    setBranchType(type);
    const newPrefix = branchTypeDefs.find(bt => bt.type === type)?.prefix || '';
    const rest = branchName.replace(/^(feature\/|fix\/|hotfix\/)/, '');
    setBranchName(newPrefix + rest);
    inputRef.current?.focus();
  };

  const handleNameChange = (value: string) => {
    setBranchName(value);
    const detected = branchTypeDefs.find(bt => value.startsWith(bt.prefix));
    if (detected) setBranchType(detected.type);
    else if (!/^(feature\/|fix\/|hotfix\/)/.test(value)) setBranchType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    setCreating(true);
    try {
      await onCreate(branchName.trim(), sourceBranch);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const localBranches = branches.filter(b => !b.is_remote && b.name !== sourceBranch);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal cbm" onClick={e => e.stopPropagation()}>
        <div className="cbm-header">
          <span className="cbm-header-icon"><SvgBranchSm /></span>
          <h3 className="cbm-title">Crear rama</h3>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="cbm-label">Tipo</label>
            <div className="cbm-types">
              {branchTypeDefs.map(bt => {
                const active = branchType === bt.type;
                return (
                  <button
                    key={bt.type}
                    type="button"
                    className={`cbm-type-btn${active ? ` active ${bt.cssClass}` : ''}`}
                    onClick={() => handleTypeChange(bt.type)}
                  >
                    {bt.icon} {bt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="cbm-label">Nombre</label>
            <input
              ref={inputRef}
              className="repo-input"
              style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
              placeholder="mi-nueva-rama"
              value={branchName}
              onChange={e => handleNameChange(e.target.value)}
              disabled={creating}
            />
          </div>

          <div>
            <label className="cbm-label">Crear desde</label>
            <select
              value={sourceBranch}
              onChange={e => setSourceBranch(e.target.value)}
              disabled={creating}
              className="cbm-select"
            >
              <option value={currentBranch}>{currentBranch} (actual)</option>
              {localBranches.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-actions" style={{ marginTop: 4 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={creating}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={creating || !branchName.trim()}>
              {creating ? <span className="spinner-sm" /> : <SvgBranchBtn />} Crear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
