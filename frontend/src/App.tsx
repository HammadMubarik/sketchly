import { useEffect } from 'react'
import { SketchlyCanvas } from './components/Canvas/SketchlyCanvas'
// Import training function to make it available in console
import './lib/trainInBrowser'

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

  return <SketchlyCanvas />
}

export default App