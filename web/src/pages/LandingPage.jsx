import { useState } from 'react';
import {
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineMapPin,
  HiOutlineCurrencyDollar,
  HiOutlineStar,
  HiOutlineCheckCircle,
  HiOutlineArrowRight,
  HiOutlineWrench,
  HiOutlineBolt,
  HiOutlineHomeModern,
  HiOutlinePaintBrush,
  HiOutlineChatBubbleLeftRight,
  HiOutlinePhone,
  HiOutlineEnvelope,
} from 'react-icons/hi2';
import { FiMenu, FiX, FiFacebook, FiTwitter, FiInstagram, FiLinkedin } from 'react-icons/fi';

const stats = [
  { value: '2,500+', label: 'Verified Fundis' },
  { value: '15,000+', label: 'Jobs Completed' },
  { value: '25+', label: 'Cities Across Uganda' },
  { value: '4.8', label: 'Average Rating' },
];

const steps = [
  {
    number: '01',
    title: 'Describe Your Problem',
    desc: 'Tell us what needs fixing — snap a photo or type a description. Our AI instantly understands and categorizes your request.',
    icon: HiOutlineChatBubbleLeftRight,
  },
  {
    number: '02',
    title: 'Get Matched Instantly',
    desc: 'Our smart matching engine finds the nearest verified fundi with the right skills. They have 5 minutes to accept, or the next best fundi is notified.',
    icon: HiOutlineSparkles,
  },
  {
    number: '03',
    title: 'Track & Pay Safely',
    desc: 'Watch your fundi arrive in real-time. Pay securely through escrow — funds are only released when you confirm the job is done.',
    icon: HiOutlineShieldCheck,
  },
];

const features = [
  {
    icon: HiOutlineSparkles,
    title: 'AI-Powered Matching',
    desc: 'Describe your problem in plain language or upload a photo. Our AI identifies the issue and matches you with the best-qualified fundi nearby.',
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Escrow Payments',
    desc: 'Your money is held safely in escrow until the job is completed and confirmed by both you and the fundi. Zero risk.',
  },
  {
    icon: HiOutlineMapPin,
    title: 'Real-Time Tracking',
    desc: 'Track your fundi live on the map as they head to your location. Know exactly when they will arrive.',
  },
  {
    icon: HiOutlineCurrencyDollar,
    title: 'Fair Price Negotiation',
    desc: 'Agree on a fair price with your fundi before any work begins. No hidden fees, no surprises.',
  },
  {
    icon: HiOutlineCheckCircle,
    title: 'Verified Professionals',
    desc: 'Every fundi goes through our verification process — document checks, skill assessments, and admin approval before going live.',
  },
  {
    icon: HiOutlineStar,
    title: 'Reviews & Ratings',
    desc: 'Read honest reviews from real customers. Our recommendation engine ranks fundis by rating and proximity to find you the best.',
  },
];

const services = [
  { icon: HiOutlineWrench, name: 'Plumbing', desc: 'Pipe fitting, leak repair, water heater installation' },
  { icon: HiOutlineBolt, name: 'Electrical', desc: 'Wiring, lighting installation, generator repair' },
  { icon: HiOutlineHomeModern, name: 'Carpentry', desc: 'Furniture repair, door installation, custom builds' },
  { icon: HiOutlinePaintBrush, name: 'Painting', desc: 'Interior & exterior painting, wall preparation' },
];

const testimonials = [
  {
    name: 'Sarah Nakamya',
    role: 'Homeowner, Kampala',
    text: "My kitchen sink was flooding and I found a plumber on Ufundi in under 2 minutes. He arrived within the hour and fixed it perfectly. The escrow payment gave me so much peace of mind.",
    rating: 5,
  },
  {
    name: 'David Okello',
    role: 'Fundi — Electrician',
    text: "Ufundi changed my business. I used to struggle finding clients. Now bookings come to me automatically based on my location. I've tripled my monthly income in just 3 months.",
    rating: 5,
  },
  {
    name: 'Grace Achieng',
    role: 'Property Manager, Entebbe',
    text: "Managing multiple properties means constant repairs. Ufundi lets me dispatch fundis for all my units, track the jobs, and handle payments — all from one app. Incredibly efficient.",
    rating: 5,
  },
];

const navLinks = [
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Services', href: '#services' },
  { label: 'Features', href: '#features' },
  { label: 'Reviews', href: '#testimonials' },
];

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary text-white font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/90 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-bg-primary font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-bold">
                Ufundi
              </span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-muted hover:text-white transition-colors text-sm font-medium"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#cta"
                className="bg-primary hover:bg-primary/90 text-bg-primary px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Download App
              </a>
            </div>

            <button
              className="md:hidden text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <FiX size={24} /> : <FiMenu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-bg-card border-t border-border">
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-muted hover:text-white transition-colors text-sm font-medium py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#cta"
                className="block bg-primary text-bg-primary text-center px-5 py-2.5 rounded-lg text-sm font-semibold mt-2"
                onClick={() => setMobileOpen(false)}
              >
                Download App
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <HiOutlineSparkles className="text-primary text-sm" />
            <span className="text-primary text-sm font-medium">AI-Powered Home Services</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Your Trusted Fundis,
            <br />
            <span className="text-primary">One Tap Away</span>
          </h1>

          <p className="text-muted text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Find verified plumbers, electricians, carpenters, and painters near you.
            Book in seconds, track in real-time, pay securely through escrow.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#cta"
              className="bg-primary hover:bg-primary/90 text-bg-primary px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center gap-2"
            >
              Find a Fundi
              <HiOutlineArrowRight className="text-lg" />
            </a>
            <a
              href="#cta"
              className="border border-border hover:border-primary/50 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:bg-primary/5"
            >
              Become a Fundi
            </a>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-muted text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How <span className="text-primary">Ufundi</span> Works
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Getting your home fixed has never been this easy. Three simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t border-dashed border-border" />
                )}
                <div className="bg-bg-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-colors relative">
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-5">
                    <step.icon className="text-primary text-2xl" />
                  </div>
                  <div className="text-primary/40 text-sm font-bold mb-2">STEP {step.number}</div>
                  <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section id="services" className="py-20 md:py-28 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Services <span className="text-primary">Available</span>
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              From leaky pipes to broken wiring — we've got the right fundi for every job.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <div
                key={service.name}
                className="bg-bg-card border border-border rounded-2xl p-6 hover:border-primary/40 hover:bg-bg-raised transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <service.icon className="text-primary text-xl" />
                </div>
                <h3 className="text-lg font-bold mb-2">{service.name}</h3>
                <p className="text-muted text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why <span className="text-primary">Ufundi</span>?
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Built for Uganda. Designed for trust. Powered by technology.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="text-primary text-xl" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 md:py-28 bg-bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Loved by <span className="text-primary">Thousands</span>
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              Hear from customers and fundis who use Ufundi every day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <HiOutlineStar key={i} className="text-primary text-lg fill-primary" />
                  ))}
                </div>
                <p className="text-muted text-sm leading-relaxed flex-1 mb-6">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-muted text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section id="cta" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
                Ready to Get <span className="text-primary">Started</span>?
              </h2>
              <p className="text-muted text-lg max-w-xl mx-auto mb-8">
                Join thousands of Ugandans who trust Ufundi for their home service needs.
                Download the app today.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="#"
                  className="bg-primary hover:bg-primary/90 text-bg-primary px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:shadow-lg hover:shadow-primary/20 flex items-center gap-2"
                >
                  <i className="fab fa-google-play" />
                  Download for Android
                </a>
                <a
                  href="#"
                  className="border border-border hover:border-primary/50 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:bg-primary/5"
                >
                  Visit Our Website
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-bg-primary font-bold text-lg">F</span>
                </div>
                <span className="text-xl font-bold">
                  Ufundi
                </span>
              </div>
              <p className="text-muted text-sm leading-relaxed mb-4">
                Connecting customers with verified skilled artisans across Uganda. Safe, fast, and reliable.
              </p>
              <div className="flex gap-3">
                {[FiFacebook, FiTwitter, FiInstagram, FiLinkedin].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-9 h-9 bg-bg-raised border border-border rounded-lg flex items-center justify-center text-muted hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-bold text-sm mb-4">Quick Links</h3>
              <ul className="space-y-2.5">
                {['How It Works', 'Services', 'Pricing', 'Become a Fundi', 'About Us'].map(
                  (link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-muted text-sm hover:text-white transition-colors"
                      >
                        {link}
                      </a>
                    </li>
                  ),
                )}
                <li>
                  <a
                    href="/admin"
                    className="text-primary text-sm font-semibold hover:text-amber-400 transition-colors"
                  >
                    Admin Panel
                  </a>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div>
              <h3 className="font-bold text-sm mb-4">Services</h3>
              <ul className="space-y-2.5">
                {['Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Custom Services'].map(
                  (service) => (
                    <li key={service}>
                      <a
                        href="#"
                        className="text-muted text-sm hover:text-white transition-colors"
                      >
                        {service}
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-bold text-sm mb-4">Contact Us</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-2.5 text-muted text-sm">
                  <HiOutlinePhone className="text-primary text-base flex-shrink-0" />
                  +256 700 123 456
                </li>
                <li className="flex items-center gap-2.5 text-muted text-sm">
                  <HiOutlineEnvelope className="text-primary text-base flex-shrink-0" />
                  support@ufundi.ug
                </li>
                <li className="flex items-start gap-2.5 text-muted text-sm">
                  <HiOutlineMapPin className="text-primary text-base flex-shrink-0 mt-0.5" />
                  Kampala, Uganda
                </li>
              </ul>
              <a
                href="#"
                className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-5 py-2.5 rounded-lg text-sm font-semibold mt-5 hover:bg-primary/20 transition-colors"
              >
                <HiOutlineChatBubbleLeftRight className="text-base" />
                Send us a message
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-muted text-xs">
              &copy; {new Date().getFullYear()} Ufundi Uganda. All rights reserved.
            </p>
            <div className="flex gap-5">
              {['Privacy Policy', 'Terms & Conditions'].map((link) => (
                <a
                  key={link}
                  href="#"
                  className="text-muted text-xs hover:text-white transition-colors"
                >
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
