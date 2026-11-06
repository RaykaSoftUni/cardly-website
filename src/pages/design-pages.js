import { el } from '../utils/dom.js';
import { button, section, badge, icon } from '../components/ui.js';
import { createCardPreview } from '../components/cards/preview.js';
import { createCardListing, createCategoryCard, priceAndAvailability } from '../components/cards/listing.js';
import { createCatalog } from '../components/cards/catalog.js';
import { createPersonalizationForm } from '../components/forms/personalization.js';
import { createAdminCardForm } from '../components/forms/admin-card.js';
import { createForm } from '../components/forms/fields.js';
import { emptyState, loadingSkeleton } from '../components/feedback/states.js';
import { showToast } from '../components/feedback/toast.js';
import { confirmDialog } from '../components/feedback/confirm-dialog.js';
import { sampleCards, findSampleCard } from '../data/sample-cards.js';

const sampleNote = () => el('p', { className: 'sample-notice' }, [icon('info-circle'), 'Design preview · All cards and content below are labelled samples.']);
const intro = (title, description, eyebrow = 'A little more personal') => el('div', { className: 'page-intro' }, [el('p', { className: 'eyebrow' }, eyebrow), el('h1', {}, title), el('p', { className: 'lead muted' }, description)]);
const categoryInfo = [
  ['Birthday', 'Make their day feel like them.', 'gift'], ['Thank you', 'Small words. Big feelings.', 'flower1'], ['Congratulations', 'Celebrate a new chapter.', 'stars'], ['Anniversary', 'For your favourite person.', 'heart'],
];
function categories() { return el('div', { className: 'category-grid' }, categoryInfo.map(([label, description, iconName]) => createCategoryCard({ label, description, iconName, href: `/category/?occasion=${encodeURIComponent(label)}` }))); }

function home(main) {
  const hero = el('section', { className: 'hero' }, [
    el('div', { className: 'hero-copy' }, [el('p', { className: 'eyebrow' }, [icon('stars'), 'Little cards. Big feelings.']),
      el('h1', {}, ['For their day.', el('br'), 'In ', el('em', {}, 'their own'), ' way.']),
      el('p', { className: 'lead muted' }, 'A greeting that feels like them. Start with a thoughtful design, add your words, and make someone feel truly seen.'),
      el('div', { className: 'action-row' }, [button({ label: 'Explore sample cards', href: '/cards/', iconName: 'arrow-right' }), button({ label: 'Find an occasion', href: '/categories/', variant: 'quiet' })]),
      el('p', { className: 'hero-note' }, 'Personal touches. Thoughtful words. All yours.'),
    ]),
    el('div', { className: 'hero-art' }, [el('span', { className: 'hero-sticker' }, [icon('heart'), 'Made for one of a kind']), createCardPreview({ ...sampleCards[0].preview, recipient: 'Alex', sender: 'Sam', sample: true }).element,
      el('span', { className: 'hero-art-note' }, 'Their name. Your words. A little magic.')]),
  ]);
  main.append(hero, sampleNote(), section({ title: 'A reason to make their day', eyebrow: 'Every kind of occasion', children: [categories()] }),
    section({ title: 'Small cards, full of possibility', description: 'A few sample designs to get your imagination going.', action: button({ label: 'View all samples', href: '/cards/', variant: 'quiet', iconName: 'arrow-up-right' }), children: [el('div', { className: 'card-grid' }, sampleCards.slice(0, 3).map((card) => createCardListing({ card })))] }),
    el('section', { className: 'warm-banner' }, [icon('envelope-heart'), el('h2', {}, 'The best part is what you put into it.'), el('p', {}, 'Their quirks. Your memories. The words only you would say.'), button({ label: 'Try the sample editor', href: '/card-editor/?id=sample-lilac', variant: 'outline-primary' })]));
}

function editor(main, id) {
  const card = id ? findSampleCard(id) : sampleCards[0];
  if (!card || card.paid || !card.available) return main.append(intro('Card unavailable', 'Choose an available free sample to try the design editor.'), button({ label: 'Browse samples', href: '/cards/' }));
  main.append(intro('Make it unmistakably them.', 'A few personal touches turn a little card into something that means a lot.', 'The sample card studio'), sampleNote());
  const preview = createCardPreview({ ...card.preview, sample: true });
  const update = (values) => preview.update({ recipient: values.recipient, sender: values.sender, greeting: values.greeting || card.preview.greeting, headline: values.age ? `Celebrating ${values.age} wonderful years!` : card.preview.headline });
  const form = createPersonalizationForm({ onChange: update, onSubmit: (values) => {
    update(values);
    showToast({ message: 'Sample preview updated. Nothing has been saved or uploaded.' });
  } });
  const reset = button({ label: 'Reset sample form', variant: 'quiet', iconName: 'arrow-counterclockwise', onClick: async () => {
    if (await confirmDialog({ title: 'Reset your sample?', message: 'This clears the text you entered in this sample form. Nothing has been saved.', confirmLabel: 'Reset form', destructive: true })) { form.reset(); showToast({ message: 'Sample form reset.' }); }
  } });
  main.append(el('div', { className: 'editor-layout' }, [el('section', { className: 'surface-panel' }, [el('h2', {}, 'A little about them'), form.element, reset]), el('aside', { className: 'preview-panel', 'aria-label': 'Sample card preview' }, [el('div', { className: 'section-heading' }, [el('h2', {}, 'Your card, taking shape'), badge('Live sample', 'premium')]), preview.element, el('p', { className: 'muted small mt-3' }, 'Text preview only. Interests and tone are ready for future generation; image uploads, AI, saving and downloads are not connected.')])]));
}

function detail(main, id, isPreview = false) {
  const card = id ? findSampleCard(id) : sampleCards[0];
  if (!card) return main.append(intro('Card not found', 'This sample card is not available.'), button({ label: 'Browse samples', href: '/cards/' }));
  main.append(intro(isPreview ? 'A little preview of something personal.' : card.title, 'A sample design, ready for your imagination.'), sampleNote(), el('div', { className: 'editor-layout' }, [
    createCardPreview({ ...card.preview, sample: true }).element,
    el('section', { className: 'surface-panel' }, [el('p', { className: 'eyebrow' }, `${card.occasion} · ${card.style}`), el('h2', {}, card.title), el('p', { className: 'muted' }, 'Add a name, a memory, and words that sound like you. This preview demonstrates the template layout.'), priceAndAvailability(card), button({ label: card.available && !card.paid ? 'Personalize sample' : 'Currently unavailable', href: `/card-editor/?id=${encodeURIComponent(card.id)}`, disabled: !card.available || card.paid }), el('p', { className: 'field-hint mt-3' }, 'No payment or purchase is available in this preview.')]),
  ]));
}

function auth(main, register) {
  const form = createForm({ fields: [ ...(register ? [{ name: 'name', label: 'Your name', required: true }] : []), { name: 'email', label: 'Email address', type: 'email', required: true }, { name: 'password', label: 'Password', type: 'password', required: true } ], submitLabel: register ? 'Create account — coming soon' : 'Login — coming soon', description: 'Interface preview only. Authentication is not connected; please do not enter real credentials.' });
  form.element.querySelector('[name="email"]').autocomplete = 'email';
  form.element.querySelector('[name="password"]').autocomplete = register ? 'new-password' : 'current-password';
  main.append(el('section', { className: 'auth-panel surface-panel' }, [intro(register ? 'A place for your little gestures.' : 'Good to see you.', register ? 'Create something worth keeping.' : 'Your next thoughtful moment starts here.'), form.element, el('a', { href: register ? '/login/' : '/register/', className: 'd-inline-block mt-4' }, register ? 'Already have an account? Login' : 'New here? Register')]));
}

export function renderDesignPage(main, pageId) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  main.replaceChildren();
  if (pageId === 'home') return home(main);
  if (['cards', 'category'].includes(pageId)) {
    main.append(intro(pageId === 'cards' ? 'Find their kind of card.' : 'A card for every kind of moment.', 'Browse sample designs by occasion, category and style.'), sampleNote(), createCatalog({ cards: sampleCards, initialFilters: { occasion: params.get('occasion') || '' } }));
  } else if (pageId === 'categories') main.append(intro('Every feeling has its occasion.', 'Find a starting point for your next thoughtful gesture.'), sampleNote(), categories());
  else if (pageId === 'card-editor') editor(main, id);
  else if (['card', 'card-preview'].includes(pageId)) detail(main, id, pageId === 'card-preview');
  else if (['login', 'register'].includes(pageId)) auth(main, pageId === 'register');
  else if (pageId === 'my-cards') main.append(intro('Your little collection of joy.', 'A home for the cards you’ll create and keep.'), emptyState({ title: params.get('view') === 'saved' ? 'Saved cards will live here' : 'Your story starts with a card', description: 'Accounts and saving are not connected yet. Explore the sample collection while we get things ready.', action: { label: 'Explore samples', href: '/cards/' } }));
  else if (pageId === 'account') main.append(intro('Your account', 'A place for your details, when accounts are ready.'), emptyState({ title: 'Account settings are coming later', description: 'Profile management is not connected. No account information is displayed.' }));
  else if (pageId === 'card-share') main.append(intro('Good things are worth sharing.', 'Completed cards will have their own place here.'), emptyState({ title: 'Sharing is not available yet', description: 'This is a page layout preview. No public link or delivery service has been created.', action: { label: 'Explore samples', href: '/cards/' } }));
  else if (pageId === 'admin-card-edit') main.append(intro('Card template workspace', 'Visual pattern only. No catalog operations are available.', 'Administration UI preview'), createAdminCardForm());
  else if (pageId.startsWith('admin')) {
    main.append(intro('Administration workspace', 'Visual patterns only. Administrator roles and data access are not implemented.', 'Design preview'), emptyState({ title: 'No management data connected', description: 'Management actions remain unavailable until database permissions and role checking are implemented.' }));
    if (pageId === 'admin-cards') main.append(section({ title: 'Card loading pattern', description: 'Static component demonstration, not an active data request.', children: [loadingSkeleton()] }));
  }
}
