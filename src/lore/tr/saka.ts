import type { LoreTr } from './types';

// Перевод пакета «saka» (названия, вступление, рассказчик). Факты — в saka.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Сақтар',
    subtitle: 'Дала алтыны, қорғандар және Томирис патшайым',
    years: 'б.з.б. VIII–III ғғ.',
    region: 'Жетісу, Алтай, Сарыарқа және Арал маңы',
    resources: {
      brick: { name: 'Кірпіш', note: 'Қыстау мен қоршауға арналған шикі кірпіш.' },
      wood: { name: 'Ағаш', note: 'Алтай балқарағайы: оның бөренелерінен қорғандардағы жерлеу қабырларын қиған.' },
      sheep: { name: 'Жүн', note: 'Дала отарларының жүні — киіз, киім және кілемге.' },
      wheat: { name: 'Астық', note: 'Тау бөктеріндегі егістіктің астығы — оны айырбастаған, өзен бойына да сепкен.' },
      ore: { name: 'Кен', note: 'Алтай кені — аң стиліндегі әшекейлерге арналған мыс, темір және алтын.' },
    },
    terrains: {
      hills: { name: 'Тас қыраттары', note: 'Мұнда қорғанға арналған тақтатастар алынады.' },
      forest: { name: 'Алтай тайгасы', note: 'Беткейдегі балқарағайлы ормандар.' },
      pasture: { name: 'Дала', note: 'Жылқыға арналған шетсіз жайылымдар.' },
      fields: { name: 'Тау бөктері егістері', note: 'Жетісу өзендері бойындағы арпа.' },
      mountains: { name: 'Алтын таулар', note: 'Алтайдың көне кеніштері.' },
      desert: { name: 'Таңбалы тастар', note: 'Жануарлар суреті салынған тастар: табыс жоқ, бірақ жау осында тығылады.' },
    },
    pieces: { road: 'Соқпақ', settlement: 'Қоныс', city: 'Патша ордасы' },
    devCards: {
      knight: { name: 'Атты садақшы', flavor: 'Садақшылар шауып келе жатып жауға жебе жаудырып, далаға сіңіп кетеді.' },
      victoryPoint: { name: 'Алтын бұғы', flavor: 'Аң стиліндегі алтын тоғы — текті рудың белгісі.' },
      roadBuilding: { name: 'Арба', flavor: 'Киізбен жабылған арбалар екі жаңа соқпақ салады.' },
      yearOfPlenty: { name: 'Той қазаны', flavor: 'Қола қазан толы: руға бүкіл қысқа жетеді.' },
      monopoly: { name: 'Алым', flavor: 'Көрші тайпалар бір түрлі мүлікті патша ордасына береді.' },
    },
    robber: {
      name: 'Парсы отряды',
      note: 'Ахеменидтер әскері бөтен жерде. Отряд тұрған гекс ештеңе бермейді, ал көрші мал-мүлкінен айырылуы мүмкін.',
    },
    bonuses: { longestRoad: 'Ұлы дала', largestArmy: 'Томирис әскері' },
    intro: [
      'Үш мың жылға жуық бұрын болашақ Қазақстанның даласында сақтар — көшпелі жылқышылар өмір сүрді. Гректер оларды скифтер, парсылар сақтар деп атады.',
      'Сақтар көсемдерін үлкен қорғандарға аттарымен, қаруымен және аң стиліндегі алтын әшекейлерімен — барыс, бұғы, арқар бейнелерімен бірге жерледі.',
      'Б.з.б. 530 жылдарда парсы патшасы Кир массагеттерге қарсы аттанды. Геродот бойынша, Томирис патшайым оның әскерін талқандады, Кирдің өзі қаза тапты.',
      'Сендерге қоныс тұрғызып, патша ордаларын көтеріп, дала бойына соқпақ салу керек. Бөтен отрядтарды жайылымдарыңа жолатпаңдар — руың бірінші болсын!',
    ],
    narration: {
      gameStarted: [
        'Ру кеңесі жиналды! Жайылым мен алтын таулардың бәрін бөліңдер.',
        'Аттар ерттелді, садақ қаптары толы. Ойын басталды!',
        'Дала кең, бірақ үздік жайылым санаулы. Алға!',
      ],
      settlement: [
        '{player}: жаңа қоныс — жылқы өзен бойында жайылып жүр.',
        '{player} — арбалар шеңбер құрып тұрды, қоныстың үстінде түтін.',
        '{player}: жақсы жайылым алынды. Көршілер қабағын шытты.',
      ],
      city: [
        '{player}: енді мұнда патша ордасы — алтын мен тулар.',
        '{player} — қоныс ордаға айналды. Шеберлер алтын барыстарды соғуда.',
        '{player}: патша ордасы — бүкіл далаға естіледі.',
      ],
      road: [
        '{player}: соқпақ салынды, аттар өтті.',
        '{player} — жайылымға жаңа жол.',
        '{player}: арбалар далаға әрі қарай жүріп барады.',
      ],
      seven: [
        'Жеті түсті! Оңтүстіктен шаң: далада парсы отряды.',
        'Жеті — қоныстарда дабыл. Артық жинаған бөліседі.',
        'Жеті! Жылқышылар жылқыны айдап, садақшылар жебені кергісін тартуда.',
      ],
      robberMoved: [
        '{player}: парсылар бөтен жайылымға кетті. Онда енді бос.',
        'Отряд жаңа жерге өтті. {player} — жүріс жасалды, жер әзірге ештеңе бермейді.',
        '{player} — бөтен әскер көршілердің жерінде тұрды.',
      ],
      stole: [
        'Олжа: {victim} → {player}. Бөтен отряд құр қол қайтпайды.',
        'Түнде бір зат кеміді: {victim} → {player}.',
        'Із қарсыластың қонысынан кетеді: {victim} мал-мүлкінен айырылды, {player} ұтты.',
      ],
      knight: [
        '{player}: атты садақшылар шауып келеді — жау қашуда.',
        '{player} — жебе бұлттай ұшып, отряд кетіп барады.',
        '{player}: садақшылар жайылымдарды қайтарып алды.',
      ],
      monopoly: [
        '{player}: көрші рулар алым төлеуде — бүкіл {res}, {count} дана.',
        'Патша ордасына алым: {count} × {res}. Алатын — {player}.',
        '{player} — барлық қоныстан {res}, барлығы {count}.',
      ],
      yearOfPlenty: [
        '{player}: той қазаны толды — таңдауға екі сый.',
        '{player} — қорған түбінде үлкен той.',
        '{player}: рудың жомарт жылы.',
      ],
      roadBuilding: [
        '{player}: арбалар бірден екі соқпақ салды.',
        '{player} — ру көшіп-қонды, жол екі еселенді.',
        '{player}: бір жүрісте екі жаңа соқпақ.',
      ],
      longestRoad: [
        '{player}: бүкіл Ұлы даланы кесіп өтетін соқпақтар.',
        '{player} — Алтайдан Аралға дейін осы жолдармен жүреді.',
        '{player}: Ұлы дала осы қолдарда.',
      ],
      largestArmy: [
        '{player}: Томирис әскерінен кем емес әскер!',
        '{player} — даладағы ең мерген садақшылар.',
        '{player}: мұндай әскермен Кирден де қорықпайсың.',
      ],
      tradeCompleted: [
        'Қол соғысты! {player} мен {victim} айырбасқа риза.',
        'Қорған жанындағы айырбас: {player} мен {victim} мүлік алмасты.',
        'Келісім қымызбен бекітілді: {player} мен {victim} есептесті.',
      ],
      bigHarvest: [
        'Мол жыл! {player}: бірден {n} карта.',
        '{player} — төл мен алтын қатар келді: {n} карта.',
        '{player}: рудың сәті, бір лақтырыста {n} карта.',
      ],
      gameWon: [
        '{player} — даланың ұлы патшасы! Ол туралы аңыз шығарады.',
        'Ру кеңесі шешті: теңдердің ішіндегі бірінші — {player}.',
        '{player}: Алтайдан Аралға дейінгі ең күшті ру!',
      ],
    },
    victory: '{player} — сақтардың ұлы патшасы! Жылқы сансыз, алтын жарқырайды, ал жау даланы айналып өтеді.',
  },
  en: {
    title: 'The Saka',
    subtitle: 'Steppe gold, burial mounds and Queen Tomyris',
    years: '8th–3rd c. BC',
    region: 'Zhetysu, the Altai, Saryarka and the Aral region',
    resources: {
      brick: { name: 'Brick', note: 'Mud brick for winter camps and enclosures.' },
      wood: { name: 'Timber', note: 'Altai larch: its logs were used to build burial chambers in the mounds.' },
      sheep: { name: 'Wool', note: 'Wool from the steppe flocks, for felt, clothing and carpets.' },
      wheat: { name: 'Grain', note: 'Grain from the foothill fields, traded for and also sown by the rivers.' },
      ore: { name: 'Ore', note: 'Altai ore: copper, iron and gold for ornaments in the animal style.' },
    },
    terrains: {
      hills: { name: 'Stone Ridges', note: 'Slabs for the burial mounds are taken here.' },
      forest: { name: 'Altai Taiga', note: 'Larch forests on the slopes.' },
      pasture: { name: 'Steppe', note: 'Boundless pastures for herds of horses.' },
      fields: { name: 'Foothill Fields', note: 'Barley by the rivers of Zhetysu.' },
      mountains: { name: 'Golden Mountains', note: 'The ancient mines of the Altai.' },
      desert: { name: 'Petroglyph Rocks', note: 'Stones carved with animals: no income, but the enemy lurks here.' },
    },
    pieces: { road: 'Trail', settlement: 'Camp', city: 'Royal Camp' },
    devCards: {
      knight: { name: 'Horse Archer', flavor: 'Archers shower the enemy with arrows at full gallop and vanish into the steppe.' },
      victoryPoint: { name: 'Golden Stag', flavor: 'A gold plaque in the animal style: the mark of a noble clan.' },
      roadBuilding: { name: 'Wagon', flavor: 'Felt-covered wagons lay down two new trails.' },
      yearOfPlenty: { name: 'Feast Cauldron', flavor: 'The bronze cauldron is full: the clan has enough for the whole winter.' },
      monopoly: { name: 'Tribute', flavor: 'Neighboring tribes give one kind of goods to the royal camp.' },
    },
    robber: {
      name: 'Persian Detachment',
      note: 'An Achaemenid force on foreign soil. While the detachment stands there, the hex yields nothing, and a neighbor risks losing goods.',
    },
    bonuses: { longestRoad: 'Great Steppe', largestArmy: 'Army of Tomyris' },
    intro: [
      'Nearly three thousand years ago the steppes of future Kazakhstan were home to the Saka, nomadic horse breeders. The Greeks called them Scythians, the Persians Sakas.',
      'The Saka buried their chiefs in great mounds together with horses, weapons and gold ornaments in the animal style: leopards, deer, argali.',
      'Around 530 BC the Persian king Cyrus marched against the Massagetae. According to Herodotus, Queen Tomyris crushed his army, and Cyrus himself was killed.',
      'You will found camps, raise royal camps and lay trails across the steppe. Keep foreign detachments off your pastures, and may your clan be first!',
    ],
    narration: {
      gameStarted: [
        'The council of clans has gathered! Divide the pastures and the golden mountains.',
        'Horses are saddled, quivers are full. The game begins!',
        'The steppe is wide, but the best pastures are few. Onward!',
      ],
      settlement: [
        '{player}: a new camp, with the herd grazing by the river.',
        '{player}: wagons drawn into a circle, smoke over the camp.',
        '{player}: a fine pasture is taken. The neighbors scowl.',
      ],
      city: [
        '{player}: a royal camp now stands here, with gold and banners.',
        '{player}: the camp has grown into a royal seat. Craftsmen forge golden leopards.',
        '{player}: a royal camp, heard across the whole steppe.',
      ],
      road: [
        '{player}: a trail is laid and the horses have passed.',
        '{player}: a new way to the pastures.',
        '{player}: the wagons roll further into the steppe.',
      ],
      seven: [
        'A seven! Dust from the south: a Persian detachment on the steppe.',
        'Seven: alarm in the camps. Whoever hoarded extra will share.',
        'Seven! Herders round up the horses and archers string their bows.',
      ],
      robberMoved: [
        '{player}: the Persians have gone to foreign pastures. It is empty there now.',
        'The detachment has moved to new land. {player} has made the move; the land yields nothing for now.',
        '{player}: a foreign army has halted among the neighbors.',
      ],
      stole: [
        'Plunder: {victim} → {player}. A foreign detachment never leaves empty-handed.',
        'By night one item went missing: {victim} → {player}.',
        'Tracks lead from a rival\'s camp: {victim} is short of goods, {player} comes out ahead.',
      ],
      knight: [
        '{player}: horse archers at full gallop, and the enemy flees.',
        '{player}: arrows fly in a cloud and the detachment withdraws.',
        '{player}: the archers have won the pastures back.',
      ],
      monopoly: [
        '{player}: neighboring clans pay tribute, all the {res}, {count} in all.',
        'Tribute to the royal camp: {count} × {res}. Recipient: {player}.',
        '{player}: {res} from every camp, {count} in total.',
      ],
      yearOfPlenty: [
        '{player}: the feast cauldron is full, with two gifts to choose from.',
        '{player}: a great feast by the burial mound.',
        '{player}: a generous year for the clan.',
      ],
      roadBuilding: [
        '{player}: the wagons laid two trails at once.',
        '{player}: the clan has moved on, and the route is doubled.',
        '{player}: two new trails in a single move.',
      ],
      longestRoad: [
        '{player}: trails across the whole Great Steppe.',
        '{player}: from the Altai to the Aral, people travel by these routes.',
        '{player}: the Great Steppe is in these hands.',
      ],
      largestArmy: [
        '{player}: an army worthy of Tomyris!',
        '{player}: the sharpest archers of the steppe.',
        '{player}: with such an army not even Cyrus is to be feared.',
      ],
      tradeCompleted: [
        'A handshake! {player} and {victim} are pleased with the exchange.',
        'Trading by the mound: {player} and {victim} swapped goods.',
        'The deal is sealed with kumis: {player} and {victim} are even.',
      ],
      bigHarvest: [
        'A generous year! {player}: {n} cards at once.',
        '{player}: newborn livestock and gold together, {n} cards.',
        '{player}: the clan\'s luck, {n} cards in one roll.',
      ],
      gameWon: [
        '{player}: the greatest king of the steppe! Legends will be told of him.',
        'The council of clans has decided: first among equals is {player}.',
        '{player}: the mightiest clan from the Altai to the Aral!',
      ],
    },
    victory: '{player}: the greatest king of the Saka! The herds are countless, the gold shines, and enemies steer clear of the steppe.',
  },
};
