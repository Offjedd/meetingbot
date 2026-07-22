import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "~/lib/auth-context";
import { NavigationBar } from "~/components/navigation-bar";
import { Toaster } from "~/components/ui/sonner";
import LoginPage from "~/pages/login";
import SignupPage from "~/pages/signup";
import HomePage from "~/pages/home";
import ActivePage from "~/pages/active";
import RecordingsPage from "~/pages/recordings";
import TranscriptsPage from "~/pages/transcripts";
import YouTubePage from "~/pages/youtube-setup";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <NavigationBar />
        <main className="container mx-auto flex-1 px-4 py-6">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/active" element={<ProtectedRoute><ActivePage /></ProtectedRoute>} />
            <Route path="/recordings" element={<ProtectedRoute><RecordingsPage /></ProtectedRoute>} />
            <Route path="/transcripts" element={<ProtectedRoute><TranscriptsPage /></ProtectedRoute>} />
            <Route path="/youtube-setup" element={<ProtectedRoute><YouTubePage /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </AuthProvider>
  );
}
