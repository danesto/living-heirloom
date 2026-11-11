import '@fontsource-variable/noto-serif';
import './styles/main.css';

import { startApp } from './app';
import { DataError } from './data/load';
import { ui } from './i18n/i18n';

startApp().catch((error: unknown) => {
  console.error(error);
  const status = document.querySelector('#status');

  if (status !== null) {
    const detail = error instanceof DataError ? ` (${error.file})` : '';

    status.textContent = `${ui('loadError', 'cyrl')}${detail}`;
    status.classList.add('status--error');
  }
});
