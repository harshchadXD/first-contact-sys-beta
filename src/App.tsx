import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, ArrowLeft, Pause, Play } from 'lucide-react';
import { MoonExperience } from './components/MoonExperience';
const Workspace = lazy(() => import('./Workspace'));
class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="loading-view"><h1>The explorer couldn’t load.</h1><button onClick={() => location.reload()}>Reload explorer</button></div> : this.props.children; }
}
export default function App() {
  const [exploring, setExploring] = useState(false);
  const wasExploring = useRef(false);
  useEffect(() => { if (!exploring && wasExploring.current) document.getElementById('hero-title')?.focus(); wasExploring.current = exploring; }, [exploring]);
  const [paused, setPaused] = useState(false);
  function enter() { setExploring(true); window.scrollTo(0, 0); }
  if (exploring) return <WorkspaceBoundary><div className="explorer-return"><button onClick={() => { setExploring(false); window.scrollTo(0, 0); }}><ArrowLeft size={16} /> Back to the Moon</button><span>FIRST CONTACT.sys</span></div><Suspense fallback={<div className="loading-view" role="status">Preparing the lunar workspace…</div>}><Workspace /></Suspense></WorkspaceBoundary>;
  return <div className="experience">
    <a className="skip-link" href="#journey">Skip to introduction</a>
    <header className="site-nav"><a className="wordmark" href="#home" aria-label="First Contact home"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1 21 10 6v15ZM13 21V2l10 6v13Z"/></svg> FIRST CONTACT<span className="sys">.sys</span></a><nav aria-label="Main navigation"><a href="#journey">The mission</a><a href="#method">The science</a><button onClick={enter}>Open explorer <ArrowUpRight size={16}/></button></nav></header>
    <main>
      <section className="moon-hero" id="home" aria-labelledby="hero-title">
        <MoonExperience paused={paused}/>
        <div className="hero-copy"><h1 id="hero-title" tabIndex={-1}>A small step.<br/><span>A precise moment.</span></h1><p>On the lunar south pole, a ridge can hide the Sun.<br className="desktop-break"/> A few metres can change the view of Earth.</p><button className="enter-button" onClick={enter}>Find your window <ArrowUpRight size={22}/></button></div>
        <div className="lunar-caption"><span>THE MOON</span><span>Our next point of contact.</span></div>
        <div className="hero-bottom"><a href="#journey"><ArrowDown size={17}/> A closer look</a><span className="orbit-hint">Drag to orbit · scroll to discover</span><button aria-pressed={paused} onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume Moon rotation' : 'Pause Moon rotation'}>{paused ? <Play size={14}/> : <Pause size={14}/>}<span>{paused ? 'Resume' : 'Pause'} motion</span></button></div>
      </section>
      <section id="journey" className="contact-story">
        <div className="story-heading"><h2>Distance is only<br/>half the story.</h2><p>Getting there is extraordinary. Staying in sunlight and in sight of home is a different question. First Contact lets you explore the terrain, time and height behind that question.</p></div>
        <figure className="identity-art"><img src="/brand/first-contact.png" alt="Original First Contact artwork: two lunar-textured hands reaching toward one another in front of the Moon" loading="lazy"/><figcaption>Between arrival and connection, there is a window.</figcaption></figure>
      </section>
      <section id="method" className="method-section"><div className="method-intro"><h2>Make the invisible<br/>terrain visible.</h2><p>A landscape becomes a horizon. A horizon becomes a window. Explore what changes when you move, arrive later, or raise the observer.</p><button className="text-action" onClick={enter}>Explore the lunar workspace <ArrowUpRight size={20}/></button></div><div className="method-rows"><article><span>Terrain</span><h3>Start with the ground.</h3><p>Inspect elevation and the skyline around a selected point. The near view and the distant horizon tell different stories.</p></article><article><span>Time</span><h3>Watch the window change.</h3><p>Follow the Sun and Earth through the selected stay. Look beyond averages to the uninterrupted intervals.</p></article><article><span>Perspective</span><h3>Change one assumption.</h3><p>Compare observer height, arrival and location. Keep the assumptions alongside the result.</p></article></div></section>
      <section className="evidence-note"><h2>Exploration, with the limits in view.</h2><p>This is a research explorer, not flight certification. Earth visibility is geometric, not an RF link guarantee. Hardware profiles are illustrative. The updated workspace contains exploratory models that need reconciliation with the host project’s independently baked horizon data.</p><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">Moon display imagery: NASA SVS / LROC / LOLA <ArrowUpRight size={14}/></a></section>
      <footer className="experience-footer"><span>FIRST CONTACT.sys</span><p>A little closer to understanding.</p><button onClick={enter}>Begin exploring <ArrowUpRight size={18}/></button></footer>
    </main>
  </div>;
}
