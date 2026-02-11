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
      }}
    >
      {collaborators.slice(0, 5).map((c, i) => (
        <div
          key={c.id}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${c.color}, ${c.color}dd)`,
            border: '2.5px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            cursor: 'default',
            marginLeft: i > 0 ? '-8px' : '0',
            zIndex: 10 - i,
            transition: 'transform 0.15s ease',
          }}
          title={c.name}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.15) translateY(-2px)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
        >
          {c.name[0]?.toUpperCase() || '?'}
        </div>
      ))}
      {collaborators.length > 5 && (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6b7280, #4b5563)',
            border: '2.5px solid white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '11px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            marginLeft: '-8px',
          }}
        >
          +{collaborators.length - 5}
        </div>
      )}
    </div>
  )
}
