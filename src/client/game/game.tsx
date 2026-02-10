import '../index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGlobalStyle, ThemeProvider } from 'styled-components';
import { styleReset } from 'react95';
import original from 'react95/dist/themes/original';
import { App } from './App';

const GlobalStyles = createGlobalStyle`
  ${styleReset}
  body {
    font-family: 'Segoe UI', 'Tahoma', sans-serif;
  }
`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalStyles />
    <ThemeProvider theme={original}>
      <App />
    </ThemeProvider>
  </StrictMode>
);
