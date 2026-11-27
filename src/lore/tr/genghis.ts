import type { LoreTr } from './types';

// Перевод пакета «genghis» (названия, вступление, рассказчик). Факты — в genghis.facts.ts.
export const TR: LoreTr = {
  kz: {
    title: 'Шыңғыс хан дәуірі',
    subtitle: 'Ұлы дала, Жібек жолының керуендері және Жошы ұлысы',
    years: '1206–1269',
    region: 'Ұлы дала: Алтай мен Жетісудан Сырдария мен Еділге дейін',
    resources: {
      brick: { name: 'Кірпіш', note: 'Саз балшықтан жасалған шикі кірпіш: Отырар, Сығанақ және Сырдарияның басқа қалаларының қабырғалары осыдан тұрғызылған.' },
      wood: { name: 'Ағаш', note: 'Киіз үйдің сүйегіне, арбаға, садақ пен қамал бұзатын құралдарға жұмсалады.' },
      sheep: { name: 'Жүн', note: 'Көшпенділердің басты байлығы: ет, жүн, киіз үйге арналған киіз.' },
      wheat: { name: 'Астық', note: 'Сырдария мен Жетісу оазистерінің наны: оны егіншілерден малға айырбастайды.' },
      ore: { name: 'Кен', note: 'Қылыш, жебе ұштары, үзеңгі мен сауыт. Дала ерте заманнан кенге бай.' },
    },
    terrains: {
      hills: { name: 'Балшықты төбелер', note: 'Сырдария жағасы: мұнда балшық илеп, кірпіш кептіреді.' },
      forest: { name: 'Алтай ормандары', note: 'Алтай беткейіндегі орман мен өзен бойының тоғайы.' },
      pasture: { name: 'Жайлау', note: 'Жазғы жайылым: отар мен жылқыға кең өріс.' },
      fields: { name: 'Оазис', note: 'Сырдария қалаларының айналасындағы егістік пен арықтар.' },
      mountains: { name: 'Кенді таулар', note: 'Темір мен мыс шығарылатын кеніштер.' },
      desert: { name: 'Бетпақдала', note: 'Аш дала: су да, шөп те жоқ. Мұнда барымташылар торуылдайды.' },
    },
    pieces: { road: 'Керуен жолы', settlement: 'Ауыл', city: 'Қала' },
    devCards: {
      knight: { name: 'Нөкер', flavor: 'Хан нөкері барымташыларды жеріңізден қуады.' },
      victoryPoint: { name: 'Пайза', flavor: 'Хан пластинасы: иесіне мемлекеттің барлық жолы ашық.' },
      roadBuilding: { name: 'Жам қызметі', flavor: 'Ауыстыратын жаңа аттары бар екі бекет: хабаршы жебедей ұшады.' },
      yearOfPlenty: { name: 'Керуен', flavor: 'Жібек жолының саудагерлері сендерге жетпегенді әкелді.' },
      monopoly: { name: 'Хан салығы', flavor: 'Баскақ барлық ұлыстан бір түрлі мал-мүлік жинайды.' },
    },
    robber: {
      name: 'Барымта',
      note: 'Далада мал айдап әкету. Барымташылар тұрған жер ештеңе бермейді, ал көрші мал-мүлкінен айырылуы мүмкін.',
    },
    bonuses: { longestRoad: 'Ұлы Жібек жолы', largestArmy: 'Ең күшті түмен' },
    intro: [
      '1206 жылдың көктемі. Онон өзеніндегі құрылтайда Темучинді ақ киізге көтереді: енді ол — бүкіл моңғолдардың билеушісі Шыңғыс хан. Ғасырлар бойы жауласқан дала тайпалары бір әскерге айналады.',
      'Батыста болашақ Қазақстанның жері жатыр: Ертістен Дунайға дейінгі қыпшақ көшпелері, Жетісудағы найман, Сырдарияның бай қалалары — Отырар, Сығанақ, Ашнас. Олар арқылы Ұлы Жібек жолының керуендері өтеді.',
      '1218 жылы Отырарда хан керуені қырылып, дала қозғалысқа келеді. Ханның үлкен ұлы Жошыға Ертістен батыстағы барлық жер уәде етіледі — осылай Жошы ұлысы пайда болады.',
      'Сендерге ауыл тұрғызып, қала көтеріп, керуен жолдары мен жам бекеттерін тарту керек. Отарларды барымтадан сақтаңдар — ұлысың даладағы бірінші болсын!',
    ],
    narration: {
      gameStarted: [
        'Құрылтай ашылды! Ұлыс хандары, даланы бөлісіңдер, бірақ ренжіспей.',
        'Ақ киіз төселді, аттар ерттелді. Ойын басталды!',
        'Дала кең, бірақ жақсы жайылым аз. Алға, басқалар алмай тұрып!',
      ],
      settlement: [
        '{player}: жаңа ауыл — киіз үйлердің түтіні алыстан көрінеді.',
        '{player} — киіз үйлер бір таңда тігіліп, ауыл су бойына орнады.',
        '{player}: су жанындағы жақсы орын алынды. Көршілері үнсіз қызғанады.',
      ],
      city: [
        '{player}: қабырғасы сыдырғыдан, базары мен теңге сарайы бар қала.',
        '{player} — ауыл қалаға айналды. Саудагерлер керуен сарай іздеп жүр.',
        '{player}: енді мұнда Отырардың гүлденген кезіндей қала бар.',
      ],
      road: [
        '{player}: керуен жолы салынды. Түйелер риза.',
        '{player} — жаңа жам бекеті, хабаршылар аттарын шауып келе жатып ауыстырады.',
        '{player}: дала арқылы соқпақ ашылды, құдықтар белгіленді, жолға шығуға болады.',
      ],
      seven: [
        'Жеті түсті! Далада дабыл: барымташылар кәсіпке шықты.',
        'Жеті — көкжиекте шаң. Артық мал жинаған бөліседі.',
        'Жеті! Күзетші иттер үріп, қойшылар отарын санап жатыр.',
      ],
      robberMoved: [
        '{player}: барымташыларға жаңа жайылым көрсетілді. Онда енді тып-тыныш, ештеңе жоқ.',
        'Барымта жаңа жерге көшті. {player} — жүріс жасалды, жер әзірге ештеңе бермейді.',
        '{player} — сойқан жігіттер бөтен жайылымға айдалды.',
      ],
      stole: [
        'Барымта: {victim} → {player}. Далада бұл — көне кәсіп.',
        'Түнде бір зат кеміді: {victim} → {player}.',
        'Із қарсыластың киіз үйлерінен кетеді: {victim} мал-мүлкінен айырылды, {player} ұтты.',
      ],
      knight: [
        '{player}: нөкерлер аттанды, барымташылар артына қарамай қашты.',
        '{player} — нөкерлер ерде. Бөтенге бұл далада орын жоқ.',
        '{player}: қосын көтерілді, ұлыста тәртіп орнады.',
      ],
      monopoly: [
        '{player}: баскақ ұлыстарды аралап, {res} жинады — {count} дана. Заң — заң.',
        'Хан салығы: барлық {res} қазынаға кетеді, барлығы {count}. Жинаушы — {player}.',
        '{player} — салық жиналды: {count} × {res}. Көршілер күрсінеді.',
      ],
      yearOfPlenty: [
        '{player}: Жібек жолынан керуен келді — көңіліңе жағанды таңда.',
        '{player} — саудагерлер тауарын жайды: екі түйіншек сыйға.',
        '{player}: керуенбасы иіліп, мол сый тастап кетті.',
      ],
      roadBuilding: [
        '{player}: бірден екі жам бекеті — хабаршылар желден жүйрік.',
        '{player} — жам қызметі жұмыс істеп тұр, екі жаңа аралық дайын.',
        '{player}: жолдың екі жаңа бөлігі. Хан поштасы күтпейді!',
      ],
      longestRoad: [
        '{player}: ең ұзын жол — міне, Ұлы Жібек жолы!',
        '{player} — керуендер осы жолдармен даланың бір шетінен екінші шетіне дейін жүреді.',
        '{player}: Ұлы Жібек жолы оның қолында. Баж — осы қолдарда.',
      ],
      largestArmy: [
        '{player}: ең күшті түмен. Мұндай көршімен дос болған жөн.',
        '{player} — даладағы ең үлкен әскер.',
        '{player}: түменнің теңдесі жоқ, он мың қылыш — ойыншық емес.',
      ],
      tradeCompleted: [
        'Қол соғысты! {player} мен {victim} айырбасқа риза.',
        'Базар күні сәтті болды: {player} мен {victim} тауар алмасты.',
        'Келісім қымызбен бекітілді: {player} мен {victim} есептесті.',
      ],
      bigHarvest: [
        'Мол жыл! {player}: бірден {n} карта.',
        '{player} — төл мен астық қатар келді: сандыққа {n} карта.',
        '{player}: Тәңір мейірімді, бір лақтырыста {n} карта.',
      ],
      gameWon: [
        '{player} — ақ киізге көтерілді, дала ханды таныды!',
        'Құрылтай шешті: теңдердің ішіндегі бірінші — {player}.',
        '{player}: Ұлы даладағы ең күшті ұлыс. Бүкіл өңірге той!',
      ],
    },
    victory: '{player} — дала Алтайдан Сырдарияға дейін біріктірілді. Керуендер тыныш жүреді, хабаршылар жылдам шабады: даңқты билік!',
  },
  en: {
    title: 'Age of Genghis Khan',
    subtitle: 'The Great Steppe, Silk Road caravans and the Ulus of Jochi',
    years: '1206–1269',
    region: 'The Great Steppe: from the Altai and Zhetysu to the Syr Darya and the Volga',
    resources: {
      brick: { name: 'Brick', note: 'Mud brick from clay: the walls of Otrar, Signak and other Syr Darya cities are built of it.' },
      wood: { name: 'Timber', note: 'Goes into yurt frames, wagons, bows and siege engines.' },
      sheep: { name: 'Wool', note: 'The nomad\'s chief wealth: meat, wool and felt for the yurt.' },
      wheat: { name: 'Grain', note: 'Bread of the Syr Darya and Zhetysu oases, traded from farmers for livestock.' },
      ore: { name: 'Ore', note: 'Sabers, arrowheads, stirrups and armor. The steppe has long been rich in ore.' },
    },
    terrains: {
      hills: { name: 'Clay Hills', note: 'The banks of the Syr Darya, where clay is kneaded and brick dried.' },
      forest: { name: 'Altai Forests', note: 'Woodland on the Altai slopes and river thickets.' },
      pasture: { name: 'Jailau', note: 'Summer pastures: wide open ground for flocks and herds.' },
      fields: { name: 'Oasis', note: 'Fields and irrigation channels around the Syr Darya cities.' },
      mountains: { name: 'Ore Mountains', note: 'Mines that yield iron and copper.' },
      desert: { name: 'Betpak-Dala', note: 'The Hungry Steppe: no water, no grass. Raiders lie in wait here.' },
    },
    pieces: { road: 'Caravan Route', settlement: 'Aul', city: 'City' },
    devCards: {
      knight: { name: 'Nöker', flavor: 'The khan\'s retainer drives raiders off your lands.' },
      victoryPoint: { name: 'Paiza', flavor: 'The khan\'s tablet: every road of the empire is open to its bearer.' },
      roadBuilding: { name: 'Yam Service', flavor: 'Two new relay stations with fresh horses: the courier flies like an arrow.' },
      yearOfPlenty: { name: 'Caravan', flavor: 'Silk Road merchants have brought what you were missing.' },
      monopoly: { name: 'Khan\'s Tribute', flavor: 'The baskak collects one kind of goods from every ulus.' },
    },
    robber: {
      name: 'Barymta',
      note: 'Cattle raiding on the steppe. While raiders stand on a hex it yields nothing, and a neighbor risks losing goods.',
    },
    bonuses: { longestRoad: 'Great Silk Road', largestArmy: 'Mightiest Tumen' },
    intro: [
      'Spring, 1206. At the kurultai on the Onon River, Temujin is raised on white felt: from now on he is Genghis Khan, ruler of all the Mongols. Steppe tribes that fought for centuries become a single army.',
      'To the west lie the lands of future Kazakhstan: the Kipchak pastures from the Irtysh to the Danube, the Naimans in Zhetysu, and the rich Syr Darya cities of Otrar, Signak and Ashnas. Great Silk Road caravans pass through them.',
      'In 1218 a caravan sent by the khan is destroyed at Otrar, and the steppe stirs. The khan\'s eldest son, Jochi, is promised all lands west of the Irtysh, and so the Ulus of Jochi is born.',
      'You will found auls, raise cities, and lay caravan routes and yam stations. Guard your flocks from barymta, and may your ulus be first on the steppe!',
    ],
    narration: {
      gameStarted: [
        'The kurultai is open! Khans of the uluses, divide the steppe, and no hard feelings.',
        'White felt is spread, horses are saddled. The game begins!',
        'The steppe is wide, but good pastures are few. Ride before they are taken!',
      ],
      settlement: [
        '{player}: a new aul, with yurt smoke visible from afar.',
        '{player}: yurts raised in a single morning, and an aul stands by the water.',
        '{player}: a fine spot by the water is taken. The neighbors envy in silence.',
      ],
      city: [
        '{player}: a city with adobe walls, a bazaar and a mint.',
        '{player}: the aul has grown into a city. Merchants already seek a caravanserai.',
        '{player}: a city now stands here, no worse than Otrar in its best years.',
      ],
      road: [
        '{player}: a caravan route is laid. The camels are content.',
        '{player}: a new yam station, where couriers change horses at full gallop.',
        '{player}: a trail across the steppe, wells marked, ready to ride.',
      ],
      seven: [
        'A seven! Alarm on the steppe: raiders are out on the hunt.',
        'Seven: dust on the horizon. Whoever hoarded extra goods will share.',
        'Seven! Watchdogs bark and herdsmen recount their flocks.',
      ],
      robberMoved: [
        '{player}: the raiders are shown a new pasture. It is quiet and empty there now.',
        'The barymta has moved to new land. {player} has made the move; the land yields nothing for now.',
        '{player}: the rough riders are sent off to foreign pastures.',
      ],
      stole: [
        'Barymta: {victim} → {player}. On the steppe it is an old trade.',
        'By night one item went missing: {victim} → {player}.',
        'Tracks lead from a rival\'s yurts: {victim} is short of goods, {player} comes out ahead.',
      ],
      knight: [
        '{player}: the nökers are sent out and the raiders flee without looking back.',
        '{player}: nökers in the saddle. Strangers are not welcome on this steppe.',
        '{player}: the retinue is raised and order holds in the ulus.',
      ],
      monopoly: [
        '{player}: the baskak rode through the uluses and gathered {res}: {count} in all. The Yasa is the Yasa.',
        'The khan\'s tribute: all {res} goes to the treasury, {count} in total. Collector: {player}.',
        '{player}: the tribute is gathered, {count} × {res}. The neighbors sigh.',
      ],
      yearOfPlenty: [
        '{player}: a caravan arrives from the Silk Road. Choose what your heart desires.',
        '{player}: merchants spread out their wares, two bundles as a gift.',
        '{player}: the caravan leader bows and leaves generous gifts.',
      ],
      roadBuilding: [
        '{player}: two yam stations at once, and couriers fly faster than the wind.',
        '{player}: the yam service is at work, two new stages ready.',
        '{player}: two new stretches of road. The khan\'s post will not wait!',
      ],
      longestRoad: [
        '{player}: the longest route, the Great Silk Road itself!',
        '{player}: caravans travel these roads from one edge of the steppe to the other.',
        '{player}: the Great Silk Road is his. The toll is in these hands.',
      ],
      largestArmy: [
        '{player}: the mightiest tumen. Better to be friends with such a neighbor.',
        '{player}: the largest army on the steppe.',
        '{player}: the tumen has no equal, and ten thousand sabers are no joke.',
      ],
      tradeCompleted: [
        'A handshake! {player} and {victim} are pleased with the exchange.',
        'A good market day: {player} and {victim} swapped goods.',
        'The deal is sealed with kumis: {player} and {victim} are even.',
      ],
      bigHarvest: [
        'A generous year! {player}: {n} cards at once.',
        '{player}: newborn livestock and harvest together, {n} cards into the chest.',
        '{player}: Tengri is merciful, {n} cards in one roll.',
      ],
      gameWon: [
        '{player} is raised on white felt, and the steppe recognizes its khan!',
        'The kurultai has decided: first among equals is {player}.',
        '{player}: the mightiest ulus of the Great Steppe. A feast for the whole region!',
      ],
    },
    victory: '{player} has united the steppe from the Altai to the Syr Darya. Caravans travel in peace, couriers ride fast: a glorious reign!',
  },
};
