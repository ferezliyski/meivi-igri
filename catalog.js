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
     ordered   cards are played in their written order, not shuffled
     rounds    the choices for the number of cards, when not the usual 15, 30, 50
   A quiz whose text has "topics" asks which of them take part before the game. */
window.MEIVI = window.MEIVI || {};
/* Text files call this to hand over the text of their game. */
MEIVI.texts = {};
MEIVI.text = function (id, text) { MEIVI.texts[id] = text; };
/* The same for the games played on several phones (lang/<language>/multi/<id>.js). */
MEIVI.mtexts = {};
MEIVI.mtext = function (id, text) { MEIVI.mtexts[id] = text; };

MEIVI.catalog = {
  categories: ["couples", "adult", "friends", "quiz"],
  games: [
    { id: "couple", cat: "couples", color: "hot", eng: "match", players: [2, 2], icon: "💞" },
    { id: "date", cat: "couples", color: "hot", eng: "cards", players: [2, 2], icon: "🔥", ordered: true },
    { id: "similar", cat: "couples", color: "mint", eng: "match", players: [2, 2], icon: "👯" },
    { id: "close", cat: "couples", color: "lilac", eng: "cards", players: [2, 2], icon: "💬", ordered: true },
    { id: "spicy", cat: "adult", color: "hot", eng: "cards", players: [2, 2], icon: "🌶️", adult: true },
    { id: "dreams", cat: "couples", color: "sky", eng: "cards", players: [2, 2], icon: "✨" },
    { id: "anniv", cat: "couples", color: "gold", eng: "match", players: [2, 2], icon: "🥂" },
    { id: "sheets", cat: "adult", color: "mint", eng: "match", players: [2, 2], icon: "🛏️", adult: true },
    { id: "party", cat: "adult", color: "hot", eng: "cards", players: [2, 12], icon: "🎉", adult: true, levels: true, modes: true, drink: true },
    { id: "never18", cat: "adult", color: "hot", eng: "cards", players: [3, 12], icon: "🙈", adult: true },
    { id: "who18", cat: "adult", color: "lilac", eng: "cards", players: [3, 12], icon: "😈", adult: true },
    { id: "truth18", cat: "adult", color: "gold", eng: "cards", players: [2, 12], icon: "🤫", adult: true },
    { id: "drink", cat: "adult", color: "sky", eng: "cards", players: [3, 12], icon: "🥃", adult: true },
    { id: "never", cat: "friends", color: "gold", eng: "cards", players: [3, 12], icon: "🙊" },
    { id: "who", cat: "friends", color: "mint", eng: "cards", players: [3, 12], icon: "👉" },
    { id: "truth", cat: "friends", color: "hot", eng: "cards", players: [2, 12], icon: "🎯" },
    { id: "lies", cat: "friends", color: "lilac", eng: "cards", players: [3, 10], icon: "🤥" },
    { id: "hotseat", cat: "friends", color: "hot", eng: "cards", players: [3, 12], icon: "🔥" },
    { id: "quiz", cat: "quiz", color: "sky", eng: "quiz", players: [1, 8], icon: "🧠", rounds: [30, 50, 100] }
  ]
};

/* Games for several phones: every player is on their own phone, all in one room.
   The page asks "how many are you?" and shows the games that fit: "min" is the fewest players, "max" the most
   (a game that is not built yet may have no "max"). A game marked "ready" can be played (its rules are in
   rooms-games.js); the others are only announced. Names are in lang/<language>/multi.js. */
MEIVI.catalog.multi = [
  /* for two */
  { id: "mirror", icon: "👀", color: "lilac", min: 2, max: 2, ready: true },
  { id: "onemind", icon: "💡", color: "mint", min: 2, max: 2, ready: true },
  { id: "letters", icon: "✉️", color: "hot", min: 2, max: 2, ready: true, mood: "sea" },
  { id: "distance", icon: "✈️", color: "sky", min: 2, max: 2, ready: true },
  { id: "wishes18", icon: "🔥", color: "gold", min: 2, max: 2, ready: true, adult: true },
  { id: "knowme", icon: "🎯", color: "lilac", min: 2, max: 2 },
  { id: "pairwho", icon: "👫", color: "lilac", min: 2, max: 2 },
  { id: "memories", icon: "📸", color: "lilac", min: 2, max: 2 },
  { id: "boat", icon: "🚣", color: "mint", min: 2, max: 2 },
  { id: "escape", icon: "🗝️", color: "mint", min: 2, max: 2 },
  { id: "battle", icon: "⚔️", color: "sky", min: 2, max: 2 },
  { id: "wish", icon: "🌠", color: "sky", min: 2, max: 2 },
  { id: "q36", icon: "💬", color: "hot", min: 2, max: 2 },
  { id: "future", icon: "🔭", color: "hot", min: 2, max: 2 },
  { id: "spicydeal", icon: "🌶️", color: "gold", min: 2, max: 2, adult: true },
  /* from three */
  { id: "mole", icon: "🕵️", color: "hot", min: 3, max: 10, ready: true },
  { id: "conquer", icon: "🗺️", color: "sky", min: 3, max: 8, ready: true },
  { id: "whoofus", icon: "👉", color: "gold", min: 3, max: 10, ready: true },
  { id: "bomb", icon: "💣", color: "mint", min: 3, max: 10, ready: true },
  { id: "liar", icon: "🤥", color: "hot", min: 3 },
  { id: "poker", icon: "🃏", color: "hot", min: 3 },
  { id: "bid", icon: "💰", color: "sky", min: 3 },
  { id: "lowest", icon: "🔢", color: "sky", min: 3 },
  { id: "split", icon: "🤝", color: "sky", min: 3 },
  { id: "market", icon: "📈", color: "sky", min: 3 },
  { id: "minority", icon: "⚖️", color: "sky", min: 3 },
  { id: "likeyou", icon: "🧠", color: "gold", min: 3 },
  { id: "trapquiz", icon: "🎣", color: "mint", min: 3 },
  { id: "auction", icon: "🔔", color: "mint", min: 3 },
  /* from four */
  { id: "agents", icon: "🕶️", color: "hot", min: 4 },
  { id: "fakeartist", icon: "🎨", color: "gold", min: 4 },
  { id: "telephone", icon: "☎️", color: "gold", min: 4 },
  { id: "court", icon: "🔨", color: "gold", min: 4 },
  { id: "nowords", icon: "🗣️", color: "lilac", min: 4 },
  /* from five */
  { id: "detectives", icon: "🔎", color: "lilac", min: 5, max: 10, ready: true }
];
