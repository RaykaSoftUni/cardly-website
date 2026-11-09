import { el } from '../utils/dom.js';
import { section, button } from '../components/ui.js';
import { createPricingOption } from '../components/cards/pricing-option.js';

export function renderPricingPage(main) {
  main.replaceChildren(
    el('div', { className: 'page-intro' }, [
      el('p', { className: 'eyebrow' }, 'A personal touch, clearly priced'),
      el('h1', {}, 'Simple pricing for meaningful digital cards'),
      el('p', { className: 'lead' }, 'Make a free design your own, or explore premium styles planned for the future. Every card is digital, with no physical shipping.'),
    ]),
    el('div', { className: 'pricing-options', 'aria-label': 'Free and premium card options' }, [
      createPricingOption({
        id: 'free-cards', title: 'Free Cards', price: '€0', priceNote: 'No payment required', status: 'Available to personalize',
        description: 'Choose a published, available free design and try its supported personalization fields.',
        features: ['Selected card designs, including some animated designs', 'Recipient name, sender name and custom greeting where supported', 'Editable text and live card preview', 'Guest personalization without signing in', 'Private drafts and demo generation jobs when signed in'],
        action: { label: 'Browse Free Cards', href: '/cards/?pricing=free&availability=true' },
      }),
      createPricingOption({
        id: 'premium-cards', title: 'Premium Cards', premium: true, price: 'Priced per card', priceNote: 'Intended EUR prices are shown in the catalogue', status: 'Currently unavailable',
        description: 'Premium identifies designs intended to have a price. It does not unlock access or mean a purchase can be made today.',
        features: ['Published premium designs can be browsed and previewed', 'Intended price varies by design; see its card details', 'Premium personalization and generation are currently unavailable', 'Exclusive designs and enhanced personalization are planned, not included today', 'Purchases will require real payments and verified access'],
        action: { label: 'Explore Premium Designs', href: '/cards/?pricing=paid' },
      }),
    ]),
    section({ title: 'What’s available today?', description: 'No cards are currently available for purchase. Free personalization does not require payment.', children: [
      el('div', { className: 'surface-panel pricing-explainer' }, [
        el('h3', {}, 'Preview now; final downloads are still on the way'),
        el('p', {}, 'Free cards support editable text previews. Saving a draft or demo generation job requires signing in. A demo job saves your personalization; it does not produce a finished image. Registration is currently a placeholder.'),
        el('p', {}, 'Final image rendering, downloadable PNG/JPG/PDF files, public sharing links and direct sending are not connected. These are not included with either option today.'),
      ]),
    ] }),
    section({ title: 'Planned features, clearly labelled', description: 'These features are not enabled. Their availability, pricing and any limits will be explained before they launch.', children: [
      el('ul', { className: 'pricing-planned' }, [
        el('li', {}, 'Premium purchases: payment processing and verified purchase access.'),
        el('li', {}, 'Premium designs: potentially exclusive artwork and additional personalization, depending on the card.'),
        el('li', {}, 'Future platform features: AI greetings, optional photo uploads and final digital downloads. Their free or premium inclusion has not been decided.'),
      ]),
      el('p', { className: 'muted' }, 'A premium label or EUR price is informational today. It cannot authorize paid use. No checkout or payment is available.'),
      button({ label: 'Read the FAQ', href: '/faq/#pricing', variant: 'outline-primary' }),
    ] }),
  );
}
