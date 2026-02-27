import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect to auth page, preserving destination via ?next= (works across new tabs/email links)
    const destination = location.pathname + location.search + location.hash;
    return <Navigate to={`/login?next=${encodeURIComponent(destination)}`} replace />;
  }

  return <>{children}</>;
}
