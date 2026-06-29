import { useEffect, useState } from 'react';
import { useFullscreen } from '../hooks/useFullscreen';

const DISMISS_KEY = 'ambience-fullscreen-dismissed';

export function FullscreenPrompt() {
  const [visible, setVisible] = useState(false);
  const { isFullscreen, toggle } = useFullscreen();

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    setVisible(!dismissed);
  }, []);

  if (!visible || isFullscreen) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  return (
    <div className="fullscreen-prompt">
      <p>For the best experience, go fullscreen (F11 or your browser menu).</p>
      <div className="fullscreen-prompt__actions">
        <button type="button" onClick={toggle}>
          Enter fullscreen
        </button>
        <button type="button" className="ghost" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
