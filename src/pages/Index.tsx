import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, Users, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroImage from "@/assets/hero-image.jpg";
import connectIcon from "@/assets/connect-icon.png";
import eventsIcon from "@/assets/events-icon.png";
import locationIcon from "@/assets/location-icon.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-90" />
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="People gathering at events in Toulouse"
            className="w-full h-full object-cover opacity-30"
          />
        </div>
        
        <div className="relative container mx-auto px-4 py-24 md:py-32">
          <div className="max-w-3xl animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Meet New People.<br />
              Move Together.
            </h1>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Discover and join local activities in Toulouse. From sports to culture, connect with your community through shared experiences.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/events">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto text-base">
                  <Calendar className="mr-2 h-5 w-5" />
                  Browse Events
                </Button>
              </Link>
              <Link to="/create">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base bg-white/10 text-white border-white/30 hover:bg-white/20">
                  <MapPin className="mr-2 h-5 w-5" />
                  Create Event
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Join a vibrant community of people looking to connect and stay active in Toulouse
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="text-center hover:shadow-elevated transition-all duration-300 animate-fade-in border-none shadow-soft">
              <CardContent className="pt-12 pb-8">
                <div className="mb-6 inline-block">
                  <img src={locationIcon} alt="Discover" className="w-24 h-24 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Discover Events</h3>
                <p className="text-muted-foreground">
                  Browse activities happening near you in Toulouse. Filter by category, date, and location.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-elevated transition-all duration-300 animate-fade-in border-none shadow-soft" style={{ animationDelay: "100ms" }}>
              <CardContent className="pt-12 pb-8">
                <div className="mb-6 inline-block">
                  <img src={connectIcon} alt="Connect" className="w-24 h-24 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Connect & Join</h3>
                <p className="text-muted-foreground">
                  Book your spot and meet like-minded people who share your interests and passions.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-elevated transition-all duration-300 animate-fade-in border-none shadow-soft" style={{ animationDelay: "200ms" }}>
              <CardContent className="pt-12 pb-8">
                <div className="mb-6 inline-block">
                  <img src={eventsIcon} alt="Create" className="w-24 h-24 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Create Your Own</h3>
                <p className="text-muted-foreground">
                  Host your own events and build a community around the activities you love.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-white animate-fade-in">
            <h2 className="text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl mb-8 text-white/90">
              Join hundreds of people in Toulouse connecting through shared activities and experiences.
            </p>
            <Link to="/auth">
              <Button variant="secondary" size="lg" className="text-base">
                Join Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span className="font-semibold">Meet & Move</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Meet & Move. Connecting Toulouse, one event at a time.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
