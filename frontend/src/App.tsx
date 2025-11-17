import { AuthProvider } from '../Contexts/AuthContext'
import { ProtectedRoute } from './components/Auth/ProtectedRoute'
import { SketchlyCanvas } from './components/Canvas/SketchlyCanvas'

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <SketchlyCanvas />
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App