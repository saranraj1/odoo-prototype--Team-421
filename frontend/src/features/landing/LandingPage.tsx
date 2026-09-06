import React, { useEffect } from 'react';
import { LandingNav } from './components/LandingNav';
import { HeroSection } from './components/HeroSection';
import { WhatIsSection } from './components/WhatIsSection';
import { FeaturesGridSection } from './components/FeaturesGridSection';
import { BenefitsSection } from './components/BenefitsSection';
import { LandingFooter } from './components/LandingFooter';

export const LandingPage: React.FC = () => {
  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900 antialiased">
      {/* 1. Header with single Login to Portal action */}
      <LandingNav />

      <main>
        {/* 2. Hero Section: Overview & Core Value */}
        <HeroSection />

        {/* 3. What is DealFlow360 & Why Required */}
        <WhatIsSection />

        {/* 4. Core Features of DealFlow360 */}
        <FeaturesGridSection />

        {/* 5. Business Outcomes & Impact */}
        <BenefitsSection />
      </main>

      {/* 6. Professional Clean Footer */}
      <LandingFooter />
    </div>
  );
};
