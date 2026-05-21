import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'

export default function HomePage() {
  const { profile, user } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Wedding Platform</h1>
          <Link to="/profile">
            <Button variant="outline">Profilo</Button>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Ciao {profile?.full_name ?? user?.email}</CardTitle>
            <CardDescription>
              Sei dentro come <strong>{profile?.role}</strong>. Le prossime fasi (catalogo, calendario,
              preventivi) compariranno qui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              In sviluppo: modulo Fornitori, Calendario, Preventivi.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
