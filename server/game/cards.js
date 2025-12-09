const SUITS = [
  { id: 'spades', label: '♠', color: 'black' },
  { id: 'clubs', label: '♣', color: 'black' },
  { id: 'hearts', label: '♥', color: 'red' },
  { id: 'diamonds', label: '♦', color: 'red' },
];

const RANKS = [
  { value: 1, label: '1', name: 'One' },
  { value: 2, label: '2', name: 'Two' },
  { value: 3, label: '3', name: 'Three' },
  { value: 4, label: '4', name: 'Four' },
  { value: 5, label: '5', name: 'Five' },
  { value: 6, label: '6', name: 'Six' },
  { value: 7, label: '7', name: 'Seven' },
  { value: 8, label: 'V', name: 'Valet' },
  { value: 9, label: 'D', name: 'Dame' },
  { value: 10, label: 'R', name: 'Roi' },
];

const SEVEN_OF_DIAMONDS_ID = 'diamonds-7';

function createDeck() {
  const cards = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      cards.push({
        id: `${suit.id}-${rank.value}`,
        suit: suit.id,
        suitLabel: suit.label,
        color: suit.color,
        rank: rank.value,
        displayRank: rank.label,
        name: `${rank.name} of ${capitalize(suit.id)}`,
        value: rank.value,
        label: `${rank.label}${suit.label}`,
      });
    });
  });
  return cards;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shuffleDeck(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  SEVEN_OF_DIAMONDS_ID,
};
