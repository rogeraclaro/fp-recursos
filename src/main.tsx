import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { SkinProvider } from './context/SkinContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SkinProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </SkinProvider>,
)
