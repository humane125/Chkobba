const SUIT_ASSET_MAP = {
  diamonds: 'carreau',
  hearts: 'coeur',
  spades: 'pique',
  clubs: 'trèfle',
};

export const POINT_ICON = encodeAssetPath('Chkobba_point.svg');
export const HIDDEN_CARD_ASSET = encodeAssetPath('Chkobba_hidden_card.svg');

export function getCardAsset(card) {
  if (!card) {
    return HIDDEN_CARD_ASSET;
  }
  const suitKey = SUIT_ASSET_MAP[card.suit];
  if (!suitKey) {
    return HIDDEN_CARD_ASSET;
  }
  const rank = padRank(card.rank ?? card.value ?? 0);
  const fileName = `Chkobba_${suitKey}_${rank}.svg`;
  return encodeAssetPath(fileName);
}

export function computeCaptureTargets(card, tableCards = []) {
  if (!card) {
    return [];
  }
  const cardValue = card.value ?? card.rank ?? 0;
  const sameValues = tableCards.filter((tableCard) => tableCard.value === cardValue);
  if (sameValues.length) {
    return sameValues;
  }
  return findCombination(tableCards, cardValue);
}

function findCombination(cards, target) {
  let bestCombo = [];
  function search(startIndex, sum, picks) {
    if (sum === target && picks.length > 1) {
      const combo = picks.map((index) => cards[index]);
      if (combo.length > bestCombo.length) {
        bestCombo = combo;
      }
      return;
    }
    if (sum >= target) {
      return;
    }
    for (let i = startIndex; i < cards.length; i += 1) {
      search(i + 1, sum + cards[i].value, picks.concat(i));
    }
  }
  search(0, 0, []);
  return bestCombo;
}

function padRank(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return '01';
  }
  return numeric.toString().padStart(2, '0');
}

function encodeAssetPath(fileName) {
  return `/cards/${encodeURIComponent(fileName)}`;
}
