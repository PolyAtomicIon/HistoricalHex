import type { LoreTr } from './types';

// Перевод пакета «silk» (названия, вступление, рассказчик). Факты — в silk.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Ұлы Жібек жолы',
    subtitle: 'Керуендер, оазис қалалары және күміс: Тараздан Отырарға дейін',
    years: 'VI–XII ғғ.',
    region: 'Жетісу және Сырдария: Тараз, Испиджаб, Отырар, Баласағұн',
    resources: {
      brick: { name: 'Кірпіш', note: 'Қабырға, монша, мұнара және керуен сарайларға арналған шикі және күйдірілген кірпіш.' },
      wood: { name: 'Ағаш', note: 'Оазистердің сымбатты теректері арқа, есік және арба жасауға кетеді.' },
      sheep: { name: 'Жүн', note: 'Қой отарларының жүні — базарға арналған кілем мен шұғаға.' },
      wheat: { name: 'Астық', note: 'Оазис астығы: арық бойындағы егістіктен бидай мен арпа.' },
      ore: { name: 'Кен', note: 'Тау кеніштерінен шығатын кен — теңге мен қару үшін күміс пен темір.' },
    },
    terrains: {
      hills: { name: 'Балшық карьерлері', note: 'Мұнда кірпішті қалыптап, күйдіреді.' },
      forest: { name: 'Тоғай', note: 'Өзен бойындағы терек пен қалың бұта.' },
      pasture: { name: 'Тұт бақтары', note: 'Тұт ағашы мен жібек құртына арналған науалар.' },
      fields: { name: 'Бақшалар', note: 'Оазис арықтарындағы қауын мен қарбыз.' },
      mountains: { name: 'Күміс кеніштері', note: 'Кенді теңге сарайларына тасымалдайтын таудағы шахталар.' },
      desert: { name: 'Қызылқұм', note: 'Оазистер арасындағы құм: су да, табыс та жоқ. Мұнда қарақшылар күтіп жатыр.' },
    },
    pieces: { road: 'Керуен жолы', settlement: 'Керуен сарай', city: 'Оазис қала' },
    devCards: {
      knight: { name: 'Керуен күзеті', flavor: 'Жалдамалы күзет қарақшыларды жолдан қуады.' },
      victoryPoint: { name: 'Астролябия', flavor: 'Оазис ғалымдары жұлдыздарды өлшейді — қалаңның даңқы артады.' },
      roadBuilding: { name: 'Жаңа аралық', flavor: 'Құдықтар қазылды, аялдамалар белгіленді: жолдың екі бөлігі дайын.' },
      yearOfPlenty: { name: 'Жәрмеңке', flavor: 'Дүниенің төрт бұрышынан келген саудагерлер тауарын жайды — керегіңді ал.' },
      monopoly: { name: 'Баж', flavor: 'Асудағы кеден: бір түрлі тауар барлық керуеннен саған келеді.' },
    },
    robber: {
      name: 'Шөл қарақшылары',
      note: 'Керуенге шабуыл. Қарақшылар тұрған жер ештеңе бермейді, ал көрші тауарынан айырылуы мүмкін.',
    },
    bonuses: { longestRoad: 'Ұлы Жібек жолы', largestArmy: 'Үздік күзет' },
    intro: [
      'VI ғасыр. Болашақ Қазақстанның даласы мен оазистері арқылы керуендер тартылады: батысқа жібек, шығысқа күміс, шыны және жылқы апарады.',
      'Сырдария бойында және Жетісуда қалалар өседі: Тараз, Испиджаб, Отырар, Баласағұн. Әрқайсысында базар, монша, керуен сарай және шеберхана бар.',
      'Түрік қағандары жолды өз қолында ұстап, Византияға елші жібереді. Кейін мұнда Қарахандар билік етеді, ал Отырарда «Екінші ұстаз» әл-Фараби дүниеге келеді.',
      'Сендерге керуен сарайлар салып, оазис қалаларын көтеріп, керуен жолдарын тарту керек. Шөл қарақшыларынан сақтаныңдар — керуенің бірінші жетсін!',
    ],
    narration: {
      gameStarted: [
        'Керуендер жүк артты, құдықтар тексерілді. Жолға!',
        'Базар ашылды! Саудагерлер, жолдар мен оазистерді бөліңдер.',
        'Шөл кең, құдық аз. Кім бірінші болса — сол сулы.',
      ],
      settlement: [
        '{player}: жаңа керуен сарай — түйелерге демалатын жер бар.',
        '{player} — қақпа ашық, ауламен алғашқы керуен кірді.',
        '{player}: құдық басындағы аялдама алынды. Көршілер шығынын санап жатыр.',
      ],
      city: [
        '{player}: қабырғасы, базары мен мұнарасы бар оазис қала.',
        '{player} — керуен сарай қалаға айналды. Өз теңгесін соғады!',
        '{player}: гүлденген кезіндегі Таразданнан кем емес қала.',
      ],
      road: [
        '{player}: жаңа керуен жолы. Түйелер риза.',
        '{player} — аралық салынды, құдықтар белгіленді.',
        '{player}: құм арқылы жол ашылды.',
      ],
      seven: [
        'Жеті түсті! Көкжиекте шаң — шөл қарақшылары.',
        'Жеті — базарда дабыл. Артық жинаған бөліседі.',
        'Жеті! Керуенбасылар түйіншектерін санап жатыр.',
      ],
      robberMoved: [
        '{player}: қарақшылар бөтен құдықтарға кетті. Онда енді бос.',
        'Қарақшылар жаңа орынға көшті. {player} — жер әзірге ештеңе бермейді.',
        '{player} — бөтен жолға тұзақ құрылды.',
      ],
      stole: [
        'Қарақшылық: {victim} → {player}. Түйіншек түнде жоғалды.',
        'Керуен жеңілдеді: {victim} → {player}.',
        'Із құмға кетеді: {victim} тауарынан айырылды, {player} ұтты.',
      ],
      knight: [
        '{player}: керуен күзеті ерде — қарақшылар қашуда.',
        '{player} — жалдамалылар жолды қайтарып алды.',
        '{player}: күзет қойылды, жолда тәртіп орнады.',
      ],
      monopoly: [
        '{player}: асудағы баж — бүкіл {res}, {count} дана.',
        'Кеден жұмыс істеп тұр: {count} × {res} {player} ойыншысына кетті.',
        '{player} — әр керуен төлейді: {res}, барлығы {count}.',
      ],
      yearOfPlenty: [
        '{player}: жәрмеңке! Таңдауға екі тауар.',
        '{player} — саудагерлер тауарлы кілемдерін жайды.',
        '{player}: жомарт базар күні.',
      ],
      roadBuilding: [
        '{player}: екі жаңа аралық — керуен тоқтамайды.',
        '{player} — құдықтар қазылды, жол екі еселенді.',
        '{player}: бір жүрісте жолдың екі бөлігі.',
      ],
      longestRoad: [
        '{player}: ең ұзын жол — міне, Ұлы Жібек жолы!',
        '{player} — керуендер осы жолдармен Қытайдан Византияға дейін жүреді.',
        '{player}: Ұлы Жібек жолы осы қолдарда.',
      ],
      largestArmy: [
        '{player}: бүкіл жолдағы үздік күзет.',
        '{player} — мұндай күзетпен құмнан да қорықпайсың.',
        '{player}: керуен күзетінің теңдесі жоқ.',
      ],
      tradeCompleted: [
        'Қол соғысты! {player} мен {victim} келісімге риза.',
        'Базар күні сәтті болды: {player} мен {victim} тауар алмасты.',
        'Келісім шаймен бекітілді: {player} мен {victim} есептесті.',
      ],
      bigHarvest: [
        'Бай керуен! {player}: бірден {n} карта.',
        '{player} — қоймалар толы: {n} карта.',
        '{player}: сәтті маусым, бір лақтырыста {n} карта.',
      ],
      gameWon: [
        '{player} — Ұлы Жібек жолының ең бай қаласы!',
        'Барлық керуен сенің қақпаң арқылы өтеді, {player}.',
        '{player}: Таразданнан Отырарға дейінгі бірінші саудагер!',
      ],
    },
    victory: '{player} — барлық керуен сенің қалаларың арқылы өтеді! Базарлар у-шу, теңгелер сылдырлайды, ал Қытайдан Византияға дейінгі жол сенімді қолда.',
  },
  en: {
    title: 'The Great Silk Road',
    subtitle: 'Caravans, oasis cities and silver: from Taraz to Otrar',
    years: '6th–12th c.',
    region: 'Zhetysu and the Syr Darya: Taraz, Ispidjab, Otrar, Balasagun',
    resources: {
      brick: { name: 'Brick', note: 'Mud brick and fired brick for walls, baths, minarets and caravanserais.' },
      wood: { name: 'Timber', note: 'Slender poplars of the oases go into beams, doors and carts.' },
      sheep: { name: 'Wool', note: 'Wool from the herders\' flocks, for carpets and cloth for the bazaars.' },
      wheat: { name: 'Grain', note: 'Oasis grain: wheat and barley from fields along the canals.' },
      ore: { name: 'Silver', note: 'Ore from mountain mines: silver and iron for coins and weapons.' },
    },
    terrains: {
      hills: { name: 'Clay Pits', note: 'Brick is molded and fired here.' },
      forest: { name: 'Tugai', note: 'Poplars and thickets along the rivers.' },
      pasture: { name: 'Mulberry Orchards', note: 'Mulberry trees and trays of silkworms.' },
      fields: { name: 'Melon Fields', note: 'Melons and watermelons by the oasis canals.' },
      mountains: { name: 'Silver Mines', note: 'Shafts in the mountains, from which ore is carried to the mints.' },
      desert: { name: 'Kyzylkum', note: 'Sands between the oases: no water, no income. Bandits lie in wait here.' },
    },
    pieces: { road: 'Caravan Route', settlement: 'Caravanserai', city: 'Oasis City' },
    devCards: {
      knight: { name: 'Caravan Guard', flavor: 'Hired guards drive bandits off the road.' },
      victoryPoint: { name: 'Astrolabe', flavor: 'The scholars of the oases measure the stars, and your city\'s renown grows.' },
      roadBuilding: { name: 'New Stage', flavor: 'Wells are dug, camps marked out: two stretches of road are ready.' },
      yearOfPlenty: { name: 'Fair', flavor: 'Merchants from all over the world lay out their wares: take what you need.' },
      monopoly: { name: 'Toll', flavor: 'A customs post at the pass: one kind of goods from every caravan comes to you.' },
    },
    robber: {
      name: 'Desert Bandits',
      note: 'A raid on the caravans. While bandits stand on a hex it yields nothing, and a neighbor risks losing goods.',
    },
    bonuses: { longestRoad: 'Great Silk Road', largestArmy: 'Finest Guard' },
    intro: [
      'The 6th century. Caravans stretch across the steppes and oases of future Kazakhstan: silk goes west, while silver, glass and horses go east.',
      'Cities rise along the Syr Darya and in Zhetysu: Taraz, Ispidjab, Otrar, Balasagun. Each has a bazaar, a bathhouse, a caravanserai and workshops.',
      'The Turkic khagans hold the road in their hands and send envoys to Byzantium. Later the Karakhanids rule here, and in Otrar al-Farabi, the "Second Teacher", is born.',
      'You will build caravanserais, raise oasis cities and lay caravan routes. Beware the desert bandits, and may your caravan arrive first!',
    ],
    narration: {
      gameStarted: [
        'The caravans are loaded and the wells checked. On the road!',
        'The bazaar is open! Merchants, divide the roads and oases.',
        'The desert is wide and wells are few. Whoever is first has the water.',
      ],
      settlement: [
        '{player}: a new caravanserai, a place for the camels to rest.',
        '{player}: the gates are open, and the first caravan is already in the courtyard.',
        '{player}: the stop at the well is taken. The neighbors count their losses.',
      ],
      city: [
        '{player}: an oasis city with walls, a bazaar and a minaret.',
        '{player}: the caravanserai has grown into a city. They mint their own coin!',
        '{player}: a city no worse than Taraz in its best years.',
      ],
      road: [
        '{player}: a new caravan route. The camels are content.',
        '{player}: a stage is laid and wells are marked.',
        '{player}: the road across the sands is open.',
      ],
      seven: [
        'A seven! Dust on the horizon: desert bandits.',
        'Seven: alarm in the bazaar. Whoever hoarded extra will share.',
        'Seven! The caravan leaders recount their bales.',
      ],
      robberMoved: [
        '{player}: the bandits have gone to foreign wells. It is empty there now.',
        'The bandits have moved to a new spot. {player} has made the move; the land yields nothing for now.',
        '{player}: an ambush is set on someone else\'s road.',
      ],
      stole: [
        'Banditry: {victim} → {player}. A bale vanished in the night.',
        'The caravan grew lighter: {victim} → {player}.',
        'Tracks lead into the sands: {victim} is short of goods, {player} comes out ahead.',
      ],
      knight: [
        '{player}: the caravan guard is in the saddle, and the bandits flee.',
        '{player}: the hired swords have retaken the road.',
        '{player}: guards are posted and order holds on the way.',
      ],
      monopoly: [
        '{player}: a toll at the pass: all the {res}, {count} in all.',
        'The customs post is at work: {count} × {res} go to {player}.',
        '{player}: every caravan pays: {res}, {count} in total.',
      ],
      yearOfPlenty: [
        '{player}: a fair! Two goods to choose from.',
        '{player}: merchants spread carpets laden with wares.',
        '{player}: a generous market day.',
      ],
      roadBuilding: [
        '{player}: two new stages, and the caravan will not halt.',
        '{player}: wells are dug and the route is doubled in length.',
        '{player}: two stretches of road in a single move.',
      ],
      longestRoad: [
        '{player}: the longest route, the Great Silk Road itself!',
        '{player}: caravans travel these roads from China to Byzantium.',
        '{player}: the Great Silk Road is in these hands.',
      ],
      largestArmy: [
        '{player}: the finest guard along the whole route.',
        '{player}: with such an escort even the sands hold no fear.',
        '{player}: the caravan guard has no equal.',
      ],
      tradeCompleted: [
        'A handshake! {player} and {victim} are pleased with the deal.',
        'A good market day: {player} and {victim} swapped goods.',
        'The deal is sealed with tea: {player} and {victim} are even.',
      ],
      bigHarvest: [
        'A rich caravan! {player}: {n} cards at once.',
        '{player}: the warehouses are full, {n} cards.',
        '{player}: a good season, {n} cards in one roll.',
      ],
      gameWon: [
        '{player}: the richest city of the Great Silk Road!',
        'Every caravan passes through your gates, {player}.',
        '{player}: the foremost merchant from Taraz to Otrar!',
      ],
    },
    victory: '{player}: every caravan passes through your cities! The bazaars hum, coins ring, and the road from China to Byzantium is in safe hands.',
  },
};
