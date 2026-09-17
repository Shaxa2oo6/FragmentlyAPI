import React from 'react';

import { useLanguage } from '../../context/LanguageContext';

import Button from '../common/Button';

import { ClipboardDocumentIcon, WalletIcon } from '@heroicons/react/24/outline';

export default function WalletConnect({
  seed,
  onSeedChange,
  onConnect,
  onGenerate,
  connecting = false,
  generating = false,
  generatedSeed,
  onCopySeed,
}) {
  const { t } = useLanguage();

  return (
    <div className="card p-5">
      <h3 className="text-h2 mb-4 flex items-center gap-2">
        <WalletIcon className="w-5 h-5 text-primary-500" />
        {t('wcTitle')}
      </h3>
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('wcDesc')}
        </p>

        <textarea
          placeholder={t('wcPlaceholder')}
          value={seed}
          onChange={onSeedChange}
          className="input-field !font-mono min-h-[80px] resize-y"
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={onConnect} disabled={!seed || connecting}>
            {connecting ? '⏳...' : t('wcConnect')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onGenerate} disabled={generating}>
            {generating ? '⏳...' : t('wcGenerate')}
          </Button>
        </div>

        {generatedSeed && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-xs text-amber-500 font-medium mb-1">
              {t('wcSeedWarning')}
            </p>
            <div className="flex items-center gap-2">
              <code className="mono-box flex-1 !rounded-[8px] text-xs">{generatedSeed}</code>
              {onCopySeed && (
                <button
                  onClick={() => onCopySeed(generatedSeed)}
                  className="icon-btn text-amber-500"
                  title={t('copy')}
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}