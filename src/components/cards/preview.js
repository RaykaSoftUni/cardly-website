import { el, safeUrl } from '../../utils/dom.js';

// Content and media are injected; this component knows nothing about their source.
export function createCardPreview({ variant = 'lilac', recipient = '', headline = 'A day just for you', greeting = 'Here’s to the little things that make you, you.', sender = '', imageUrl, imageAlt, sample = false } = {}) {
  const root = el('div', { className: `greeting-preview preview-${['lilac', 'peach', 'sage', 'night'].includes(variant) ? variant : 'lilac'}` });
  const content = el('div', { className: 'greeting-content' });
  const render = (values) => {
    content.replaceChildren(
      el('p', { className: 'greeting-recipient' }, values.recipient ? `For ${values.recipient}` : 'A little note, a lot of heart'),
      el('p', { className: 'greeting-headline' }, values.headline),
      el('p', { className: 'greeting-message' }, values.greeting),
      el('p', { className: 'greeting-sender' }, values.sender ? `With love, ${values.sender}` : 'Made for someone special'),
    );
  };
  const values = { recipient, headline, greeting, sender };
  if (safeUrl(imageUrl)) root.append(el('img', { src: safeUrl(imageUrl), alt: imageAlt ?? `${headline} — greeting card artwork`, className: 'greeting-image', loading: 'lazy' }));
  root.append(el('span', { className: 'preview-spark spark-one', 'aria-hidden': 'true' }, '✳'), el('span', { className: 'preview-spark spark-two', 'aria-hidden': 'true' }, '✧'), content);
  if (sample) root.append(el('span', { className: 'preview-caption' }, 'SAMPLE DESIGN'));
  render(values);
  return { element: root, update(next) { Object.assign(values, next); render(values); } };
}
