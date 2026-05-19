import { useState, useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { 
  Clock, 
  MessageSquare, 
  ShieldCheck, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Sparkles
} from 'lucide-react'
import { Helmet } from 'react-helmet-async'

export function Homepage() {
  // State for interactive features
  const [sandboxClinicName, setSandboxClinicName] = useState('Apex Physio')
  const [activeFaq, setActiveFaq] = useState<number | null>(null)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  // Scroll-reveal: observe elements with .reveal, .reveal-scale, .reveal-fade
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )

    const elements = document.querySelectorAll('.reveal, .reveal-scale, .reveal-fade')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  // Header glassmorphism on scroll
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  
  // JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "KinetiMap",
    "applicationCategory": "HealthApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "GBP",
      "lowPrice": "49",
      "highPrice": "179",
      "offers": [
        {
          "@type": "Offer",
          "name": "Essentials",
          "price": "49.00",
          "priceCurrency": "GBP",
          "description": "Solo practitioner tier"
        },
        {
          "@type": "Offer",
          "name": "Growth",
          "price": "89.00",
          "priceCurrency": "GBP",
          "description": "Growing clinic tier"
        },
        {
          "@type": "Offer",
          "name": "Scale",
          "price": "179.00",
          "priceCurrency": "GBP",
          "description": "Established multi-practitioner tier"
        }
      ]
    },
    "author": {
      "@type": "Organization",
      "name": "esemdot"
    }
  }

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index)
  }

  return (
    <div ref={mainRef} className="min-h-screen bg-[#EDF6F9] text-[#32323F] font-sans antialiased selection:bg-[#006D77] selection:text-white">
      <Helmet>
        <title>KinetiMap | AI Practice Management for UK Physiotherapists</title>
        <meta name="description" content="Voice-dictate consultations, generate structured clinical notes in seconds, and automate patient journeys via WhatsApp Cloud API. Built for modern UK clinics." />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>

      {/* STICKY HEADER */}
      <header className={`sticky top-0 z-50 px-4 sm:px-6 lg:px-8 glass-header ${headerScrolled ? 'glass-header-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <div className="flex items-center gap-[10px] lg:gap-[12px]">
            <img 
              src="/logo.svg" 
              alt="KinetiMap Logo" 
              className="h-[40px] md:h-[44px] lg:h-[48px] w-auto object-contain [image-rendering:auto]"
            />
            <span className="font-bricolage font-bold text-[20px] md:text-[22px] lg:text-[24px] tracking-tight text-[#32323F]">KinetiMap</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 font-semibold text-sm text-[#32323F]/80">
            <a href="#features" className="hover:text-[#006D77] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#006D77] transition-colors">Pricing</a>
            <a href="#about" className="hover:text-[#006D77] transition-colors">About</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              to="/login"
              className="text-sm font-semibold hover:text-[#006D77] transition-all px-3 py-2 rounded-lg"
            >
              Log in
            </Link>
            <Link 
              to="/signup"
              className="btn-premium bg-[#006D77] hover:bg-[#005560] text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer px-4 py-2 rounded-lg transition-premium"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 flex flex-col items-start text-left reveal">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006D77]/10 text-[#006D77] text-xs font-semibold uppercase tracking-wider mb-6">
            <Sparkles className="w-3.5 h-3.5" /> Built for UK Physiotherapy Clinics
          </div>
          <h1 className="font-bricolage font-black text-4xl sm:text-5xl lg:text-6xl text-[#32323F] leading-[1.1] tracking-tight mb-6">
            Finish Your SOAP Notes Before Your Patient Leaves the Room.
          </h1>
          <p className="text-[#32323F]/80 text-lg sm:text-xl font-medium leading-relaxed mb-8 max-w-2xl">
            KinetiMap is the AI-powered practice platform built for UK physiotherapists. Voice-dictate consultations, generate structured clinical notes in seconds, and finally leave admin at the clinic.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-4">
            <Link 
              to="/signup"
              className="btn-premium flex items-center justify-center bg-[#006D77] hover:bg-[#005560] text-white font-bold shadow-lg hover:shadow-xl py-3.5 px-8 border-2 border-transparent rounded-xl text-center text-base cursor-pointer"
            >
              Start Your Free 14-Day Trial
            </Link>
            <a 
              href="#demo"
              className="flex items-center justify-center gap-2 border-2 border-[#006D77]/20 hover:border-[#006D77]/40 bg-white text-[#32323F] hover:text-[#006D77] font-bold py-3.5 px-8 rounded-xl transition-all hover:bg-white/80 text-base"
            >
              <Play className="w-4 h-4 text-[#006D77] fill-current" />
              Watch 2-Minute Demo
            </a>
          </div>
          <p className="text-sm font-semibold text-[#32323F]/50 ml-1">
            No credit card required. Cancel anytime.
          </p>
        </div>

        <div className="lg:col-span-5 w-full flex justify-center reveal reveal-delay-2">
          <div className="w-full max-w-md bg-white border border-[#E0EEF0] rounded-3xl p-4 shadow-xl relative overflow-hidden group">
            {/* Styled clinical notes mock preview */}
            <div className="bg-[#EDF6F9] rounded-2xl p-5 min-h-[320px] flex flex-col border border-[#E0EEF0] relative">
              <div className="flex items-center justify-between pb-3 border-b border-[#E0EEF0] mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-bold text-[#006D77] uppercase tracking-wider">AI Clinical Assistant</span>
                </div>
                <span className="text-[10px] font-mono text-[#32323F]/40 bg-white px-2 py-0.5 rounded border border-[#E0EEF0]">v1.4</span>
              </div>

              <div className="space-y-4 flex-1">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-[#006D77] uppercase">Subjective (S)</div>
                  <div className="text-xs bg-white rounded-lg p-2.5 border border-[#E0EEF0] shadow-sm leading-relaxed text-[#32323F]/80">
                    Patient presents with a 6-week history of right shoulder discomfort. Aggravated by overhead reach. Pain described as deep ache (6/10 NPRS).
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-[#006D77] uppercase">Objective (O)</div>
                  <div className="text-xs bg-white rounded-lg p-2.5 border border-[#E0EEF0] shadow-sm leading-relaxed text-[#32323F]/80">
                    Right glenohumeral abduction restricted to 110° with pain. Palpable tenderness over supraspinatus insertion area. Painful arc present.
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E0EEF0] flex items-center justify-between text-xs text-[#32323F]/40">
                <span>Continuity reference loaded</span>
                <span className="font-semibold text-[#006D77]">Draft Completed</span>
              </div>
            </div>

            {/* Overlay tag */}
            <div className="absolute inset-0 bg-[#32323F]/5 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="bg-[#32323F] text-white text-xs font-semibold tracking-wider uppercase px-4 py-2 rounded-lg shadow-lg">
                Product screenshot
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM SECTION */}
      <section className="bg-white border-y border-[#E0EEF0] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 reveal">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              THE EVENING ADMIN PROBLEM
            </span>
            <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight">
              You became a physiotherapist to treat patients. Not to type notes until midnight.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col items-start text-left card-hover-lift reveal reveal-delay-1">
              <div className="w-12 h-12 rounded-xl bg-[#006D77]/10 flex items-center justify-center text-[#006D77] mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bricolage font-bold text-xl mb-3">90 Minutes of Notes. Every Single Day.</h3>
              <p className="text-[#32323F]/70 text-sm sm:text-base leading-relaxed">
                The average UK physiotherapist spends 15+ minutes per patient writing SOAP notes — most of it after the clinic closes. That's 7+ unpaid hours every week.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col items-start text-left card-hover-lift reveal reveal-delay-2">
              <div className="w-12 h-12 rounded-xl bg-[#006D77]/10 flex items-center justify-center text-[#006D77] mb-6">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-bricolage font-bold text-xl mb-3">Hidden SMS Fees Eating Your Margins.</h3>
              <p className="text-[#32323F]/70 text-sm sm:text-base leading-relaxed">
                Legacy software charges 4–8p per text message. Send 500 reminders a month and you're paying £40 in hidden fees on top of your subscription.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col items-start text-left card-hover-lift reveal reveal-delay-3">
              <div className="w-12 h-12 rounded-xl bg-[#006D77]/10 flex items-center justify-center text-[#006D77] mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bricolage font-bold text-xl mb-3">GDPR Audit Anxiety, Always.</h3>
              <p className="text-[#32323F]/70 text-sm sm:text-base leading-relaxed">
                Patient data scattered across spreadsheets, email, and clunky desktop software. One ICO complaint and your practice is at risk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SOLUTION SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 reveal">
          <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
            THE KINETIMAP WAY
          </span>
          <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight mb-6">
            One platform. Built by a clinician. Designed for UK physios.
          </h2>
          <p className="text-[#32323F]/80 text-lg leading-relaxed font-medium">
            KinetiMap was built by a medical professional who watched too many talented physiotherapists drown in admin. Every feature exists for one reason: to give you your evenings back without compromising clinical standards or patient care.
          </p>
        </div>
      </section>

      {/* FEATURE SPOTLIGHTS */}
      <section id="features" className="space-y-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Feature 1: AI SOAP Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 text-left reveal">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              HANDS-FREE CLINICAL DOCUMENTATION
            </span>
            <h3 className="font-bricolage font-bold text-2xl sm:text-3xl text-[#32323F] leading-tight mb-4">
              Speak naturally. Get structured notes in seconds.
            </h3>
            <p className="text-[#32323F]/70 leading-relaxed mb-6">
              Press record. Talk to your patient like always. KinetiMap's clinical AI listens, transcribes, and generates a structured SOAP note formatted to UK clinical standards — including subjective findings, objective measurements, assessment, and plan. It even references the last five sessions so your notes maintain clinical continuity.
            </p>
            <ul className="space-y-3 font-semibold text-[#32323F]/80">
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Whisper-grade transcription accuracy</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>UK clinical spelling and terminology built in</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Editable before saving — you stay in control</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Links automatically to the patient's history and booking</span>
              </li>
            </ul>
          </div>
          <div className="lg:col-span-6 bg-white border border-[#E0EEF0] rounded-3xl p-5 shadow-lg max-w-xl mx-auto w-full reveal-scale reveal-delay-2">
            {/* Static preview representing SOAP notes layout */}
            <div className="space-y-4">
              <div className="bg-[#EDF6F9] rounded-xl p-4 border border-[#E0EEF0]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-0.5 bg-[#006D77] text-white text-[9px] font-bold rounded">LIVE EDITOR</div>
                  <span className="text-xs font-semibold text-[#32323F]/50">Audio Recording #392</span>
                </div>
                <div className="flex items-center gap-2 mb-3 bg-white p-2.5 rounded-lg border border-[#E0EEF0]">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs font-mono text-red-600 font-bold">01:42 Dictating...</span>
                </div>
                <div className="text-xs text-[#32323F]/60 italic">
                  "Next, checking internal rotation range, patient winced at 30 degrees..."
                </div>
              </div>

              <div className="border border-[#E0EEF0] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#E0EEF0]">
                  <h4 className="text-xs font-bold text-[#006D77] uppercase tracking-wider">Clinical Output Draft</h4>
                  <span className="text-[10px] text-[#32323F]/40 font-semibold">UK Standard Format</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-[#32323F]/50 block">ASSESSMENT (A)</span>
                    <span className="text-xs text-[#32323F]/80">Primary dysfunction indicates mild right shoulder adhesive capsulitis, consistent with 5-session progression.</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#32323F]/50 block">PLAN (P)</span>
                    <span className="text-xs text-[#32323F]/80">Proceed with low-velocity humeral mobilisations and update home exercise programme to focus on abduction comfort.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: WhatsApp Patient Journeys */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 lg:order-2 text-left reveal">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              AUTOMATED PATIENT COMMUNICATION
            </span>
            <h3 className="font-bricolage font-bold text-2xl sm:text-3xl text-[#32323F] leading-tight mb-4">
              Reminders, follow-ups, and feedback — on the channel patients actually read.
            </h3>
            <p className="text-[#32323F]/70 leading-relaxed mb-6">
              WhatsApp open rates are 98% compared to 20% for email. KinetiMap automates the entire patient journey through WhatsApp Cloud API — booking confirmations, 24-hour reminders, post-session follow-ups, and feedback requests — all without hidden per-message fees.
            </p>
            <ul className="space-y-3 font-semibold text-[#32323F]/80">
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>One "journey" = the complete automation per booking (confirmation + reminder + follow-up)</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>No SMS surcharges, ever</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Patients can reply directly to confirm or reschedule</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Delivery and read receipts visible in your dashboard</span>
              </li>
            </ul>
          </div>
          
          <div className="lg:col-span-6 lg:order-1 bg-white border border-[#E0EEF0] rounded-3xl p-5 shadow-lg max-w-xl mx-auto w-full reveal-scale reveal-delay-2">
            {/* WhatsApp thread mockup and indicators */}
            <div className="bg-[#EDF6F9] rounded-2xl p-4 border border-[#E0EEF0] space-y-4 max-w-sm mx-auto">
              <div className="bg-[#006D77] text-white p-3 rounded-xl flex items-center justify-between shadow-sm">
                <span className="text-xs font-bold font-bricolage">KinetiMap WhatsApp API</span>
                <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded font-mono">Live Node</span>
              </div>
              
              <div className="space-y-3">
                {/* Bubble 1 */}
                <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-[85%] shadow-sm text-left">
                  <p className="text-xs leading-relaxed text-[#32323F]/90">
                    Your appointment at **Apex Physio** is confirmed for tomorrow at 10:00 AM.
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[8px] text-[#32323F]/40 font-mono">14:02</span>
                    {/* Read indicator ticks */}
                    <div className="flex text-blue-500">
                      <Check className="w-3 h-3 -mr-1.5" strokeWidth={3} />
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                  </div>
                </div>

                {/* Bubble 2 */}
                <div className="bg-white rounded-xl rounded-tl-none p-3 max-w-[85%] shadow-sm text-left">
                  <p className="text-xs leading-relaxed text-[#32323F]/90">
                    Hi Sarah, how is your shoulder feeling after today's session? Please rate your current pain scale.
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[8px] text-[#32323F]/40 font-mono">17:15</span>
                    <div className="flex text-blue-500">
                      <Check className="w-3 h-3 -mr-1.5" strokeWidth={3} />
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Status feed widget */}
              <div className="bg-white rounded-xl p-3 border border-[#E0EEF0] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="font-semibold text-[#006D77]">Status: Journey Complete</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[9px] text-[#32323F]/50">
                  <span>98% open-rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 3: Branded Patient Booking */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 text-left reveal">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              A BOOKING EXPERIENCE THAT REFLECTS YOUR CLINIC
            </span>
            <h3 className="font-bricolage font-bold text-2xl sm:text-3xl text-[#32323F] leading-tight mb-4">
              Your colours. Your logo. Your booking URL.
            </h3>
            <p className="text-[#32323F]/70 leading-relaxed mb-6">
              Send patients to a booking page that feels like an extension of your clinic — not a generic third-party form. They tap their pain area on an interactive body map, choose a time, and you get a fully briefed appointment before they walk in.
            </p>
            <ul className="space-y-3 font-semibold text-[#32323F]/80">
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Custom URL: kinetimap.app/your-clinic-name</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Interactive body map for pain location and severity</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Mobile-first design — most patients book on their phone</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm sm:text-base">
                <Check className="w-5 h-5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                <span>Branded with your logo and colours automatically</span>
              </li>
            </ul>
          </div>
          
          <div className="lg:col-span-6 bg-white border border-[#E0EEF0] rounded-3xl p-6 shadow-lg max-w-xl mx-auto w-full reveal-scale reveal-delay-2">
            {/* Interactive Branding Sandbox Preview */}
            <div className="space-y-5">
              <div className="bg-[#EDF6F9] rounded-xl p-4 border border-[#E0EEF0]">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#006D77] mb-2">
                  Try it: Enter Your Clinic Name
                </label>
                <input 
                  type="text" 
                  value={sandboxClinicName}
                  onChange={(e) => setSandboxClinicName(e.target.value)}
                  className="w-full bg-white border border-[#E0EEF0] rounded-lg px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#006D77] transition-all"
                  placeholder="e.g. Apex Physio"
                />
              </div>

              {/* Repurposed Branding Mobile Preview frame */}
              <div className="bg-white border-[3px] border-gray-800 rounded-[30px] shadow-lg overflow-hidden mx-auto max-w-xs transition-premium">
                <div className="h-6 bg-gray-800 flex items-center justify-center">
                  <div className="w-16 h-1 bg-gray-600 rounded-full" />
                </div>
                <div className="bg-[#EDF6F9] p-5 text-center border-b border-[#E0EEF0]" style={{ backgroundColor: 'rgba(217,178,156,0.2)' }}>
                  <div className="w-12 h-12 rounded-xl shadow-sm mx-auto mb-2.5 flex items-center justify-center text-white font-bold text-lg font-bricolage bg-[#006D77]">
                    {sandboxClinicName ? sandboxClinicName[0].toUpperCase() : '?'}
                  </div>
                  <h4 className="text-sm font-bold font-bricolage text-[#32323F]">
                    {sandboxClinicName || 'Your Clinic Name'}
                  </h4>
                </div>
                <div className="p-4 bg-white space-y-4">
                  <div className="flex justify-center">
                    <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-white bg-[#006D77]">
                      £60.00 · 60 min
                    </span>
                  </div>
                  <button className="w-full py-2.5 rounded-lg text-white text-xs font-bold bg-[#006D77] hover:opacity-90 shadow-md">
                    Book an Appointment
                  </button>
                  <p className="text-[8px] text-[#32323F]/30 text-center">Powered by KinetiMap</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO SECTION */}
      <section id="demo" className="bg-white border-y border-[#E0EEF0] py-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-4xl mx-auto reveal">
          <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
            PRODUCT WALKTHROUGH
          </span>
          <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight mb-8">
            See KinetiMap in Action
          </h2>
          <div className="w-full max-w-2xl mx-auto aspect-video rounded-3xl bg-[#EDF6F9] border border-[#E0EEF0] flex flex-col items-center justify-center shadow-inner relative overflow-hidden group">
            <div className="w-16 h-16 rounded-full bg-[#006D77] flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-6 h-6 fill-current ml-1" />
            </div>
            <div className="mt-4 text-[#32323F]/50 text-sm font-bold uppercase tracking-widest">
              Demo video coming soon
            </div>
          </div>
        </div>
      </section>

      {/* TRUST & COMPLIANCE SECTION */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
            BUILT FOR UK HEALTHCARE STANDARDS
          </span>
          <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight mb-6">
            GDPR-compliant by default. Not as an afterthought.
          </h2>
          <p className="text-[#32323F]/70 text-base sm:text-lg">
            Patient data is the most sensitive information you handle. KinetiMap gives you the controls regulators expect and the audit trail you'll need if asked.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Pillar 1 */}
          <div className="bg-white border border-[#E0EEF0] rounded-2xl p-6 shadow-sm card-hover-lift text-left reveal reveal-delay-1">
            <h3 className="font-bricolage font-bold text-lg text-[#006D77] mb-3">UK Data Residency</h3>
            <p className="text-[#32323F]/70 text-sm leading-relaxed">
              All patient data stored in EU data centres. Never shipped overseas.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white border border-[#E0EEF0] rounded-2xl p-6 shadow-sm card-hover-lift text-left reveal reveal-delay-2">
            <h3 className="font-bricolage font-bold text-lg text-[#006D77] mb-3">One-Click Data Export</h3>
            <p className="text-[#32323F]/70 text-sm leading-relaxed">
              Right to Portability fulfilled automatically. Export a full patient record as a structured ZIP in seconds.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white border border-[#E0EEF0] rounded-2xl p-6 shadow-sm card-hover-lift text-left reveal reveal-delay-3">
            <h3 className="font-bricolage font-bold text-lg text-[#006D77] mb-3">Right to be Forgotten</h3>
            <p className="text-[#32323F]/70 text-sm leading-relaxed">
              Patient deletion cascades across every system. No leftover records in backups or audit logs.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="bg-white border border-[#E0EEF0] rounded-2xl p-6 shadow-sm card-hover-lift text-left reveal reveal-delay-4">
            <h3 className="font-bricolage font-bold text-lg text-[#006D77] mb-3">Granular Consent Tracking</h3>
            <p className="text-[#32323F]/70 text-sm leading-relaxed">
              Per-patient consent toggles for AI processing, marketing communications, and data sharing. Logged with timestamps.
            </p>
          </div>
        </div>
      </section>

      {/* FOUNDING MEMBERS SECTION */}
      <section className="bg-white border-y border-[#E0EEF0] py-20 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto mb-16 reveal">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              EARLY ACCESS
            </span>
            <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight mb-6">
              Join the founding 100 UK clinics shaping KinetiMap.
            </h2>
            <p className="text-[#32323F]/70 text-base sm:text-lg">
              We're building KinetiMap with feedback from UK physiotherapists every single week. Founding members get:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Benefit Card 1 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 text-left shadow-sm">
              <h3 className="font-bricolage font-bold text-xl text-[#006D77] mb-3">Lifetime Founding Pricing</h3>
              <p className="text-[#32323F]/70 text-sm leading-relaxed">
                Lock in £49/month on Essentials. Forever. Even when we raise prices later, your rate stays the same.
              </p>
            </div>

            {/* Benefit Card 2 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 text-left shadow-sm">
              <h3 className="font-bricolage font-bold text-xl text-[#006D77] mb-3">Direct Founder Access</h3>
              <p className="text-[#32323F]/70 text-sm leading-relaxed">
                A monthly 1:1 call with our founder. Request features, flag bugs, shape the roadmap.
              </p>
            </div>

            {/* Benefit Card 3 */}
            <div className="bg-[#EDF6F9] border border-[#E0EEF0] rounded-2xl p-6 md:p-8 text-left shadow-sm">
              <h3 className="font-bricolage font-bold text-xl text-[#006D77] mb-3">Priority Onboarding</h3>
              <p className="text-[#32323F]/70 text-sm leading-relaxed">
                White-glove migration from your current system. We move your patient records, set up your branded booking page, and train your team.
              </p>
            </div>
          </div>

          <Link 
            to="/signup"
            className="btn-premium bg-[#006D77] hover:bg-[#005560] text-white font-bold shadow-lg py-4 px-10 rounded-xl text-lg cursor-pointer inline-block"
          >
            Claim Your Founding Spot
          </Link>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto reveal">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal">
          <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
            SIMPLE, TRANSPARENT PRICING
          </span>
          <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F] leading-tight mb-6">
            Pricing that scales with your clinic — not your stress levels.
          </h2>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#006D77]/10 border border-[#006D77]/20 text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-wide">
            <Sparkles className="w-4 h-4" /> Try any plan free for 14 days. No credit card required.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-12 reveal">
          {/* Card 1: Essentials */}
          <div className="bg-white border border-[#E0EEF0] rounded-3xl p-8 flex flex-col justify-between shadow-sm relative hover:shadow-md transition-all text-left reveal">
            <div>
              <h3 className="font-bricolage font-bold text-2xl text-[#32323F] mb-1">Essentials</h3>
              <p className="text-[#32323F]/50 text-sm font-medium mb-6">For solo practitioners</p>
              
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-black font-bricolage text-[#006D77]">£49</span>
                <span className="text-[#32323F]/50 font-semibold text-sm ml-2">/ month</span>
              </div>

              <div className="w-full h-px bg-[#E0EEF0] mb-6" />

              <ul className="space-y-3.5 mb-8 font-semibold text-[#32323F]/80">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>1 practitioner</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>300 WhatsApp journeys / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>200 AI SOAP notes / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Branded booking page</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>GDPR-compliant patient records</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Email support</span>
                </li>
              </ul>
            </div>

            <Link 
              to="/signup"
              search={(prev) => ({ ...prev, plan: 'essentials' })}
              className="w-full bg-[#006D77]/10 hover:bg-[#006D77]/20 text-[#006D77] font-bold text-center py-3.5 rounded-xl transition-all font-semibold"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Card 2: Growth (MOST POPULAR) */}
          <div className="bg-white border-2 border-[#006D77] rounded-3xl p-8 flex flex-col justify-between shadow-lg relative text-left ring-4 ring-[#006D77]/5 scale-100 lg:scale-[1.03] reveal">
            {/* "Most Popular" Ribbon */}
            <div className="absolute -top-4 right-8 bg-[#006D77] text-white text-xs font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-md">
              Most Popular
            </div>

            <div>
              <h3 className="font-bricolage font-bold text-2xl text-[#32323F] mb-1">Growth</h3>
              <p className="text-[#32323F]/50 text-sm font-medium mb-6">For growing clinics</p>
              
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-black font-bricolage text-[#006D77]">£89</span>
                <span className="text-[#32323F]/50 font-semibold text-sm ml-2">/ month</span>
              </div>

              <div className="w-full h-px bg-[#E0EEF0] mb-6" />

              <ul className="space-y-3.5 mb-8 font-semibold text-[#32323F]/80">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>2–3 practitioners</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>1,000 WhatsApp journeys / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>600 AI SOAP notes / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-[#006D77]">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>AI-driven follow-up and discharge summaries</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Outcome measure tracking (PSFS, NPRS, Oswestry)</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Priority email support</span>
                </li>
              </ul>
            </div>

            <Link 
              to="/signup"
              search={(prev) => ({ ...prev, plan: 'growth' })}
              className="w-full bg-[#006D77] hover:bg-[#005560] text-white font-bold text-center py-3.5 rounded-xl transition-all shadow-md"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Card 3: Scale */}
          <div className="bg-white border border-[#E0EEF0] rounded-3xl p-8 flex flex-col justify-between shadow-sm relative hover:shadow-md transition-all text-left reveal">
            <div>
              <h3 className="font-bricolage font-bold text-2xl text-[#32323F] mb-1">Scale</h3>
              <p className="text-[#32323F]/50 text-sm font-medium mb-6">For established multi-practitioner clinics</p>
              
              <div className="flex items-baseline mb-6">
                <span className="text-4xl font-black font-bricolage text-[#006D77]">£179</span>
                <span className="text-[#32323F]/50 font-semibold text-sm ml-2">/ month</span>
              </div>

              <div className="w-full h-px bg-[#E0EEF0] mb-6" />

              <ul className="space-y-3.5 mb-8 font-semibold text-[#32323F]/80">
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Unlimited practitioners</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>3,000 WhatsApp journeys / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>1,500 AI SOAP notes / month</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Multi-location support</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Advanced analytics dashboard</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <Check className="w-4.5 h-4.5 text-[#006D77] flex-shrink-0" strokeWidth={3} />
                  <span>Dedicated phone support</span>
                </li>
              </ul>
            </div>

            <Link 
              to="/signup"
              search={(prev) => ({ ...prev, plan: 'scale' })}
              className="w-full bg-[#006D77]/10 hover:bg-[#006D77]/20 text-[#006D77] font-bold text-center py-3.5 rounded-xl transition-all font-semibold"
            >
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>

        <div className="text-center space-y-3 text-sm text-[#32323F]/60 font-semibold max-w-2xl mx-auto">
          <p>
            Need more? Custom Enterprise plans available for NHS contracts and multi-site groups. Contact us.
          </p>
          <div className="inline-block px-3 py-1 bg-[#006D77]/5 border border-[#006D77]/10 rounded-lg text-xs">
            Add-on note: Need extra AI notes? Booster packs available: 100 for £8, 300 for £18, 500 for £25.
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="bg-white border-y border-[#E0EEF0] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#006D77] text-xs sm:text-sm font-bold uppercase tracking-widest block mb-3">
              COMMON QUESTIONS
            </span>
            <h2 className="font-bricolage font-bold text-3xl sm:text-4xl text-[#32323F]">
              Honest answers to honest questions.
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Is the AI accurate enough for clinical use?",
                a: "KinetiMap uses Whisper-grade transcription with UK clinical spelling and terminology. Every AI-generated note is editable before saving — you remain the clinician of record. We do not auto-diagnose; the AI structures your words, it doesn't replace your judgement."
              },
              {
                q: "How does this compare to Cliniko or WriteUpp?",
                a: "Legacy platforms were built before clinical AI existed. They charge 4–8p per SMS message, require manual note-taking, and offer limited customisation. KinetiMap was built specifically for modern UK physiotherapy practice, with native AI dictation and WhatsApp automation included in your subscription."
              },
              {
                q: "What happens to my data if I cancel?",
                a: "You own your data, always. One click exports your entire clinic — patient records, SOAP notes, booking history, payment records — as a structured ZIP file. We delete everything from our systems within 30 days."
              },
              {
                q: "Will it work with my existing patients?",
                a: "Yes. Founding members get white-glove migration. We import your patient records, set up your branded booking page, and onboard your team. Most clinics are fully operational within 48 hours."
              },
              {
                q: "Do I need to install anything?",
                a: "No. KinetiMap runs in your browser on any modern device — laptop, iPad, or phone. No downloads, no updates to manage, no IT department required."
              },
              {
                q: "Is my patient data GDPR compliant?",
                a: "Yes. All data is stored in EU data centres. We provide one-click Right to Portability and Right to be Forgotten fulfilment. Granular consent tracking is built into every patient record."
              }
            ].map((faq, idx) => (
              <div 
                key={idx}
                className="border border-[#E0EEF0] bg-[#EDF6F9]/30 rounded-2xl overflow-hidden transition-premium"
              >
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full flex items-center justify-between p-5 sm:p-6 text-left font-bricolage font-bold text-base sm:text-lg text-[#32323F] hover:text-[#006D77] transition-colors outline-none"
                >
                  <span>{faq.q}</span>
                  {activeFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-[#006D77] flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#32323F]/40 flex-shrink-0" />
                  )}
                </button>
                
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    activeFaq === idx ? 'max-h-[300px] border-t border-[#E0EEF0] bg-white' : 'max-h-0'
                  }`}
                >
                  <p className="p-5 sm:p-6 text-sm sm:text-base leading-relaxed text-[#32323F]/80">
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="bg-[#006D77] text-white py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto space-y-8 relative z-10 reveal">
          <h2 className="font-bricolage font-black text-4xl sm:text-5xl tracking-tight leading-tight">
            Your evenings are waiting.
          </h2>
          <p className="text-white/80 text-lg sm:text-xl font-medium leading-relaxed max-w-2xl mx-auto">
            Start your free 14-day trial. No credit card required. Be one of the founding 100 UK clinics shaping the future of physiotherapy practice management.
          </p>
          <div className="pt-4">
            <Link 
              to="/signup"
              className="btn-premium bg-white hover:bg-white/95 text-[#006D77] font-black text-lg py-4 px-10 rounded-xl shadow-xl transition-all cursor-pointer inline-block"
            >
              Start Your Free Trial →
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="about" className="bg-white text-[#32323F]/50 py-16 px-4 sm:px-6 lg:px-8 border-t border-[#E0EEF0]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Column 1 Logo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.svg" 
                alt="KinetiMap Logo" 
                className="h-[32px] md:h-[36px] w-auto object-contain [image-rendering:auto]"
              />
              <span className="font-bricolage font-bold text-[16px] md:text-[18px] tracking-tight text-[#32323F]">KinetiMap</span>
            </div>
            <p className="text-xs leading-relaxed max-w-xs">
              Automated patient journeys and voice-dictated SOAP notes designed specifically for modern UK physiotherapy clinics.
            </p>
            <div className="flex items-center gap-3 pt-4">
              <a 
                href="https://www.instagram.com/kinetimap.app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-lg bg-[#006D77]/5 hover:bg-[#006D77]/10 text-[#006D77] flex items-center justify-center transition-all border border-[#006D77]/10 hover:border-[#006D77]/20 hover:scale-105"
                title="Instagram"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
              <a 
                href="https://www.facebook.com/kinetimap" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-lg bg-[#006D77]/5 hover:bg-[#006D77]/10 text-[#006D77] flex items-center justify-center transition-all border border-[#006D77]/10 hover:border-[#006D77]/20 hover:scale-105"
                title="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/>
                </svg>
              </a>
              <a 
                href="https://x.com/kinetimap.app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-lg bg-[#006D77]/5 hover:bg-[#006D77]/10 text-[#006D77] flex items-center justify-center transition-all border border-[#006D77]/10 hover:border-[#006D77]/20 hover:scale-105"
                title="X (Twitter)"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a 
                href="https://www.youtube.com/channel/UCnlbdV1hrHv3-GsOihdg20w" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-lg bg-[#006D77]/5 hover:bg-[#006D77]/10 text-[#006D77] flex items-center justify-center transition-all border border-[#006D77]/10 hover:border-[#006D77]/20 hover:scale-105"
                title="YouTube"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.53 3.5 12 3.5 12 3.5s-7.53 0-9.388.555A3.003 3.003 0 0 0 .502 6.163C0 8.07 0 12 0 12s0 3.93.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.47 20.5 12 20.5 12 20.5s7.53 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.93 24 12 24 12s0-3.93-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <a 
                href="https://linktr.ee/kinetimap.app" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-lg bg-[#006D77]/5 hover:bg-[#006D77]/10 text-[#006D77] flex items-center justify-center transition-all border border-[#006D77]/10 hover:border-[#006D77]/20 hover:scale-105"
                title="Linktree"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="m13.73635 5.85251 4.00467 -4.11665 2.3248 2.3808 -4.20064 4.00466h5.9085v3.30473h-5.9365l4.22865 4.10766 -2.3248 2.3338L12.0005 12.099l-5.74052 5.76852 -2.3248 -2.3248 4.22864 -4.10766h-5.9375V8.12132h5.9085L3.93417 4.11666l2.3248 -2.3808 4.00468 4.11665V0h3.4727zm-3.4727 10.30614h3.4727V24h-3.4727z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2 Product */}
          <div className="space-y-4 text-left">
            <h4 className="text-[#32323F] text-xs font-bold uppercase tracking-widest">Product</h4>
            <ul className="space-y-2 text-sm font-semibold">
              <li><a href="#features" className="hover:text-[#006D77] transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-[#006D77] transition-colors">Pricing</a></li>
              <li><a href="#demo" className="hover:text-[#006D77] transition-colors">Book a Demo</a></li>
              <li><Link to="/login" className="hover:text-[#006D77] transition-colors">Log in</Link></li>
            </ul>
          </div>

          {/* Column 3 Company */}
          <div className="space-y-4 text-left">
            <h4 className="text-[#32323F] text-xs font-bold uppercase tracking-widest">Company</h4>
            <ul className="space-y-2 text-sm font-semibold">
              <li><a href="#about" className="hover:text-[#006D77] transition-colors">About</a></li>
              <li><a href="mailto:support@kinetimap.app" className="hover:text-[#006D77] transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-[#006D77] transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Column 4 Legal */}
          <div className="space-y-4 text-left">
            <h4 className="text-[#32323F] text-xs font-bold uppercase tracking-widest">Legal</h4>
            <ul className="space-y-2 text-sm font-semibold">
              <li><a href="#" className="hover:text-[#006D77] transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#006D77] transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-[#006D77] transition-colors">GDPR Data Requests</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-[#E0EEF0] flex flex-col sm:flex-row items-center justify-between text-xs gap-4">
          <p>© 2026 KinetiMap. A product by esemdot. Made for UK physiotherapists.</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="font-semibold text-[#006D77]">UK Healthcare Standards Compliant</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
