import type { Collaborator } from './YjsSyncBridge'

interface CollaboratorListProps {
  collaborators: Collaborator[]
}

export function CollaboratorList({ collaborators }: CollaboratorListProps) {
  if (collaborators.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        left: '4.5rem',
        zIndex: 1000,
        display: 'flex',
        gap: '4px',
      }}
    >
      {collaborators.slice(0, 5).map((c) => (
        <div
          key={c.id}
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: c.color,
            border: '2px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            cursor: 'default',
          }}
          title={c.name}
        >
          {c.name[0]?.toUpperCase() || '?'}
        </div>
      ))}
      {collaborators.length > 5 && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#666',
            border: '2px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          +{collaborators.length - 5}
        </div>
      )}
    </div>
  )
}
