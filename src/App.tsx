import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Events from "./pages/Events";
import CreateEventRoute from "./routes/create";
import EventDetailRoute from "./routes/event.$id";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import BookingsRoute from "./routes/bookings";
import VendorDashboardRoute from "./routes/vendor-dashboard";
import { VendorOnly } from "./components/RoleGuard";
import { AuthProvider } from "./contexts/AuthContext";
import { EventsProvider } from "./contexts/EventsContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <EventsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetailRoute />} />
              <Route path="/event/:id" element={<EventDetailRoute />} />
              <Route path="/create" element={<CreateEventRoute />} />
              <Route path="/bookings" element={<BookingsRoute />} />
              <Route path="/reservations" element={<BookingsRoute />} />
              <Route path="/vendor-dashboard" element={<VendorDashboardRoute />} />
              <Route path="/auth" element={<Auth />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </EventsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
