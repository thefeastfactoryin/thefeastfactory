'use client';

import { MessageCircle, Phone, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWhatsAppPrompt } from '../hooks/use-whatsapp-prompt';
import { useRouteMessage } from '../hooks/use-route-message';
import {
  generateWhatsAppLink,
  getSupportPhone,
  whatsappMessages,
} from '../lib/generate-whatsapp-link';
import { usePublicSettings } from './public-settings-provider';

function trackWhatsAppClick(action: string) {
  window.dispatchEvent(new CustomEvent('tff:whatsapp-click', { detail: { action } }));
}

export function WhatsAppConcierge() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoOpened = useRef(false);
  const prompt = useWhatsAppPrompt();
  const routeMessage = useRouteMessage();
  const settings = usePublicSettings();
  const supportPhone = getSupportPhone(settings?.business.supportPhone);

  useEffect(() => {
    if (prompt.isDismissed || isPanelOpen || hasAutoOpened.current) return;
    let idleTimer: number;
    const resetIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        hasAutoOpened.current = true;
        setIsPanelOpen(true);
      }, 10000);
    };
    const interactions = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    interactions.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      window.clearTimeout(idleTimer);
      interactions.forEach((event) => window.removeEventListener(event, resetIdleTimer));
    };
  }, [isPanelOpen, prompt.isDismissed]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsPanelOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsPanelOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  function openLink(message: string, action: string) {
    prompt.hideBubble();
    trackWhatsAppClick(action);
    window.open(generateWhatsAppLink(message, supportPhone), '_blank', 'noopener,noreferrer');
  }

  function callSupport() {
    prompt.hideBubble();
    trackWhatsAppClick('call');
    window.location.href = `tel:${supportPhone}`;
  }

  function dismissConcierge() {
    prompt.dismiss();
    setIsPanelOpen(false);
  }

  return (
    <div ref={containerRef} className="fixed bottom-20 right-4 z-40 md:bottom-10 md:right-6">
      {prompt.isBubbleVisible && !isPanelOpen && (
        <aside className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] max-w-[260px] rounded-xl border border-border bg-ivory p-4 pr-10 text-sm leading-5 text-foreground shadow-md">
          <p>{prompt.promptText}</p>
          <button type="button" onClick={dismissConcierge} className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Dismiss WhatsApp help prompt">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </aside>
      )}

      {isPanelOpen && (
        <section className="fixed inset-x-0 bottom-16 w-full rounded-t-xl border border-border bg-ivory p-5 shadow-md motion-safe:animate-[concierge-sheet_200ms_ease-out] md:absolute md:inset-x-auto md:bottom-16 md:right-0 md:w-80 md:origin-bottom-right md:rounded-xl md:p-4 md:motion-safe:animate-[concierge-enter_200ms_ease-out]" aria-label="WhatsApp concierge options">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-serif text-lg font-bold text-foreground">Need help planning?</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">No pressure. Just helpful suggestions.</p>
            </div>
            <button type="button" onClick={dismissConcierge} aria-label="Close concierge" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-5 grid gap-4">
            <button type="button" onClick={() => openLink(routeMessage, 'chat')} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary/90 px-4 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-primary hover:shadow-md"><MessageCircle className="h-4 w-4" />Chat on WhatsApp</button>
            <button type="button" onClick={() => openLink(whatsappMessages.recommendation, 'recommendation')} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/35 px-4 text-sm font-bold text-primary transition-all hover:-translate-y-px hover:bg-primary/5 hover:shadow-sm"><Sparkles className="h-4 w-4" />Suggest a menu for me</button>
            <button type="button" onClick={callSupport} className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-4 text-sm font-bold text-foreground transition-all hover:-translate-y-px hover:bg-muted hover:shadow-sm"><Phone className="h-4 w-4" />Call now</button>
          </div>
        </section>
      )}

      <button type="button" onClick={() => { prompt.hideBubble(); setIsPanelOpen((current) => !current); }} aria-expanded={isPanelOpen} aria-label="Open WhatsApp concierge" className="grid h-12 w-12 place-items-center rounded-full bg-primary/90 text-white shadow-[0_8px_20px_rgba(45,31,20,0.14)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:animate-[concierge-pulse_1s_ease-in-out_20s_1]">
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
