import { useAuth } from '../../../Contexts/AuthContext'
import { Login } from '../Auth/Login'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return <>{children}</>
}