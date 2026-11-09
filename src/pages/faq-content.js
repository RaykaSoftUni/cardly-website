import { el } from '../utils/dom.js';

const sections = [
  ['general', 'General', [
    ['What is Cardly?', 'Cardly helps you personalize digital greeting cards using distinct designs and details about the recipient. Choose a card, edit its supported text fields and preview the result.'],
    ['What kinds of cards are available?', 'The current collection focuses on birthdays. Browse the catalogue for published occasions and categories. More occasions may be added later.'],
    ['Are these physical cards?', 'No. Cardly focuses on digital cards. Physical printing, ordering and shipping are not offered.'],
  ]],
  ['browsing', 'Browsing cards', [
    ['Do I need an account to browse cards?', 'No. You can browse published cards, open previews and see availability and EUR prices without signing in.'],
    ['Can I search or filter cards?', 'Yes. Search the catalogue and filter by occasion, category, style, free or paid, and availability.'],
    ['Why are some cards unavailable?', 'Some published cards are shown for preview only. Paid cards remain unavailable while payments are not implemented. An unavailable card cannot be generated or purchased.'],
  ]],
  ['personalization', 'Personalization', [
    ['What can I personalize?', 'The selected card determines the fields you can edit, such as recipient name, headline, message and sender name. Some forms also collect age, relationship, interests or tone; these do not currently generate AI text or images. Photo uploads are not connected.'],
    ['Can I preview a card before generating it?', 'Yes. Available free cards support a live text preview, including guest personalization. This preview is not a finished downloadable image.'],
    ['Can I change the message?', 'Yes. Edit the supported text fields and review the preview. AI message generation and regeneration are not available yet.'],
    ['Will every card look the same?', 'No. Cards use different illustrations, typography, layouts and personalization fields. Some designs include animation, with a still version for reduced-motion preferences.'],
  ]],
  ['ai', 'AI-generated content', [
    ['Does Cardly use AI?', 'AI greeting and image generation are planned, but are not connected in the current app. Current previews use your editable text and the selected design.'],
    ['What information would AI use?', 'The planned feature would use details you provide for the card, such as name, interests, relationship and tone. There is currently no connected AI generation workflow.'],
    ['Could AI content contain mistakes?', 'Yes. If AI generation is introduced, review its output for accuracy and suitable wording before using it. Generated text must remain editable.'],
    ['Can I regenerate a message?', 'Not currently. Regeneration and any usage limits will be explained if that feature becomes available.'],
  ]],
  ['pricing', 'Free and paid cards', [
    ['Are there free cards?', 'Yes. Available free cards can be personalized and previewed. Saving drafts and demo generation jobs requires signing in. Final image export is not connected.'],
    ['Why do some cards show a price?', 'Premium cards can display their intended price in EUR. A listed price does not mean the card can currently be purchased or used.'],
    ['Can I purchase paid cards now?', 'No. Payments are not implemented and paid cards remain unavailable. Future paid access will require verified purchase entitlement.'],
    ['What currency is used?', 'All card prices are displayed in EUR.'],
  ]],
  ['accounts', 'Accounts and generated cards', [
    ['Do I need an account to create a card?', 'You can browse and try personalization without an account. Sign in to save private drafts, create demo generation jobs and view your collection. The registration screen is currently a placeholder.'],
    ['What can I access after logging in?', 'You can save and reopen your own drafts, view demo generation records in My Cards, and manage your account details. Favorites are not connected.'],
    ['What is a demo generation?', 'It is a saved snapshot of your personalization and template, with a generation status. Final image rendering is not connected, so a saved job or preview does not mean a finished image is ready.'],
    ['Can other users see my cards?', 'Your private drafts and generation records are restricted to your account. Public sharing links are not implemented.'],
  ]],
  ['downloads', 'Downloads and sharing', [
    ['What download formats are available?', 'Final card downloads are not available yet. PNG, JPG or PDF export may be added later; no export format is currently promised.'],
    ['Can I send a card by email or messaging apps?', 'Cardly does not currently provide downloadable final cards, public sharing links or direct sending. Once downloads are supported, you could share the file through your preferred app.'],
    ['Can I print a card?', 'There is currently no final downloadable file or printing service. Future downloadable files may be printable depending on format and resolution.'],
  ]],
  ['images', 'Images and uploads', [
    ['Can I upload my own photo?', 'Personalization photo uploads are not connected. Current designs use their existing artwork.'],
    ['What image formats will be supported?', 'No personalization upload formats are currently enabled. When uploads are introduced, the form should state the supported formats and maximum file size.'],
    ['Who would be able to access uploaded photos?', 'Personalization uploads are planned to be private to the authenticated owner. Public photo sharing is not implemented.'],
  ]],
  ['privacy', 'Privacy and security', [
    ['Is my account data private?', 'Authentication and database access policies restrict private profiles, drafts and generation records to their owners. Authorized administrators have protected catalog and limited account/support management tools.'],
    ['Does Cardly store my password in application tables?', 'No. Supabase Auth handles authentication and password management; Cardly application tables do not store passwords.'],
    ['Can an administrator see my password?', 'No. The administrator tools do not expose user passwords.'],
  ]],
  ['support', 'Problems and support', [
    ['Why can’t I generate a card?', 'The card may be unavailable or unpublished, required fields may be missing, or you may need to sign in. Even a saved demo job cannot produce a final image yet because rendering is not connected. Check the message shown beside the action.'],
    ['What happens if generation fails?', 'Check the displayed error or job status. An unfinished or failed demo job is not a completed card. Correct any missing details and retry where the interface allows it.'],
    ['How can I get support?', 'A public support contact or contact form is not available yet. There are no support email addresses or direct delivery services listed on Cardly.'],
  ]],
];

export function renderFaqPage(main) {
  main.replaceChildren(
    el('div', { className: 'page-intro' }, [
      el('p', { className: 'eyebrow' }, 'A little help'),
      el('h1', {}, 'Frequently asked questions'),
      el('p', { className: 'muted' }, 'From finding their kind of card to making it personal. Here’s what you can do today, and what’s still on the way.'),
    ]),
    el('div', { className: 'faq-content' }, [
      el('nav', { className: 'surface-panel faq-topics', 'aria-label': 'FAQ topics' }, [
        el('h2', {}, 'Jump to a topic'),
        el('ul', {}, sections.map(([id, title]) => el('li', {}, el('a', { href: `#${id}` }, title)))),
      ]),
      ...sections.map(([id, title, questions]) => el('section', { className: 'page-section faq-section', 'aria-labelledby': id }, [
        el('h2', { id, tabindex: '-1' }, title),
        ...questions.map(([question, answer], index) => {
          const answerId = `faq-${id}-${index + 1}`;
          const content = el('div', { id: answerId, hidden: true, className: 'faq-answer' }, el('p', {}, answer));
          const button = el('button', {
            type: 'button', className: 'faq-question', 'aria-expanded': 'false', 'aria-controls': answerId,
            onClick: () => {
              const expanded = button.getAttribute('aria-expanded') === 'true';
              button.setAttribute('aria-expanded', String(!expanded));
              content.hidden = expanded;
            },
          }, [el('span', {}, question), el('span', { className: 'faq-indicator', 'aria-hidden': 'true' }, '+')]);
          return el('div', { className: 'faq-item' }, [el('h3', {}, button), content]);
        }),
      ])),
    ]),
  );
  // The headings are created by this module, after the browser's initial fragment lookup.
  const followHash = () => {
    const target = sections.find(([id]) => location.hash === `#${id}`);
    if (target) {
      const heading = document.getElementById(target[0]);
      heading.focus({ preventScroll: true });
      heading.scrollIntoView();
    }
  };
  window.addEventListener('hashchange', followHash);
  if (location.hash) requestAnimationFrame(followHash);
}
