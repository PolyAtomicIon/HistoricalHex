import type { LoreFactsTr } from './types';

// Перевод фактов пакета «classic»: facts[i] — перевод pack.facts[i].text.
export const FACTS: LoreFactsTr = {
  kz: {
    facts: [
      `Ең жиі 6 мен 8 түседі (36 лақтырудың 5-інде), ең сирек 2 мен 12 (1 реттен).`,
      `Жетондағы санның астындағы нүктелер оның қаншалықты жиі түсетінін көрсетеді: нүкте көп болса, жиі түседі.`,
      `Жеті кез келген басқа санға қарағанда жиірек түседі: 36-ның 6-ында. Қолыңда 7 картадан артық ұстама.`,
      `Жеті түскенде қолыңда 7 картадан көп болса, жартысын тастайсың (төмен қарай дөңгелектеп).`,
      `Қонысты басқа қонысқа таяу салуға болмайды: араларында кемінде бір бос түйісу болуы керек.`,
      `Қала 1 емес, 2 ресурс және 1 емес, 2 ұпай береді.`,
      `Банк 4 бірдей картаны 1 кез келген картаға алмастырады. 3:1 айлағымен үш кез келген бірдей картаны, 2:1 айлағымен өз ресурсыңның екеуін алмастыруға болады.`,
      `Ең ұзын жол — қатарынан 5 жолдан басталады, 2 ұпай береді. Қарсылас ұзынырақ жол салса, оны жоғалтуың мүмкін.`,
      `Ең үлкен әскер — 3 рыцарь ойналғаннан басталады, 2 ұпай береді.`,
      `Даму картасын сатып алған сол жүрісте ойнауға болмайды. Жеңіс ұпайы — ерекшелік, ол бірден есептеледі.`,
      `Бір жүрісте тек бір даму картасын ойнауға болады.`,
      `Рыцарьді сүйектерді лақтырудан бұрын да ойнауға болады, мысалы, қарақшыны өз гексіңнен алып тастау үшін.`,
      `Алғашқы қоныстарыңды жиі сандары бар үш түрлі ресурстың түйісіне сал.`,
      `Кірпіш пен ағаш бастапқыда жолдар мен қоныстар үшін, кен мен астық кейінірек қалалар үшін керек.`,
    ],
  },
  en: {
    facts: [
      `6 and 8 come up most often (5 times in 36 rolls); 2 and 12 come up least often (once each).`,
      `The dots under the number on a token show how often it is rolled: more dots, more often.`,
      `Seven is rolled more often than any other number, 6 times in 36. Don't hold more than 7 cards in hand.`,
      `If you hold more than 7 cards when a 7 is rolled, you discard half (rounded down).`,
      `A settlement can't be placed next to another settlement: there must be at least one empty intersection between them.`,
      `A city gives 2 resources instead of 1 and 2 points instead of 1.`,
      `The bank trades 4 identical cards for 1 of your choice. With a 3:1 harbor it takes any three identical cards; with a 2:1 harbor, two of that harbor's resource.`,
      `Longest Road needs 5 connected roads in a row and gives 2 points. You can lose it if a rival builds a longer one.`,
      `Largest Army needs 3 played knights and gives 2 points.`,
      `A development card can't be played on the turn you bought it. A victory point card is the exception: it counts immediately.`,
      `You can play only one development card per turn.`,
      `You can play a knight even before rolling the dice, for example to move the robber off your own hex.`,
      `Place your first settlements at intersections of three different resources with frequent numbers.`,
      `Brick and lumber are needed early for roads and settlements; ore and grain later for cities.`,
    ],
  },
};
