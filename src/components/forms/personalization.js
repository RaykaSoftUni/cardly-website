import { createForm } from './fields.js';
export const personalizationFields = [
  { name: 'recipient', label: 'Recipient name', required: true, maxLength: 60, hint: 'Who are we celebrating?' },
  { name: 'age', label: 'Recipient age', type: 'number', min: 0, max: 130 },
  { name: 'sender', label: 'Sender name', maxLength: 60 },
  { name: 'relationship', label: 'Relationship to recipient', options: ['', 'Friend', 'Parent', 'Partner', 'Sibling', 'Colleague', 'Other'] },
  { name: 'interests', label: 'Interests or hobbies', maxLength: 200, hint: 'For example: stargazing, baking, long walks.' },
  { name: 'tone', label: 'Tone of message', options: ['Warm & heartfelt', 'Playful', 'Magical', 'Simple & sweet'] },
  { name: 'greeting', label: 'Custom message', type: 'textarea', maxLength: 600, hint: 'Your own words are always welcome. Up to 600 characters.' },
  { name: 'image', label: 'Personal image', type: 'file', accept: 'image/png,image/jpeg,image/webp', hint: 'Optional PNG, JPG or WebP. Upload and storage are not connected in this design preview.' },
];
export function createPersonalizationForm(options = {}) {
  return createForm({ ...options, fields: personalizationFields, description: 'Make it personal. Required and optional fields are labelled below.' });
}
