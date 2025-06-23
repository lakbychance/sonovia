import AppShell from './components/AppShell';
import SafariAppShell from './components/SafariAppShell';
import { isSafariBrowser } from './utils/userAgent';

function App() {
  const isSafari = isSafariBrowser(navigator.userAgent);

  return (isSafari ? <SafariAppShell /> : <AppShell />);
}

export default App;