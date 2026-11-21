/* Meivi games: the catalogue.
   What every game is, with no text in it, so it is the same for every language and country.
   The texts of a game are in lang/<language>/games/<id>.js; a game without a text file in the
   language of the site is simply not shown.

   categories  the shelves of the home screen, in the order they are shown
   games       in the order they are shown inside their shelf (the first one gets the big tile)
     cat       shelf the game stands on
     color     colour of its tile and cards (a class "c-<color>" in the styles)
     eng       how it is played: "cards" (cards passed around), "quiz" (four answers), "match" (two people)
     players   fewest and most players
     adult     18+ only            levels  has three levels of spice
     modes     card kinds can be switched on and off      drink  offers "a sip" as the penalty for a pass
     ordered   cards are played in their written order, not shuffled */
window.MEIVI = window.MEIVI || {};
/* Text files call this to hand over the text of their game. */
MEIVI.texts = {};
MEIVI.text = function (id, text) { MEIVI.texts[id] = text; };
/* The same for the games played on several phones (lang/<language>/multi/<id>.js). */
MEIVI.mtexts = {};
MEIVI.mtext = function (id, text) { MEIVI.mtexts[id] = text; };

MEIVI.catalog = {
  categories: ["couples", "adult", "friends", "family", "occasions", "quiz", "holidays", "travel"],
  games: [
    { id: "couple", cat: "couples", color: "hot", eng: "match", players: [2, 2], icon: "💞" },
    { id: "girls", cat: "friends", color: "lilac", eng: "cards", players: [2, 10], icon: "💅" },
    { id: "family", cat: "family", color: "mint", eng: "cards", players: [2, 10], icon: "🏡" },
    { id: "zodiac", cat: "quiz", color: "sky", eng: "quiz", players: [1, 8], icon: "🔮" },
    { id: "xmas", cat: "holidays", color: "gold", eng: "quiz", players: [1, 8], icon: "🎄" },
    { id: "hen", cat: "occasions", color: "hot", eng: "cards", players: [3, 12], icon: "👰" },
    { id: "wedding", cat: "occasions", color: "gold", eng: "match", players: [2, 2], icon: "💍" },
    { id: "bday", cat: "occasions", color: "lilac", eng: "cards", players: [3, 12], icon: "🎂" },
    { id: "baby", cat: "occasions", color: "mint", eng: "quiz", players: [1, 8], icon: "🍼" },
    { id: "class", cat: "occasions", color: "sky", eng: "cards", players: [3, 12], icon: "🎓" },
    { id: "auto", cat: "quiz", color: "hot", eng: "quiz", players: [1, 8], icon: "🏎️" },
    { id: "team", cat: "travel", color: "sky", eng: "cards", players: [3, 12], icon: "💼" },
    { id: "road", cat: "travel", color: "mint", eng: "cards", players: [2, 7], icon: "🚗" },
    { id: "date", cat: "couples", color: "hot", eng: "cards", players: [2, 2], icon: "🔥", ordered: true },
    { id: "bg", cat: "quiz", color: "gold", eng: "quiz", players: [1, 8], icon: "🇧🇬" },
    { id: "similar", cat: "couples", color: "mint", eng: "match", players: [2, 2], icon: "👯" },
    { id: "close", cat: "couples", color: "lilac", eng: "cards", players: [2, 2], icon: "💬", ordered: true },
    { id: "spicy", cat: "adult", color: "hot", eng: "cards", players: [2, 2], icon: "🌶️", adult: true },
    { id: "dreams", cat: "couples", color: "sky", eng: "cards", players: [2, 2], icon: "✨" },
    { id: "anniv", cat: "couples", color: "gold", eng: "match", players: [2, 2], icon: "🥂" },
    { id: "party", cat: "adult", color: "hot", eng: "cards", players: [2, 12], icon: "🎉", adult: true, levels: true, modes: true, drink: true },
    { id: "never18", cat: "adult", color: "hot", eng: "cards", players: [3, 12], icon: "🙈", adult: true },
    { id: "who18", cat: "adult", color: "lilac", eng: "cards", players: [3, 12], icon: "😈", adult: true },
    { id: "truth18", cat: "adult", color: "gold", eng: "cards", players: [2, 12], icon: "🤫", adult: true },
    { id: "drink", cat: "adult", color: "sky", eng: "cards", players: [3, 12], icon: "🥃", adult: true },
    { id: "sheets", cat: "adult", color: "mint", eng: "match", players: [2, 2], icon: "🛏️", adult: true },
    { id: "distance", cat: "couples", color: "sky", eng: "cards", players: [2, 2], icon: "✈️" },
    { id: "never", cat: "friends", color: "gold", eng: "cards", players: [3, 12], icon: "🙊" },
    { id: "who", cat: "friends", color: "mint", eng: "cards", players: [3, 12], icon: "👉" },
    { id: "truth", cat: "friends", color: "hot", eng: "cards", players: [2, 12], icon: "🎯" },
    { id: "guys", cat: "friends", color: "sky", eng: "cards", players: [3, 12], icon: "🍻" },
    { id: "lies", cat: "friends", color: "lilac", eng: "cards", players: [3, 10], icon: "🤥" },
    { id: "hotseat", cat: "friends", color: "hot", eng: "cards", players: [3, 12], icon: "🔥" },
    { id: "kids", cat: "family", color: "sky", eng: "quiz", players: [1, 8], icon: "🧒" },
    { id: "kidsvs", cat: "family", color: "gold", eng: "cards", players: [2, 10], icon: "⚔️" },
    { id: "mime", cat: "family", color: "mint", eng: "cards", players: [3, 10], icon: "🤐" },
    { id: "riddles", cat: "family", color: "lilac", eng: "cards", players: [2, 8], icon: "🧩" },
    { id: "grand", cat: "family", color: "gold", eng: "cards", players: [2, 10], icon: "👵" },
    { id: "parents", cat: "family", color: "hot", eng: "cards", players: [3, 8], icon: "👪" },
    { id: "stag", cat: "occasions", color: "sky", eng: "cards", players: [3, 12], icon: "🤵" },
    { id: "prom", cat: "occasions", color: "gold", eng: "cards", players: [3, 12], icon: "🎓" },
    { id: "nye", cat: "holidays", color: "gold", eng: "cards", players: [3, 12], icon: "🎆" },
    { id: "valentine", cat: "holidays", color: "hot", eng: "cards", players: [2, 2], icon: "💘" },
    { id: "march8", cat: "holidays", color: "lilac", eng: "cards", players: [2, 12], icon: "💐" },
    { id: "easter", cat: "holidays", color: "mint", eng: "quiz", players: [1, 8], icon: "🥚" },
    { id: "dec8", cat: "holidays", color: "sky", eng: "cards", players: [3, 12], icon: "🍾" },
    { id: "nameday", cat: "holidays", color: "mint", eng: "cards", players: [3, 12], icon: "🎈" },
    { id: "football", cat: "quiz", color: "mint", eng: "quiz", players: [1, 8], icon: "⚽" },
    { id: "music", cat: "quiz", color: "lilac", eng: "quiz", players: [1, 8], icon: "🎶" },
    { id: "cinema", cat: "quiz", color: "hot", eng: "quiz", players: [1, 8], icon: "🎬" },
    { id: "general", cat: "quiz", color: "sky", eng: "quiz", players: [1, 8], icon: "🧠" },
    { id: "beach", cat: "travel", color: "sky", eng: "cards", players: [2, 10], icon: "🏖️" },
    { id: "hut", cat: "travel", color: "mint", eng: "cards", players: [2, 10], icon: "🏔️" },
    { id: "fire", cat: "travel", color: "gold", eng: "cards", players: [2, 12], icon: "🔥" },
    { id: "table", cat: "travel", color: "hot", eng: "cards", players: [3, 12], icon: "🍽️" },
    { id: "meet", cat: "travel", color: "lilac", eng: "cards", players: [2, 10], icon: "👋" }
  ]
};

/* Games for several phones: every player is on their own phone, all in one room.
   A game marked "ready" can be played (its rules are in rooms-games.js, "players" is fewest and most);
   the others are only announced on the page.
   Two groups (for a company, for a couple), each with its shelves. Names are in lang/<language>/multi.js. */
MEIVI.catalog.multi = [
  { id: "group", shelves: [
    { id: "bluff", color: "hot", games: [ { id: "mole", icon: "🕵️", ready: true, players: [3, 10] }, { id: "agents", icon: "🕶️" }, { id: "liar", icon: "🤥" }, { id: "poker", icon: "🃏" } ] },
    { id: "tactics", color: "sky", games: [ { id: "conquer", icon: "🗺️", ready: true, players: [3, 8] }, { id: "bid", icon: "💰" }, { id: "lowest", icon: "🔢" }, { id: "split", icon: "🤝" }, { id: "market", icon: "📈" }, { id: "minority", icon: "⚖️" } ] },
    { id: "fun", color: "gold", games: [ { id: "whoofus", icon: "👉", ready: true, players: [3, 10] }, { id: "fakeartist", icon: "🎨" }, { id: "telephone", icon: "☎️" }, { id: "likeyou", icon: "🧠" }, { id: "court", icon: "🔨" } ] },
    { id: "speed", color: "mint", games: [ { id: "trapquiz", icon: "🎣" }, { id: "bomb", icon: "💣", ready: true, players: [3, 10] }, { id: "auction", icon: "🔔" } ] },
    { id: "teams", color: "lilac", games: [ { id: "nowords", icon: "🗣️" }, { id: "detectives", icon: "🔎", ready: true, players: [5, 10] } ] }
  ] },
  { id: "pairs", shelves: [
    { id: "know", color: "lilac", games: [ { id: "mirror", icon: "👀", ready: true, players: [2, 2] }, { id: "knowme", icon: "🎯" }, { id: "pairwho", icon: "👫" }, { id: "memories", icon: "📸" } ] },
    { id: "together", color: "mint", games: [ { id: "onemind", icon: "💡", ready: true, players: [2, 2] }, { id: "boat", icon: "🚣" }, { id: "escape", icon: "🗝️" } ] },
    { id: "versus", color: "sky", games: [ { id: "battle", icon: "⚔️" }, { id: "deal", icon: "📝", ready: true, players: [2, 2] }, { id: "wish", icon: "🌠" } ] },
    { id: "romantic", color: "hot", games: [ { id: "q36", icon: "💬" }, { id: "letters", icon: "✉️", ready: true, players: [2, 2] }, { id: "future", icon: "🔭" } ] },
    { id: "spicy", color: "gold", games: [ { id: "spicydeal", icon: "🌶️", adult: true }, { id: "wishes18", icon: "🔥", ready: true, players: [2, 2], adult: true } ] }
  ] }
];
