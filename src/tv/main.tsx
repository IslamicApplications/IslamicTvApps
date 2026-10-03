// First: settings moved over from the old address must be in place before anything reads them
import './importSettings';
import React from 'react';
import ReactDOM from 'react-dom/client';
import TvApp from './TvApp';
import { registerServiceWorker } from '../shared/utils/serviceWorker';
import { enableSeparateUiLanguage } from '../shared/hooks/useHadithLanguage';
import '../shared/index.css';
import './tv.css';

registerServiceWorker('./sw.js');
// On the TV the screen and the Hadith text can be in different languages
enableSeparateUiLanguage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TvApp />
  </React.StrictMode>
);
