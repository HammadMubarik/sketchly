import { useAuth } from '../../../Contexts/AuthContext'

export function UserProfile() {
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div style={{
      position: 'absolute',
      top: '1rem',
      right: '1rem',
      zIndex: 1000,
      background: 'white',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>
        {user?.email}
      </div>
      <button
        onClick={handleSignOut}
        style={{
          padding: '0.5rem 1rem',
          background: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: '500'
        }}
      >
        Sign Out
      </button>
    </div>
  )
}