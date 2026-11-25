/* HistoricalHex — промо-страница. Без фреймворков и внешних скриптов. */
(function () {
  'use strict';

  // ════════════════════════════════════════════════════════════════════
  //  ОБ АВТОРЕ — ЗАПОЛНИТЬ ЗДЕСЬ.
  //  Блок «Об авторе» показывается, только если текст для текущего языка
  //  непустой. Абзацы разделяются пустой строкой (\n\n).
  //  name  — строка или { ru, kz, en }.
  //  links — [{ label: 'Telegram', href: 'https://…' }, …]
  //          (label тоже может быть { ru, kz, en }).
  // ════════════════════════════════════════════════════════════════════
  const ABOUT = {
    ru: '',
    kz: '',
    en: '',
    name: '',
    links: [],
  };

  // ─── тексты страницы ───
  const STR = {
    title: {
      ru: 'HistoricalHex — настольная игра на гексах в исторических эпохах',
      kz: 'HistoricalHex — тарихи дәуірлердегі гекс үстел ойыны',
      en: 'HistoricalHex — a hex board game set in historical eras',
    },
    desc: {
      ru: 'Строй, торгуй и узнавай историю: мобильная настольная игра на гексах. Чингисхан, Япония самураев, Казахское ханство, Шёлковый путь, саки. Играй с телефона за одним столом или онлайн.',
      kz: 'Сал, айырбаста, тарихты таны: гекстегі мобильді үстел ойыны. Шыңғыс хан, самурайлар Жапониясы, Қазақ хандығы, Жібек жолы, сақтар. Телефоннан бір үстел басында немесе онлайн ойна.',
      en: 'Build, trade and learn history in a mobile hex board game. Genghis Khan, samurai Japan, the Kazakh Khanate, the Silk Road, the Saka. Play on phones around one table or online.',
    },
    pitch: {
      ru: 'Настольная игра на гексах: строй, торгуй и узнавай историю. Каждая партия — в своей эпохе.',
      kz: 'Гекстегі үстел ойыны: сал, айырбаста, тарихты таны. Әр ойын — өз дәуірінде.',
      en: 'A hex board game: build, trade and pick up some history. Every game is set in its own era.',
    },
    play: { ru: 'Играть', kz: 'Ойнау', en: 'Play' },
    pickEra: { ru: 'Выбрать эпоху', kz: 'Дәуір таңдау', en: 'Pick an era' },
    note: {
      ru: 'Открывается в браузере телефона. Можно установить как приложение.',
      kz: 'Телефон браузерінде ашылады. Қосымша ретінде орнатуға болады.',
      en: 'Opens in your phone browser. Can be installed as an app.',
    },
    howEyebrow: { ru: 'Как это играется', kz: 'Ойын қалай өтеді', en: 'How it plays' },
    f1t: { ru: 'Одна карта — два вида', kz: 'Бір карта — екі түрі', en: 'One board, two looks' },
    f1d: {
      ru: 'Рисованная 2D-карта читается с одного взгляда. 3D — низкополигональный остров посреди моря. Выбирай ту, что по душе.',
      kz: 'Суретті 2D-карта бір қарағаннан-ақ түсінікті. 3D — теңіз ортасындағы төмен полигонды арал. Қайсысы ұнаса, соны таңда.',
      en: 'The illustrated 2D board reads at a glance. The 3D one is a low-poly island in the middle of the sea. Pick whichever you like.',
    },
    f2t: { ru: 'Торг в одно касание', kz: 'Бір түртумен саудаласу', en: 'Haggling in one tap' },
    f2d: {
      ru: 'Предложение обмена появляется прямо над твоими ресурсами. Не устраивает — кнопка «Встречное» отправит ответ одним нажатием.',
      kz: 'Айырбас ұсынысы ресурстарыңның дәл үстінен шығады. Ұнамаса — қарсы ұсыныс батырмасы жауабыңды бір басумен жібереді.',
      en: 'A trade offer appears right above your resources. Not happy with it? The counter-offer button sends your reply in a single tap.',
    },
    f3t: { ru: 'За одним столом или по сети', kz: 'Бір үстел басында немесе желіде', en: 'Around one table or online' },
    f3d: {
      ru: 'Каждый играет со своего телефона — рядом или онлайн по PIN из шести цифр. Включи режим экрана на телевизоре, и карту увидят все. А сводка стола покажет, у кого что копится.',
      kz: 'Әркім өз телефонынан ойнайды — қатар отырып немесе алты санды PIN арқылы онлайн. Теледидарда экран режимін қоссаң, картаны бәрі көреді. Ал үстел жиынтығы кімде не жиналып жатқанын көрсетеді.',
      en: 'Everyone plays on their own phone, side by side or online with a six-digit PIN. Turn on screen mode on a TV and the whole table sees the board. The table summary shows who is stockpiling what.',
    },
    moreEyebrow: { ru: 'Ещё в игре', kz: 'Ойында тағы не бар', en: 'Also in the game' },
    m1t: { ru: 'Боты и ИИ-персонажи', kz: 'Боттар мен ЖИ-кейіпкерлер', en: 'Bots and AI characters' },
    m1d: {
      ru: 'Три уровня сложности и персонажи с собственным рейтингом.',
      kz: 'Үш деңгейлі боттар және өз рейтингі бар кейіпкерлер.',
      en: 'Three difficulty levels, plus characters with ratings of their own.',
    },
    m2t: { ru: 'Планировщик хода', kz: 'Жүріс жоспарлағыш', en: 'Turn planner' },
    m2d: {
      ru: 'Собери план, пока ходят другие, и выполни его в свой ход.',
      kz: 'Басқалар жүріп жатқанда жоспар құр, кезегің келгенде орында.',
      en: 'Line up your move while others play, then run it on your turn.',
    },
    m3t: { ru: 'Пауза на несколько дней', kz: 'Бірнеше күнге үзіліс', en: 'Pause for days' },
    m3d: {
      ru: 'Не успели доиграть — вернётесь к партии позже.',
      kz: 'Ойынды бітіріп үлгермесеңдер — кейін жалғастырасыңдар.',
      en: 'Ran out of time? Come back to the game later.',
    },
    m4t: { ru: 'Зрители', kz: 'Көрермендер', en: 'Spectators' },
    m4d: {
      ru: 'Живые партии можно смотреть и реагировать на ходы.',
      kz: 'Жүріп жатқан ойындарды көріп, реакция қалдыруға болады.',
      en: 'Watch live games and react as they unfold.',
    },
    m5t: { ru: 'Друзья и приглашения', kz: 'Достар мен шақырулар', en: 'Friends and invites' },
    m5d: {
      ru: 'Видно, кто в сети, — зови в партию.',
      kz: 'Кім желіде екені көрінеді — ойынға шақыр.',
      en: 'See who is online and call them into a game.',
    },
    m6t: { ru: 'Рейтинг и лидеры', kz: 'Рейтинг пен көшбасшылар', en: 'Rating and leaderboard' },
    m6d: {
      ru: 'Свой рейтинг и общая таблица лидеров.',
      kz: 'Өз рейтингің және ортақ көшбасшылар кестесі.',
      en: 'Your own rating and a shared leaderboard.',
    },
    m7t: { ru: 'Правила и обучение', kz: 'Ережелер мен оқу', en: 'Rules and tutorial' },
    m7d: {
      ru: 'Обучение за 3 минуты и справочник правил — на русском, казахском и английском.',
      kz: '3 минуттық оқу және ережелер анықтамалығы — қазақ, орыс және ағылшын тілдерінде.',
      en: 'A 3-minute tutorial and a rulebook in Russian, Kazakh and English.',
    },
    m8t: { ru: 'Как приложение', kz: 'Қосымша сияқты', en: 'Works as an app' },
    m8d: {
      ru: 'Ставится на главный экран телефона.',
      kz: 'Телефонның басты экранына орнатылады.',
      en: 'Install it to your phone’s home screen.',
    },
    labEyebrow: { ru: 'Эпохи', kz: 'Дәуірлер', en: 'Eras' },
    labTitle: { ru: 'Один остров — шесть эпох', kz: 'Бір арал — алты дәуір', en: 'One island, six eras' },
    labLead: {
      ru: 'Правила те же, а мир вокруг меняется: названия земель, цвет моря, рассказчик и факты из истории. Выбери эпоху и нажми на любой гекс.',
      kz: 'Ереже сол күйінде, ал айнала өзгереді: жер атаулары, теңіз түсі, баяндаушы және тарихи деректер. Дәуірді таңдап, кез келген гексті бас.',
      en: 'Same rules, different world: the names of the lands, the colour of the sea, the narrator and the history facts. Pick an era and tap any hex.',
    },
    authorEyebrow: { ru: 'Об авторе', kz: 'Автор туралы', en: 'About the author' },
    finalTitle: { ru: 'Собери свою эпоху', kz: 'Өз дәуіріңді құр', en: 'Build your era' },
    // интерактив
    gives: { ru: 'даёт: {res}', kz: '{res} береді', en: 'gives {res}' },
    prob: {
      ru: 'Число {n} выпадает в {p} из 36 бросков — примерно {pct}%.',
      kz: '{n} саны 36 лақтырыста шамамен {p} рет түседі — {pct}%.',
      en: '{n} comes up in {p} of 36 rolls, about {pct}%.',
    },
    hot: {
      ru: '6 и 8 — самые частые числа, рядом с ними и стоит строиться.',
      kz: '6 мен 8 — ең жиі түсетін сандар, солардың жанына салған дұрыс.',
      en: '6 and 8 are the most frequent numbers, so build next to them.',
    },
    rare: { ru: 'Реже не бывает.', kz: 'Бұдан сирек түсетін сан жоқ.', en: 'It does not get rarer than that.' },
    desertRes: { ru: 'ничего не даёт', kz: 'ештеңе бермейді', en: 'gives nothing' },
    desertText: {
      ru: 'На этом гексе нет числа. Отсюда начинает разбойник.',
      kz: 'Бұл гексте сан жоқ. Қарақшы осы жерден бастайды.',
      en: 'This hex has no number. The robber starts here.',
    },
    island: { ru: 'Остров', kz: 'Арал', en: 'Island' },
    erasLabel: { ru: 'Эпохи', kz: 'Дәуірлер', en: 'Eras' },
    altHome: {
      ru: 'Главный экран HistoricalHex: обложка эпохи Чингисхана и кнопка новой партии',
      kz: 'HistoricalHex басты экраны: Шыңғыс хан дәуірінің мұқабасы және жаңа ойын батырмасы',
      en: 'HistoricalHex home screen: the Genghis Khan era cover and the new game button',
    },
    alt2d: {
      ru: 'Рисованная 2D-карта острова в середине партии',
      kz: 'Ойын ортасындағы аралдың суретті 2D-картасы',
      en: 'The illustrated 2D island board in the middle of a game',
    },
    alt3d: {
      ru: 'Тот же остров в 3D: низкополигональные горы, леса и корабли',
      kz: 'Сол арал 3D түрінде: төмен полигонды таулар, ормандар мен кемелер',
      en: 'The same island in 3D: low-poly mountains, forests and ships',
    },
    altTrade: {
      ru: 'Карточка входящего обмена с кнопкой встречного предложения',
      kz: 'Келген айырбас карточкасы және қарсы ұсыныс батырмасы',
      en: 'An incoming trade card with a counter-offer button',
    },
    altStats: {
      ru: 'Сводка стола: рынок ресурсов и кто что получает за бросок',
      kz: 'Үстел жиынтығы: ресурстар нарығы және кім әр лақтырыста не алатыны',
      en: 'Table summary: the resource market and who earns what per roll',
    },
  };

  // Названия ресурсов — как в обучении (src/app/learn/tutorialText.ts).
  const RES = {
    ru: { brick: 'кирпич', wood: 'дерево', sheep: 'шерсть', wheat: 'зерно', ore: 'руда' },
    kz: { brick: 'кірпіш', wood: 'ағаш', sheep: 'жүн', wheat: 'астық', ore: 'кен' },
    en: { brick: 'brick', wood: 'wood', sheep: 'wool', wheat: 'grain', ore: 'ore' },
  };
  const TERRAIN_RES = { forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore', desert: null };
  // Цвета местности — src/ui/theme.ts.
  const TERRAIN_COLOR = { forest: '#2f7d3a', hills: '#c3643d', pasture: '#8fc657', fields: '#e9c046', mountains: '#8c95a6', desert: '#e3cf9e' };

  // Эпохи: id, годы, акцент и море — из src/lore/packs/*. Обложка — ../eras/<id>.webp (как eraCover в src/app/era.ts).
  // t — местность в порядке: forest, hills, pasture, fields, mountains, desert.
  const ERAS = [
    {
      id: 'genghis', accent: '#c8963e', sea: '#3f8fb5', deep: '#1c4a6e',
      ru: { chip: 'Чингисхан', title: 'Эпоха Чингисхана', years: '1206–1269', sub: 'Великая степь, караваны Шёлкового пути и Улус Джучи', t: ['Алтайские леса', 'Глиняные холмы', 'Жайлау', 'Оазис', 'Рудные горы', 'Бетпак-Дала'] },
      kz: { chip: 'Шыңғыс хан', title: 'Шыңғыс хан дәуірі', years: '1206–1269', sub: 'Ұлы дала, Жібек жолының керуендері және Жошы ұлысы', t: ['Алтай ормандары', 'Саз төбелер', 'Жайлау', 'Оазис', 'Кенді таулар', 'Бетпақдала'] },
      en: { chip: 'Genghis Khan', title: 'The Age of Genghis Khan', years: '1206–1269', sub: 'The Great Steppe, Silk Road caravans and the Ulus of Jochi', t: ['Altai forests', 'Clay hills', 'Jailau', 'Oasis', 'Ore mountains', 'Betpak-Dala'] },
    },
    {
      id: 'japan', accent: '#cf3f4a', sea: '#3d7ea6', deep: '#1a2f52',
      ru: { chip: 'Япония самураев', title: 'Страна восходящего солнца', years: '1467–1639', sub: 'Воюющие провинции, замки и рис: Япония от Сэнгоку до сёгуната Токугава', t: ['Кедровый лес', 'Каменоломня', 'Чайные холмы', 'Рисовые поля', 'Железные горы', 'Склон вулкана'] },
      kz: { chip: 'Самурайлар Жапониясы', title: 'Күншығыс елі', years: '1467–1639', sub: 'Соғысқан провинциялар, қамалдар мен күріш: Сэнгокудан Токугава сёгунатына дейінгі Жапония', t: ['Балқарағай орманы', 'Тас карьері', 'Шай төбелері', 'Күріш алқаптары', 'Темір таулар', 'Жанартау беткейі'] },
      en: { chip: 'Samurai Japan', title: 'Land of the Rising Sun', years: '1467–1639', sub: 'Warring provinces, castles and rice: Japan from Sengoku to the Tokugawa shogunate', t: ['Cedar forest', 'Quarry', 'Tea hills', 'Rice paddies', 'Iron mountains', 'Volcano slope'] },
    },
    {
      id: 'ww2', accent: '#b4472f', sea: '#5f8191', deep: '#2b3f4c',
      ru: { chip: 'Всё для фронта', title: 'Всё для фронта', years: '1941–1945', sub: 'Казахстан — тыл и арсенал в годы Второй мировой войны', t: ['Лесхоз', 'Угольные сопки', 'Отгонное пастбище', 'Колхозное поле', 'Рудник', 'Солончак'] },
      kz: { chip: 'Бәрі де майдан үшін', title: 'Бәрі де майдан үшін', years: '1941–1945', sub: 'Қазақстан — Екінші дүниежүзілік соғыс жылдарындағы тыл мен арсенал', t: ['Орман шаруашылығы', 'Көмірлі шоқылар', 'Шалғай жайылым', 'Колхоз егістігі', 'Кеніш', 'Сортаң'] },
      en: { chip: 'Home Front', title: 'Everything for the Front', years: '1941–1945', sub: 'Kazakhstan as home front and arsenal during the Second World War', t: ['Forestry', 'Coal hills', 'Distant pasture', 'Collective farm field', 'Mine', 'Salt flat'] },
    },
    {
      id: 'khanate', accent: '#3fb6c9', sea: '#3f8aa8', deep: '#1b3f5c',
      ru: { chip: 'Казахское ханство', title: 'Казахское ханство', years: '1465–1730', sub: 'Вольные люди степи: ханы, бии, батыры и Туркестан', t: ['Ельники Алатау', 'Кирпичные холмы', 'Жайлау', 'Просяные поля', 'Улытау', 'Мойынкум'] },
      kz: { chip: 'Қазақ хандығы', title: 'Қазақ хандығы', years: '1465–1730', sub: 'Даланың еркін халқы: хандар, билер, батырлар және Түркістан', t: ['Алатау шыршалары', 'Кірпіш төбелер', 'Жайлау', 'Тары егістігі', 'Ұлытау', 'Мойынқұм'] },
      en: { chip: 'Kazakh Khanate', title: 'The Kazakh Khanate', years: '1465–1730', sub: 'Free people of the steppe: khans, biys, batyrs and Turkestan', t: ['Alatau spruce forests', 'Brick hills', 'Jailau', 'Millet fields', 'Ulytau', 'Moiynkum'] },
    },
    {
      id: 'silk', accent: '#d9a441', sea: '#2f9aa0', deep: '#163f52',
      ru: { chip: 'Шёлковый путь', title: 'Великий Шёлковый путь', years: 'VI–XII вв.', sub: 'Караваны, города-оазисы и серебро: от Тараза до Отрара', t: ['Тугаи', 'Глиняные карьеры', 'Тутовые сады', 'Бахчи', 'Серебряные рудники', 'Кызылкум'] },
      kz: { chip: 'Жібек жолы', title: 'Ұлы Жібек жолы', years: 'VI–XII ғғ.', sub: 'Керуендер, оазис-қалалар мен күміс: Тараздан Отырарға дейін', t: ['Тоғайлар', 'Саз карьерлері', 'Тұт бақтары', 'Бақшалар', 'Күміс кеніштері', 'Қызылқұм'] },
      en: { chip: 'Silk Road', title: 'The Great Silk Road', years: '6th–12th c.', sub: 'Caravans, oasis cities and silver: from Taraz to Otrar', t: ['Tugai woods', 'Clay pits', 'Mulberry orchards', 'Melon fields', 'Silver mines', 'Kyzylkum'] },
    },
    {
      id: 'saka', accent: '#e0b23a', sea: '#4a8fa3', deep: '#1d3a4f',
      ru: { chip: 'Саки', title: 'Саки', years: 'VIII–III вв. до н. э.', sub: 'Золото степи, курганы и царица Томирис', t: ['Тайга Алтая', 'Каменные гряды', 'Степь', 'Предгорные поля', 'Золотые горы', 'Скалы с петроглифами'] },
      kz: { chip: 'Сақтар', title: 'Сақтар', years: 'б.з.д. VIII–III ғғ.', sub: 'Дала алтыны, обалар және Томирис патшайым', t: ['Алтай тайгасы', 'Тас жоталар', 'Дала', 'Тау бөктеріндегі егістік', 'Алтын таулар', 'Петроглифті жартастар'] },
      en: { chip: 'The Saka', title: 'The Saka', years: '8th–3rd c. BCE', sub: 'Steppe gold, kurgans and Queen Tomyris', t: ['Altai taiga', 'Stone ridges', 'Steppe', 'Foothill fields', 'Golden mountains', 'Petroglyph rocks'] },
    },
  ];
  const T_ORDER = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'];

  // Остров: классическая раскладка 3-4-5-4-3 (19 гексов, числа 2–12 без семёрки; 6 и 8 не соседи).
  const ISLAND = [
    [['forest', 11], ['pasture', 12], ['fields', 9]],
    [['hills', 4], ['mountains', 6], ['hills', 5], ['pasture', 10]],
    [['desert', 0], ['forest', 3], ['fields', 11], ['forest', 4], ['fields', 8]],
    [['hills', 8], ['pasture', 10], ['pasture', 9], ['mountains', 3]],
    [['mountains', 5], ['fields', 2], ['forest', 6]],
  ];

  // ─── язык ───
  const LANGS = ['ru', 'kz', 'en'];
  const LANG_KEY = 'hh.lang'; // тот же ключ, что у игры (src/app/learn/lang.ts): выбор общий
  const HTML_LANG = { ru: 'ru', kz: 'kk', en: 'en' };

  function initialLang() {
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q && LANGS.indexOf(q.toLowerCase()) >= 0) return q.toLowerCase();
    } catch (e) {
      /* ok */
    }
    try {
      const v = localStorage.getItem(LANG_KEY);
      if (LANGS.indexOf(v) >= 0) return v;
    } catch (e) {
      /* приватный режим */
    }
    return 'ru';
  }

  let lang = initialLang();
  let eraIdx = 0;
  let sel = 11; // гекс «поле, 8» — чтобы подсказка не была пустой

  const $ = (id) => document.getElementById(id);
  const tr = (key) => (STR[key] && (STR[key][lang] || STR[key].ru)) || '';
  const pick = (v) => (v && typeof v === 'object' ? v[lang] || v.ru || '' : v || '');
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs) => {
    const el = document.createElementNS(SVG, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  // ─── остров ───
  const hexes = [];
  function buildIsland() {
    const svg = $('island');
    const S = 30;
    const W = Math.sqrt(3) * S;
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 90);
      pts.push((Math.cos(a) * (S - 1)).toFixed(2) + ',' + (Math.sin(a) * (S - 1)).toFixed(2));
    }
    ISLAND.forEach((row, r) => {
      row.forEach((cell, i) => {
        const terrain = cell[0];
        const num = cell[1];
        const x = (i - (row.length - 1) / 2) * W;
        const y = (r - 2) * S * 1.5;
        const pips = num ? 6 - Math.abs(7 - num) : 0;
        // внешняя группа держит позицию, внутренняя — «подпрыгивает» при выборе
        const pos = svgEl('g', { transform: 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')' });
        const g = svgEl('g', { class: 'hex' + (num === 6 || num === 8 ? ' hot' : ''), tabindex: '0', role: 'button' });
        g.appendChild(svgEl('polygon', { points: pts.join(' '), fill: TERRAIN_COLOR[terrain] }));
        if (num) {
          g.appendChild(svgEl('circle', { class: 'tok', r: '11.5' }));
          const t = svgEl('text', { y: '2.4' });
          t.textContent = String(num);
          g.appendChild(t);
          for (let p = 0; p < pips; p++) {
            g.appendChild(svgEl('circle', { class: 'pip', r: '0.9', cx: ((p - (pips - 1) / 2) * 2.6).toFixed(2), cy: '6.6' }));
          }
        }
        const idx = hexes.length;
        g.addEventListener('click', () => select(idx));
        g.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            select(idx);
          }
        });
        pos.appendChild(g);
        svg.appendChild(pos);
        hexes.push({ g, pos, terrain, num, pips });
      });
    });
    const dots = $('dots');
    for (let d = 0; d < 36; d++) dots.appendChild(document.createElement('i'));
  }

  function terrainName(terrain) {
    return ERAS[eraIdx][lang].t[T_ORDER.indexOf(terrain)];
  }

  function select(idx) {
    sel = idx;
    hexes.forEach((h, i) => {
      const on = i === idx;
      h.g.classList.toggle('on', on);
      h.g.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // выбранный гекс — поверх соседей
    const h = hexes[idx];
    const hadFocus = document.activeElement === h.g;
    h.pos.parentNode.appendChild(h.pos);
    if (hadFocus) h.g.focus();
    renderRead();
  }

  function renderRead() {
    const h = hexes[sel];
    const era = ERAS[eraIdx];
    const res = TERRAIN_RES[h.terrain];
    $('readName').textContent = terrainName(h.terrain);
    const ic = $('readIc');
    ic.textContent = '';
    if (res) {
      const img = new Image();
      img.alt = '';
      img.width = 52;
      img.height = 52;
      img.src = '../eras/' + era.id + '/res-' + res + '.webp'; // как eraIcon в src/app/era.ts
      ic.appendChild(img);
      $('readRes').textContent = cap(fill(tr('gives'), { res: RES[lang][res] }));
      const pct = Math.round((h.pips / 36) * 100);
      let text = fill(tr('prob'), { n: h.num, p: h.pips, pct: pct });
      if (h.pips === 5) text += ' ' + tr('hot');
      if (h.pips === 1) text += ' ' + tr('rare');
      $('readText').textContent = text;
    } else {
      ic.appendChild(document.createElement('i'));
      $('readRes').textContent = cap(tr('desertRes'));
      $('readText').textContent = tr('desertText');
    }
    const dots = $('dots').children;
    for (let d = 0; d < dots.length; d++) dots[d].className = d < h.pips ? 'f' : '';
  }

  function labelHexes() {
    hexes.forEach((h) => {
      const res = TERRAIN_RES[h.terrain];
      h.g.setAttribute('aria-label', terrainName(h.terrain) + (res ? ', ' + RES[lang][res] + ', ' + h.num : ''));
    });
    $('island').setAttribute('aria-label', tr('island'));
  }

  // ─── эпохи ───
  let coverFront = null;
  let coverBack = null;
  function buildChips() {
    const box = $('chips');
    ERAS.forEach((era, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      const img = new Image();
      img.alt = '';
      img.width = 32;
      img.height = 32;
      img.loading = 'lazy';
      img.src = '../eras/' + era.id + '/emblem.webp';
      const span = document.createElement('span');
      b.appendChild(img);
      b.appendChild(span);
      b.addEventListener('click', () => setEra(i, true));
      box.appendChild(b);
    });
  }

  function setEra(i, user) {
    const changed = i !== eraIdx;
    eraIdx = i;
    const era = ERAS[i];
    const lab = $('eras');
    lab.style.setProperty('--era', era.accent);
    lab.style.setProperty('--sea', era.sea);
    lab.style.setProperty('--sea-deep', era.deep);
    if (changed) {
      const src = '../eras/' + era.id + '.webp';
      const next = coverBack;
      const prev = coverFront;
      next.onload = () => {
        if (ERAS[eraIdx] !== era) return; // успели выбрать другую
        next.classList.add('on');
        prev.classList.remove('on');
        coverFront = next;
        coverBack = prev;
      };
      next.src = src;
    }
    renderEra();
    if (user) {
      const chip = $('chips').children[i];
      if (chip && chip.scrollIntoView && window.matchMedia('(max-width: 899px)').matches) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        try {
          chip.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
        } catch (e) {
          /* старый Safari */
        }
      }
    }
  }

  function renderEra() {
    const era = ERAS[eraIdx];
    const L = era[lang];
    $('eraYears').textContent = L.years;
    $('eraTitle').textContent = L.title;
    $('eraSub').textContent = L.sub;
    const chips = $('chips').children;
    for (let c = 0; c < chips.length; c++) {
      chips[c].setAttribute('aria-pressed', c === eraIdx ? 'true' : 'false');
      chips[c].lastChild.textContent = ERAS[c][lang].chip;
    }
    $('chips').setAttribute('aria-label', tr('erasLabel'));
    labelHexes();
    renderRead();
  }

  // ─── об авторе ───
  function renderAbout() {
    const text = String(ABOUT[lang] || '').trim();
    const section = $('author');
    if (!text) {
      section.hidden = true;
      return;
    }
    const name = String(pick(ABOUT.name)).trim();
    const nameEl = $('authorName');
    nameEl.textContent = name;
    nameEl.hidden = !name;
    const box = $('authorText');
    box.textContent = '';
    text.split(/\n\s*\n/).forEach((para) => {
      const p = document.createElement('p');
      p.textContent = para.trim();
      box.appendChild(p);
    });
    const linksEl = $('authorLinks');
    linksEl.textContent = '';
    const links = Array.isArray(ABOUT.links) ? ABOUT.links : [];
    links.forEach((l) => {
      if (!l || !l.href) return;
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = pick(l.label) || l.href;
      if (/^https?:/i.test(l.href)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      linksEl.appendChild(a);
    });
    linksEl.hidden = !linksEl.children.length;
    section.hidden = false;
  }

  // ─── применить язык ───
  function setMeta(sel, value) {
    const el = document.querySelector(sel);
    if (el) el.setAttribute('content', value);
  }
  function applyLang() {
    document.documentElement.lang = HTML_LANG[lang];
    document.title = tr('title');
    setMeta('meta[name="description"]', tr('desc'));
    setMeta('meta[property="og:title"]', tr('title'));
    setMeta('meta[property="og:description"]', tr('desc'));
    document.querySelectorAll('[data-i]').forEach((el) => {
      const s = tr(el.getAttribute('data-i'));
      if (s) el.textContent = s;
    });
    document.querySelectorAll('[data-alt]').forEach((el) => {
      const s = tr(el.getAttribute('data-alt'));
      if (s) el.setAttribute('alt', s);
    });
    document.querySelectorAll('.lang button').forEach((b) => {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
    renderEra();
    renderAbout();
  }

  function init() {
    coverFront = $('coverA');
    coverBack = $('coverB');
    buildIsland();
    buildChips();
    document.querySelectorAll('.lang button').forEach((b) => {
      b.addEventListener('click', () => {
        lang = b.getAttribute('data-lang');
        try {
          localStorage.setItem(LANG_KEY, lang);
        } catch (e) {
          /* приватный режим */
        }
        applyLang();
      });
    });
    setEra(0, false);
    select(sel);
    applyLang();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
