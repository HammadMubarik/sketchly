import { useEffect } from 'react'
import { SketchlyCanvas } from './components/Canvas/SketchlyCanvas'
import { AuthProvider } from '../Contexts/AuthContext'
import { ProtectedRoute } from './components/Auth/ProtectedRoute'
function App() {
  useEffect(() => {
    // Preload CNN model on app startup
    import('./lib/cnnRecognizer').then(({ cnnRecognizer }) => {
      cnnRecognizer.loadModel().catch((err) => {
        console.warn('Failed to preload CNN model:', err)
        console.warn('Shape recognition will fall back to backend API')
      })
    })
  }, [])

  return (
    <AuthProvider>
      <ProtectedRoute>
        <SketchlyCanvas />
      </ProtectedRoute>
    </AuthProvider>
  )
}

export default App