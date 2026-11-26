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

  // ─── тексты: русский уже в разметке, здесь — казахский и английский ───
  // [kz, en]; ключ совпадает с data-i / data-alt / data-al в index.html.
  const T = {
    play: ['Ойнау', 'Play'],
    playFree: ['Тегін ойнау', 'Play free'],
    howTurn: ['Жүріс қалай өтеді', 'How a turn works'],
    footPlay: ['Ойынды ашу', 'Open the game'],
    h1a: ['Сал.', 'Build.'],
    h1b: ['Айырбаста.', 'Trade.'],
    h1c: ['Жауды қайтар.', 'Repel the raid.'],
    lead: [
      'HistoricalHex — гекстегі үстел стратегиясы. Әр ойын өз дәуірінде өтеді: Шыңғыс хан ордасы, самурайлар Жапониясы, 1941 жылғы тыл. Тегін, тікелей браузерде.',
      'HistoricalHex is a hex board strategy game. Every game is set in its own era: the horde of Genghis Khan, samurai Japan, the home front of 1941. Free, right in the browser.',
    ],
    f1: ['2–6 ойыншы', '2–6 players'],
    f2: ['6 дәуір', '6 eras'],
    f3: ['3 минутта үйренесің', '3-minute tutorial'],
    f4: ['Орнатудың қажеті жоқ', 'No install'],
    seven: ['Жеті!', 'Seven!'],
    warSub: ['Жеті түсті — аралға шапқыншылық келе жатыр.', 'Roll a seven and a raid hits the island.'],
    warText: [
      'Басқыншылар гексті басып алады да, ол иелеріне табыс бермей қалады. Әр дәуірдің жауы да, келу тәсілі де бөлек: ұшақтар тобы, атты әскер, шатырдағы көлеңкелер. Жауынгер картасы оларды қуып шығады — ол да өз дәуірінше.',
      'Raiders take a hex and it stops paying its owners. Every era has its own enemy with its own entrance: a bomber wing, mounted archers, shadows on the rooftops. The knight card drives them off, in period style too.',
    ],
    reelsLabel: ['Шапқыншылық көріністері', 'Raid scenes'],
    eraWw2: ['Бәрі де майдан үшін, 1941–1945', 'Home Front, 1941–1945'],
    eraGenghis: ['Шыңғыс хан дәуірі, 1206–1269', 'Age of Genghis Khan, 1206–1269'],
    eraJapan: ['Самурайлар Жапониясы, 1467–1639', 'Samurai Japan, 1467–1639'],
    r1T: ['Әуе шабуылы', 'Air raid'],
    r1P: ['Бомбалаушылар тобы арал үстінен ұшып өтеді. Жарылыс, түтін — бүкіл арал сұр тартады.', 'A bomber wing crosses the island. A blast, smoke, and the whole island turns grey.'],
    r2T: ['Танк колоннасы', 'Tank column'],
    r2P: ['Жауынгер картасын ойнасаң, колонна басқыншыларды ығыстырып, өзгенің гексіне айдайды.', "Play the knight card and the column pushes the raiders off, onto someone else's hex."],
    r3T: ['Барымта', 'Barymta'],
    r3P: ['Атты садақшылар гекске лап қояды. Гекс табыссыз қалады, ал көршінің бір картасы қолды болады.', 'Mounted archers sweep onto a hex. It stops paying, and a neighbour loses a card.'],
    r4T: ['Ниндзя', 'Ninja'],
    r4P: ['Күріш алқабына көлеңкелер келеді. Самурайлар бөтендерді қумайынша, гекс үнсіз тұрады.', 'Shadows slip into the rice paddies. The hex stays silent until samurai drive the intruders out.'],
    warNote: ['Айтпақшы: қолында жеті картадан артық болса — жартысын тастайды.', 'One more thing: anyone holding more than seven cards discards half.'],
    turnH: ['Бір жүріс — алты қадам', 'One turn, six steps'],
    turnP: ['Оқып шық — үстелге отыра беруге болады. Қалғанын ойындағы үш минуттық оқу көрсетеді.', 'Read this and you can sit down at the table. The 3-minute in-game tutorial covers the rest.'],
    s1T: ['Сүйек лақтыр', 'Roll the dice'],
    s1P: ['Екі сүйектің қосындысы осы жүрісте қай гекстер табыс беретінін шешеді.', 'The sum of two dice decides which hexes pay this turn.'],
    s2T: ['Өнім жина', 'Collect the harvest'],
    s2P: [
      'Түскен саны бар гекс жанына салғандардың бәріне төлейді: ағаш, кірпіш, жүн, астық, кен. Кімге не келетінін үстел жиынтығы көрсетеді.',
      'The hex with the rolled number pays everyone built next to it: wood, brick, wool, grain, ore. The table summary shows who gets what.',
    ],
    s3T: ['Саудалас', 'Trade'],
    s3P: [
      'Ойыншылармен және порттармен айырбаста. Қарсы ұсыныс — бір түртумен, ал боттың ұсынысына жауап беруге 8 секунд бар.',
      "Swap with players and ports. Counter-offer in one tap; a bot's offer waits 8 seconds for your answer.",
    ],
    s4T: ['Сал', 'Build'],
    s4P: ['Жолдар, қоныстар, қалалар және даму карталары. Ресурсың неге жететінін ойын өзі айтып тұрады.', 'Roads, settlements, cities and development cards. The game tells you what you can already afford.'],
    s5T: ['Жетіден аман өт', 'Survive the seven'],
    s5P: ['Жеті түссе, басқыншылар гексті басып алып, бір картаны тартып алады. Оларды жауынгер картасы қуа алады.', 'On a seven, raiders take a hex and steal a card. The knight card can drive them off.'],
    s6T: ['10 ұпай жина', 'Reach 10 points'],
    s6P: [
      'Ұпайды қоныстар, қалалар және ең күшті әскер сияқты бонустар береді. Онға бірінші жеткен ойыншы жеңеді.',
      'Points come from settlements, cities and bonuses like the strongest army. First to ten takes the game.',
    ],
    islH: ['Қай гекс жиі береді', 'Which hex pays more often'],
    islP: ['Кез келген гексті басып, оның саны қаншалықты жиі түсетінін көр.', 'Tap any hex to see how often its number comes up.'],
    tvH: ['Бүкіл бөлмеге бір экран', 'One screen for the whole room'],
    tvP: [
      'ТВ режимі алаңды, есепті, өнім кестесін және жүрістер журналын үлкен экранға шығарады. Әркім өз телефонынан жүреді, ал шапқыншылықты бәрі бірге көреді.',
      'TV mode puts the board, score, harvest table and move log on the big screen. Everyone plays from their own phone and watches the raid together.',
    ],
    w1T: ['Бір үстел басында', 'Around one table'],
    w1P: ['Карталар әркімнің өз телефонында. Қорап та жоқ, жоғалған фишка да жоқ.', "Everyone's cards stay on their own phone. No box, no lost pieces."],
    w2T: ['Онлайн', 'Online'],
    w2P: ['Алты таңбалы PIN немесе QR-код — достарың қайда жүрсе де ойынға кіреді.', 'A six-digit PIN or a QR code, and your friends are in, wherever they are.'],
    w3T: ['Жалғыз қалсаң', 'Home alone'],
    w3P: ['Үш деңгейлі боттар мен өз рейтингі бар ЖИ-кейіпкерлер үстелге бірден отырады.', 'Bots at three levels and AI characters with their own ratings sit down right away.'],
    erasH: ['Алты дәуір — алты арал', 'Six eras, six islands'],
    erasP: [
      'Ереже біреу, ал әлем әр жолы жаңа: өз суреттері, жер атаулары, музыкасы және жетіде келетін өз жауы бар.',
      'Same rules, a new world every time: its own art, place names, music and its own enemy on a seven.',
    ],
    moreH: ['Ойын өтуі үшін бәрі бар', 'Everything a game night needs'],
    m1T: ['Жүріс жоспарлаушы', 'Turn planner'],
    m1P: ['Басқалар жүріп жатқанда жүрісіңді ойластыр да, бір түртумен іске қос.', 'Plan while others move, then run it in one tap.'],
    m2T: ['Бірнеше күнге үзіліс', 'Pause for days'],
    m2P: ['Бүгін бітпей қалса — ойын күте тұрады.', "Didn't finish tonight? The game waits."],
    m3T: ['Көрермендер', 'Spectators'],
    m3P: ['Өзгелердің ойынын тікелей көріп, реакция жібер.', 'Watch live games and send reactions.'],
    m4T: ['Достар мен шақырулар', 'Friends and invites'],
    m4P: ['Кім желіде екені көрініп тұрады. Ойынға екі түртумен шақыр.', "See who's online and invite them in a couple of taps."],
    m5T: ['Рейтинг пен көшбасшылар', 'Rating and streaks'],
    m5P: ['Рейтинг, қатарынан ойнаған күндер және көшбасшылар кестесі.', 'A rating, day streaks and a leaderboard.'],
    m6T: ['Үш тілдегі ережелер', 'Rules in three languages'],
    m6P: ['3 минуттық оқу және толық анықтамалық: қазақ, орыс және ағылшын тілдерінде.', 'A 3-minute tutorial and the full rulebook in Russian, Kazakh and English.'],
    m7T: ['2D және 3D', '2D and 3D'],
    m7P: ['Суретті алаң немесе көлемді арал — қалаған кезде ауыстыр.', 'An illustrated board or a 3D island. Switch whenever you like.'],
    m8T: ['Қосымша сияқты', 'Works as an app'],
    m8P: ['Басты экранға қос та, кәдімгі қосымшадай аш. Дүкеннің қажеті жоқ.', 'Add it to your home screen and open it like any app. No store needed.'],
    authorH: ['Автор туралы', 'About the author'],
    finH: ['Достарыңды жина. Жеті таяп қалды.', 'Gather the table. The seven is coming.'],
    finP: ['Тегін, орнатусыз, тікелей браузерде. Алғашқы ойын бір минуттан кейін басталады.', 'Free, no install, right in the browser. Your first game starts in a minute.'],
    // alt и aria-label
    altBombers: ['Ойыннан жазба: бомбалаушылар арал үстінен ұшып өтеді, гексте жарылыс', 'In-game footage: bombers fly over the island, an explosion on a hex'],
    altTanks: ['Ойыннан жазба: танк колоннасы гекске шығып, оқ атады', 'In-game footage: a tank column rolls onto a hex and fires'],
    altGenghis: ['Ойыннан жазба: атты садақшылар гекске шабуыл жасайды', 'In-game footage: mounted archers raid a hex'],
    altNinja: ['Ойыннан жазба: ниндзялар гексті басып алады', 'In-game footage: ninja take over a hex'],
    altS1: ['Қазақ хандығының 3D аралы және «Сүйек лақтыру» батырмасы', 'The 3D island of the Kazakh Khanate and the “Roll the dice” button'],
    altS2: ['Үстел жиынтығы: әр лақтырыста кімге қандай ресурс келеді', 'Table summary: which resource goes to whom on each roll'],
    altS3: ['Келген айырбас карточкасы және қарсы ұсыныс батырмасы', 'An incoming trade card with a counter-offer button'],
    altS4: ['Жапонияның 3D аралы, құрылыс панелі және қонысқа не жетпейтіні туралы кеңес', 'The 3D island of Japan, the build bar and a hint about what a settlement still needs'],
    altS5: ['«Жеті!» көрінісі: қарақшылар даланы тонап жатыр', 'The “Seven!” cinematic: raiders plunder the steppe'],
    altS6: ['Ойыншылардың қоныстары, қалалары мен жолдары бар суретті 2D алаң', 'The illustrated 2D board with players’ settlements, cities and roads'],
    altTv: [
      'ТВ режимі: алаң үстіндегі атты садақшылар бар «Жеті! Барымта» көрінісі, ойыншылар тізімі, өнім кестесі, жүрістер журналы және кіруге арналған QR',
      'TV mode: the “Seven! Barymta” cinematic with mounted archers over the board, the player list, harvest table, move log and a QR code to join',
    ],
    altLobby: ['Ойын лоббиі: QR-код, кіруге арналған PIN, «ТВ-ға» батырмасы және боттарға арналған орындар', 'Game lobby: QR code, join PIN, a “To TV” button and seats for bots'],
    altHome: [
      'Басты экран: Шыңғыс хан дәуірінің мұқабасы, «Жаңа ойын» және «PIN арқылы» батырмалары, рейтинг пен достар',
      'Home screen: the Genghis Khan era cover, “New game” and “By PIN” buttons, rating and friends',
    ],
    altTanksShot: ['«Бәрі де майдан үшін» дәуіріндегі гекстегі танк колоннасы', 'A tank column on a hex in the Home Front era'],
  };

  // Строки с подстановками и мета — на всех трёх языках.
  const STR = {
    title: {
      ru: 'HistoricalHex — настольная стратегия на гексах в исторических эпохах',
      kz: 'HistoricalHex — тарихи дәуірлердегі гекс үстел стратегиясы',
      en: 'HistoricalHex — a hex board strategy game set in historical eras',
    },
    desc: {
      ru: 'Строй, торгуй и отбивай набеги: бесплатная настольная игра на гексах для 2–6 игроков. Чингисхан, Япония самураев, тыл 1941–1945, Казахское ханство, Шёлковый путь, саки. С телефона за одним столом или онлайн.',
      kz: 'Сал, айырбаста, шапқыншылықты тойтар: 2–6 ойыншыға арналған тегін гекс үстел ойыны. Шыңғыс хан, самурайлар Жапониясы, 1941–1945 жылдардағы тыл, Қазақ хандығы, Жібек жолы, сақтар. Телефоннан бір үстел басында немесе онлайн.',
      en: 'Build, trade and fight off raids: a free hex board game for 2–6 players. Genghis Khan, samurai Japan, the 1941–1945 home front, the Kazakh Khanate, the Silk Road, the Saka. From your phone, around one table or online.',
    },
    ogDesc: {
      ru: 'Строй, торгуй и отбивай набеги. Каждая партия — в своей эпохе. С телефона за одним столом или онлайн, бесплатно.',
      kz: 'Сал, айырбаста, шапқыншылықты тойтар. Әр ойын өз дәуірінде. Телефоннан бір үстел басында немесе онлайн, тегін.',
      en: 'Build, trade and fight off raids. Every game in its own era. From your phone, around one table or online, free.',
    },
    gives: { ru: 'даёт: {res}', kz: '{res} береді', en: 'gives {res}' },
    prob: {
      ru: '{n} выпадает в {p} бросках из 36 — около {pct}%.',
      kz: '{n} саны 36 лақтырыстың шамамен {p}-інде түседі — {pct}%.',
      en: '{n} comes up in {p} of 36 rolls, about {pct}%.',
    },
    hot: {
      ru: '6 и 8 — самые частые числа, рядом с ними строятся первыми.',
      kz: '6 мен 8 — ең жиі түсетін сандар, солардың жанына салған дұрыс.',
      en: '6 and 8 are the most frequent numbers. Build next to them first.',
    },
    rare: { ru: 'Реже не бывает.', kz: 'Бұдан сирек түсетін сан жоқ.', en: 'It does not get rarer than that.' },
    desertRes: { ru: 'ничего не даёт', kz: 'ештеңе бермейді', en: 'gives nothing' },
    desertText: {
      ru: 'На этом гексе нет числа. Отсюда начинают захватчики.',
      kz: 'Бұл гексте сан жоқ. Басқыншылар осы жерден бастайды.',
      en: 'This hex has no number. The raiders start here.',
    },
    island: { ru: 'Остров: нажми на гекс', kz: 'Арал: гексті бас', en: 'Island: tap a hex' },
    erasLabel: { ru: 'Эпохи', kz: 'Дәуірлер', en: 'Eras' },
    coverAlt: { ru: 'Обложка эпохи: {t}', kz: 'Дәуір мұқабасы: {t}', en: 'Era cover art: {t}' },
    boardAlt: { ru: '3D-остров эпохи «{t}» в середине партии', kz: '«{t}» дәуірінің 3D аралы, ойын ортасы', en: 'The 3D island of the “{t}” era mid-game' },
  };
  const RES = {
    ru: { brick: 'кирпич', wood: 'дерево', sheep: 'шерсть', wheat: 'зерно', ore: 'руда' },
    kz: { brick: 'кірпіш', wood: 'ағаш', sheep: 'жүн', wheat: 'астық', ore: 'кен' },
    en: { brick: 'brick', wood: 'wood', sheep: 'wool', wheat: 'grain', ore: 'ore' },
  };
  const TERRAIN_RES = { forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore', desert: null };
  // Цвета местности — src/ui/theme.ts.
  const TERRAIN_COLOR = { forest: '#2f7d3a', hills: '#c3643d', pasture: '#8fc657', fields: '#e9c046', mountains: '#8c95a6', desert: '#e3cf9e' };

  // Эпохи: id и годы — из src/lore/packs/*. Обложка — ../eras/<id>.webp (как eraCover в src/app/era.ts).
  // t — местность в порядке: forest, hills, pasture, fields, mountains, desert.
  const ERAS = [
    {
      id: 'genghis',
      ru: { chip: 'Чингисхан', title: 'Эпоха Чингисхана', years: '1206–1269', sub: 'Великая степь, караваны Шёлкового пути и Улус Джучи', t: ['Алтайские леса', 'Глиняные холмы', 'Жайлау', 'Оазис', 'Рудные горы', 'Бетпак-Дала'] },
      kz: { chip: 'Шыңғыс хан', title: 'Шыңғыс хан дәуірі', years: '1206–1269', sub: 'Ұлы дала, Жібек жолының керуендері және Жошы ұлысы', t: ['Алтай ормандары', 'Саз төбелер', 'Жайлау', 'Оазис', 'Кенді таулар', 'Бетпақдала'] },
      en: { chip: 'Genghis Khan', title: 'The Age of Genghis Khan', years: '1206–1269', sub: 'The Great Steppe, Silk Road caravans and the Ulus of Jochi', t: ['Altai forests', 'Clay hills', 'Jailau', 'Oasis', 'Ore mountains', 'Betpak-Dala'] },
    },
    {
      id: 'japan',
      ru: { chip: 'Япония самураев', title: 'Страна восходящего солнца', years: '1467–1639', sub: 'Воюющие провинции, замки и рис: Япония от Сэнгоку до сёгуната Токугава', t: ['Кедровый лес', 'Каменоломня', 'Чайные холмы', 'Рисовые поля', 'Железные горы', 'Склон вулкана'] },
      kz: { chip: 'Самурайлар Жапониясы', title: 'Күншығыс елі', years: '1467–1639', sub: 'Соғысқан провинциялар, қамалдар мен күріш: Сэнгокудан Токугава сёгунатына дейінгі Жапония', t: ['Балқарағай орманы', 'Тас карьері', 'Шай төбелері', 'Күріш алқаптары', 'Темір таулар', 'Жанартау беткейі'] },
      en: { chip: 'Samurai Japan', title: 'Land of the Rising Sun', years: '1467–1639', sub: 'Warring provinces, castles and rice: Japan from Sengoku to the Tokugawa shogunate', t: ['Cedar forest', 'Quarry', 'Tea hills', 'Rice paddies', 'Iron mountains', 'Volcano slope'] },
    },
    {
      id: 'ww2',
      ru: { chip: 'Всё для фронта', title: 'Всё для фронта', years: '1941–1945', sub: 'Казахстан — тыл и арсенал в годы Второй мировой войны', t: ['Лесхоз', 'Угольные сопки', 'Отгонное пастбище', 'Колхозное поле', 'Рудник', 'Солончак'] },
      kz: { chip: 'Бәрі де майдан үшін', title: 'Бәрі де майдан үшін', years: '1941–1945', sub: 'Қазақстан — Екінші дүниежүзілік соғыс жылдарындағы тыл мен арсенал', t: ['Орман шаруашылығы', 'Көмірлі шоқылар', 'Шалғай жайылым', 'Колхоз егістігі', 'Кеніш', 'Сортаң'] },
      en: { chip: 'Home Front', title: 'Everything for the Front', years: '1941–1945', sub: 'Kazakhstan as home front and arsenal during the Second World War', t: ['Forestry', 'Coal hills', 'Distant pasture', 'Collective farm field', 'Mine', 'Salt flat'] },
    },
    {
      id: 'khanate',
      ru: { chip: 'Казахское ханство', title: 'Казахское ханство', years: '1465–1730', sub: 'Вольные люди степи: ханы, бии, батыры и Туркестан', t: ['Ельники Алатау', 'Кирпичные холмы', 'Жайлау', 'Просяные поля', 'Улытау', 'Мойынкум'] },
      kz: { chip: 'Қазақ хандығы', title: 'Қазақ хандығы', years: '1465–1730', sub: 'Даланың еркін халқы: хандар, билер, батырлар және Түркістан', t: ['Алатау шыршалары', 'Кірпіш төбелер', 'Жайлау', 'Тары егістігі', 'Ұлытау', 'Мойынқұм'] },
      en: { chip: 'Kazakh Khanate', title: 'The Kazakh Khanate', years: '1465–1730', sub: 'Free people of the steppe: khans, biys, batyrs and Turkestan', t: ['Alatau spruce forests', 'Brick hills', 'Jailau', 'Millet fields', 'Ulytau', 'Moiynkum'] },
    },
    {
      id: 'silk',
      ru: { chip: 'Шёлковый путь', title: 'Великий Шёлковый путь', years: 'VI–XII вв.', sub: 'Караваны, города-оазисы и серебро: от Тараза до Отрара', t: ['Тугаи', 'Глиняные карьеры', 'Тутовые сады', 'Бахчи', 'Серебряные рудники', 'Кызылкум'] },
      kz: { chip: 'Жібек жолы', title: 'Ұлы Жібек жолы', years: 'VI–XII ғғ.', sub: 'Керуендер, оазис-қалалар мен күміс: Тараздан Отырарға дейін', t: ['Тоғайлар', 'Саз карьерлері', 'Тұт бақтары', 'Бақшалар', 'Күміс кеніштері', 'Қызылқұм'] },
      en: { chip: 'Silk Road', title: 'The Great Silk Road', years: '6th–12th c.', sub: 'Caravans, oasis cities and silver: from Taraz to Otrar', t: ['Tugai woods', 'Clay pits', 'Mulberry orchards', 'Melon fields', 'Silver mines', 'Kyzylkum'] },
    },
    {
      id: 'saka',
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
  const RU = {}; // русские строки из разметки, запоминаются при первом проходе

  const doc = document;
  const $ = (id) => doc.getElementById(id);
  const all = (q) => Array.prototype.slice.call(doc.querySelectorAll(q));
  const tr = (key) => (STR[key] && (STR[key][lang] || STR[key].ru)) || '';
  const pick = (v) => (v && typeof v === 'object' ? v[lang] || v.ru || '' : v || '');
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : String(vars[k])));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs) => {
    const el = doc.createElementNS(SVG, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hasIO = 'IntersectionObserver' in window;

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
      row.forEach((cell) => {
        const terrain = cell[0];
        const num = cell[1];
        const x = (row.indexOf(cell) - (row.length - 1) / 2) * W;
        const y = (r - 2) * S * 1.5;
        const pips = num ? 6 - Math.abs(7 - num) : 0;
        // внешняя группа держит позицию, внутренняя — увеличивается при выборе
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
    for (let d = 0; d < 36; d++) dots.appendChild(doc.createElement('i'));
  }

  function terrainName(terrain) {
    return ERAS[eraIdx][lang].t[T_ORDER.indexOf(terrain)];
  }

  function select(idx) {
    sel = idx;
    hexes.forEach((h, i) => {
      const on = i === idx;
      h.g.setAttribute('class', 'hex' + (h.num === 6 || h.num === 8 ? ' hot' : '') + (on ? ' on' : ''));
      h.g.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    // выбранный гекс — поверх соседей
    const h = hexes[idx];
    const hadFocus = doc.activeElement === h.g;
    h.pos.parentNode.appendChild(h.pos);
    if (hadFocus) h.g.focus();
    renderRead();
  }

  function resIcon(res, size) {
    const img = new Image();
    img.alt = '';
    img.width = size;
    img.height = size;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = '../eras/' + ERAS[eraIdx].id + '/res-' + res + '.webp'; // как eraIcon в src/app/era.ts
    return img;
  }

  function renderRead() {
    const h = hexes[sel];
    const res = TERRAIN_RES[h.terrain];
    $('readName').textContent = terrainName(h.terrain);
    const ic = $('readIc');
    ic.textContent = '';
    if (res) {
      ic.appendChild(resIcon(res, 48));
      $('readRes').textContent = cap(fill(tr('gives'), { res: RES[lang][res] }));
      let text = fill(tr('prob'), { n: h.num, p: h.pips, pct: Math.round((h.pips / 36) * 100) });
      if (h.pips === 5) text += ' ' + tr('hot');
      if (h.pips === 1) text += ' ' + tr('rare');
      $('readText').textContent = text;
    } else {
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
  const tabs = [];
  function buildTabs() {
    const box = $('eraTabs');
    ERAS.forEach((era, i) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'eraPanel');
      const img = new Image();
      img.alt = '';
      img.width = 34;
      img.height = 34;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = '../eras/' + era.id + '/emblem.webp';
      b.appendChild(img);
      b.appendChild(doc.createElement('span'));
      b.addEventListener('click', () => setEra(i, true));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = (i + d + ERAS.length) % ERAS.length;
        setEra(n, true);
        tabs[n].focus();
      });
      box.appendChild(b);
      tabs.push(b);
    });
  }

  function setEra(i, swap) {
    eraIdx = i;
    const era = ERAS[i];
    const panel = $('eraPanel');
    const cover = $('eraCover');
    const board = $('eraBoard');
    if (swap) {
      // короткое затемнение, пока грузится новая картинка
      panel.classList.add('swap');
      let left = 2;
      const done = () => {
        if (--left <= 0) panel.classList.remove('swap');
      };
      cover.onload = cover.onerror = done;
      board.onload = board.onerror = done;
      setTimeout(() => panel.classList.remove('swap'), 900);
    }
    cover.srcset = '../eras/' + era.id + '-md.webp 800w, ../eras/' + era.id + '.webp 1280w';
    cover.src = '../eras/' + era.id + '-md.webp';
    board.srcset = './shots/sm/board3d-' + era.id + '.webp 560w, ./shots/board3d-' + era.id + '.webp 780w';
    board.sizes = '(min-width: 700px) 260px, 40vw';
    board.src = './shots/sm/board3d-' + era.id + '.webp';
    renderEra();
  }

  function renderEra() {
    const era = ERAS[eraIdx];
    const L = era[lang];
    tabs.forEach((b, i) => {
      b.lastChild.textContent = ERAS[i][lang].chip;
      b.setAttribute('aria-selected', i === eraIdx ? 'true' : 'false');
      b.tabIndex = i === eraIdx ? 0 : -1;
    });
    $('eraTabs').setAttribute('aria-label', tr('erasLabel'));
    $('eraYears').textContent = L.years;
    $('eraTitle').textContent = L.title;
    $('eraSub').textContent = L.sub;
    $('eraCover').alt = fill(tr('coverAlt'), { t: L.title });
    $('eraBoard').alt = fill(tr('boardAlt'), { t: L.title });
    const lands = $('lands');
    lands.textContent = '';
    T_ORDER.forEach((terrain, k) => {
      const res = TERRAIN_RES[terrain];
      if (!res) return;
      const li = doc.createElement('li');
      li.appendChild(resIcon(res, 30));
      li.appendChild(doc.createTextNode(L.t[k]));
      lands.appendChild(li);
    });
    labelHexes();
    renderRead();
  }

  // ─── ход: на широком экране — один «липкий» телефон, кадр меняется по шагам ───
  function initTurn() {
    const steps = all('.step');
    const stage = $('stage');
    const wide = window.matchMedia ? matchMedia('(min-width: 1024px)') : null;
    let frames = null;
    let cur = 0;
    function build() {
      if (frames || !wide || !wide.matches) return;
      frames = steps.map((li) => {
        const src = li.querySelector('img');
        const img = new Image();
        img.alt = '';
        img.width = 560;
        img.height = 1212;
        img.decoding = 'async';
        img.srcset = src.getAttribute('srcset');
        img.sizes = '320px';
        img.src = src.getAttribute('src');
        stage.appendChild(img);
        return img;
      });
      show(cur);
    }
    function show(i) {
      cur = i;
      steps.forEach((li, k) => li.classList.toggle('on', k === i));
      if (frames) frames.forEach((img, k) => img.classList.toggle('on', k === i));
    }
    steps.forEach((li, i) => {
      li.addEventListener('click', () => show(i));
      li.addEventListener('mouseenter', () => {
        if (wide && wide.matches) show(i);
      });
    });
    show(0);
    if (!wide) return;
    if (hasIO) {
      // телефон собирается, только когда секция рядом: шесть кадров не грузятся зря
      const near = new IntersectionObserver(
        (es) => {
          if (es.some((e) => e.isIntersecting)) {
            build();
            if (frames) near.disconnect();
          }
        },
        { rootMargin: '600px 0px' }
      );
      near.observe($('turn'));
      const mid = new IntersectionObserver(
        (es) => {
          es.forEach((e) => {
            if (e.isIntersecting) show(steps.indexOf(e.target));
          });
        },
        { rootMargin: '-46% 0px -46% 0px' }
      );
      steps.forEach((li) => mid.observe(li));
    } else build();
    const onChange = () => build();
    if (wide.addEventListener) wide.addEventListener('change', onChange);
    else if (wide.addListener) wide.addListener(onChange);
  }

  // ─── видео: в разметке только кадры-постеры; <video> создаётся рядом с экраном,
  //     играет только в кадре; при reduced-motion — постер и ручной запуск ───
  function initVideo() {
    const stills = all('img[data-clip]');
    if (!hasIO) return;
    const play = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting && e.intersectionRatio >= 0.45) {
            const p = v.play();
            if (p && p.catch) p.catch(() => {});
          } else if (!v.paused) v.pause();
        });
      },
      { threshold: [0, 0.45, 0.9] }
    );
    function mount(img) {
      const v = doc.createElement('video');
      v.className = 'clip';
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.preload = 'none';
      v.width = 540;
      v.height = 1168;
      v.poster = img.currentSrc || img.src;
      v.setAttribute('aria-label', img.alt);
      const src = doc.createElement('source');
      src.src = './media/' + img.getAttribute('data-clip') + '.mp4';
      src.type = 'video/mp4';
      v.appendChild(src);
      img.parentNode.appendChild(v); // поверх постера: без мигания, пока видео грузится
      if (reduced) v.controls = true;
      else play.observe(v);
    }
    const near = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          near.unobserve(e.target);
          mount(e.target);
        });
      },
      { rootMargin: '300px 0px' }
    );
    const start = () => stills.forEach((img) => near.observe(img));
    // не соревнуемся с первой отрисовкой: видео появляются после load
    if (doc.readyState === 'complete') setTimeout(start, 300);
    else window.addEventListener('load', () => setTimeout(start, 300));
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) all('video.clip').forEach((v) => v.pause());
    });
  }

  // ─── сцена «Семь!» и шапка ───
  function initScroll() {
    const war = $('war');
    const top = $('top');
    if (!hasIO) {
      war.classList.add('in');
      top.classList.add('solid');
      return;
    }
    const once = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting) {
          war.classList.add('in');
          once.disconnect();
        }
      },
      { rootMargin: '0px 0px -35% 0px' }
    );
    once.observe(war.querySelector('.war-head'));
    const sentinel = doc.createElement('i');
    // шапка получает фон сразу после начала прокрутки — текст под логотипом не просвечивает
    sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:40px;pointer-events:none';
    doc.body.appendChild(sentinel);
    new IntersectionObserver((es) => top.classList.toggle('solid', !es[0].isIntersecting)).observe(sentinel);
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
      const p = doc.createElement('p');
      p.textContent = para.trim();
      box.appendChild(p);
    });
    const linksEl = $('authorLinks');
    linksEl.textContent = '';
    const links = Array.isArray(ABOUT.links) ? ABOUT.links : [];
    links.forEach((l) => {
      if (!l || !l.href) return;
      const a = doc.createElement('a');
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
  function setMeta(q, value) {
    const el = doc.querySelector(q);
    if (el) el.setAttribute('content', value);
  }
  // attr: null — текст узла, иначе имя атрибута; русский берётся из разметки
  function localize(dataAttr, attr) {
    all('[' + dataAttr + ']').forEach((el) => {
      const key = el.getAttribute(dataAttr);
      const id = dataAttr + ':' + key;
      if (!(id in RU)) RU[id] = attr ? el.getAttribute(attr) : el.textContent;
      const row = T[key];
      const s = lang === 'ru' || !row ? RU[id] : row[lang === 'kz' ? 0 : 1];
      if (attr) el.setAttribute(attr, s);
      else if (el.textContent !== s) el.textContent = s;
    });
  }
  function applyLang() {
    doc.documentElement.lang = HTML_LANG[lang];
    doc.title = tr('title');
    setMeta('meta[name="description"]', tr('desc'));
    setMeta('meta[property="og:title"]', tr('title'));
    setMeta('meta[property="og:description"]', tr('ogDesc'));
    localize('data-i', null);
    localize('data-alt', 'alt');
    localize('data-al', 'aria-label');
    all('video.clip').forEach((v) => v.setAttribute('aria-label', v.parentNode.querySelector('img').alt));
    all('.lang button').forEach((b) => {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
    renderEra();
    renderAbout();
  }

  function init() {
    doc.documentElement.classList.add('js');
    buildIsland();
    buildTabs();
    all('.lang button').forEach((b) => {
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
    select(sel);
    applyLang();
    initTurn();
    initScroll();
    initVideo();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
