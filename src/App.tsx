import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Navbar from '@/components/Navbar';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import IndexRoute from '@/routes/index';
import CreateRoute from '@/routes/create';
import EventDetailRoute from '@/routes/event.$id';
import BookingsRoute from '@/routes/bookings';
import VendorDashboardRoute from '@/routes/vendor-dashboard';
import AdminRoute from '@/routes/admin';
import AuthRoute from '@/routes/auth';
import { VendorOnly, UserOnly, AdminOnly } from '@/components/RoleGuard';

const queryClient = new QueryClient();

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
      <AuthProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Navbar />
            <div className="flex-1">
              <Routes>
                <Route path="/" element={<IndexRoute />} />
                <Route
                  path="/create"
                  element={(
                    <VendorOnly>
                      <CreateRoute />
                    </VendorOnly>
                  )}
                />
                <Route path="/event/:id" element={<EventDetailRoute />} />
                <Route
                  path="/bookings"
                  element={(
                    <UserOnly>
                      <BookingsRoute />
                    </UserOnly>
                  )}
                />
                <Route
                  path="/vendor-dashboard"
                  element={(
                    <VendorOnly>
                      <VendorDashboardRoute />
                    </VendorOnly>
                  )}
                />
                <Route
                  path="/admin"
                  element={(
                    <AdminOnly>
                      <AdminRoute />
                    </AdminOnly>
                  )}
                />
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="*" element={<IndexRoute />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
