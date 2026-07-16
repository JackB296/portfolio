// Short film reviews shown in the theater's focused-detail panel, beside a
// small low-resolution poster. The writing is the point here: the poster is a
// thumbnail-sized identifier next to genuine criticism, which is why the
// film-credits page frames the posters as commentary rather than decoration.
//
// Keyed by film grade id (see lib/grades.ts). All reviews and ratings are
// Jack's own, lightly copyedited.

export type FilmReview = {
  /** 0–5, matching Jack's Letterboxd rating. Half steps allowed. */
  rating: number;
  /** One short paragraph. Rendered as the primary text of the detail panel. */
  body: string;
};

export const filmReviews: Record<string, FilmReview> = {
  casablanca: {
    rating: 4,
    body: "Rick is who I want and don't want to be all at once. He's an amazingly written, complex character of a kind you rarely see. The shield of detachment he wears slowly breaks down, and the final ten minutes are where he transforms, finally finding self-fulfillment through an act of true altruism.",
  },
  matrix: {
    rating: 5,
    body: "One of my favorite movies of all time. This is the blend of computers and philosophy the world needed, and it will stay relevant for years to come. Not to mention it's built on the allegory of the cave, one of my favorite philosophical concepts.",
  },
  "blade-runner": {
    rating: 4,
    body: "Nothing better than a grim cyberpunk future, and this delivers that aesthetic with a great story and a beautiful soundtrack. This movie and its original only become more relevant as AI booms and the line between real and artificial thins. I have watched it twice: once believing there is a line and always will be, and once believing there is none. What I found is that the line is just something we make up in our heads. Where do intelligence and artificial intelligence really differ, if something can feel suffering?",
  },
  "space-odyssey": {
    rating: 4.5,
    body: "The match cut is, and always will be, one of the greatest cuts in history. Beyond being aesthetically pleasing, it says that even when we conquer space, we are still fundamentally primitive apes driven by violence and survival instinct.",
  },
  dune: {
    rating: 5,
    body: "All hail Villeneuve. To take a story as complex as Dune and do it justice is truly impressive. The commentary on politics, ecology, religion, and human evolution through the lens of a far future opens your mind to analyzing human behavior and psychology in ways you've never thought of before.",
  },
  "the-batman": {
    rating: 4.5,
    body: "Paul Dano did not let me down with his incredible performance as the Riddler. Batman needs his villains to give his mission meaning, and they need him to validate their chaotic existences. It's beautiful.",
  },
  parasite: {
    rating: 4.5,
    body: "Bong Joon Ho is one of my favorite directors, and this is his magnum opus: social commentary sharper than anything he'd done before. I'm glad he realized his dream of getting his message to viewers around the world.",
  },
  arrival: {
    rating: 5,
    body: "The sound in this movie is some of the best ever, between Jóhannsson's score and the incredible house-shaking sound effects. A film about determinism and free will that will leave you thinking about your own life.",
  },
  "fury-road": {
    rating: 5,
    body: "One of, if not the, best action movies of all time. Truly revolutionary; there is nothing else like it. Every little thing has you thinking, wow, I never would have thought of that. I love a movie with so many details you can tell genuine effort went into, and this is one.",
  },
  her: {
    rating: 4.5,
    body: "One of the saddest movies ever made, and it only becomes more relevant with time. Definitely give this a rewatch and sit with the fact that this could be the near future. How would you react? What would you do?",
  },
  "wall-e": {
    rating: 5,
    body: "This timeless sci-fi movie shows an exaggerated future in a way live action couldn't, and the mute robot romance carries its warning to kids and adults alike. Truly one of the most eye-opening movies, and one that will be talked about for years to come.",
  },
  "royal-tenenbaums": {
    rating: 5,
    body: "Wes absolutely kills it with an amazing story and characters that truly immerse you in this world. The soundtrack is revolutionary too. This one never fails to put a smile on my face.",
  },
  "fight-club": {
    rating: 5,
    body: "The absolute film bro classic. Undefeated as the best of all time. Everything about it is amazing, and that's without even analyzing it. The deeper you get into this movie, the more you realize its genius. It should be a must-watch for everyone; even its surface-level message, that the things you own end up owning you, is something we should all be thinking about.",
  },
  goodfellas: {
    rating: 4.5,
    body: "Just the best-paced gangster movie out there. From top to bottom you feel every emotion with Henry as it happens to him. Scorsese doesn't disappoint; I could watch this any time, any day.",
  },
  amadeus: {
    rating: 4.5,
    body: "Absolutely genius movie. Salieri dedicates his life to his art, and we watch his ego crash and burn when Mozart effortlessly does it better. Mozart, meanwhile, is an eternal child, impulsive and obsessive. The acting and music will send chills down your spine.",
  },
  wargames: {
    rating: 4,
    body: "I will never forget the first time I watched this movie and how it made me fall in love with computers. It's from well before my time, but that didn't stop me from being in awe of everything about it. One of the most important and influential movies in early programming culture.",
  },
};
