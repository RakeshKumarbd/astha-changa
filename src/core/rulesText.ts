// "How to play", written out from a rule set, in English or Hindi.

import type { RuleConfig } from './state';

export type TextLang = 'en' | 'hi';

const list = (items: (string | number)[], lang: TextLang): string => {
  if (items.length <= 1) return items.join('');
  const and = lang === 'hi' ? ' या ' : ' or ';
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
};

/** "k open → v" for each row of the throw table, naming the all-closed and all-open rows. */
function tableText(r: RuleConfig, lang: TextLang): string {
  return r.throwTable
    .map((v, k) => {
      if (lang === 'hi') {
        const name = k === 0 ? 'सब बंद' : k === r.cowries ? 'सब खुली' : `${k} खुली`;
        return `${name} = ${v}`;
      }
      const name = k === 0 ? 'all closed' : k === r.cowries ? 'all open' : `${k} open`;
      return `${name} = ${v}`;
    })
    .join(', ');
}

export function rulesSummary(r: RuleConfig, lang: TextLang): string[] {
  const n = r.boardSize;
  const bonus = r.throwTable.filter((v, i, a) => a.indexOf(v) === i && r.bonusThrows.includes(v));
  const entry = [...new Set(r.throwTable)].filter((v) => r.entryThrows.includes(v));

  if (lang === 'hi') {
    const dir = r.outerClockwise ? 'घड़ी की दिशा में' : 'घड़ी की उल्टी दिशा में';
    return [
      `${n}×${n} का बोर्ड। गोटियाँ बाहरी घेरे में ${dir} चलती हैं, फिर अंदर मुड़कर${r.alternateInner ? ' (हर घेरे में दिशा बदलते हुए)' : ''} बीच तक जाती हैं।`,
      `हर खिलाड़ी के पास ${r.piecesPerPlayer} गोटियाँ।` +
        (r.startOnHome ? ' सब अपने घर (अपनी तरफ़ का क्रॉस वाला घर) से शुरू होती हैं।' : ` गोटियाँ बाहर रहती हैं; ${list(entry, lang)} आने पर एक गोटी घर पर आती है।`),
      `${r.cowries} कौड़ियाँ फेंकें और खुली कौड़ियाँ गिनें: ${tableText(r, lang)}।`,
      'हर दाँव अलग से, किसी भी गोटी पर चल सकते हैं।',
      (bonus.length ? `${list(bonus, lang)} आने पर एक और दाँव मिलता है।` : 'किसी अंक पर अतिरिक्त दाँव नहीं मिलता।') +
        (r.bonusStreakLimit ? ` लगातार ${r.bonusStreakLimit} बार आने पर बारी खत्म।` : ''),
      `सादे घर पर विरोधी की गोटी पर पहुँचें तो वह कट जाती है और ${r.captureSendsHome ? 'अपने घर लौट जाती है' : 'बोर्ड से बाहर चली जाती है'}${r.captureGivesThrow ? '; आपको एक और दाँव मिलता है' : ''}।`,
      'क्रॉस वाले घर (हर खिलाड़ी का घर और बीच का घर) सुरक्षित हैं: वहाँ कोई नहीं कटता।' +
        (r.pairBlocks ? ' एक टीम की दो गोटियाँ एक सादे घर पर हों तो वह घर बंद है।' : ''),
      ...(r.captureRequiredForInner
        ? ['अंदर के घेरे में जाने से पहले कम से कम एक गोटी काटना ज़रूरी है; तब तक गोटियाँ बाहरी घेरे में घूमती रहती हैं।' +
            (r.enterIfNothingToCut ? ' अगर बाहरी घेरे में काटने लायक कोई विरोधी गोटी नहीं है, तो बिना काटे भी अंदर जा सकते हैं।' : '')]
        : []),
      (r.exactFinish ? 'बीच के घर तक पहुँचने के लिए सही अंक चाहिए।' : 'बड़ा अंक आने पर भी गोटी बीच में पहुँच जाती है।') +
        (r.stopAtFirstWinner ? ' जो पहले सारी गोटियाँ बीच में पहुँचाए, वह जीतता है।' : ' सब खिलाड़ियों के पूरा होने तक खेल चलता है।'),
    ];
  }

  const dir = r.outerClockwise ? 'clockwise' : 'anticlockwise';
  return [
    `${n}×${n} board. Pieces go ${dir} round the outer ring, then turn inward${r.alternateInner ? ' (switching direction on each inner ring)' : ''} and spiral to the centre.`,
    `Each player has ${r.piecesPerPlayer} pieces.` +
      (r.startOnHome ? ' They start on their home square: the crossed square in the middle of their side.' : ` They wait off the board; a ${list(entry, lang)} brings one onto its home square.`),
    `Throw ${r.cowries} cowrie shells and count the open (mouth-up) ones: ${tableText(r, lang)}.`,
    'You use each throw separately, on any of your pieces.',
    (bonus.length ? `A ${list(bonus, lang)} gives you another throw.` : 'No result gives an extra throw.') +
      (r.bonusStreakLimit ? ` ${r.bonusStreakLimit} of those in a row lose the turn.` : ''),
    `Land on another player's piece on a plain square to cut it: it goes ${r.captureSendsHome ? 'back to its home square' : 'off the board'}${r.captureGivesThrow ? ' and you throw again' : ''}.`,
    'Crossed squares (each home and the centre) are safe: nobody can be cut there.' +
      (r.pairBlocks ? ' Two pieces of one team on a plain square block it.' : ''),
    ...(r.captureRequiredForInner
      ? ['You must cut at least one piece before your pieces may leave the outer ring; until then they keep circling.' +
          (r.enterIfNothingToCut ? ' If no other player has a piece on the outer ring that can be cut, you may go inside anyway.' : '')]
      : []),
    (r.exactFinish ? 'You need the exact number to reach the centre.' : 'A big throw still takes a piece into the centre.') +
      (r.stopAtFirstWinner ? ' First to bring all their pieces to the centre wins.' : ' Play on until everyone has finished.'),
  ];
}
