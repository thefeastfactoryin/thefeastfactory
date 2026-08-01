'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const dismissKey = 'wa_concierge_dismissed';

const prompts = {
  default: { delay: 7000, text: 'Planning something? We’ll help you choose 😊' },
  packages: { delay: 8000, text: 'Not sure which package fits? We can suggest one' },
  cart: { delay: 6000, text: 'Want help finalizing your order?' },
  build: { delay: 7000, text: 'Tell us your preferences, we’ll build it for you' },
};

export function useWhatsAppPrompt() {
  const pathname = usePathname();
  const [isBubbleVisible, setIsBubbleVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const prompt =
    pathname === '/cart'
      ? prompts.cart
      : pathname === '/packages/build' || pathname === '/build-your-own'
        ? prompts.build
        : pathname === '/packages' || pathname === '/menu'
          ? prompts.packages
          : prompts.default;

  useEffect(() => {
    const dismissed = localStorage.getItem(dismissKey) === 'true';
    setIsDismissed(dismissed);
    if (dismissed) return;

    setIsBubbleVisible(false);
    const showTimer = window.setTimeout(
      () => setIsBubbleVisible(true),
      prompt.delay,
    );
    const hideTimer = window.setTimeout(
      () => setIsBubbleVisible(false),
      prompt.delay + 10000,
    );
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pathname, prompt.delay]);

  function dismiss() {
    localStorage.setItem(dismissKey, 'true');
    setIsDismissed(true);
    setIsBubbleVisible(false);
  }

  return {
    isBubbleVisible,
    isDismissed,
    promptText: prompt.text,
    dismiss,
    hideBubble: () => setIsBubbleVisible(false),
  };
}
