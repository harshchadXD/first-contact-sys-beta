import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ArrowDown, ArrowUpRight, ArrowLeft, Pause, Play } from 'lucide-react';
import { MoonExperience } from './components/MoonExperience';
import { WindowStudy } from './components/WindowStudy';

const Workspace = lazy(() => import('./Workspace'));

type WorkspaceSection = 'terrain' | 'time' | 'hardware' | 'compare';

class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="loading-view">
        <p className="eyebrow">FIRST CONTACT.sys</p>
        <h1>The observatory could not load.</h1>
        <p>The calculation runs locally. Reload to retry the application files.</p>
        <button onClick={() => location.reload()}>Reload observatory</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

function useReveals(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      nodes.forEach((node) => node.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [active]);
}

export default function App() {
  const [exploring, setExploring] = useState(false);
  const [initialSection, setInitialSection] = useState<WorkspaceSection>('terrain');
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [navSolid, setNavSolid] = useState(false);
  const wasExploring = useRef(false);
  const coverScroll = useRef(0);

  useReveals(!exploring && loaderGone);

  // Loader: the Moon reports when its colour map is available. The minimum
  // dwell keeps the opening from flashing on fast connections.
  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      const visual = Math.min(94, (elapsed / 1500) * 94);
      setProgress((current) => Math.max(current, visual));
      if (elapsed < 1500) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const fallback = window.setTimeout(() => setReady(true), 3600);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    setProgress(100);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(() => setLoaderGone(true), reduced ? 80 : 520);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    document.body.classList.toggle('is-locked', !loaderGone);
    return () => document.body.classList.remove('is-locked');
  }, [loaderGone]);

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!exploring && wasExploring.current) {
      window.scrollTo({ top: coverScroll.current, behavior: 'instant' as ScrollBehavior });
      document.getElementById('hero-title')?.focus({ preventScroll: true });
    }
    wasExploring.current = exploring;
  }, [exploring]);

  function enter(section: WorkspaceSection = 'terrain') {
    coverScroll.current = window.scrollY;
    setInitialSection(section);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const swap = () => {
      setExploring(true);
      window.scrollTo(0, 0);
    };
    if (!reduced && 'startViewTransition' in document) {
      (
        document as Document & {
          startViewTransition: (callback: () => void) => { finished: Promise<void> };
        }
      ).startViewTransition(swap);
    } else {
      swap();
    }
  }

  function leave() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const swap = () => setExploring(false);
    if (!reduced && 'startViewTransition' in document) {
      (
        document as Document & {
          startViewTransition: (callback: () => void) => { finished: Promise<void> };
        }
      ).startViewTransition(swap);
    } else {
      swap();
    }
  }

  if (exploring) {
    return (
      <WorkspaceBoundary>
        <Suspense
          fallback={
            <div className="loading-view" role="status">
              <p className="eyebrow">FIRST CONTACT.sys</p>
              <h1>Opening the observatory.</h1>
              <p>Preparing the local lunar workspace.</p>
            </div>
          }
        >
          <Workspace onExit={leave} initialSection={initialSection} />
        </Suspense>
      </WorkspaceBoundary>
    );
  }

  return (
    <div className={`experience${loaderGone ? ' is-ready' : ' is-loading'}`}>
      {!loaderGone && (
        <div className={`preloader${progress >= 100 ? ' is-complete' : ''}`} aria-hidden={progress >= 100}>
          <div className="preloader-top">
            <span className="wordmark wordmark--small">
              <BrandMark />
              FIRST CONTACT<span className="sys">.sys</span>
            </span>
            <span className="preloader-coords">89.4632° S / 137.4900° W</span>
          </div>
          <div className="preloader-center">
            <p className="eyebrow">Establishing contact</p>
            <span className="preloader-count">{String(Math.round(progress)).padStart(3, '0')}</span>
          </div>
          <div className="preloader-bottom">
            <span>Lunar south pole · operating windows</span>
            <div className="preloader-track"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
            <span>NASA LRO / LOLA · JPL DE421</span>
          </div>
        </div>
      )}

      <div className="grain" aria-hidden="true" />
      <a className="skip-link" href="#journey">Skip to the story</a>

      <header className={`site-nav${navSolid ? ' is-solid' : ''}`}>
        <a className="wordmark" href="#home" aria-label="First Contact home">
          <BrandMark />
          FIRST CONTACT<span className="sys">.sys</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#journey">01 / The idea</a>
          <a href="#method">02 / The instrument</a>
          <a href="#evidence">03 / Evidence</a>
          <button className="nav-cta" onClick={() => enter('terrain')}>
            Open observatory <ArrowUpRight size={15} aria-hidden="true" />
          </button>
        </nav>
      </header>

      <main id="main">
        <section className="moon-hero" id="home" aria-labelledby="hero-title">
          <div className="hero-ambient" aria-hidden="true" />
          <MoonExperience paused={paused} onReady={() => setReady(true)} />
          <div className="hero-scrim" aria-hidden="true" />

          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow" data-reveal>
              NASA Space Apps 2026 <span aria-hidden="true">/</span> Lunar Landing Site Navigator
            </p>
            <h1 id="hero-title" tabIndex={-1}>
              <span className="line"><span>Some windows</span></span>
              <span className="line"><span>only open</span></span>
              <span className="line"><span>on the Moon.</span></span>
            </h1>
            <p className="hero-lede" data-reveal>
              At the lunar south pole, sunlight and Earth rise and set behind the terrain.
              First Contact turns that horizon into a place you can explore — site by site,
              hour by hour.
            </p>
            <div className="hero-actions" data-reveal>
              <button className="enter-button" onClick={() => enter('terrain')}>
                Open the observatory
                <span className="enter-arrow"><ArrowUpRight size={19} aria-hidden="true" /></span>
              </button>
              <a className="quiet-link" href="#journey">
                See the first contact <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="hero-coordinates" aria-hidden="true">
            <span className="micro-label">Selected site</span>
            <strong>Connecting Ridge</strong>
            <span>89.4632° S&nbsp;&nbsp;137.4900° W</span>
          </div>

          <div className="hero-bottom">
            <a href="#journey" className="scroll-cue">
              <span className="scroll-line" aria-hidden="true" />
              Scroll to begin
            </a>
            <span className="orbit-hint">Drag the Moon to turn it</span>
            <button
              className="motion-toggle"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'Resume Moon motion' : 'Pause Moon motion'}
            >
              {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
              <span>{paused ? 'Resume' : 'Pause'} motion</span>
            </button>
          </div>
        </section>

        <section className="contact" id="journey" aria-labelledby="contact-title">
          <div className="contact-axis" aria-hidden="true" />
          <header className="contact-head">
            <p className="eyebrow" data-reveal>01 / The idea</p>
            <p className="contact-kicker" data-reveal>
              Between arrival and connection,<br /> there is a window.
            </p>
          </header>

          <figure className="contact-figure" data-reveal>
            <div className="contact-art-wrap">
              <img
                className="contact-art"
                src="/brand/first-contact.png"
                alt="Original First Contact artwork: two lunar-textured hands reaching toward one another in front of the Moon"
                loading="eager"
              />
              <span className="contact-spark" aria-hidden="true" />
              <span className="contact-reticle" aria-hidden="true" />
            </div>
            <figcaption>
              <span className="micro-label">Original identity study</span>
              <span>Creation of Adam, reinterpreted as a lunar handshake.</span>
            </figcaption>
          </figure>

          <div className="contact-copy">
            <h2 id="contact-title" data-reveal>
              Distance is only<br /> half the story.
            </h2>
            <div data-reveal>
              <p>
                Getting to the Moon is extraordinary. Staying in sunlight, and staying in
                sight of home, is a different question. The answer lives at the edge of the
                terrain — where a ridge can hide the Sun, or take Earth out of the sky.
              </p>
              <p>
                First Contact is a working observatory for that edge. Choose a south-pole
                site, a landing offset, an arrival day, and an observer height. The window
                moves with every choice.
              </p>
              <button className="text-action" onClick={() => enter('terrain')}>
                Step inside the observatory <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <WindowStudy />

        <section className="variables" aria-labelledby="variables-title">
          <div className="variables-head">
            <p className="eyebrow" data-reveal>03 / What moves</p>
            <h2 id="variables-title" data-reveal>
              Three things<br /> move the window.
            </h2>
            <p data-reveal>
              The explorer keeps every result attached to the exact position, arrival day,
              height and assumptions that produced it. Change one, and the evidence changes
              with it.
            </p>
          </div>

          <div className="variable-list">
            <button className="variable-row" onClick={() => enter('terrain')} data-reveal>
              <span className="variable-number">01</span>
              <span className="variable-title">Position</span>
              <span className="variable-copy">
                A touchdown offset of a few hundred metres can redraw the skyline. The
                500 m dispersion grid tests every offset separately.
              </span>
              <span className="variable-art" aria-hidden="true">
                <svg viewBox="0 0 160 74">
                  <path d="M2 62 34 34 58 48 82 22 108 44 134 30 158 58" />
                  <path className="ghost" d="M2 58 30 40 54 52 78 30 106 50 132 36 158 60" />
                  <circle cx="82" cy="22" r="2.6" />
                </svg>
              </span>
              <ArrowUpRight size={18} className="variable-arrow" aria-hidden="true" />
            </button>

            <button className="variable-row" onClick={() => enter('time')} data-reveal>
              <span className="variable-number">02</span>
              <span className="variable-title">Arrival</span>
              <span className="variable-copy">
                Land a day later and the Sun has moved. The arrival matrix compares 30
                candidate days against the same duration and limits.
              </span>
              <span className="variable-art" aria-hidden="true">
                <svg viewBox="0 0 160 74">
                  <path className="arc" d="M8 58A72 72 0 0 1 152 58" />
                  <line x1="8" y1="58" x2="152" y2="58" />
                  <circle cx="52" cy="27" r="4" />
                  <circle className="ghost" cx="112" cy="24" r="3" />
                </svg>
              </span>
              <ArrowUpRight size={18} className="variable-arrow" aria-hidden="true" />
            </button>

            <button className="variable-row" onClick={() => enter('hardware')} data-reveal>
              <span className="variable-number">03</span>
              <span className="variable-title">Height</span>
              <span className="variable-copy">
                A taller mast sees over more of the ridge. Supported heights from 0.5 to
                10 metres are evaluated independently.
              </span>
              <span className="variable-art" aria-hidden="true">
                <svg viewBox="0 0 160 74">
                  <path d="M2 64 38 38 70 52 104 30 136 46 158 38" />
                  <line x1="104" y1="30" x2="104" y2="8" />
                  <circle cx="104" cy="8" r="2.6" />
                  <path className="ghost" d="M104 30 128 21" />
                </svg>
              </span>
              <ArrowUpRight size={18} className="variable-arrow" aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="evidence" id="evidence" aria-labelledby="evidence-title">
          <div className="evidence-lead">
            <p className="eyebrow" data-reveal>04 / Evidence</p>
            <h2 id="evidence-title" data-reveal>
              Wonder is the entrance.<br /> Evidence is the room.
            </h2>
            <p data-reveal>
              The visual is the invitation. The result is the terrain horizon, the sampled
              ephemeris, and the constraint margin that produced it. Every scenario can be
              inspected, compared and exported.
            </p>
            <button className="enter-button enter-button--light" onClick={() => enter('terrain')} data-reveal>
              Find your window
              <span className="enter-arrow"><ArrowUpRight size={19} aria-hidden="true" /></span>
            </button>
          </div>

          <div className="evidence-grid">
            <article data-reveal>
              <span className="micro-label">Data</span>
              <h3>NASA LRO / LOLA terrain</h3>
              <p>
                Published PGDA LOLA products at 5–60 m/pixel supply each site&apos;s local
                crop, 360° skyline and dispersion surface. Ephemerides are baked from JPL
                DE421 for the 2026-12-01 to 2027-03-02 envelope. Fourteen real sites are
                compared; MOCK-01 is a synthetic calibration case, excluded from ranking.
              </p>
            </article>
            <article data-reveal>
              <span className="micro-label">Method</span>
              <h3>A horizon, per position</h3>
              <p>
                Terrain is sampled as a 360° skyline. Sun and Earth are tested against that
                skyline for each supported height, position and arrival day.
              </p>
            </article>
            <article data-reveal>
              <span className="micro-label">Limits</span>
              <h3>Exploration, not certification</h3>
              <p>
                The default PGDA-01 scenario starts 2026-12-17 with a 3.0 m observer mast.
                This is a research explorer: Earth-disc visibility is geometric, not an RF
                link guarantee, and hardware profiles are illustrative assumptions.
              </p>
            </article>
          </div>

          <p className="credit-line" data-reveal>
            Moon display imagery: NASA SVS / LROC / LOLA. Ephemeris: JPL DE421.
            <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">
              Source <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          </p>
        </section>
      </main>

      <footer className="experience-footer">
        <div>
          <BrandMark />
          <span>FIRST CONTACT.sys</span>
        </div>
        <p>A lunar operating-window explorer.</p>
        <a href="#home">Back to the Moon <ArrowUpRight size={14} aria-hidden="true" /></a>
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M1 21 10 6v15ZM13 21V2l10 6v13Z" />
    </svg>
  );
}
