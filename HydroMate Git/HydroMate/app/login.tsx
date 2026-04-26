// _app/login.tsx
// Expo Router page that renders the existing LoginScreen.
// The auth guard in _layout.tsx will redirect here when the user is signed out,
// and back to '/' once Firebase confirms a successful login.
import LoginScreen from '../screens/LoginScreen';

export default function LoginPage() {
  // LoginScreen calls Firebase auth directly; no onLogin callback needed
  // since _layout.tsx watches onAuthStateChanged and will navigate automatically.
  return <LoginScreen onLogin={() => {}} />;
}
