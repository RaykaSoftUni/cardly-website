// Explicit visual fixtures, not production catalog records or purchasable products.
export const sampleCards = [
  { id: 'sample-lilac', title: 'A little birthday magic', occasion: 'Birthday', category: 'For friends', style: 'Playful', paid: false, available: true, preview: { variant: 'lilac', headline: 'You are a little bit of magic.', greeting: 'Wishing you a birthday as wonderful as you.' } },
  { id: 'sample-sage', title: 'Good things are growing', occasion: 'Birthday', category: 'For family', style: 'Botanical', paid: false, available: true, preview: { variant: 'sage', headline: 'Another year. More room to bloom.', greeting: 'Here’s to growing into your next beautiful chapter.' } },
  { id: 'sample-peach', title: 'A whole lot of happy', occasion: 'Birthday', category: 'For friends', style: 'Minimal', paid: true, price: 3.5, available: false, preview: { variant: 'peach', headline: 'A whole lot of happy.', greeting: 'A little sunshine for your very special day.' } },
  { id: 'sample-night', title: 'Written in the stars', occasion: 'Congratulations', category: 'For colleagues', style: 'Celestial', paid: true, price: 4, available: false, preview: { variant: 'night', headline: 'Look at you shine.', greeting: 'For everything you’ve done. And everything still to come.' } },
  { id: 'sample-thanks', title: 'The little things', occasion: 'Thank you', category: 'For family', style: 'Minimal', paid: false, available: true, preview: { variant: 'peach', headline: 'You made all the difference.', greeting: 'A small note for a very big thank you.' } },
  { id: 'sample-love', title: 'Our favourite chapter', occasion: 'Anniversary', category: 'For a partner', style: 'Botanical', paid: true, price: 3.5, available: false, preview: { variant: 'sage', headline: 'Still my favourite person.', greeting: 'Here’s to all the chapters we have left to write.' } },
];
export function findSampleCard(id) { return sampleCards.find((card) => card.id === id); }
