import type { LoreTr } from './types';

// Перевод пакета «japan» (названия, вступление, рассказчик). Факты — в japan.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Шығып келе жатқан күн елі',
    short: 'Самурай Жапониясы',
    subtitle: 'Соғысушы провинциялар, қамалдар мен күріш: Сэнгокудан Токугава сёгунатына дейінгі Жапония',
    years: '1467–1639',
    region: 'Жапон аралдары: Киото, Осака, Эдо, Токайдо жолы',
    resources: {
      brick: { name: 'Кірпіш', note: 'Саз кірпіш пен қыш қаптама — қамал мен ғибадатхана қабырғасына.' },
      wood: { name: 'Ағаш', note: 'Ғибадатхана, көпір, кеме және қамал мұнараларына арналған ағаш.' },
      sheep: { name: 'Жүн', note: 'Тау жайылымдарының жүні — жылы киім мен жорыққа арналған киізге.' },
      wheat: { name: 'Астық', note: 'Елдің басты байлығы: салық пен жалақыны күрішпен төлеген, князьдіктің күшін күрішпен өлшеген.' },
      ore: { name: 'Кен', note: 'Одан қылыш, сауыт және аркебуза түтіктерін соққан.' },
    },
    terrains: {
      hills: { name: 'Тас қазбасы', note: 'Мұнда қамал қабырғасына тас қалайды.' },
      forest: { name: 'Кедр орманы', note: 'Тау криптомерия мен кипарис ормандары.' },
      pasture: { name: 'Шай төбелері', note: 'Беткейдегі шай бұталарының тегіс қатарлары.' },
      fields: { name: 'Күріш алқаптары', note: 'Су басқан террасалар: бүкіл ауылдың еңбегі.' },
      mountains: { name: 'Темір таулары', note: 'Таудағы кеніштер мен балқыту пештері.' },
      desert: { name: 'Жанартау беткейі', note: 'Күл мен қатқан лава. Мұнда ниндзя тығылады.' },
    },
    pieces: { road: 'Тракт', settlement: 'Ауыл', city: 'Қамал' },
    devCards: {
      knight: { name: 'Самурай', flavor: 'Адал жауынгер тыңшыны аңдып, қуып жібереді.' },
      victoryPoint: { name: 'Шай рәсімі', flavor: 'Шай шебері сізді қонақ етті: үлкен құрмет пен даңқ.' },
      roadBuilding: { name: 'Пошта бекеттері', flavor: 'Қонақүйлері бар тракттың екі жаңа бөлігі.' },
      yearOfPlenty: { name: 'Мол өнім', flavor: 'Күз жомарт: қамбалар толы, керегіңді ал.' },
      monopoly: { name: 'Күріш биржасы', flavor: 'Осака саудагерлері бір тауарды бүкіл елден сатып алды.' },
    },
    robber: {
      name: 'Ниндзя',
      note: 'Синоби-тыңшы. Ол телімде тұрғанда ол ештеңе бермейді, ал көршінің мүлкі жоғалып кетуі мүмкін.',
    },
    bonuses: { longestRoad: 'Токайдо тракты', largestArmy: 'Ең күшті жасақ' },
    intro: [
      'XV–XVI ғасырлардағы Жапония. Сёгун билігінен айырылып, ел даймё-князьдердің иеліктеріне бөлінді. Жүз жыл бойы олар аралдарды кім біріктіретінін таластырады. Бұл кезеңді Сэнгоку — «соғысушы провинциялар дәуірі» дейді.',
      'Мұндағы байлықты алтынмен емес, күрішпен санайды. Жер қанша күріш берсе, князь сонша жауынгерді асырайды. Күріш алқаптарының үстінде ақ мұнаралы қамалдар өседі.',
      'Жолдармен жаяу асигару жауынгерлері, монахтар, шай мен жібек артқан саудагерлер жүреді. Негізгі тракт — Токайдо — ескі астана Киотоны жаңа Эдо қаласымен жалғайды.',
      'Ауыл мен қамал салыңдар, трактілер тартыңдар, күріш пен шай жинаңдар. Көлеңкелерге де назар аударыңдар: айналада ниндзя көрінген дейді.',
    ],
    narration: {
      gameStarted: [
        'Провинциялар ие күтіп тұр. Князьдер, атқа қонындар — ойын басталды!',
        'Күріш алқаптарының үстінде таң. Аралдарды кім біріктіреді?',
        'Шай демделді, қылыштар қайралды, сүйектер лақтырылды. Бастаймыз!',
      ],
      settlement: [
        '{player}: жаңа ауыл — шаруалар күріш егіп жатыр.',
        '{player} — жол бойындағы ауыл. Түтін мен жаңа сабан иісі аңқиды.',
        '{player}: адамдар алқапқа қоныстанды. Өнім алыс емес.',
      ],
      city: [
        '{player}: қамал — ақ мұнарасы үш күндік жерден көрінеді.',
        '{player} — ауыл қамал қаласына айналды. Саудагерлер де жетті.',
        '{player}: тас іргелі, орлы қамал.',
      ],
      road: [
        '{player}: жаңа тракт. Жолаушылар иіліп, әрі өтеді.',
        '{player} — асуда шай үйі бар жолдың жаңа бөлігі.',
        '{player}: төбелер арасындағы жол төселді. Хабаршылар риза.',
      ],
      seven: [
        'Жеті түсті! Қараңғыда көлеңке жылт етті — ниндзя іске шықты.',
        'Жеті: қамбасы толғандар жартысымен қоштасады.',
        'Жеті! Күзет шамдарын жағуда, бірақ кеш болды.',
      ],
      robberMoved: [
        '{player}: ниндзяға жаңа тығылатын жер табылды. Онда енді ешкім жұмыс істемейді.',
        'Ниндзя жаңа телімге ауысты. {player} — жүріс жасалды, телім тына қалды.',
        '{player} — көлеңке егістіктер арқылы бөтен жерге сырғыды.',
      ],
      stole: [
        'Қамбада ниндзя: {victim} → {player}. Қамал бүтін, мүлік азайды.',
        'Қор күрсініспен қайта саналды: {victim} → {player}. Шай суып үлгерген жоқ.',
        'Үнсіз, ізсіз: {victim} → {player}.',
      ],
      knight: [
        '{player}: самурай аттанды — ниндзя түтінге сіңіп кетті.',
        '{player} — самурай жерлерді күзетпен аралады. Бөтеннің мұнда жөні жоқ.',
        '{player}: күзет қойылды, тыңшы оңай олжа іздеп кетті.',
      ],
      monopoly: [
        '{player}: саудагерлер елдегі бүкіл {res} сатып алды — {count} дана. Міне, саудасы!',
        'Күріш биржасы жабылды: бүкіл {res} бір қамбада, барлығы {count}. Саудада жеңген — {player}.',
        '{player} — {res} барлық провинциядан жиналды: {count} дана.',
      ],
      yearOfPlenty: [
        '{player}: жомарт күз, мол өнімнен екі сыйлық.',
        '{player} — қамбалар толы, жетпегенді таңдауға болады.',
        '{player}: шаруалар тойлап жатыр, жыл сәтті болды.',
      ],
      roadBuilding: [
        '{player}: екі пошта бекеті — тракт ұзарды.',
        '{player} — қонатын жері мен жаңа аттары бар екі жаңа аралық.',
        '{player}: жол бірден екі бөлікке ұзарды. Токайдо өсіп келеді!',
      ],
      longestRoad: [
        '{player}: ең ұзын жол — нағыз Токайдо тракты!',
        '{player} — бүкіл ел бекеттен бекетке жүріп келеді.',
        '{player}: Токайдо оның қолында. Суретшілер көрініс салып жатыр.',
      ],
      largestArmy: [
        '{player}: ең күшті жасақ. Көршілер сый жібереді.',
        '{player} — ту астында самурай ең көп.',
        '{player}: провинциялардағы ең мықты әскер.',
      ],
      tradeCompleted: [
        '{player} мен {victim} тауар мен иілу алмасты.',
        'Келісім бір кесе шай үстінде жасалды: {player} мен {victim} риза.',
        'Саудагерлер қол соғысты: {player} мен {victim}.',
      ],
      bigHarvest: [
        'Мол өнім! {player}: бірден {n} карта.',
        '{player} — қамбалар жарылып барады: бір лақтырыста {n} карта.',
        '{player}: өнім құдайлары күлді, {n} карта.',
      ],
      gameWon: [
        '{player} — провинциялар біріктірілді. Елге бейбітшілік келеді!',
        'Князьдер туларын түсіріп жатыр: жеңімпаз — {player}.',
        '{player}: князьдердің ішіндегі бірінші. Шай ішіп, сакураға тамашалайтын кез.',
      ],
    },
    victory: 'Жеңімпаз — {player}: провинциялар біріктіріліп, елге бейбітшілік орнады. Күріш жиналды, жолдар тыныш: шай демдейтін уақыт.',
  },
  en: {
    title: 'Land of the Rising Sun',
    short: 'Samurai Japan',
    subtitle: 'Warring provinces, castles and rice: Japan from Sengoku to the Tokugawa shogunate',
    years: '1467–1639',
    region: 'The Japanese islands: Kyoto, Osaka, Edo, the Tokaido road',
    resources: {
      brick: { name: 'Brick', note: 'Clay brick and roof tile for castle and temple walls.' },
      wood: { name: 'Timber', note: 'Timber for temples, bridges, ships and castle towers.' },
      sheep: { name: 'Wool', note: 'Wool from mountain pastures, for warm clothing and campaign felt.' },
      wheat: { name: 'Rice', note: 'The nation\'s chief wealth: taxes and stipends were paid in rice, and the strength of a domain was counted in it.' },
      ore: { name: 'Iron', note: 'From it swords, armor and arquebus barrels were forged.' },
    },
    terrains: {
      hills: { name: 'Quarry', note: 'Stone is cut here for castle walls.' },
      forest: { name: 'Cedar Forest', note: 'Mountain forests of cryptomeria and cypress.' },
      pasture: { name: 'Tea Hills', note: 'Even rows of tea bushes on the slopes.' },
      fields: { name: 'Rice Paddies', note: 'Flooded terraces: the labor of a whole village.' },
      mountains: { name: 'Iron Mountains', note: 'Mines and smelters in the hills.' },
      desert: { name: 'Volcano Slope', note: 'Ash and hardened lava. Ninja hide here.' },
    },
    pieces: { road: 'Highway', settlement: 'Village', city: 'Castle' },
    devCards: {
      knight: { name: 'Samurai', flavor: 'A loyal warrior tracks down the spy and drives him off.' },
      victoryPoint: { name: 'Tea Ceremony', flavor: 'A tea master received you: great honor and renown.' },
      roadBuilding: { name: 'Post Stations', flavor: 'Two new stretches of highway with inns.' },
      yearOfPlenty: { name: 'Rich Harvest', flavor: 'Autumn is generous: the granaries are full, take what you need.' },
      monopoly: { name: 'Rice Exchange', flavor: 'The merchants of Osaka have bought up one commodity across the land.' },
    },
    robber: {
      name: 'Ninja',
      note: 'A shinobi spy. While he lurks on a plot it yields nothing, and a neighbor may lose goods.',
    },
    bonuses: { longestRoad: 'Tokaido Road', largestArmy: 'Mightiest Retinue' },
    intro: [
      'Japan, 15th and 16th centuries. The shogun has lost his power, and the country has split into the domains of the daimyo lords. For a hundred years they contest who will unite the islands. This age is called Sengoku, the "Warring States" period.',
      'Wealth here is counted not in gold but in rice. As much rice as the land yields, so many warriors a lord can feed. Castles with white towers rise above the paddies.',
      'Foot soldiers called ashigaru, monks, and merchants with tea and silk travel the roads. The great highway, the Tokaido, will link the old capital Kyoto with the new city of Edo.',
      'Build villages and castles, lay highways, gather rice and tea. And watch the shadows: they say ninja have been seen nearby.',
    ],
    narration: {
      gameStarted: [
        'The provinces await their masters. Lords, to your horses: the game begins!',
        'Morning over the rice paddies. Who will unite the islands?',
        'The tea is brewed, the swords sharpened, the dice cast. Let us begin!',
      ],
      settlement: [
        '{player}: a new village, and the peasants are already planting rice.',
        '{player}: a village by the road. It smells of smoke and fresh straw.',
        '{player}: people have settled the valley. The harvest is not far off.',
      ],
      city: [
        '{player}: a castle, its white tower visible three days away.',
        '{player}: the village has become a castle town. The merchants are already here.',
        '{player}: a castle with a stone base and a moat.',
      ],
      road: [
        '{player}: a new highway. Travelers bow and walk on.',
        '{player}: a new stretch of road with a teahouse at the pass.',
        '{player}: the road through the hills is paved. The couriers are pleased.',
      ],
      seven: [
        'A seven! A shadow flickers at dusk: the ninja is out on a job.',
        'Seven: whoever\'s granaries are bursting must part with half.',
        'Seven! The guards light their lanterns, but it is already too late.',
      ],
      robberMoved: [
        '{player}: the ninja has found a new hideout. No one works there now.',
        'The ninja has moved to a new plot. {player} has made the move; the plot falls silent.',
        '{player}: a shadow slips across the fields onto foreign land.',
      ],
      stole: [
        'A ninja in the granary: {victim} → {player}. The castle stands, but the goods are fewer.',
        'The stores are recounted with a sigh: {victim} → {player}. The tea had not even cooled.',
        'Quietly, without a trace: {victim} → {player}.',
      ],
      knight: [
        '{player}: a samurai is sent out and the ninja vanishes in smoke.',
        '{player}: a samurai patrols the lands. Strangers have no place here.',
        '{player}: guards are posted, and the spy goes off in search of easier prey.',
      ],
      monopoly: [
        '{player}: merchants bought up all the {res} in the land, {count} in all. What a deal!',
        'The rice exchange has closed: all the {res} sits in one granary, {count} in total. The winner of the bidding is {player}.',
        '{player}: {res} gathered from every province, {count} in all.',
      ],
      yearOfPlenty: [
        '{player}: a generous autumn, two gifts from the rich harvest.',
        '{player}: the granaries are full, so choose what you lacked.',
        '{player}: the peasants celebrate, the year has been a fine one.',
      ],
      roadBuilding: [
        '{player}: two post stations, and the highway grows longer.',
        '{player}: two new stages, with lodging and fresh horses.',
        '{player}: two stretches of road at once. The Tokaido is growing!',
      ],
      longestRoad: [
        '{player}: the longest road, a true Tokaido!',
        '{player}: the whole country travels from station to station.',
        '{player}: the Tokaido is his. Artists are already painting the views.',
      ],
      largestArmy: [
        '{player}: the mightiest retinue. The neighbors send gifts.',
        '{player}: the most samurai under one banner.',
        '{player}: the finest army in the provinces.',
      ],
      tradeCompleted: [
        '{player} and {victim} exchanged goods and bows.',
        'The deal is made over a cup of tea: {player} and {victim} are content.',
        'The merchants shake on it: {player} and {victim}.',
      ],
      bigHarvest: [
        'A rich harvest! {player}: {n} cards at once.',
        '{player}: the granaries are bursting, {n} cards in one roll.',
        '{player}: the gods of the harvest smiled, {n} cards.',
      ],
      gameWon: [
        '{player}: the provinces are united. Peace comes to the land!',
        'The lords lower their banners: the winner is {player}.',
        '{player}: first among the lords. Time to drink tea and admire the cherry blossoms.',
      ],
    },
    victory: 'The winner is {player}: the provinces are united and peace has come to the land. The rice is in, the roads are calm. Time to brew some tea.',
  },
};
