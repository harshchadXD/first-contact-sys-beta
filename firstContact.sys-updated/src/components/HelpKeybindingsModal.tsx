import { useEffect, useRef } from 'react';
import type { PersonaMode } from '../science/types';
export interface HelpKeybindingsModalProps { isOpen: boolean; onClose: () => void; persona: PersonaMode; onTogglePersona: () => void; }
export function HelpKeybindingsModal({ isOpen, onClose, persona, onTogglePersona }: HelpKeybindingsModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (isOpen && !node.open) node.showModal();
    if (!isOpen && node.open) node.close();
  }, [isOpen]);
  return <dialog ref={dialog} className="help-dialog" aria-labelledby="help-title" onCancel={onClose} onClose={onClose}>
    <header><h2 id="help-title">Explore at your pace.</h2><button onClick={onClose} autoFocus>Close</button></header>
    <p>Shortcuts work when you are not using an input, button or menu.</p>
    <dl><div><dt>Space</dt><dd>Play or pause the timeline</dd></div><div><dt>[ / ]</dt><dd>Move one hour backward or forward</dd></div><div><dt>R</dt><dd>Reset the scenario to Shackleton</dd></div><div><dt>M</dt><dd>Switch guided and technical labels</dd></div><div><dt>H / ?</dt><dd>Open this guide</dd></div><div><dt>Escape</dt><dd>Close this guide</dd></div></dl>
    <button onClick={onTogglePersona}>{persona === 'planner' ? 'Use guided labels' : 'Use technical labels'}</button>
  </dialog>;
}
