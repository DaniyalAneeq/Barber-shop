import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import ServicesSection from "./components/ServicesSection";
import AboutSection from "./components/AboutSection";
import GallerySection from "./components/GallerySection";
import JourneySection from "./components/sections/JourneySection";
import ContactSection from "./components/ContactSection";
import BarberFooter from "./components/footer";

export default function Page() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <AboutSection />
      <GallerySection />
      <JourneySection />
      <ContactSection />
      <BarberFooter />
    </main>
  );
}
