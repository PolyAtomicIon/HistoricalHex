import type { LoreTr } from './types';

// Перевод пакета «khanate» (названия, вступление, рассказчик). Факты — в khanate.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Қазақ хандығы',
    subtitle: 'Дала еркін халқы: хандар, билер, батырлар және Түркістан',
    years: '1465–1730',
    region: 'Жетісу, Сарыарқа, Сырдария және Түркістан',
    resources: {
      brick: { name: 'Кірпіш', note: 'Түркістан мен Сайрамдағы мешіт, медресе және кесенелерге арналған күйдірілген кірпіш.' },
      wood: { name: 'Ағаш', note: 'Киіз үйдің керегесі мен уықтарына, шаңырағына арналған иілгіш таяқтар.' },
      sheep: { name: 'Жүн', note: 'Отар жүні — одан киіз үйге арналған киіз басады.' },
      wheat: { name: 'Астық', note: 'Тарыны өзен мен арық бойына сепкен: одан ботқа мен жолға арналған талқан жасайды.' },
      ore: { name: 'Кен', note: 'Қылыш, найза ұшы, батырлардың сауыты мен үзеңгі.' },
    },
    terrains: {
      hills: { name: 'Кірпіш төбелер', note: 'Кірпіш күйдіретін Сырдарияның балшықты жағалауы.' },
      forest: { name: 'Алатау шыршалары', note: 'Жетісу тауларының беткейіндегі тянь-шань шыршасы.' },
      pasture: { name: 'Жайлау', note: 'Жылқы мен отарға арналған жазғы тау жайылымы.' },
      fields: { name: 'Тары егістері', note: 'Хандықтың оңтүстігіндегі өзен мен арық бойының егіні.' },
      mountains: { name: 'Ұлытау', note: 'Дала жүрегіндегі көне кеніштер мен балқыту орындары.' },
      desert: { name: 'Мойынқұм', note: 'Сексеуілді құм: шөп те, табыс та жоқ. Мұнда шабуылшылар тығылған.' },
    },
    pieces: { road: 'Көш жолы', settlement: 'Ауыл', city: 'Хан ордасы' },
    devCards: {
      knight: { name: 'Батыр', flavor: 'Батыр жасағымен шабуылшыларды жайылымыңнан қуады.' },
      victoryPoint: { name: 'Жеті жарғы', flavor: 'Бүкіл дала құрметтейтін заңдар жинағы — даңқың мен тірегің.' },
      roadBuilding: { name: 'Көшу', flavor: 'Ауыл жаңа жайылымға көшті: бір күнде екі соқпақ салынды.' },
      yearOfPlenty: { name: 'Той', flavor: 'Үлкен мереке: қонақтар сый әкеледі, дастарқан мол.' },
      monopoly: { name: 'Хан жарлығы', flavor: 'Хан жарлығы: бір түрлі мүлік барлық ауылдан ордаға барады.' },
    },
    robber: {
      name: 'Жоңғар шапқыншылығы',
      note: 'Жайылымдарға шабуыл. Шабуылшылар тұрған жер ештеңе бермейді, ал көрші мал-мүлкінен айырылуы мүмкін.',
    },
    bonuses: { longestRoad: 'Ұлы көш', largestArmy: 'Батырлар кеңесі' },
    intro: [
      '1465 жыл. Керей мен Жәнібек сұлтандар өз адамдарымен Әбілқайыр ханнан шығысқа, Шу мен Талас аңғарына кетеді. Моғолстан билеушісі Есенбұға оларды қабылдайды — осылай Қазақ хандығы пайда болады.',
      'Олардың адамдарын «қазақ» — еркін, азат деп атайды. Жетісудан Сарыарқа мен Сырдарияға дейінгі дала олардың мекеніне айналады: жазда таудағы жайлау, қыста өзен бойындағы қыстау.',
      'Хандар заң жазады — Қасымның «қасқа жолы», Есімнің «ескі жолы», Тәукенің «Жеті жарғысы». Билер сөзбен төрелік айтады, батырлар көшті қорғайды, ал шығыстан жоңғар шапқыншылығы жиілей түседі.',
      'Сендерге ауыл тұрғызып, хан ордаларын көтеріп, көшті дала бойымен жүргізу керек. Батырларды дайын ұстаңдар — рулың құрылтайда бірінші болсын!',
    ],
    narration: {
      gameStarted: [
        'Құрылтай жиналды! Сұлтандар, жайылымды әділ бөліңдер.',
        'Ақ киіз төселді, аттар ерттелді. Ойын басталды!',
        'Дала бос, бірақ жақсы жайлау санаулы. Алға!',
      ],
      settlement: [
        '{player}: жаңа ауыл — киіз үйлер су бойына тігілді.',
        '{player} — киіз үйлердің үстінде түтін, ауыл қыстауға орнықты.',
        '{player}: өзен бойындағы жақсы орын алынды. Көршілер бір-біріне қарасты.',
      ],
      city: [
        '{player}: енді мұнда хан ордасы — ақ орда мен билер кеңесі.',
        '{player} — ауыл ордаға айналды. Шабарман төрт жақтан шауып келеді.',
        '{player}: Түркістанның гүлденген кезінен кем емес хан ордасы.',
      ],
      road: [
        '{player}: көш жолы салынды, құдықтар белгіленді.',
        '{player} — жаңа жайлауға жол ашылды.',
        '{player}: керуен жаңа соқпақпен келе жатыр.',
      ],
      seven: [
        'Жеті түсті! Шығыстан шаң: жоңғарлар шапқыншылыққа шықты.',
        'Жеті — ауылдарда дабыл. Артық жинаған бөліседі.',
        'Жеті! Жылқышылар жылқыны айдап, батырлар атын ерттеуде.',
      ],
      robberMoved: [
        '{player}: шабуылшылар бөтен жайылымға кетті. Онда енді бос.',
        'Шапқыншылық ауысты. {player} — жүріс жасалды, жер әзірге ештеңе бермейді.',
        '{player} — жоңғар отряды жаңа жерге тоқтады.',
      ],
      stole: [
        'Шапқыншылық: {victim} → {player}. Далада атыңды ерттеулі ұста.',
        'Түнде бір зат кеміді: {victim} → {player}.',
        'Із қарсыластың ауылынан кетеді: {victim} мал-мүлкінен айырылды, {player} ұтты.',
      ],
      knight: [
        '{player}: батыр жасақ көтерді — шабуылшылар артына қарамай қашуда.',
        '{player} — батырлар ерде. Бөтенге мұнда жол жоқ.',
        '{player}: ұран тасталды, қол жиналды.',
      ],
      monopoly: [
        '{player}: хан жарлығы оқылды — бүкіл {res} ордаға, {count} дана.',
        'Хан жарлығы: барлық ауылдан {res}, барлығы {count}. Жинайтын — {player}.',
        '{player} — {count} × {res} ордаға кетті. Көршілер күрсінеді.',
      ],
      yearOfPlenty: [
        '{player}: үлкен той! Қонақтар сый әкелді — таңдауға екеуі.',
        '{player} — дастарқан жайылды, сыйлықтар қойылды.',
        '{player}: мереке сәтті өтті, сандықтар толды.',
      ],
      roadBuilding: [
        '{player}: көшу! Бір көшіп-қонуда екі жаңа соқпақ.',
        '{player} — ауыл орнынан қозғалды: екі соқпақ дайын.',
        '{player}: түйе керуені екі рет өтті. Жол ашық.',
      ],
      longestRoad: [
        '{player}: даладағы ең ұзын көш.',
        '{player} — қыстаудан жайлауға тек осы соқпақтармен жүреді.',
        '{player}: Ұлы көш енді осы қолдарда.',
      ],
      largestArmy: [
        '{player}: батырлар кеңесінде алғашқы сөз.',
        '{player} — даладағы ең күшті қол.',
        '{player}: батырлар бір тудың астына жиналды.',
      ],
      tradeCompleted: [
        'Қол соғысты! {player} мен {victim} айырбасқа риза.',
        'Түркістандағы базар: {player} мен {victim} тауар алмасты.',
        'Келісім қымызбен бекітілді: {player} мен {victim} есептесті.',
      ],
      bigHarvest: [
        'Мол жыл! {player}: бірден {n} карта.',
        '{player} — төл мен өнім қатар келді: {n} карта.',
        '{player}: Тәңір мейірімді, бір лақтырыста {n} карта.',
      ],
      gameWon: [
        '{player} — ақ киізге көтерілді! Дала ханды таныды.',
        'Құрылтай шешті: теңдердің ішіндегі бірінші — {player}.',
        '{player}: даладағы ең күшті ру. Бүкіл өңірге той!',
      ],
    },
    victory: '{player} — ақ киізге көтерілді! Үш жүз бірлікте, көш тыныш, ал дала заңын бәрі құрметтейді.',
  },
  en: {
    title: 'The Kazakh Khanate',
    subtitle: 'Free people of the steppe: khans, biys, batyrs and Turkestan',
    years: '1465–1730',
    region: 'Zhetysu, Saryarka, the Syr Darya and Turkestan',
    resources: {
      brick: { name: 'Brick', note: 'Fired brick for the mosques, madrasas and mausoleums of Turkestan and Sairam.' },
      wood: { name: 'Timber', note: 'Flexible poles for the kerege and uyk, the lattice and dome of the yurt.' },
      sheep: { name: 'Wool', note: 'Wool of the flocks, from which felt for yurts is made.' },
      wheat: { name: 'Millet', note: 'Millet sown by rivers and irrigation channels, cooked into porridge and talkan for the road.' },
      ore: { name: 'Iron', note: 'Sabers, spearheads, the chain mail of batyrs, and stirrups.' },
    },
    terrains: {
      hills: { name: 'Brick Hills', note: 'The clay banks of the Syr Darya, where brick is fired.' },
      forest: { name: 'Alatau Spruce', note: 'Tian Shan spruce on the slopes of the Zhetysu mountains.' },
      pasture: { name: 'Jailau', note: 'Summer mountain pastures for herds and flocks.' },
      fields: { name: 'Millet Fields', note: 'Crops by rivers and canals in the south of the khanate.' },
      mountains: { name: 'Ulytau', note: 'Ancient mines and smelters in the heart of the steppe.' },
      desert: { name: 'Moyynkum', note: 'Sands with saxaul: no grass, no income. Raiders lie hidden here.' },
    },
    pieces: { road: 'Migration Trail', settlement: 'Aul', city: 'Khan\'s Horde' },
    devCards: {
      knight: { name: 'Batyr', flavor: 'A batyr and his retinue drive raiders off your pastures.' },
      victoryPoint: { name: 'Zheti Zhargy', flavor: 'A code of laws honored across the steppe: your glory and support.' },
      roadBuilding: { name: 'Migration', flavor: 'The aul moves to a new pasture: two trails laid in a day.' },
      yearOfPlenty: { name: 'Toi', flavor: 'A great feast: guests bring gifts and the table groans.' },
      monopoly: { name: 'Khan\'s Edict', flavor: 'The khan\'s decree: one kind of goods from every aul goes to the horde.' },
    },
    robber: {
      name: 'Dzungar Raid',
      note: 'A raid on the pastures. While raiders stand on a hex it yields nothing, and a neighbor risks losing goods.',
    },
    bonuses: { longestRoad: 'Great Migration', largestArmy: 'Council of Batyrs' },
    intro: [
      '1465. Sultans Kerey and Janibek lead their people away from Khan Abul-Khayr to the east, into the valleys of the Chu and Talas. Esen-Buqa, khan of Moghulistan, receives them, and so the Kazakh Khanate is born.',
      'Their people are called "Kazakhs": free ones. The steppe from Zhetysu to Saryarka and the Syr Darya becomes their home: in summer the mountain jailau, in winter the riverside winter camps.',
      'The khans write laws: Qasym\'s "Bright Path", Esim\'s "Old Path", Tauke\'s "Zheti Zhargy". Biys judge with words, batyrs guard the migrations, and from the east Dzungar raids come ever more often.',
      'You will found auls, raise the hordes of khans and lead migrations across the steppe. Keep your batyrs ready, and may your clan be first at the kurultai!',
    ],
    narration: {
      gameStarted: [
        'The kurultai has gathered! Sultans, divide the pastures fairly.',
        'White felt is spread, horses are saddled. The game begins!',
        'The steppe is free, but good jailau are few. Onward!',
      ],
      settlement: [
        '{player}: a new aul, with yurts pitched by the water.',
        '{player}: smoke over the yurts, and the aul settles at its winter camp.',
        '{player}: a good spot by the river is taken. The neighbors exchange glances.',
      ],
      city: [
        '{player}: a khan\'s horde stands here now, with a white yurt and a council of biys.',
        '{player}: the aul has grown into a horde. Couriers ride in from every side.',
        '{player}: a khan\'s horde, no worse than Turkestan in its best years.',
      ],
      road: [
        '{player}: a migration trail is laid and wells are marked.',
        '{player}: the way to a new jailau is open.',
        '{player}: a caravan walks the new trail.',
      ],
      seven: [
        'A seven! Dust from the east: the Dzungars are out on a raid.',
        'Seven: alarm in the auls. Whoever hoarded extra will share.',
        'Seven! Herdsmen round up the horses and batyrs saddle theirs.',
      ],
      robberMoved: [
        '{player}: the raiders have gone to foreign pastures. It is empty there now.',
        'The raid has shifted. {player} has made the move; the land yields nothing for now.',
        '{player}: a Dzungar band has halted on new land.',
      ],
      stole: [
        'Raid: {victim} → {player}. On the steppe, keep your horse saddled.',
        'By night one item went missing: {victim} → {player}.',
        'Tracks lead from a rival\'s aul: {victim} is short of goods, {player} comes out ahead.',
      ],
      knight: [
        '{player}: a batyr raises his retinue and the raiders flee without looking back.',
        '{player}: batyrs in the saddle. Strangers are not welcome here.',
        '{player}: the war cry is sounded, the levy assembled.',
      ],
      monopoly: [
        '{player}: the khan\'s edict is read, and all the {res} goes to the horde, {count} in all.',
        'The khan\'s decree: {res} from every aul, {count} in total. Collector: {player}.',
        '{player}: {count} × {res} go to the horde. The neighbors sigh.',
      ],
      yearOfPlenty: [
        '{player}: a great toi! Guests bring gifts, two to choose from.',
        '{player}: the dastarkhan is laid and the gifts set out.',
        '{player}: the feast was a success and the chests are fuller.',
      ],
      roadBuilding: [
        '{player}: migration! Two new trails in a single move.',
        '{player}: the aul has broken camp, and two trails are ready.',
        '{player}: a camel caravan passed twice. The road is open.',
      ],
      longestRoad: [
        '{player}: the longest migration on the steppe.',
        '{player}: from winter camp to jailau, people travel only these trails.',
        '{player}: the Great Migration is now in these hands.',
      ],
      largestArmy: [
        '{player}: the first voice in the council of batyrs.',
        '{player}: the strongest levy on the steppe.',
        '{player}: the batyrs have rallied under one banner.',
      ],
      tradeCompleted: [
        'A handshake! {player} and {victim} are pleased with the exchange.',
        'A bazaar in Turkestan: {player} and {victim} swapped goods.',
        'The deal is sealed with kumis: {player} and {victim} are even.',
      ],
      bigHarvest: [
        'A generous year! {player}: {n} cards at once.',
        '{player}: newborn livestock and harvest together, {n} cards.',
        '{player}: Tengri is merciful, {n} cards in one roll.',
      ],
      gameWon: [
        '{player} is raised on white felt! The steppe recognizes its khan.',
        'The kurultai has decided: first among equals is {player}.',
        '{player}: the mightiest clan on the steppe. A feast for the whole region!',
      ],
    },
    victory: '{player} is raised on white felt! The three zhuzes are united, the migrations are calm, and the laws of the steppe are honored by all.',
  },
};
