export type LeftTab = 'changes' | 'history' | 'stash' | 'tags' | 'graph' | 'actions';

interface LeftTabsProps {
  activeTab: LeftTab;
  onTabChange: (tab: LeftTab) => void;
  filesCount: number;
  stashesCount: number;
}

export function LeftTabs({ activeTab, onTabChange, filesCount, stashesCount }: LeftTabsProps) {
  return (
    <div className="left-tabs">
      <button
        className={`left-tab-btn${activeTab === 'changes' ? ' active' : ''}`}
        onClick={() => onTabChange('changes')}
      >
        Cambios
        {filesCount > 0 && (
          <span className="left-tab-badge">{filesCount}</span>
        )}
      </button>
      <button
        className={`left-tab-btn${activeTab === 'history' ? ' active' : ''}`}
        onClick={() => onTabChange('history')}
      >
        Historial
      </button>
      <button
        className={`left-tab-btn${activeTab === 'stash' ? ' active' : ''}`}
        onClick={() => onTabChange('stash')}
      >
        Stash
        {stashesCount > 0 && (
          <span className="left-tab-badge">{stashesCount}</span>
        )}
      </button>
      <button
        className={`left-tab-btn${activeTab === 'tags' ? ' active' : ''}`}
        onClick={() => onTabChange('tags')}
      >
        Tags
      </button>
    </div>
  );
}
