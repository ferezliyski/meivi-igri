/* Meivi games · words of the app itself · Bulgarian
   Buttons, rules and messages. The texts of the games are next to this file, in games/<id>.js.
   A text that depends on a number or on a name is a small function, so that every language can
   build its sentence its own way. Names arrive ready to show (already safe, sometimes in bold). */
MEIVI.ui = {
  title: "Игри от Meivi",
  brand: "Дигитални игри",
  loadError: message => "Грешка при зареждане: " + message,

  /* ---------- first screen: one phone or several ---------- */
  startTitle: "Как ще играете?",
  onePhone: "На един телефон",
  onePhoneText: "Подавате телефона от ръка на ръка.",
  manyPhones: "На няколко телефона",
  manyPhonesText: "Всеки е на своя телефон. Влизате в една стая с код, дори от разстояние.",
  gamesCount: n => n === 1 ? "1 игра" : `${n} игри`,
  soon: "Скоро",
  /* how many games for several phones can be played now, out of all announced */
  multiCount: (ready, all) => ready === 0 ? `${all} игри · Скоро` : ready >= all ? `${all} игри` : `${ready} игри · още ${all - ready} скоро`,
  toStart: "Начало",
  multiTitle: "Всеки играе на своя телефон",
  /* the page of the games for several phones: first "how many are you?", then the games that fit */
  howMany: "Колко сте?",
  sixPlus: "6+",
  multiAll: "Всички игри",
  multiFor: n => ({ 2: "Игри за двама", 3: "Игри за трима", 4: "Игри за четирима", 5: "Игри за петима" })[n] || "Игри за шестима и повече",
  multiNone: "Засега няма готова игра за толкова играчи. Скоро ще има.",
  soonMore: n => n === 1 ? "Очаквайте още 1 игра" : `Очаквайте още ${n} игри`,
  playersShort: (min, max) => min === max ? `${min} души` : `${min}–${max} души`,
  multiNote: "Един отваря стая, другите влизат с код или QR. Докосни игра, за да видиш правилата й.",

  /* ---------- games for one phone ---------- */
  homeTitle: "Избери игра за тази вечер",
  homeNote: (games, shelves) => `${games} игри в ${shelves} категории.`,
  shelvesLabel: "Категории",
  shelves: {
    couples: "За двойки", adult: "18+", friends: "Приятели", family: "Семейство и деца",
    occasions: "Поводи", quiz: "Викторини", holidays: "Празници през годината", travel: "Път, почивка и екип"
  },
  shelfCount: (have, all) => `${have} от ${all}`,
  players: (min, max) => min === max ? `${min} ${min === 1 ? "играч" : "играчи"}` : `${min}–${max} играчи`,
  engines: { cards: "Карти", quiz: "Викторина", match: "За двама" },

  /* ---------- before the game ---------- */
  allGames: "Всички игри",
  how: {
    cards: "Един телефон се подава от ръка на ръка. Четете картата на глас и отбелязвайте кой какво е направил. Всеки може да каже пас.",
    quiz: "Редувате се. Всеки вижда въпрос с четири отговора, а верният носи точка.",
    match: "Отговаряте един по един, без да гледате екрана на другия. После виждате дали сте избрали едно и също."
  },
  heroHow: hero => `Първият в списъка е ${hero}. Докосни име, за да го преместиш най-отпред.`,
  adultOnly: "Играта е само за пълнолетни.",
  playersTitle: n => `Играчи: ${n}`,
  playersNeed: (min, max) => min === max ? `Точно ${min}` : `От ${min} до ${max}`,
  playersStatus: (n, min, max) =>
    n < min ? (n === 0 ? `Напиши имената на играчите. ${min === max ? `Трябват точно ${min}.` : `Трябват поне ${min}.`}` : `Добави още ${min - n}.`)
    : n > max ? `Тази игра е за ${min === max ? "точно" : "най-много"} ${max}. Махни ${n - max}.`
    : n < max ? `Може да започнете. Има място за още ${max - n}.` : "Всички места са заети. Може да започнете.",
  removePlayer: name => `Махни ${name}`,
  heroFirst: hero => "Първо " + hero,
  playerName: "Име на играч",
  add: "Добави",
  modes: "Режими",
  modeHints: { A: "Който го е правил, си признава", V: "Всички сочат един човек", Q: "Въпрос към един играч", D: "Задача към един играч" },
  pickMode: "Избери поне един режим.",
  spice: "Колко пикантно",
  levels: ["Загрявка", "Пикантно", "Без задръжки"],
  penalty: "Наказание при пас",
  sip: "Глътка",
  pointsOnly: "Само точки",
  cardsCount: "Брой карти",
  questionsCount: "Брой въпроси",
  time: {
    cards: { 15: "20–30 мин", 30: "около 45 мин", 50: "1–1,5 часа" },
    match: { 15: "10–15 мин", 30: "20–30 мин", 50: "35–50 мин" },
    quiz: { 15: "5–10 мин", 30: "около 15 мин", 50: "около 25 мин" }
  },
  poolNote: n => `С този избор има ${n} карти, толкова ще изиграете.`,
  start: "Започни играта",
  startAdult: "На 18 или повече сме, започни",

  /* ---------- during the game ---------- */
  back: "Назад",
  backLabel: "Назад към предишната карта",
  progress: (now, all) => `${now} от ${all}`,
  score: "Точки",
  end: "Край",
  cardBack: "Върнахте картата. Отбележете я отново.",

  /* cards: "A" confession, "V" who of us, "Q" question, "D" task, "G" guess */
  kinds: { A: "Признание", V: "Кой от нас", Q: "Въпрос", D: "Задача", G: "Познай" },
  levelLabel: level => `Ниво ${level} от 3`,
  showAnswer: "Виж отговора",
  rules: {
    A: sip => "Който го е правил, си признава. Маркирайте всички признали." + (sip ? " Те отпиват по глътка." : ""),
    V: sip => "Бройте до три и посочете едновременно. Маркирайте избрания." + (sip ? " Той отпива глътка." : ""),
    G: hero => `Всички казват предположенията си, после ${hero} разкрива истината. Маркирайте кой позна.`,
    Q: sip => sip ? "Отговорът носи 1 точка. Пас означава една глътка." : "Отговорът носи 1 точка. Пасът не носи нищо.",
    D: sip => "Изпълнената задача носи 2 точки. Ако включва друг човек, той може да откаже." + (sip ? " Пас означава една глътка." : "")
  },
  questionTo: name => `Въпрос към ${name}`,
  taskFor: name => `Задача за ${name}`,
  ask: { A: "Кой си призна?", V: "Кого посочихте?", G: "Кой позна?" },
  saveNext: "Запиши и напред",
  nobodyNext: "Никой, напред",
  pass: "Пас",
  answered: "Отговорих",
  done: "Изпълнено",
  marked: names => `Отбелязани: ${names}`,
  guessedBy: names => `Познаха: ${names}`,
  saidPass: name => `${name} каза пас`,

  /* quiz */
  turn: name => `На ход е ${name}`,
  right: "Вярно! +1 точка",
  rightIs: answer => `Верният отговор е ${answer}`,
  next: "Напред",

  /* for two */
  handTo: "Подайте телефона на",
  otherLooksAway: "Другият не гледа екрана.",
  forYourself: "Отговаряш за себе си.",
  guessOther: "Познаваш отговора на другия.",
  oneByOne: "Отговаряте един след друг.",
  gotPhone: "Телефонът е у мен",
  answers: name => `Отговаря ${name}`,
  whichOfTwo: question => "Кой от двамата " + question,
  same: "Съвпадение",
  different: "Разминаване",

  /* ---------- points and the end ---------- */
  colPlayer: "Играч",
  colRight: "Верни",
  colPointed: "Посочван",
  colPoints: "Точки",
  colPass: "Пас",
  scoreSoFar: "Точки дотук",
  backToPlay: "Обратно към играта",
  and: "и",
  tier: percent => percent >= 85 ? "Един ум в две тела" : percent >= 65 ? "Силен отбор" : percent >= 40 ? "Има за какво да си говорите" : "Противоположностите се привличат",
  guessed: name => `${name} позна`,
  outOf: (part, all) => `${part} от ${all}`,
  knowsBetter: "По-добре познава другия",
  matches: "Съвпадения",
  winner: "Победител",
  result: "Резултат",
  rightOutOf: (part, all) => `${part} от ${all} верни`,
  finalRanking: "Крайно класиране",
  noRight: "Нито един верен отговор",
  passKing: "Крал на паса",
  recap: "Равносметката",
  matchWord: "съвпадение",
  ranking: "Класиране",
  playToo: site => `Играй и ти на ${site}`,
  share: (game, percent, title, lines, site) => `${game} · игра от Meivi\n${percent ? percent + " съвпадение. " : ""}${title}\n${lines}\nИграй и ти: ${site}`,
  copy: "Копирай резултата за споделяне",
  copied: "Копирано",
  again: "Играй пак",
  backToGame: "Назад към играта",
  storyTip: "Направи снимка на картата и я пусни в стори.",

  /* ---------- games for several phones: the room ---------- */
  rooms: {
    room: code => `Стая ${code}`,
    roomCode: "Код на стаята",
    scan: site => `Другите сканират кода с камерата си или отварят ${site}, избират „Влез в стая“ и пишат кода.`,
    inRoom: n => `В стаята: ${n}`,
    hostTag: "домакин",
    canStart: "Когато всички са вътре, започнете играта.",
    waitHost: "Чакаме домакинът да започне играта.",
    needPlayers: (min, max, n) => n > max ? `Играта е за най-много ${max} играчи.`
      : min === max ? `Играта е за точно ${min}. Чакаме още ${min - n}.` : `Трябват поне ${min} играчи. Чакаме още ${min - n}.`,
    start: "Започни играта",
    closeRoom: "Затвори стаята",
    leave: "Излез от стаята",
    again: "Нова игра със същите хора",
    endGame: "Прекрати играта",
    sure: "Сигурно ли е? Докосни пак",
    gameOver: "Край на играта",
    lateJoin: "Играта вече върви. Ще се включиш в следващата.",
    connecting: "Свързване…",
    noRoom: "Търсим стаята. Провери кода или изчакай домакина да я отвори.",
    hostAway: "Домакинът изгуби връзка. Изчакайте да се върне.",
    offline: "Няма връзка. Опитваме пак…",
    closed: "Домакинът затвори стаята.",
    backToGames: "Към игрите",
    waiting: names => `Чакаме: ${names}`,
    sent: "Изпратено",
    send: "Изпрати",
    rules: "Правила",
    close: "Затвори",
    create: "Създай стая",
    createAdult: "На 18 или повече сме, създай стая",
    joinCode: "Влез с код",
    joinRoom: "Влез в стая",
    yourName: "Твоето име",
    namePh: "Как да те виждат другите",
    codePh: "5 цифри",
    enter: "Влез",
    make: "Отвори стаята",
    cancel: "Отказ",
    badCode: "Кодът е от 5 цифри.",
    needName: "Напиши името си.",
    noServer: "Стаите още не са пуснати. Скоро ще може да играете.",
    resume: code => `Беше в стая ${code}. Връщаш ли се?`,
    resumeYes: "Върни ме в стаята",
    resumeNo: "Не, излизам",
    /* shared by the games */
    round: (now, all) => `Рунд ${now} от ${all}`,
    nextRound: "Следващ рунд",
    toEnd: "Виж крайния резултат",
    skipWait: "Продължи без чакане",
    scores: "Точки",
    winner: "Победител"
  },

  /* Names an early version filled in by itself ("Играч 1"); they are dropped when names are read back. */
  autoName: /^Играч \d+$/
};
