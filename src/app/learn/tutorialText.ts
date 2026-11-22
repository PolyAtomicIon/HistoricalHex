// Тексты интерактивного обучения на трёх языках. {res}, {n}, {terrain}, {name} — подстановки.

import type { Resource, Terrain } from '../../engine';
import type { Lang, T3 } from './lang';

export const RES_NAME: Record<Lang, Record<Resource, string>> = {
  ru: { brick: 'кирпич', wood: 'дерево', sheep: 'шерсть', wheat: 'зерно', ore: 'руда' },
  kz: { brick: 'кірпіш', wood: 'ағаш', sheep: 'жүн', wheat: 'астық', ore: 'кен' },
  en: { brick: 'brick', wood: 'wood', sheep: 'wool', wheat: 'grain', ore: 'ore' },
};

export const TERRAIN_NAME: Record<Lang, Record<Terrain, string>> = {
  ru: { forest: 'лес', hills: 'холмы (глина)', pasture: 'пастбище', fields: 'поле', mountains: 'горы', desert: 'пустыня' },
  kz: { forest: 'орман', hills: 'төбе (саз)', pasture: 'жайылым', fields: 'егістік', mountains: 'тау', desert: 'шөл' },
  en: { forest: 'forest', hills: 'hills (clay)', pasture: 'pasture', fields: 'field', mountains: 'mountains', desert: 'desert' },
};

export const UI: Record<string, T3> = {
  title: { ru: 'Как играть', kz: 'Қалай ойнау керек', en: 'How to play' },
  lesson: { ru: 'Шаг', kz: 'Қадам', en: 'Step' },
  next: { ru: 'Дальше', kz: 'Әрі қарай', en: 'Next' },
  skip: { ru: 'Пропустить', kz: 'Өткізіп жіберу', en: 'Skip' },
  roll: { ru: 'Бросить кубики', kz: 'Сүйекті лақтыру', en: 'Roll the dice' },
  road: { ru: 'Дорога', kz: 'Жол', en: 'Road' },
  house: { ru: 'Дом', kz: 'Үй', en: 'House' },
  city: { ru: 'Город', kz: 'Қала', en: 'City' },
  trade: { ru: 'Обмен', kz: 'Айырбас', en: 'Trade' },
  card: { ru: 'Карта', kz: 'Карта', en: 'Card' },
  endTurn: { ru: 'Конец хода', kz: 'Жүрісті аяқтау', en: 'End turn' },
  points: { ru: 'очков', kz: 'ұпай', en: 'points' },
  pointsLbl: { ru: 'Очки', kz: 'Ұпай', en: 'Points' },
  bot: { ru: 'Аскар', kz: 'Асқар', en: 'Askar' },
  play: { ru: 'Играть', kz: 'Ойнау', en: 'Play' },
  rules: { ru: 'Правила', kz: 'Ережелер', en: 'Rules' },
  again: { ru: 'Пройти ещё раз', kz: 'Қайта ойнау', en: 'Start over' },
  tradeGive: { ru: 'Отдаёшь', kz: 'Бересің', en: 'You give' },
  tradeGet: { ru: 'Получаешь', kz: 'Аласың', en: 'You get' },
  tradeDo: { ru: 'Обменять с банком', kz: 'Банкпен айырбастау', en: 'Trade with the bank' },
  spent: { ru: 'Потрачено', kz: 'Жұмсалды', en: 'Spent' },
  gift: { ru: 'Для урока добавили', kz: 'Сабақ үшін қосылды', en: 'Added for this lesson' },
  drew: { ru: 'Ты купил карту развития. Тебе выпал:', kz: 'Даму картасын сатып алдың. Саған түскені:', en: 'You bought a development card. You got:' },
  knight: { ru: 'Рыцарь', kz: 'Рыцарь', en: 'Knight' },
  knightText: {
    ru: 'Сыграй после броска: переставь захватчиков и забери карту у соседа. 3 рыцаря — бонус «Самая большая армия».',
    kz: 'Сүйекті лақтырған соң ойна: қарақшыны жылжытып, көршіден бір карта ал. 3 рыцарь — «Ең үлкен әскер» бонусы.',
    en: 'Play it after rolling: move the robber and take a card from a neighbor. 3 knights earn the “Largest army” bonus.',
  },
};

/** Подсказка при неверном нажатии. */
export const WRONG: Record<string, T3> = {
  hex: {
    ru: 'Это {terrain} — даёт {res}. Смотри на значок сверху гекса.',
    kz: 'Бұл — {terrain}, {res} береді. Гекстің үстіндегі белгіге қара.',
    en: 'That’s a {terrain} — it gives {res}. Look at the icon on top of the hex.',
  },
  number: {
    ru: 'Здесь {n} — выпадает реже. Ищи красные 6 или 8.',
    kz: 'Мұнда {n} — сирек түседі. Қызыл 6 немесе 8-ді ізде.',
    en: 'That’s {n} — it comes up less often. Look for a red 6 or 8.',
  },
  map: {
    ru: 'Сейчас нажимай на карту — на подсвеченное место.',
    kz: 'Қазір картаны бас — белгіленген орынды.',
    en: 'Tap the map now — the highlighted spot.',
  },
  button: {
    ru: 'Нажми золотую кнопку внизу.',
    kz: 'Төмендегі алтын түсті батырманы бас.',
    en: 'Tap the gold button below.',
  },
};

export interface StepText {
  title: T3;
  text: T3;
  /** Что сказать, когда шаг выполнен (необязательно). */
  done?: T3;
}

export const STEPS: Record<string, StepText> = {
  intro: {
    title: { ru: 'Добро пожаловать!', kz: 'Қош келдің!', en: 'Welcome!' },
    text: {
      ru: 'Строй дома на острове. Каждый дом — 1 очко. Кто первым наберёт 10 очков — победил. Научим за 3 минуты.',
      kz: 'Аралда үй сал. Әр үй — 1 ұпай. Кім бірінші 10 ұпай жинаса — сол жеңеді. 3 минутта үйретеміз.',
      en: 'Build houses on an island. Each house is 1 point. First to 10 points wins. We’ll teach you in 3 minutes.',
    },
  },
  hexes: {
    title: { ru: 'Гексы дают ресурсы', kz: 'Гекстер ресурс береді', en: 'Hexes give resources' },
    text: {
      ru: 'Остров собран из шестиугольников — гексов. Каждый даёт свой ресурс: значок сверху гекса. Нажми на любой лес — он даёт дерево.',
      kz: 'Арал алтыбұрыштардан — гекстерден құралған. Әрқайсысы өз ресурсын береді: белгісі гекстің үстінде. Кез келген орманды бас — ол ағаш береді.',
      en: 'The island is made of hexagons — hexes. Each gives its own resource: see the icon on top. Tap any forest — it gives wood.',
    },
    done: { ru: 'Верно! Лес → дерево.', kz: 'Дұрыс! Орман → ағаш.', en: 'Right! Forest → wood.' },
  },
  numbers: {
    title: { ru: 'Числа на гексах', kz: 'Гекстегі сандар', en: 'Numbers on hexes' },
    text: {
      ru: 'Гекс приносит ресурс, когда на двух кубиках выпадает его число. Точки под числом — как часто оно выпадает. Чаще всего — красные 6 и 8. Нажми на такой гекс.',
      kz: 'Екі сүйекте гекстің саны түскенде, ол ресурс береді. Сан астындағы нүктелер — қаншалықты жиі түсетінін көрсетеді. Ең жиі — қызыл 6 мен 8. Сондай гексті бас.',
      en: 'A hex produces when the two dice add up to its number. The dots under the number show how often it comes up. Red 6 and 8 are the most common. Tap one.',
    },
    done: { ru: 'Да! Такие гексы — самые выгодные.', kz: 'Иә! Мұндай гекстер — ең тиімді.', en: 'Yes! These hexes pay the most.' },
  },
  settle: {
    title: { ru: 'Первый дом (поселение)', kz: 'Алғашқы үй (қоныс)', en: 'Your first house (settlement)' },
    text: {
      ru: 'Дом ставят на угол между гексами — он берёт ресурсы со всех соседних. Мы подсветили 4 лучших места. Нажми на любой светящийся кружок.',
      kz: 'Үй гекстер арасындағы бұрышқа қойылады — көрші гекстердің бәрінен ресурс алады. 4 ең жақсы орынды белгіледік. Кез келген жарқыраған дөңгелекті бас.',
      en: 'Houses go on corners between hexes — they collect from every hex around. We lit up the 4 best spots. Tap any glowing circle.',
    },
    done: { ru: '+1 очко! Дом будет приносить ресурсы.', kz: '+1 ұпай! Үй ресурс әкеледі.', en: '+1 point! This house will bring resources.' },
  },
  road: {
    title: { ru: 'Первая дорога', kz: 'Алғашқы жол', en: 'Your first road' },
    text: {
      ru: 'От дома ведут дорогу — по ней потом строят новые дома. Нажми на светящуюся линию у своего дома.',
      kz: 'Үйден жол тартылады — кейін сол жол бойына жаңа үй саласың. Үйіңнің жанындағы жарқыраған сызықты бас.',
      en: 'Roads lead away from your house — later you build new houses along them. Tap a glowing line next to your house.',
    },
    done: { ru: 'Дорога построена!', kz: 'Жол салынды!', en: 'Road built!' },
  },
  setupRest: {
    title: { ru: 'Начало партии', kz: 'Ойын басталды', en: 'The game begins' },
    text: {
      ru: 'В начале каждый ставит 2 дома и 2 дороги. Второй дом мы поставили за тебя, а {name} — синий — поставил свои. За второй дом сразу дают ресурсы с соседних гексов — смотри внизу.',
      kz: 'Басында әркім 2 үй мен 2 жол қояды. Екінші үйіңді біз қойдық, ал {name} — көк — өзінікін қойды. Екінші үй үшін көрші гекстерден бірден ресурс беріледі — төменге қара.',
      en: 'At the start everyone places 2 houses and 2 roads. We placed your second house, and {name} (blue) placed theirs. Your second house gives starting resources right away — see below.',
    },
  },
  roll: {
    title: { ru: 'Бросок кубиков', kz: 'Сүйек лақтыру', en: 'Rolling the dice' },
    text: {
      ru: 'Каждый ход начинается с броска. Нажми «Бросить кубики». В настоящей партии кубики могут бросаться сами через пару секунд (автобросок).',
      kz: 'Әр жүріс сүйек лақтырудан басталады. «Сүйекті лақтыру» батырмасын бас. Нағыз ойында сүйек бірнеше секундтан кейін өзі лақтырылуы мүмкін (автолақтыру).',
      en: 'Every turn starts with a roll. Tap “Roll the dice”. In a real game the dice may roll by themselves after a few seconds (auto-roll).',
    },
    done: {
      ru: 'Выпало {n}! Твой дом у гекса {n} приносит {res}. Ресурсы получают все, у кого есть дом рядом, — даже не в свой ход.',
      kz: '{n} түсті! {n} гексінің жанындағы үйің {res} әкеледі. Жанында үйі барлардың бәрі ресурс алады — өз жүрісі болмаса да.',
      en: 'You rolled {n}! Your house next to the {n} hex brings {res}. Everyone with a house there gets resources — even on someone else’s turn.',
    },
  },
  buildRoad: {
    title: { ru: 'Строим дорогу', kz: 'Жол саламыз', en: 'Build a road' },
    text: {
      ru: 'Дорога стоит: кирпич + дерево. Нажми «Дорога», потом светящуюся линию.',
      kz: 'Жол бағасы: кірпіш + ағаш. «Жол» батырмасын, сосын жарқыраған сызықты бас.',
      en: 'A road costs brick + wood. Tap “Road”, then a glowing line.',
    },
    done: { ru: 'Дорога построена! Кирпич и дерево потрачены.', kz: 'Жол салынды! Кірпіш пен ағаш жұмсалды.', en: 'Road built! Brick and wood are spent.' },
  },
  buildHouse: {
    title: { ru: 'Новый дом', kz: 'Жаңа үй', en: 'A new house' },
    text: {
      ru: 'Дом стоит: кирпич + дерево + шерсть + зерно. Вплотную к другому дому нельзя. Нажми «Дом», потом светящийся кружок.',
      kz: 'Үй бағасы: кірпіш + ағаш + жүн + астық. Басқа үйдің дәл жанына болмайды. «Үй» батырмасын, сосын жарқыраған дөңгелекті бас.',
      en: 'A house costs brick + wood + wool + grain. Not right next to another house. Tap “House”, then a glowing circle.',
    },
    done: { ru: '+1 очко!', kz: '+1 ұпай!', en: '+1 point!' },
  },
  buildCity: {
    title: { ru: 'Город', kz: 'Қала', en: 'A city' },
    text: {
      ru: 'Город стоит: 3 руды + 2 зерна. Его ставят на место своего дома — он даёт 2 очка и вдвое больше ресурсов. Нажми «Город» и выбери свой дом.',
      kz: 'Қала бағасы: 3 кен + 2 астық. Ол өз үйіңнің орнына салынады — 2 ұпай және екі есе көп ресурс береді. «Қала» батырмасын басып, өз үйіңді таңда.',
      en: 'A city costs 3 ore + 2 grain. It replaces one of your houses — worth 2 points and twice the resources. Tap “City” and pick your house.',
    },
    done: { ru: 'Теперь это город: 2 очка!', kz: 'Енді бұл қала: 2 ұпай!', en: 'Now it’s a city: 2 points!' },
  },
  seven: {
    title: { ru: 'Выпало 7', kz: '7 түсті', en: 'Rolling a 7' },
    text: {
      ru: 'На 7 никто ничего не получает, а у кого больше 7 карт — сбрасывает половину. Бросивший ставит захватчиков на любой гекс: он перестаёт приносить ресурсы. Брось кубики.',
      kz: '7 түскенде ешкім ештеңе алмайды, ал 7-ден көп картасы барлар жартысын тастайды. 7 лақтырған ойыншы қарақшыны басқа гекске қояды: ол ресурс бермей қалады. Сүйекті лақтыр.',
      en: 'On a 7 nobody gets anything, and anyone holding more than 7 cards discards half. The player who rolled the 7 moves the robber to another hex: that hex stops producing. Roll the dice.',
    },
  },
  robber: {
    title: { ru: 'Захватчики', kz: 'Қарақшы', en: 'The robber' },
    text: {
      ru: 'Выпало 7! Поставь захватчиков на гекс, где стоит синий дом {name}, — и заберёшь у него одну случайную карту.',
      kz: '7 түсті! Қарақшыны {name} көк үйі тұрған гекске қой — одан бір кездейсоқ карта аласың.',
      en: 'It’s a 7! Put the robber on a hex with {name}’s blue house — and take one random card from them.',
    },
    done: { ru: 'Ты забрал у игрока {name}: {res}.', kz: '{name} ойыншысынан алдың: {res}.', en: 'You took from {name}: {res}.' },
  },
  trade: {
    title: { ru: 'Обмен', kz: 'Айырбас', en: 'Trading' },
    text: {
      ru: 'Не хватает ресурса — меняй. С банком: отдай 4 одинаковых — получи 1 любой. Если твой дом у порта на берегу, дешевле: «?» 3:1 — любой ресурс 3 к 1, порт со значком ресурса — 2 к 1. Ещё можно меняться с игроками. Нажми «Обмен».',
      kz: 'Ресурс жетпесе — айырбаста. Банкпен: 4 бірдейін бер — 1 кез келгенін ал. Үйің жағадағы айлақ жанында болса, арзанырақ: «?» 3:1 — кез келген ресурс 3-ке 1, ресурс белгісі бар айлақ — 2-ге 1. Ойыншылармен де айырбастауға болады. «Айырбас» батырмасын бас.',
      en: 'Missing a resource? Trade. With the bank: give 4 of one resource, get 1 of any. If your house is at a harbor on the coast it’s cheaper: “?” 3:1 — any resource 3 for 1, a harbor with a resource icon — 2 for 1. You can also trade with players. Tap “Trade”.',
    },
    done: { ru: 'Обмен прошёл!', kz: 'Айырбас өтті!', en: 'Trade done!' },
  },
  dev: {
    title: { ru: 'Карты развития', kz: 'Даму карталары', en: 'Development cards' },
    text: {
      ru: 'Карта стоит: руда + шерсть + зерно. Внутри сюрприз: рыцарь, 2 дороги бесплатно, 2 ресурса из банка, монополия или тайное очко. Играть карту можно только после броска кубиков. Нажми «Карта».',
      kz: 'Карта бағасы: кен + жүн + астық. Ішінде тосын сый: рыцарь, тегін 2 жол, банктен 2 ресурс, монополия немесе жасырын ұпай. Картаны тек сүйек лақтырғаннан кейін ойнауға болады. «Карта» батырмасын бас.',
      en: 'A card costs ore + wool + grain. It’s a surprise: a knight, 2 free roads, 2 resources from the bank, a monopoly (take all of one resource from everyone) or a hidden point. You can play cards only after rolling. Tap “Card”.',
    },
  },
  bonus: {
    title: { ru: 'Бонусы +2', kz: '+2 бонус', en: '+2 bonuses' },
    text: {
      ru: 'Ещё 2 очка дают: самая длинная дорога (от 5 отрезков подряд) и самая большая армия (от 3 сыгранных рыцарей). Их можно отбить, если построишь длиннее или сыграешь больше.',
      kz: 'Тағы 2 ұпай береді: ең ұзын жол (қатарынан 5 кесіндіден бастап) және ең үлкен әскер (3 ойналған рыцарьдан бастап). Ұзынырақ салсаң немесе көбірек ойнасаң, оларды тартып аласың.',
      en: 'Two bonus points go to the player with the longest road (5+ pieces in a row) and to the one with the largest army (3+ knights played). Someone else takes a bonus by building a longer road or playing more knights.',
    },
  },
  end: {
    title: { ru: 'Конец хода', kz: 'Жүріс соңы', en: 'Ending your turn' },
    text: {
      ru: 'Твой ход: бросок → обмен → стройка → «Конец хода». Дальше ходит следующий игрок. Нажми «Конец хода».',
      kz: 'Сенің жүрісің: лақтыру → айырбас → құрылыс → «Жүрісті аяқтау». Сосын келесі ойыншы жүреді. «Жүрісті аяқтау» батырмасын бас.',
      en: 'Your turn: roll → trade → build → “End turn”. Then the next player goes. Tap “End turn”.',
    },
  },
  finish: {
    title: { ru: 'Готово!', kz: 'Дайын!', en: 'All set!' },
    text: {
      ru: 'Ты знаешь главное. В игре подсказки внизу экрана подскажут, что делать дальше, а все правила с поиском — в меню «Правила».',
      kz: 'Негізгісін білесің. Ойында экранның төменгі жағындағы кеңестер не істеу керегін айтады, ал барлық ереже іздеуімен — «Ережелер» мәзірінде.',
      en: 'You know the basics. In the game, hints at the bottom of the screen tell you what to do next, and the full searchable rules are in the “Rules” menu.',
    },
  },
};

export const STEP_ORDER = [
  'intro',
  'hexes',
  'numbers',
  'settle',
  'road',
  'setupRest',
  'roll',
  'buildRoad',
  'buildHouse',
  'buildCity',
  'seven',
  'robber',
  'trade',
  'dev',
  'bonus',
  'end',
  'finish',
] as const;
export type StepId = (typeof STEP_ORDER)[number];

export const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
