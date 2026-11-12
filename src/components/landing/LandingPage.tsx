import React, { useState } from 'react';
import { 
  GitFork, 
  Compass, 
  ShieldCheck, 
  Camera, 
  Users, 
  ArrowRight, 
  ChevronDown, 
  Check, 
  Lock, 
  Sparkles 
} from 'lucide-react';
import { TiesoraLogo } from '../common/TiesoraLogo';

interface LandingPageProps {
  onStartBuilding: () => void;
  onExploreDemo: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartBuilding,
  onExploreDemo,
  onSignIn,
  onSignUp,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does Tiesora calculate relationships between distant relatives?',
      a: 'Tiesora runs a deterministic, graph-based pathfinding engine. Instead of guessing from names, it traverses verified directional parent-child, spouse, adoptive, and step relationships stored in the database to calculate exact kinship classifications (such as first cousins, aunts/uncles, half-siblings, and cousins once removed) and identifies shared common ancestors.',
    },
    {
      q: 'Can multiple relatives collaborate on the same family tree?',
      a: 'Yes. Tiesora supports two role levels: Administrator and Viewer. Administrators have full access to add and edit family members, manage relationships, upload memories, and manage user access. Viewers can browse the tree, search members, and view authorized content — but cannot make any changes. Admins send secure invitation links and assign the appropriate role.',
    },
    {
      q: 'Is our family data private and secure?',
      a: "Absolutely. Tiesora does not make family trees publicly searchable by default. All data models are backed by Supabase Row-Level Security (RLS) policies ensuring only invited, authenticated family members have access. Living members' sensitive details can also be protected.",
    },
    {
      q: 'Can Tiesora handle adoptive, step, or blended family structures?',
      a: 'Yes. We believe every family structure deserves respectful, accurate representation. The engine supports adoptive parents, step-parents, half-siblings, and domestic partnerships with explicit relationship markers rather than forcing rigid biological templates.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-900 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Wordmark */}
          <div className="shrink-0">
            <TiesoraLogo size="sm" />
          </div>

          {/* Zone 2: Nav links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-stone-600">
            <a href="#features" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#preview" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
              Tree Preview
            </a>
            <a href="#privacy" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
              Privacy & Trust
            </a>
            <a href="#faq" className="hover:text-emerald-900 transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          {/* Zone 3: CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onSignIn}
              className="text-xs font-semibold text-stone-700 hover:text-emerald-900 px-3 py-2 transition-colors whitespace-nowrap"
            >
              Sign In
            </button>
            <button
              onClick={onSignUp}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-semibold shadow-xs hover:shadow transition-all whitespace-nowrap"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-10 pb-14 px-4 sm:px-8 max-w-5xl mx-auto text-center space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-full text-xs font-semibold text-emerald-900">
          <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
          Smart Family Tree & Relationship Intelligence
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-stone-900 tracking-tight leading-[1.1] max-w-3xl mx-auto">
          Your family story, <br />
          <span className="text-emerald-800">beautifully connected.</span>
        </h1>

        <p className="text-base sm:text-lg text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Build your family tree, discover relationships between relatives, and preserve family memories.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={onStartBuilding}
            className="px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-xl text-sm shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            Build Your Family Tree
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onExploreDemo}
            className="px-6 py-3.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-semibold rounded-xl text-sm transition-all"
          >
            Explore Live Demo Tree
          </button>
        </div>

        {/* Tree Preview Showcase Card */}
        <div id="preview" className="pt-10">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-xl text-left space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Montgomery-Vance Heritage Tree</h3>
                  <p className="text-xs text-stone-400">4 Generations · 16 Members · Interactive Zoom & Pan</p>
                </div>
              </div>
              <button
                onClick={onExploreDemo}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 rounded-lg text-xs font-semibold transition-colors"
              >
                Launch Workspace ➔
              </button>
            </div>

            {/* Mock interactive branch preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50/60 p-4 rounded-2xl border border-stone-100">
              <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-stone-400">Generation I</span>
                <p className="font-bold text-stone-900 text-xs">Arthur & Margaret Montgomery</p>
                <p className="text-[11px] text-stone-500 tabular-nums">1930 – 2018 · Boston, MA</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-emerald-700/60 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Generation II</span>
                <p className="font-bold text-stone-900 text-xs">Robert & Diana Vance-Montgomery</p>
                <p className="text-[11px] text-stone-500 tabular-nums">Married 1984 · 2 Children</p>
              </div>

              <div className="p-4 bg-white rounded-xl border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-stone-400">Generation III</span>
                <p className="font-bold text-stone-900 text-xs">Thomas & Audrey Lin</p>
                <p className="text-[11px] text-stone-500 tabular-nums">1986 · Cambridge, MA</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How Tiesora Works (3 Simple Steps) */}
      <section id="how-it-works" className="py-14 bg-white border-y border-stone-200 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Simple Workflow
            </span>
            <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">
              How Tiesora Works in Three Simple Steps
            </h2>
            <p className="text-sm text-stone-600 max-w-xl mx-auto">
              No confusing pedigree charts or convoluted genealogical databases.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-base font-bold text-stone-900">Add Your Family</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Start with yourself or grandparents. Add names, birth years, and immediate relationships with progressive disclosure.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h3 className="text-base font-bold text-stone-900">Discover Connections</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                The Tiesora graph engine calculates relationship paths, shared common ancestors, and generation distance between any two people.
              </p>
            </div>

            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="text-base font-bold text-stone-900">Preserve & Collaborate</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Invite relatives with custom role permissions. Upload photographs, milestones, and heirloom stories to a private digital archive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep-Dive Grid */}
      <section id="features" className="py-14 px-4 sm:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
            Core Platform Pillars
          </span>
          <h2 className="text-3xl font-extrabold text-stone-900 tracking-tight">
            Designed for Real Family Complexity
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl w-fit">
              <GitFork className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Interactive Family Tree Canvas</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Pan, zoom, and explore large branches with progressive expansion. Switch seamlessly between dynamic canvas view, ancestor pedigree trees, descendants view, and searchable directory tables.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl w-fit">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Relationship Intelligence Explorer</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Select any two individuals to see their exact kinship path, shared ancestors, and step-by-step connection nodes. Distinguishes full/half siblings, cousins, in-laws, and step-families.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl w-fit">
              <Camera className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Heirloom Memories & Timeline</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Attach photographs, audio stories, and journals to specific people and milestone events. Browse high-resolution albums or experience family history along a chronological timeline.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-xs">
            <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl w-fit">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900">Secure Relative Collaboration</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Invite family members with two clear role levels — Admin or Viewer. Admins can build and manage the tree; Viewers can explore and browse. A clean audit trail records all changes.
            </p>
          </div>
        </div>
      </section>

      {/* Privacy & Trust Section */}
      <section id="privacy" className="py-14 bg-stone-900 text-white px-4 sm:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 text-emerald-300 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">
            Your Family Data Remains Strictly Private
          </h2>
          <p className="text-xs sm:text-sm text-stone-400 max-w-xl mx-auto leading-relaxed">
            Unlike traditional genealogy platforms, Tiesora does not sell family data, license photographs, or expose living relatives' private records to public search indexing.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-left">
            <div className="p-4 bg-stone-800/60 rounded-xl border border-stone-700/60 space-y-1">
              <p className="text-xs font-bold text-white">Private by Default</p>
              <p className="text-[11px] text-stone-400">Only invited members can view tree records.</p>
            </div>
            <div className="p-4 bg-stone-800/60 rounded-xl border border-stone-700/60 space-y-1">
              <p className="text-xs font-bold text-white">Living Member Protection</p>
              <p className="text-[11px] text-stone-400">Birth dates and sensitive bios can be masked.</p>
            </div>
            <div className="p-4 bg-stone-800/60 rounded-xl border border-stone-700/60 space-y-1">
              <p className="text-xs font-bold text-white">Data Export Rights</p>
              <p className="text-[11px] text-stone-400">Export your complete family JSON archive anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section id="faq" className="py-14 px-4 sm:px-8 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-stone-500">Everything you need to know about building your family tree.</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-stone-200 rounded-2xl bg-white overflow-hidden shadow-2xs"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full text-left p-5 flex items-center justify-between gap-4 font-semibold text-xs sm:text-sm text-stone-900 hover:text-emerald-900 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180 text-emerald-800' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 pt-1 text-xs text-stone-600 leading-relaxed border-t border-stone-100">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-white border-t border-stone-200 px-6 sm:px-8 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <TiesoraLogo size="xs" />
            <span className="ml-1">· Every family. Every connection. Every story.</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={onSignIn} className="hover:text-stone-900 transition-colors">
              Sign In
            </button>
            <button onClick={onSignUp} className="hover:text-stone-900 transition-colors font-medium text-emerald-800">
              Sign Up Free
            </button>
            <button onClick={onStartBuilding} className="hover:text-stone-900 transition-colors">
              Build Your Tree
            </button>
            <span>© 2026 Tiesora</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
