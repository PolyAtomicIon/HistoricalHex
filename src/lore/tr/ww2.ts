import type { LoreTr } from './types';

// Перевод пакета «ww2» (названия, вступление, рассказчик). Факты — в ww2.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Бәрі майдан үшін',
    subtitle: 'Қазақстан — Екінші дүниежүзілік соғыс жылдарындағы тыл мен қару-жарақ қоймасы',
    years: '1941–1945',
    region: 'Қазақ КСР: Қарағанды, Алматы, Кенді Алтай, Ембі, Түрксіб',
    resources: {
      brick: { name: 'Кірпіш', note: 'Зауыт цехтарына және эвакуацияланғандарға арналған тұрғын үйге кірпіш.' },
      wood: { name: 'Ағаш', note: 'Жаңа теміржол тармақтарына шпал, шахтаға бекітпе, цех пен барак қабырғасы.' },
      sheep: { name: 'Жүн', note: 'Шинель, байпақ және тон: колхоздар қорғаныс қорына 62,4 мың тонна жүн тапсырды.' },
      wheat: { name: 'Астық', note: 'Майдан мен қалаларға астық. Далада негізінен әйелдер, қарттар мен жасөспірімдер еңбек етті.' },
      ore: { name: 'Кен', note: 'Қорғасын, мыс, молибден, марганец — қорғаныс зауыттарына арналған Қазақстан металдары.' },
    },
    terrains: {
      hills: { name: 'Көмір төбелері', note: 'Қарағанды шахталары мен разрездері.' },
      forest: { name: 'Орман шаруашылығы', note: 'Кенді Алтай мен солтүстік облыстардың ормандары.' },
      pasture: { name: 'Қашық жайылым', note: 'Колхоз отарлары: жүн, тон терісі, ет.' },
      fields: { name: 'Колхоз егісі', note: 'Бидай, тары, күріш — майдан мен тылға нан.' },
      mountains: { name: 'Кеніш', note: 'Жезқазған, Лениногорск, Текелі, Жезді кеніштері.' },
      desert: { name: 'Сортаң', note: 'Бос тұзды дала — мұнда ештеңе өндіруге болмайды.' },
    },
    pieces: { road: 'Темір жол тармағы', settlement: 'Жұмысшы кенті', city: 'Зауыт-қала' },
    devCards: {
      knight: {
        name: 'Танк колоннасы',
        flavor: 'Колхозшылар мен жұмысшылардың қаражатына құрылған колонна телімге шықты — шабуылшыларға енді мұнда орын жоқ.',
      },
      victoryPoint: { name: 'Ауыспалы ту', flavor: 'Майдан үшін еңбек еткен үздік ұжымға сый.' },
      roadBuilding: { name: 'Магистраль құрылысы', flavor: 'Екі жаңа аралық: шикізат зауыттарға үзіліссіз барады.' },
      yearOfPlenty: { name: 'Жабдықты эшелон', flavor: 'Эвакуацияланған зауыттың станоктары келді — жетпегенді алыңдар.' },
      monopoly: { name: 'Қорғаныс қоры', flavor: 'Бәрі майдан үшін! Бір түрлі ресурс бүкіл республикадан жиналады.' },
    },
    robber: {
      name: 'Әуе шабуылы',
      note: 'Жау бомбалаушылары телім үстінде тұр: қуылмайынша ол ештеңе бермейді, ал көршінің жүгі жоғалуы мүмкін.',
    },
    bonuses: { longestRoad: 'Бас магистраль', largestArmy: 'Ең күшті колонна' },
    intro: [
      '1941 жылы 22 маусымда Ұлы Отан соғысы басталды. Қазақстан терең тыл болды: мұнда зауыттар, институттар, театрлар және баспана керек жүздеген мың адам әкелінді.',
      'Майданға 1,2 миллионға жуық қазақстандық аттанды — республиканың әрбір бесінші ересек тұрғыны. Станок басында, шахтада және далада олардың орнын әйелдер, қарттар мен жасөспірімдер басты.',
      'Қарағанды көмірі, Шымкент пен Кенді Алтай қорғасыны, астық, жүн, жылы киім — бәрі эшелонмен батысқа кетті. Ол жылдардың ұраны: «Бәрі майдан үшін, бәрі жеңіс үшін!»',
      'Бұл ойында сендер — тыл басшыларысыңдар. Жұмысшы кенттері мен зауыттар салыңдар, теміржол тармақтарын тартыңдар, бір-біріңе көмектесіңдер. Жеңісті ортақ еңбекпен жақындатты.',
    ],
    narration: {
      gameStarted: [
        'Тыл жұмысқа кірісті. «Бәрі майдан үшін, бәрі жеңіс үшін!»',
        'Ауысымға гудок! Республика көмір, нан және металл күтіп тұр.',
        'Эшелондар жолда. Станоктарды қабылдап, құрылысты бастаймыз.',
      ],
      settlement: [
        '{player}: жұмысшы кенті — тұратын да, еңбек ететін де орын болады.',
        '{player} — жаңа кент: бараккалар, асхана және екі ауысымды мектеп.',
        '{player}: жаңа қоныстанушылар қабылданды. Орын бәріне жетеді.',
      ],
      city: [
        '{player}: кент зауыт-қалаға айналды. Алғашқы өнім тиеліп жатыр.',
        '{player} — зауыт іске қосылды, станоктар төбесі жабылмай жұмыс істей бастады.',
        '{player}: мұржалар түтіндеді, цехтар толық қуатпен жұмыс істеуде.',
      ],
      road: [
        '{player}: жаңа тармақ — эшелондар жылдамырақ жүреді.',
        '{player} — рельс далаға төселді, жаңа аралық.',
        '{player}: бекеттер жалғанды. Жол жөндеушілерге алғыс!',
      ],
      seven: [
        'Жеті түсті — әуе шабуылы! Артық қорлар паналауға кетіп жатыр.',
        'Жеті: сирена үні және жабдықтаудағы іркіліс. Қоймаларды тексереміз.',
        'Жеті! Бомбалаушылар тыл үстінде — біреу белін бекем буады.',
      ],
      robberMoved: [
        '{player}: бомбалаушылар жаңа телімге бағытталды — онда жұмыс тоқтады.',
        'Мәлімет бойынша әуе шабуылы ауысты. {player} — жүріс жасалды, телім әзірге үнсіз.',
        '{player} — ұшақтар жаңа телім үстінде айналып жүр, жұмыс тоқтатылды.',
      ],
      stole: [
        'Жабдықтаудағы іркіліс: {victim} → {player}. Қоймадан бір жүк кетті.',
        'Қорға тапсырыс: {victim} → {player}. Тапшылық ешкімді аямайды.',
        'Қойма кемшілігі: {victim} → {player}. Вагон басқа телімге кетті.',
      ],
      knight: [
        '{player}: танк колоннасы телімге шығып, шабуылшыларды қуды.',
        '{player} — колонна шығарылды, телім қайта жұмыс істеп тұр.',
        '{player}: бүкіл халық жинаған колонна тәртіп орнатуда.',
      ],
      monopoly: [
        '{player}: қорғаныс қорына жинау — {res}, барлығы {count}. Бәріңе рахмет!',
        'Бәрі майдан үшін: {count} × {res} жөнелтуге жиналды. Ұйымдастырушы — {player}.',
        '{player} — үндеу бойынша республика {res} тапсырды: бір эшелонға {count} дана.',
      ],
      yearOfPlenty: [
        '{player}: жабдықты эшелон келді — таңдауға екі жүк.',
        '{player} — эвакуацияланған зауыт қабылданды, станоктар платформада тұр.',
        '{player}: түсіру жүріп жатыр, керегінің бәрі мезгілінде жеткізілді.',
      ],
      roadBuilding: [
        '{player}: магистраль құрылысы — бірден екі жаңа аралық.',
        '{player} — жол жөндеушілер бір ауысымда екі телім салды.',
        '{player}: екпінді құрылыс, екі тармақ мерзімінен бұрын тапсырылды.',
      ],
      longestRoad: [
        '{player}: бас магистраль. Эшелондар кідіріссіз жүреді.',
        '{player} — республиканың ең ұзын жолы.',
        '{player}: осы рельстермен жүктер бүкіл даланы кесіп өтеді.',
      ],
      largestArmy: [
        '{player}: майдандағы үздік бригада — барлық телімге үлгі.',
        '{player} — бригадалар үшеудің орнына еңбек етуде. Оларға ту!',
        '{player}: екпінді бригада ең көп.',
      ],
      tradeCompleted: [
        '{player} мен {victim} қорларымен бөлісті. Тылда бұл әдеттегі іс.',
        'Айырбас болды: {player} мен {victim} бір-біріне қол ұшын берді.',
        '{player} мен {victim} келісті — екі телім де жұмыста.',
      ],
      bigHarvest: [
        'Екпінді ауысым! {player}: бірден {n} карта.',
        '{player} — жоспар артығымен орындалды: қоймаға {n} карта.',
        '{player}: рекордтық өнім, бір лақтырыста {n} карта.',
      ],
      gameWon: [
        '{player} — жоспарды бірінші орындады. Жеңісті әр телім жақындатты.',
        'Жоспар орындалды: {player} алда, бірақ бәрі еңбек етті.',
        'Республика алғыс айтады: {player} және қасында еңбек еткен бәріне.',
      ],
    },
    victory: 'Жоспарды бірінші орындаған — {player}. Басты ойды ұмытпайық: жеңісті бәрі жақындатты — соғысқандар да, тылда еңбек еткендер де.',
  },
  en: {
    title: 'Everything for the Front',
    subtitle: 'Kazakhstan as rear base and arsenal in the years of the Second World War',
    years: '1941–1945',
    region: 'Kazakh SSR: Karaganda, Alma-Ata, the Ore Altai, Emba, Turksib',
    resources: {
      brick: { name: 'Brick', note: 'Brick for factory shops and housing for the evacuated.' },
      wood: { name: 'Timber', note: 'Railway ties for new branch lines, mine props, walls of workshops and barracks.' },
      sheep: { name: 'Wool', note: 'Greatcoats, felt boots and sheepskin coats: collective farms gave 62.4 thousand tons of wool to the defense fund.' },
      wheat: { name: 'Grain', note: 'Grain for the front and the cities. The fields were worked mostly by women, old men and teenagers.' },
      ore: { name: 'Ore', note: 'Lead, copper, molybdenum, manganese: Kazakhstan\'s metals for the defense plants.' },
    },
    terrains: {
      hills: { name: 'Coal Hills', note: 'The mines and open pits of Karaganda.' },
      forest: { name: 'Forestry Station', note: 'Forests of the Ore Altai and the northern regions.' },
      pasture: { name: 'Distant Pasture', note: 'Collective-farm flocks: wool, sheepskin, meat.' },
      fields: { name: 'Collective Farm Field', note: 'Wheat, millet, rice: bread for the front and the rear.' },
      mountains: { name: 'Mine', note: 'The mines of Zhezkazgan, Leninogorsk, Tekeli and Zhezdy.' },
      desert: { name: 'Salt Flat', note: 'Empty salt steppe: nothing to be extracted here.' },
    },
    pieces: { road: 'Railway Branch', settlement: 'Workers\' Settlement', city: 'Factory Town' },
    devCards: {
      knight: {
        name: 'Tank Column',
        flavor: 'A column built with the savings of collective farmers and workers rolls out to the sector: raiders have no place there anymore.',
      },
      victoryPoint: { name: 'Challenge Banner', flavor: 'An award to the best team for labor on behalf of the front.' },
      roadBuilding: { name: 'Mainline Construction', flavor: 'Two new stretches: raw materials will reach the plants without interruption.' },
      yearOfPlenty: { name: 'Equipment Train', flavor: 'Machine tools of an evacuated factory have arrived: take what you were missing.' },
      monopoly: { name: 'Defense Fund', flavor: 'Everything for the front! One kind of resource is collected from the whole republic.' },
    },
    robber: {
      name: 'Air Raid',
      note: 'Enemy bombers hang over a sector: until they are driven off it yields nothing, and a neighbor may lose cargo.',
    },
    bonuses: { longestRoad: 'Main Line', largestArmy: 'Strongest Column' },
    intro: [
      'On 22 June 1941 the Great Patriotic War began. Kazakhstan became the deep rear: factories, institutes and theaters were brought here, along with hundreds of thousands of people who needed shelter.',
      'About 1.2 million Kazakhstanis went to the front, one in five adults of the republic. At the machines, in the mines and in the fields, they were replaced by women, old men and teenagers.',
      'Karaganda coal, lead from Shymkent and the Ore Altai, grain, wool, warm clothing: everything went west by trainload. The motto of those years: "Everything for the front, everything for victory!"',
      'In this game you are the leaders of the rear. Build workers\' settlements and factories, lay railway branches, help one another. Victory was brought closer by common labor.',
    ],
    narration: {
      gameStarted: [
        'The rear gets to work. "Everything for the front, everything for victory!"',
        'The whistle for the shift! The republic awaits coal, bread and metal.',
        'The trains are already on their way. We receive the machines and begin construction.',
      ],
      settlement: [
        '{player}: a workers\' settlement, a place to live and work.',
        '{player}: a new settlement with barracks, a canteen and a two-shift school.',
        '{player}: the newcomers are taken in. There is room for everyone.',
      ],
      city: [
        '{player}: the settlement has grown into a factory town. The first output is being loaded.',
        '{player}: the plant is running, and the machines started before the roof was finished.',
        '{player}: the chimneys are smoking, the shops are at full capacity.',
      ],
      road: [
        '{player}: a new branch line, and the trains will run faster.',
        '{player}: rails laid across the steppe, a new stretch.',
        '{player}: the stations are connected. Thanks to the track crews!',
      ],
      seven: [
        'A seven: air raid! Surplus stocks go to shelter.',
        'Seven: sirens wail and supplies falter. Checking the warehouses.',
        'Seven! Bombers over the rear, and someone will have to tighten their belt.',
      ],
      robberMoved: [
        '{player}: the bombers are directed to a new sector, and work has stopped there.',
        'By the bulletin the raid has shifted. {player} has made the move; the sector falls silent for now.',
        '{player}: planes circle over a new sector, and work is halted.',
      ],
      stole: [
        'Supply disruption: {victim} → {player}. One load left the warehouse.',
        'A requisition on the stocks: {victim} → {player}. Shortage spares no one.',
        'A shortfall at the warehouse: {victim} → {player}. A wagon went to another sector.',
      ],
      knight: [
        '{player}: a tank column rolled out to the sector and drove off the raiders.',
        '{player}: the column is deployed, and the sector is working again.',
        '{player}: a column built by everyone together restores order.',
      ],
      monopoly: [
        '{player}: a collection for the defense fund: {res}, {count} in all. Thanks to everyone!',
        'Everything for the front: {count} × {res} gathered for shipment. Organizer: {player}.',
        '{player}: at the appeal the republic gave up {res}, {count} in one trainload.',
      ],
      yearOfPlenty: [
        '{player}: a train with equipment has arrived, two loads to choose from.',
        '{player}: the evacuated factory is received, and the machines are already on the platform.',
        '{player}: unloading is underway, and everything needed was delivered on time.',
      ],
      roadBuilding: [
        '{player}: mainline construction, two new stretches at once.',
        '{player}: the track crews laid two sections in a single shift.',
        '{player}: a shock-work project, two branches handed over ahead of schedule.',
      ],
      longestRoad: [
        '{player}: the main line. Trains run without delay.',
        '{player}: the longest railway in the republic.',
        '{player}: along these rails cargo crosses the whole steppe.',
      ],
      largestArmy: [
        '{player}: the best front-line brigade, an example for every sector.',
        '{player}: the brigades work for three. A banner for them!',
        '{player}: the most shock brigades.',
      ],
      tradeCompleted: [
        '{player} and {victim} shared their stocks. That is how it is done in the rear.',
        'The exchange is done: {player} and {victim} helped each other out.',
        '{player} and {victim} reached agreement, and both sectors are working.',
      ],
      bigHarvest: [
        'A shock shift! {player}: {n} cards at once.',
        '{player}: the plan is overfulfilled, {n} cards to the warehouse.',
        '{player}: record output, {n} cards in one roll.',
      ],
      gameWon: [
        '{player} fulfilled the plan first. Every sector brought victory closer.',
        'The plan is fulfilled: {player} leads, but everyone labored.',
        'The republic gives thanks: to {player} and to everyone who worked alongside.',
      ],
    },
    victory: 'First to fulfill the plan: {player}. Let us remember the main thing: victory was brought closer by everyone, those who fought and those who labored in the rear.',
  },
};
