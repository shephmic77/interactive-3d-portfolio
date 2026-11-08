// Plain-language summaries and workflows drawn from the project write-ups.
export const projectBriefs: Record<string, { summary: string; flow: string[] }> = {
  shotmake: {
    summary: 'Estimate how likely an NBA shot was to go in, then compare what players scored with what their shots were expected to produce.',
    flow: ['Collect shot logs', 'Describe each shot', 'Train on earlier seasons', 'Test on a later season'],
  },
  lineup: {
    summary: 'Compare how NBA player combinations score, defend, and rebound when they share the court.',
    flow: ['Read play-by-play', 'Rebuild on-court lineups', 'Group possessions', 'Compare player combinations'],
  },
  futwar: {
    summary: 'FutWAR asks how much a footballer adds compared with a realistic replacement. The current prototype lets you explore several definitions of replacement while the research tests which comparisons hold up.',
    flow: ['Audit player and match data', 'Compare replacement baselines', 'Test what changes across roles'],
  },
  allstar: {
    summary: 'The model predicts All-Star selections from player stats. The most interesting cases are its confident misses, where the box score and the actual selection tell different stories.',
    flow: ['Build player-season profiles', 'Estimate selection probability', 'Inspect confident misses'],
  },
  moneyball: {
    summary: 'The project estimates NBA salaries from on-court production, then looks at who earns more or less than the model expects. Those gaps flag players worth investigating and can reflect factors outside the data.',
    flow: ['Match salary and player stats', 'Estimate salary from production', 'Review the largest gaps'],
  },
  archetypes: {
    summary: 'Instead of starting with the five official positions, this analysis groups players with similar statistical profiles. The groups offer another way to describe what players do on the court.',
    flow: ['Compare player profiles', 'Group similar players', 'Interpret the groups as roles'],
  },
  purchase: {
    summary: 'This project uses browsing-session data to estimate who is likely to buy. A separate clustering analysis groups similar sessions to help explain different shopping patterns.',
    flow: ['Prepare browsing-session data', 'Predict purchase intent', 'Group similar sessions'],
  },
  letterboxd: {
    summary: 'Import a Letterboxd export and explore how your viewing habits and ratings change over time. The Streamlit interface turns the exported records into a personal film dashboard.',
    flow: ['Import a Letterboxd export', 'Organize film and rating records', 'Explore viewing patterns'],
  },
  kaggle: {
    summary: 'With only 242 training rows, this competition rewarded models that could generalize from a small sample. The final blend placed first on the private leaderboard, where a lower error score was better.',
    flow: ['Build a regression baseline', 'Test features and competing models', 'Blend the strongest candidates'],
  },
  ds310project2: {
    summary: 'The model ranks stocks by the likelihood that they meet the competition’s buy label. The final blend combined two prediction approaches and placed third on the private leaderboard.',
    flow: ['Prepare financial predictors', 'Train and compare classifiers', 'Blend prediction ranks'],
  },
  nbawins: {
    summary: 'This group project tests how team age, three-point attempt rate, and pace relate to NBA regular-season wins. The analysis describes associations in the data.',
    flow: ['Assemble team-season data', 'Compare age, shooting, and pace', 'Interpret relationships with wins'],
  },
  singapore: {
    summary: 'This research compares Singapore with ten other economies to examine how policy, economic performance, and living standards move together. The work is exploratory and asks which comparisons might transfer to other countries.',
    flow: ['Collect comparable indicators', 'Compare economies over time', 'Test associations and limits'],
  },
  rag: {
    summary: 'Ask a basketball question and the app finds relevant game records before generating an answer. The interface shows the evidence so you can see what the answer draws on.',
    flow: ['Index summaries of game records', 'Retrieve games that match the question', 'Generate an answer with evidence'],
  },
  gas: {
    summary: 'Two agents turn raw hazard records into map-ready data. One finds nearby flood alerts, while the other standardizes hazard records so downstream tools can use them together.',
    flow: ['Collect alerts and hazard records', 'Filter, score, and standardize', 'Return GeoJSON for the map'],
  },
  spotify: {
    summary: 'The curator organizes music already in your Spotify library. It explains why tracks fit proposed playlists and gives you a chance to review the changes before sending them to Spotify.',
    flow: ['Read existing tracks', 'Score tracks against playlist rules', 'Review and approve changes'],
  },
  skillissue: {
    summary: 'Two players use separate phones to control one character. One handles movement and the other aims and shoots, so winning depends on how well the pair coordinates.',
    flow: ['Pair both phones with the game', 'Split movement and aiming', 'Coordinate in a two-on-two match'],
  },
  macropad: {
    summary: 'Custom firmware turns a 12-control macropad into a desktop shortcut station. The buttons launch apps and control media, and the knob adjusts volume.',
    flow: ['Map the physical controls', 'Build and flash QMK firmware', 'Use the shortcuts on Windows'],
  },
  engineering: {
    summary: 'Eight projects show how I used CAD and 3D printing to design parts and test how they fit or move. The collection ranges from an RC car chassis to a geared clock and fabrication experiments.',
    flow: ['Design the part in CAD', 'Prototype and check fit', 'Refine for fabrication'],
  },
};
