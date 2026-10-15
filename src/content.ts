/** Edit this file to change all portfolio content. Nothing here is loaded from a server. */
export type Category = 'Data Science & ML' | 'Software & AI' | 'Hardware' | 'Engineering';
export type Project = {
  id: string;
  name: string;
  category: Category;
  description: string;
  tools: string[];
  link?: string;
  status?: string;
  color: string;
};


/** One chart ("plate") on the left page of a project's book spread. Every number here comes from the project's own README. */
export type Chart=
  |{kind:'bars';title:string;items:{label:string;value:number;text:string}[];max:number;note?:string}
  |{kind:'prob';title:string;groups:{heading:string;items:{label:string;value:number}[]}[];note?:string}
  |{kind:'gauge';title:string;value:number;max:number;text:string;label:string;sub:string}
  |{kind:'stack';title:string;segments:{label:string;value:number}[];chips:{label:string;value:string}[];note?:string}
  |{kind:'steps';title:string;steps:string[];note?:string}
  |{kind:'matrix';title:string;rows:string[];cols:string[];note?:string}
  |{kind:'keys';title:string;knob:string;keys:string[];note?:string}
  |{kind:'shelf';title:string;items:string[];note?:string};
export type Fact={label:string;value:string};
/** What the open book shows for a project. Only facts stated in the project's public README or already in this file; no invented results. */
export type ProjectBook={
  kicker?:string;                       // status line, e.g. "STAT 380 final project"
  tagline:string;
  question?:string;
  data?:string;
  approach?:string[];
  findings?:string[];
  caveat?:string;
  stats?:Fact[];
  chart:Chart;
  labels?:Partial<Record<'question'|'data'|'approach'|'findings'|'caveat',string>>;
  repoNote?:string;                     // shown instead of a GitHub button when there is no single repository
};

const git = 'https://github.com/shephmic77/';
export const profile = {
  name: 'Michael Shepherd',
  title: 'Data Science · Sports Analytics',
  school: 'Penn State University',
  degree: 'B.S. in Data Science',
  graduation: 'Expected May 2027',
  location: 'United States',
  email: 'mrs7065@psu.edu',
  github: 'https://github.com/shephmic77',
  linkedin: 'https://www.linkedin.com/in/michael-shepherd7/',
};

/** 7 data science projects + 2 software/AI + 1 hardware + 1 grouped engineering book. */
export const projects: Project[] = [
  { id:'futwar', name:'FutWAR', category:'Data Science & ML', description:'Developing a soccer value metric inspired by baseball WAR, accounting for positional roles, tactics, and differences across leagues.', tools:['Python','Sports analytics','Statistical modeling'], link:git+'FutWAR', status:'In progress', color:'#eb7d56' },
  { id:'allstar', name:'NBA All-Star Prediction', category:'Data Science & ML', description:'Machine-learning models exploring NBA All-Star selections and potential snubs.', tools:['Python','Machine learning','Basketball'], link:git+'nba-all-star-prediction', color:'#b8c7f9' },
  { id:'moneyball', name:'NBA Moneyball', category:'Data Science & ML', description:'Examines player salary and performance using predictive regression models.', tools:['Python','Regression','Basketball'], link:git+'nba-moneyball', color:'#ffcf7d' },
  { id:'archetypes', name:'NBA Player Archetypes', category:'Data Science & ML', description:'Groups basketball players by statistical playing style to find comparable player types.', tools:['Python','Clustering','Basketball'], link:git+'nba-player-archetypes', color:'#8dd9d1' },
  { id:'purchase', name:'Online Purchase Prediction', category:'Data Science & ML', description:'Predictive modeling and customer segmentation for online shopping behavior.', tools:['R','Classification','Clustering'], link:git+'online-purchase-prediction', color:'#b0a5ff' },
  { id:'letterboxd', name:'Letterboxd Analyzer', category:'Data Science & ML', description:'An exploratory analysis project working with film-watching and rating data.', tools:['Python','Data analysis','Movies'], link:git+'letterboxd-analyzer', color:'#ff9cab' },
  { id:'kaggle', name:'DS 310 Kaggle Project', category:'Data Science & ML', description:'An academic regression and ensemble-modeling competition project.', tools:['Python','Ensemble methods','Regression'], link:git+'DS-310-Project-1', color:'#a8e2a8' },
  { id:'rag', name:'Basketball RAG Assistant', category:'Software & AI', description:'A basketball question-answering application built around retrieval-augmented generation.', tools:['Python','FastAPI','PostgreSQL','Docker'], link:git+'basketball-rag-assistant', color:'#80daef' },
  { id:'gas', name:'Geospatial Agentic Services', category:'Software & AI', description:'Contributions to NOAA flood alerts and travel hazard assessment agents for geospatial workflows.', tools:['Python','Agents','Geospatial data'], link:git+'GIBD-GAS-Contributions', color:'#99f2d5' },
  { id:'macropad', name:'Pluto12 Macropad', category:'Hardware', description:'A configurable custom macropad and keyboard firmware project.', tools:['Firmware','Hardware','Customization'], link:git+'pluto12-macropad', color:'#ffbd86' },
  { id:'engineering', name:'Engineering Portfolio', category:'Engineering', description:'A collection of earlier CAD and mechanical-design work, including a Formula SAE nose cone, bearing, carabiner, Zen Garden table, and 3D-printed mechanisms.', tools:['CAD','SolidWorks','Fusion 360','3D printing'], status:'Collection', color:'#d9c2a4' },
];

export const categories: Array<'All' | Category> = ['All','Data Science & ML','Software & AI','Hardware','Engineering'];

/** Individual works grouped inside the single Engineering Portfolio book. */
export const engineeringWorks = [
  'Project TARMO · RC car chassis',
  'Formula SAE nose cone',
  'Ball bearing CAD model',
  '3D-printed carabiner',
  'Zen Garden table',
  'Functional geared clock',
  'Tolerance-testing mechanism',
  'Multi-material 3D-printing experiments',
];

/** Book pages, keyed by project id. Wording is condensed from each repository's README; numbers are quoted exactly. */
export const books: Record<string, ProjectBook> = {
  futwar: {
    kicker:'Under construction',
    tagline:"A soccer value metric inspired by baseball's WAR.",
    question:'How much does a player contribute compared with a defensible replacement, keeping league strength and tactical fit as separate questions?',
    data:"Men's domestic football in Europe's Big Five leagues, 2017–18 to 2024–25, from sources that differ in coverage and definitions.",
    approach:[
      'Per-90 contribution, scaled to minutes played.',
      'Three replacement baselines (same-position average, a chosen league’s average, a team-accessible option), each in position-locked and flexible views.',
      'A secondary-position rule (at least five appearances and 10% of a player’s appearances) and bounded event-state experiments.',
    ],
    findings:[
      'No final WAR formula, coefficients or replacement pool is approved yet.',
      'Event context can improve outcome prediction in limited samples, but that does not credit actions to players or measure value.',
    ],
    caveat:'Open: team-budget feasibility, league adjustment, cross-position comparability and uncertainty. Raw data is not published, so the repository holds code and documentation only.',
    stats:[{label:'Seasons',value:'2017–2025'},{label:'Leagues',value:'Big Five'},{label:'Views',value:'6'}],
    chart:{kind:'matrix',title:'Three replacement baselines × two position views',rows:['Same-position average, five leagues','A selected league’s average','A team-accessible option'],cols:['Position-locked','Flexible position'],note:'Six views to compare, not six candidate formulas.'},
  },
  allstar: {
    kicker:'Five development versions',
    tagline:'Can basic stats predict the All-Star team, and what do the misses reveal?',
    question:'Can basic player stats predict NBA All-Star picks, and what do the model’s disagreements with real selections say about the stats?',
    data:'About 3,800 player-seasons from 2015–2025: scoring, assists, rebounds, steals, blocks, minutes, shooting percentages and All-Star status. Later runs added True Shooting % and team wins.',
    approach:[
      'Random Forest and logistic-regression classifiers.',
      'Feature engineering, a custom player score and a predicted probability for every player-season.',
      'A close look at where the model and the real selections disagree.',
    ],
    findings:[
      'The README leads with disagreements, not a headline accuracy: Westbrook 2021 scored 98.8% and was not selected; Wiggins 2022 scored 2.4% and was.',
      'The final experiment hit data-merging and missing-value problems that shrank the usable sample.',
    ],
    caveat:'Box scores miss defense and off-ball impact, and selection depends on voting, conference competition and injuries. A probability shows how closely a profile matches past All-Stars, not who deserved it.',
    stats:[{label:'Seasons',value:'2015–2025'},{label:'Rows',value:'≈ 3,800'},{label:'Models',value:'Forest + logistic'}],
    chart:{kind:'prob',title:'Model probability of selection, six player-seasons',groups:[
      {heading:'Model said yes · not selected',items:[{label:'Westbrook 2021',value:98.8},{label:'Sabonis 2024',value:94.0},{label:'Harden 2023',value:85.4}]},
      {heading:'Model said no · selected',items:[{label:'Wiggins 2022',value:2.4},{label:'D. Green 2022',value:3.6},{label:'Conley 2021',value:5.8}]},
    ],note:'Examples listed in the repository README.'},
  },
  moneyball: {
    kicker:'V1 regression to final script',
    tagline:'Can production predict salary, and do the gaps point to bargains?',
    question:'Can player production predict market salary, and do gaps between predicted and actual pay reveal underpriced players?',
    data:'2023–24 per-game and advanced stats, matched to 2023–24 salaries.',
    approach:[
      'Linear regression on 12 stats, from PTS and AST to BPM, VORP, WS/48 and age.',
      'Traded-player duplicates removed and names normalised; tested on a held-out set, then retrained on all matched data.',
      'Gap = predicted minus actual salary, with VORP per $1M as a second lens.',
    ],
    findings:[
      'V1 regression: RMSE about $6.63 million, R² about 0.588.',
      'Model-flagged names include Tyrese Maxey, Desmond Bane and Tyrese Haliburton. They are model outputs, not claims the contracts were mispriced.',
    ],
    caveat:'Pay also reflects rookie-scale and max-contract rules, contract timing, injuries and positional scarcity. Read a gap as “unusual versus similar production”, not true economic value.',
    stats:[{label:'RMSE',value:'≈ $6.63M'},{label:'R²',value:'≈ 0.588'},{label:'Season',value:'2023–24'}],
    chart:{kind:'gauge',title:'How well the V1 salary model fits',value:0.588,max:1,text:'0.588',label:'R²',sub:'RMSE ≈ $6.63 million'},
  },
  archetypes: {
    kicker:'Complete',
    tagline:'Do players fall into statistical archetypes beyond the five positions?',
    question:'Can NBA players be grouped into archetypes with K-Means rather than only by position? It began as “Death of PF”, about the changing power forward role.',
    data:'2023–24 regular-season player stats. Earlier stages used 2024–25 data from nba_api, then a Kaggle 2023–24 set.',
    approach:[
      'Clean records, handle players who changed teams, drop tiny samples.',
      'Ten features covering scoring, shooting, playmaking, rebounding, defense and minutes, standardised before clustering.',
      'K-Means, then read each cluster’s profile and name it.',
    ],
    findings:[
      'The final model uses 10 clusters.',
      'The README’s lesson: the data you have decides which roles a model can recognise.',
    ],
    caveat:'Changing the features changes the clusters, 10 is not the only sensible choice, and the names are the author’s interpretation: exploratory, not definitive.',
    stats:[{label:'Clusters',value:'10'},{label:'Features',value:'10'},{label:'Season',value:'2023–24'}],
    chart:{kind:'steps',title:'From box scores to archetypes',steps:['Clean the player records','Standardise 10 features','K-Means with 10 clusters','Name each cluster'],note:'Each cluster name is an interpretation.'},
  },
  purchase: {
    kicker:'STAT 380 final project',
    tagline:'Can browsing behaviour predict whether a session ends in a purchase?',
    question:'Can browsing behaviour predict whether a session ends in a purchase, and are there distinct behavioural groups when the outcome is ignored?',
    data:'UCI Online Shoppers Purchasing Intention data: 12,330 sessions, 18 analysis variables; about 15.5% ended in a purchase.',
    approach:[
      'Exploration, quality checks and a train / validation / test split.',
      'Logistic regression vs KNN with 10-fold cross-validation; the final model is logistic regression at a 0.12 threshold.',
      'K-means segmentation, with the purchase outcome removed first.',
    ],
    findings:[
      'Test set: accuracy 78.4%, sensitivity 86.8%, specificity 76.9%, precision 40.8%, AUC 0.91.',
      'Four segments: quick-exit sessions, special-day visitors, intensive product browsers and typical sessions.',
    ],
    caveat:'Only about 15.5% of sessions end in a purchase, and precision is 40.8%, so most flagged sessions do not convert.',
    stats:[{label:'Sessions',value:'12,330'},{label:'AUC',value:'0.91'},{label:'Threshold',value:'0.12'}],
    chart:{kind:'bars',title:'Final model on the held-out test set',max:100,items:[
      {label:'Accuracy',value:78.4,text:'78.4%'},{label:'Sensitivity',value:86.8,text:'86.8%'},{label:'Specificity',value:76.9,text:'76.9%'},
      {label:'Balanced accuracy',value:81.8,text:'81.8%'},{label:'Precision',value:40.8,text:'40.8%'},{label:'AUC (0–1 scale)',value:91,text:'0.91'},
    ]},
  },
  letterboxd: {
    kicker:'Streamlit app',
    tagline:'A Letterboxd export turned into a portrait of how you watch films.',
    question:'What does a personal Letterboxd history say about rating behaviour, taste and viewing patterns?',
    data:'A standard Letterboxd ZIP export (ratings, diary and watched files), uploaded through the app.',
    approach:[
      'Clean and combine the files; unrated films count toward viewing volume but not rating maths.',
      'Rating distribution, rolling average, monthly activity, decades, a year-by-month heatmap and day-of-week patterns.',
      'A Ridge regression predicts ratings from month, weekday, release year, movie age and days since the last watch.',
    ],
    findings:[
      'The README names MAE, RMSE and R² but does not report values.',
      'It says the model leans mainly on temporal and release-year information.',
    ],
    caveat:'Exploratory, with limited predictive power: no genre, director, cast or runtime features yet. Public deployment is future work.',
    chart:{kind:'steps',title:'How an export becomes insight',steps:['Upload the Letterboxd ZIP','Clean and combine the files','Explore ratings and habits','Ridge model predicts ratings'],note:'Built with Streamlit.'},
  },
  kaggle: {
    kicker:'DS 310 course competition',
    tagline:'A regression and ensemble-modelling competition.',
    question:'Predict the target values for a Kaggle competition in Penn State’s DS 310.',
    data:'242 training rows, 200 test rows and 64 predictor columns.',
    approach:[
      'Data checks, scaling, and weighted ridge regression with added powers and separate penalties per feature group.',
      'Also tried PCA regression, SVR, splines and shallow trees.',
      'Final model: stacking and fixed prediction blends, some with negative weights.',
    ],
    findings:[
      'Final private MSE 2058.85, ranked 1st (Team 9), as recorded in the README.',
      'Public MSE fell from 3190.60 (plain ridge) to 2930.80 (final blend).',
    ],
    caveat:'Public and private scores use different samples, and public scores were checked many times, so they are not a fresh test. Next time: a separate validation set.',
    stats:[{label:'Private MSE',value:'2058.85'},{label:'Rank',value:'1st · Team 9'},{label:'Train rows',value:'242'}],
    chart:{kind:'bars',title:'Public leaderboard MSE, lower is better',max:3300,items:[
      {label:'Ridge, all 64 columns',value:3190.60,text:'3190.60'},{label:'Weighted ridge + features',value:3051.87,text:'3051.87'},
      {label:'Earlier signed blend',value:2942.52,text:'2942.52'},{label:'Final signed blend',value:2930.80,text:'2930.80'},
    ],note:'Public and private scores come from different samples.'},
  },
  rag: {
    kicker:'Runs locally',
    tagline:'Ask about basketball games and see the evidence behind each answer.',
    question:'An end-to-end retrieval-augmented generation (RAG) app for basketball statistics.',
    data:'Sample game records in data/games.csv: synthetic, with fictional teams and players.',
    approach:[
      'Games are loaded into PostgreSQL, summarised and embedded.',
      'A question is embedded and matched to similar games with pgvector.',
      'Only those records go to a local model, and the chat page shows the evidence.',
    ],
    findings:[
      'Runs with Docker Compose: FastAPI, PostgreSQL with pgvector, and Ollama (nomic-embed-text and llama3.2:3b).',
      'The README gives example questions but no accuracy or latency numbers.',
    ],
    caveat:'Built on synthetic data. The AWS deployment is described as a possible extension, not something that exists.',
    chart:{kind:'steps',title:'One question, five steps',steps:['Load and validate games in PostgreSQL','Summarise each game and store an embedding','Embed the question, retrieve similar games','Send only those records to a local LLM','Show the answer with its evidence']},
  },
  gas: {
    kicker:'GIBD Lab · Summer 2026',
    tagline:'Hazard agents that plug into a multi-agent geospatial system.',
    question:'Build hazard agents that fit the existing Geospatial Agentic Services (GAS) multi-agent system.',
    data:'NOAA / NWS alerts, USGS earthquake data from an existing agent, and GeoJSON or CSV hazard datasets.',
    approach:[
      'A NOAA Flood Alert Agent: deterministic Python parses location, radius and time, keeps flood alerts and turns alert areas into points.',
      'A Travel Hazard Assessment Agent: standardises records, assigns Low to Critical, removes duplicates, outputs point GeoJSON.',
      'Results go to a Web Mapping App Agent for the map.',
    ],
    findings:[
      'Demo: “travel hazards within 300 km of Houston from the last week” returned 12 hazards (9 NOAA/NWS, 3 USGS), all mapped.',
      'Tests: 8 for the NOAA agent and 5 for the Travel Hazard agent.',
    ],
    caveat:'Risk levels are simplified screening, not official guidance. Warning areas become points, and only earthquake and flood/weather hazards are covered.',
    stats:[{label:'Hazards found',value:'12'},{label:'Radius',value:'300 km'},{label:'Tests',value:'8 + 5'}],
    chart:{kind:'stack',title:'Demo run: hazards near Houston by risk level',segments:[{label:'Low',value:3},{label:'Medium',value:6},{label:'High',value:3},{label:'Critical',value:0}],chips:[{label:'NOAA / NWS',value:'9'},{label:'USGS',value:'3'},{label:'Combined',value:'12'}],note:'From the final demonstration in the repository README.'},
  },
  macropad: {
    kicker:'Penn State IEEE Pluto12',
    tagline:'Custom QMK firmware and Windows shortcuts for a 12-slot macropad.',
    labels:{question:'The goal',data:'The hardware'},
    question:'Make the pad useful for music, coding and everyday desktop shortcuts.',
    data:'An 11-key pad with a rotary encoder, built at a Penn State IEEE workshop. The PCB was designed by the IEEE Projects Committee.',
    approach:[
      'A QMK keymap for psuieee/pluto12, with the encoder flipped so turning right raises the volume.',
      'An AutoHotkey v2 script runs the launcher keys (F13–F15), falling back to web versions.',
    ],
    findings:[
      'The keymap compiles for psuieee/pluto12.',
      'Not yet tested on the pad: the final button order and the launcher actions.',
    ],
    caveat:'The original USB device reports a different vendor ID from the QMK board definition, so confirm the PCB is a Pluto12 before flashing.',
    stats:[{label:'Keys',value:'11 + knob'},{label:'Firmware',value:'QMK'},{label:'Script',value:'AutoHotkey v2'}],
    chart:{kind:'keys',title:'Key layout from the README',knob:'Volume',keys:['Play / pause','Next track','Mute','Spotify','Run notebook cell','Alt + Tab','Discord','Copy','Paste','Select all','Krillion']},
  },
  engineering: {
    kicker:'A collection of earlier work',
    tagline:'CAD and mechanical design, gathered into one volume.',
    labels:{question:'About this volume'},
    question:'A collection of earlier CAD and mechanical-design work, including a Formula SAE nose cone, bearing, carabiner, Zen Garden table and 3D-printed mechanisms.',
    stats:[{label:'Works',value:String(engineeringWorks.length)},{label:'Focus',value:'CAD & 3D printing'}],
    repoNote:'This volume groups earlier CAD and fabrication work. There is no single verified public repository to link to.',
    chart:{kind:'shelf',title:'On the shelf',items:engineeringWorks,note:'The eight works are listed on the facing page.'},
  },
};
