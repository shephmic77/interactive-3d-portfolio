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


/** One chart ("plate") in a project's book. Every number here comes from the project's own README. */
export type Chart=
  |{kind:'bars';title:string;items:{label:string;value:number;text:string}[];max:number;note?:string}
  |{kind:'prob';title:string;groups:{heading:string;items:{label:string;value:number}[]}[];note?:string}
  |{kind:'gauge';title:string;value:number;max:number;text:string;label:string;sub:string}
  |{kind:'stack';title:string;segments:{label:string;value:number}[];chips:{label:string;value:string}[];note?:string}
  |{kind:'steps';title:string;steps:string[];note?:string}
  |{kind:'matrix';title:string;rows:string[];cols:string[];note?:string}
  |{kind:'keys';title:string;knob:string;keys:string[];note?:string}
  |{kind:'shelf';title:string;items:string[];note?:string}
  |{kind:'contrast';title:string;from:{heading:string;items:string[]};to:{heading:string;items:string[]};note?:string}
  |{kind:'cards';title:string;items:{title:string;text:string}[];note?:string}
  |{kind:'chat';title:string;items:string[];note?:string};
export type Fact={label:string;value:string};
export type Step={title:string;text:string};
export type Term={term:string;text:string};
export type FileNote={path:string;text:string};
/**
 * What a project's own book contains. A book is a small volume of up to four spreads:
 *  1 Overview (left: title, numbers, tools · right: story, question, data)
 *  2 Method   (left: the steps · right: details worth knowing)
 *  3 Results  (left: charts · right: findings)
 *  4 Limits   (left: limits and lessons · right: next steps, files, GitHub link)
 * Spreads with nothing to show are left out. Only facts stated in the project's public README or already in this file;
 * no invented results.
 */
export type ProjectBook={
  kicker?:string;                       // status line, e.g. "STAT 380 final project"
  tagline:string;
  overview:string[];                    // one or two short paragraphs
  question?:string;
  data:string[];
  stats?:Fact[];
  tools?:string[];                      // overrides the tool chips from the project list
  method?:Step[];
  details?:Term[];
  chart:Chart;                          // main plate on the Results spread
  extra?:Chart;                         // second plate under it
  findings:string[];
  limits?:string[];
  learned?:string[];
  next?:string[];
  files?:FileNote[];
  credit?:string;
  repoNote?:string;                     // shown instead of a GitHub button when there is no single repository
  titles?:Partial<Record<'overview'|'method'|'results'|'limits',string>>;
  labels?:Partial<Record<'question'|'data'|'method'|'details'|'findings'|'limits'|'learned'|'next'|'files',string>>;
};

const git = 'https://github.com/shephmic77/';
export const profile = {
  name: 'Michael Shepherd',
  title: 'Data Science · Sports Analytics',
  school: 'Penn State University',
  degree: 'B.S. in Applied Data Science',
  graduation: 'Anticipated graduation May 2027',
  location: 'United States',
  email: 'mrs7065@psu.edu',
  github: 'https://github.com/shephmic77',
  linkedin: 'https://www.linkedin.com/in/michael-shepherd7/',
};

/** The in-site resume. Mirrors public/Michael_Shepherd_Resume.pdf (supplied 2026-10-15); wording follows the PDF.  */
export type ResumeJob={org:string;place:string;role:string;dates:string;bullets:string[]};
export type ResumeProject={name:string;tools:string;bullets:string[]};
export const resume={
  pdf:'Michael_Shepherd_Resume.pdf',
  site:'michael-shepherd.vercel.app',
  phone:'281-771-6887',
  linkedin:'linkedin.com/in/michael-shepherd7/',
  school:{name:'The Pennsylvania State University',place:'University Park, PA',degree:'B.S. in Applied Data Science, College of Information Sciences and Technology',grad:'May 2027'},
  skills:[
    {label:'Programming Languages',items:'Python | R | SQL | JavaScript | HTML/CSS'},
    {label:'Libraries and Frameworks',items:'Pandas | NumPy | scikit-learn | Matplotlib | Beautiful Soup | FastAPI | Streamlit'},
    {label:'Programs and Tools',items:'PostgreSQL (pgvector) | Docker | Git | GitHub | Vercel | Jupyter Notebook | Alteryx Designer | Autodesk Fusion | Ollama | ChatGPT | Codex | Claude'},
    {label:'Methods',items:'Machine Learning | RAG | Data Cleaning and Auditing | Web Scraping | Data Visualization | Unit Testing'},
    {label:'Spoken Language',items:'Spanish (Fluent)'},
  ],
  experience:[
    {org:'Geoinformation and Big Data Research Laboratory (GIBD)',place:'University Park, PA',role:'Undergraduate Research Assistant',dates:'May 2026 – Aug 2026',bullets:[
      'Built two Python-based agents, a Travel Hazard Assessment Agent and a NOAA Flood Alert Agent, for the Geospatial Agentic Services (GAS) multi-agent workflow, which fans requests out to hazard-data agents and renders the combined results on an interactive web map.',
      'Flood Alert Agent: takes a location, search radius and time range, filters National Weather Service alerts to flood-related hazards, calculates distance from the requested location, classifies risk level and returns GeoJSON for downstream GAS agents.',
      'Travel Hazard Assessment Agent: standardized fields across GeoJSON and CSV hazard datasets, assigned Low, Medium, High or Critical risk levels, removed duplicate records, rejected unsupported geometry and produced one unified point-based GeoJSON dataset.',
      'Wrote 13 unit tests across both agents and validated the full workflow through the GAS client, covering agent registration, artifact passing and map generation; a Houston demo combined 12 earthquake and flood records within 300 km.',
      'Collaborated with graduate researchers and independently studied technical documentation to implement and refine agent features.']},
    {org:'Made By Design Lab',place:'University Park, PA',role:'Undergraduate Research Assistant',dates:'August 2023 – May 2025',bullets:[
      'Developed a working multi-material 3D printing process (Mosaic hardware, Chroma software) through iterative CAD designs and test prints, and documented it in an instruction manual that gave future lab members a repeatable workflow.']},
    {org:'American Society of Mechanical Engineers (ASME) Design Team',place:'University Park, PA',role:'Team Lead',dates:'January 2023 – May 2025',bullets:[
      'Led the chassis subsystem of a fully 3D-printed RC car, collaborating with 5 subsystem leads and designing the gear differential casing and drivetrain components in Autodesk Fusion for PLA and resin 3D printing.',
      "Trained 8 team members in Autodesk Fusion, providing CAD guidance for the RC car's design and development."]},
  ] as ResumeJob[],
  projects:[
    {name:'Basketball RAG Assistant',tools:'Python, FastAPI, PostgreSQL (pgvector), Ollama, Docker',bullets:[
      'Built a retrieval-augmented generation (RAG) app that answers basketball questions from a sample game dataset: a FastAPI backend loads game records into PostgreSQL, writes a natural-language summary of each game and stores its vector embedding in pgvector.',
      'At query time the question is embedded, pgvector retrieves similar games and only those records go to a local Llama 3.2 model through Ollama, so answers stay grounded; the chat UI shows the retrieved evidence, and the app runs as three Docker Compose services.']},
    {name:'NBA All-Star Prediction and Snub Exploration',tools:'Python, Jupyter Notebook',bullets:[
      'Built random forest and logistic regression models (scikit-learn) to predict All-Star selections across approximately 3,800 NBA player seasons from 2015–2025, reaching about 0.949 accuracy, and iterated through five versions that used Pandas and NumPy to add True Shooting Percentage and team wins as efficiency and team-context features.',
      'Analyzed high-confidence prediction errors to find players whose box score profiles diverged from their selection, such as James Harden in 2023 (85.4% predicted, not selected) and Andrew Wiggins in 2022 (2.4% predicted, selected).']},
    {name:'Penn State DS 310 Kaggle Regression Competition',tools:'Python, Jupyter Notebook',bullets:[
      'Built regression models on 242 training rows and 64 predictors, from ridge baselines through feature engineering, PCA regression, SVR and stacked blends in scikit-learn, and ranked first on the private leaderboard (MSE 2058.85).']},
  ] as ResumeProject[],
  certificates:['IBM Data Analyst Professional Certificate','Alteryx Designer Core Certification'],
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
    kicker:'Under construction · active research',
    tagline:'A soccer value metric inspired by baseball’s WAR.',
    overview:[
      'FutWAR is a research prototype that tries to estimate how much a soccer player contributes compared with a defensible replacement, in the spirit of WAR in baseball.',
      'League strength and tactical fit are deliberately kept as separate questions. The project is open about what is decided and what is not: no final formula, coefficients, replacement pool or expected-points conversion has been approved yet.',
    ],
    question:'How much does a player contribute compared with a defensible replacement, while keeping league strength and tactical fit as separate questions?',
    data:[
      'Men’s domestic football in Europe’s Big Five leagues, 2017–18 to 2024–25.',
      'An initial player-season source has been audited, match and standings references assembled, and metric coverage explored by position.',
      'Sources differ in definitions, coverage and reuse terms, so a data-source register tracks them.',
      'Raw and processed datasets are not published, so the repository holds code and documentation only.',
    ],
    stats:[{label:'Seasons',value:'2017–2025'},{label:'Leagues',value:'Big Five'},{label:'Views',value:'6'},{label:'Status',value:'In progress'}],
    tools:['Python','PostgreSQL / SQL','Docker Compose','Notebooks'],
    method:[
      {title:'Per-90 contribution',text:'Estimate a player’s contribution per 90 minutes first, then across the playing time observed. An expected-points reading is sought only after validation.'},
      {title:'Choose a replacement',text:'Compare against three candidates: a same-position average across the five leagues, a selected league’s average, and a team-accessible option informed by historical resources and budgets.'},
      {title:'Two position views',text:'Each comparison runs position-locked and flexible-position: six views to compare, not six chosen formulas.'},
      {title:'Roles from evidence',text:'Positions and tactics are studied without inferring a played role from broad labels or formation alone.'},
      {title:'Test with event states',text:'Bounded event-state experiments check whether match context improves outcome prediction.'},
    ],
    details:[
      {term:'Secondary position',text:'Counts only with at least five appearances and at least 10% of a player’s appearances in that position.'},
      {term:'Goalkeepers',text:'Included, with role-appropriate measurement and a separate validation path.'},
      {term:'Event-state experiments',text:'They do not assign credit to individual actions or measure player value.'},
      {term:'COVID-era seasons',text:'In scope for inspection. Omitting them or adding context is undecided; they are not to be adjusted or excluded without discussion.'},
    ],
    titles:{results:'Where it stands'},
    chart:{kind:'matrix',title:'Three replacement baselines × two position views',rows:['Same-position average, five leagues','A selected league’s average','A team-accessible option'],cols:['Position-locked','Flexible position'],note:'Six views to compare, not six candidate formulas.'},
    findings:[
      'No final WAR formula, coefficients, replacement pool or expected-league-points conversion has been approved.',
      'Event-state experiments suggest event context can improve outcome prediction in limited samples. That does not establish action-to-player credit or player value.',
      'The data are not complete or fully harmonised across sources.',
      'A provider inquiry about a possible later-season event-data source has been submitted. It does not count as registration or permission.',
    ],
    limits:[
      'Source definitions, coverage and terms vary.',
      'Event-state results come from limited samples.',
      'Earlier proposals in the linked documents remain proposals unless marked as an owner decision.',
      'Access to a possible later-season event-data source is unresolved.',
    ],
    labels:{next:'Open research questions'},
    next:['Team-budget feasibility','League adjustment','Cross-position comparability','Player credit','Uncertainty'],
    files:[
      {path:'docs/',text:'research plan, provenance, decisions and methods'},
      {path:'data/',text:'source manifests, aliases and reviewed metadata'},
      {path:'notebooks/ · scripts/',text:'exploratory notebooks, audits and experiments'},
      {path:'sql/',text:'PostgreSQL schema and analysis queries'},
      {path:'profile/ · reports/ · tests/',text:'player-explorer prototype, reviewed findings, automated checks'},
    ],
  },

  allstar: {
    kicker:'Five development versions · final analysis',
    tagline:'Can basic stats predict the All-Star team, and what do the misses reveal?',
    overview:[
      'A personal project asking whether conventional NBA box-score statistics can predict who becomes an All-Star, flag possible snubs and show where box scores run out.',
      'It was inspired by Michael Lewis’s article on Shane Battier, “The No-Stats All-Star”: defensive positioning, communication, off-ball movement and screening matter, yet barely show up in the numbers.',
    ],
    question:'Can basic NBA player statistics predict who becomes an All-Star, and what do the disagreements between the model and the real selections say about the statistics?',
    data:[
      'Started with the 2023 season, then expanded to player-seasons from 2015 to 2025: about 3,800 observations.',
      'Points, assists, rebounds, steals, blocks, minutes, shooting percentages and All-Star status.',
      'Later experiments added True Shooting Percentage and team wins.',
    ],
    stats:[{label:'Seasons',value:'2015–2025'},{label:'Rows',value:'≈ 3,800'},{label:'Versions',value:'5'},{label:'Models',value:'Forest + logistic'}],
    tools:['Python','Random Forest','Logistic regression','Jupyter'],
    method:[
      {title:'Prototype',text:'Version 1 is a single-season prototype.'},
      {title:'Scale up',text:'Version 2 is a multi-season Random Forest on 2015–2025.'},
      {title:'Make it visible',text:'Versions 3 and 4 add All-Star visuals, then a custom player score and probability visuals.'},
      {title:'Study the probabilities',text:'Later versions focus on the probability given to each player, which separates a near miss from a player the model strongly favoured.'},
      {title:'Add context',text:'Version 5 adds True Shooting Percentage and team wins.'},
    ],
    details:[
      {term:'Probability, not verdict',text:'A probability shows how closely a player-season matches patterns learned from past All-Stars. It does not say who deserved selection.'},
      {term:'The Steve Nash test',text:'Nash’s two MVPs made him a benchmark. Tuning the model toward assists, efficiency and winning to fit him was recognised as steering it toward an expected answer: a benchmark can turn into a target.'},
      {term:'Era effects',text:'Pace, scoring, three-point shooting and roles change what an All-Star profile looks like. Using 2015–2025 helped but did not solve it.'},
    ],
    titles:{results:'The disagreements'},
    chart:{kind:'prob',title:'Model probability of selection, ten player-seasons',groups:[
      {heading:'Not selected',items:[{label:'Westbrook 2021',value:98.8},{label:'Sabonis 2024',value:94.0},{label:'A. Davis 2023',value:90.8},{label:'Harden 2023',value:85.4},{label:'T. Young 2023',value:85.1},{label:'J. Butler 2023',value:48.8}]},
      {heading:'Selected',items:[{label:'Wiggins 2022',value:2.4},{label:'D. Green 2022',value:3.6},{label:'Horford 2018',value:5.5},{label:'Conley 2021',value:5.8}]},
    ],note:'Saved results listed in the repository README.'},
    findings:[
      'High-probability non-All-Stars such as Westbrook, Sabonis, Harden and Young produced large measurable totals, which the model rewards strongly. The selection process includes factors it cannot see.',
      'Low-probability All-Stars such as Green, Horford and Conley offered value that scoring and rebounding totals do not capture. A low probability may reflect a data limitation, not a player limitation.',
      'The README leads with these disagreements rather than a headline accuracy.',
      'The main lesson: the variables available to a model decide what it can recognise, and a disagreement can be more informative than a correct prediction.',
    ],
    limits:[
      'Relies heavily on season-level conventional statistics.',
      'The All-Star label also depends on voting, conference competition, roster construction, injuries, team context, narrative and timing.',
      'The final experiment hit data-merging and missing-value problems that shrank the usable sample, so it stays in the development history instead of being treated as the final reliable model.',
      'Not an objective ranking of who deserved selection.',
    ],
    next:[
      'Add player tracking, shot location, spatial and defensive tracking, lineup and possession data.',
      'Add era-adjusted statistics and more advanced efficiency and impact metrics.',
      'Separate two questions: who will be selected, and who provides All-Star-level value.',
    ],
    files:[
      {path:'final-analysis/',text:'the analysis notebook and cleaned 2015–2025 data'},
      {path:'development/',text:'version 1 to 5 notebooks'},
      {path:'data/',text:'cleaned 2023 and 2015–2025 data, team stats'},
      {path:'portfolio/',text:'project case study (PDF)'},
    ],
  },

  moneyball: {
    kicker:'V1 regression → final reconstruction',
    tagline:'Can production predict salary, and do the gaps point to bargains?',
    overview:[
      'A personal analytics project inspired by the Moneyball idea of finding value the market may underprice. It asks whether a player’s production can be translated into an estimated salary.',
      'The interesting part is the gap: how far a player’s actual salary sits from what similar production predicts.',
    ],
    question:'Can NBA player production be translated into an estimated market salary, and can the gap between predicted and actual salary reveal potential bargains?',
    data:[
      '2023–24 basic statistics and 2023–24 advanced statistics, as two CSV files.',
      '2023–24 salary data, retrieved by the final script.',
      'Twelve model features: PTS, AST, TRB, STL, BLK, MP, TS%, BPM, VORP, WS, WS/48 and Age.',
    ],
    stats:[{label:'RMSE (V1)',value:'≈ $6.63M'},{label:'R² (V1)',value:'≈ 0.588'},{label:'Season',value:'2023–24'},{label:'Features',value:'12'}],
    tools:['Python','Linear regression','pandas','Jupyter'],
    method:[
      {title:'V1: salary regression',text:'Combine basic and advanced stats, merge in salaries, train a multiple linear regression, then rank players by potential under- and over-payment.'},
      {title:'V2: value score',text:'A side experiment built on VORP per $1 million of salary, also testing contract information and physical attributes. Useful as a second way to think about efficiency, but it did not replace the regression.'},
      {title:'Final reconstruction',text:'Combines both paths: traded-player duplicates removed, one profile per player, and names normalised before matching salaries.'},
      {title:'Evaluate',text:'Test on a held-out set, then retrain on the full matched dataset.'},
      {title:'Read the gap',text:'Predicted minus actual salary, with VORP per $1M as a second lens. The script exports four valuation tables.'},
    ],
    details:[
      {term:'RMSE',text:'Root mean squared error: a typical miss, in dollars. V1 is about $6.63 million.'},
      {term:'R²',text:'The share of salary variation the model explains. V1 is about 0.588.'},
      {term:'VORP',text:'Value over replacement player, used here per $1 million of salary.'},
      {term:'The gap',text:'Predicted minus actual salary: how unusual a salary looks next to similar production.'},
    ],
    titles:{results:'The fit'},
    chart:{kind:'gauge',title:'How well the V1 salary model fits',value:0.588,max:1,text:'0.588',label:'R²',sub:'RMSE ≈ $6.63 million'},
    extra:{kind:'contrast',title:'What goes in, what comes out',from:{heading:'Twelve inputs',items:['PTS','AST','TRB','STL','BLK','MP','TS%','BPM','VORP','WS','WS/48','Age']},to:{heading:'Outputs',items:['Predicted salary','Gap vs actual','VORP per $1M']},note:'Final-model features as listed in the README.'},
    findings:[
      'V1 regression: RMSE about $6.63 million and R² about 0.588.',
      'The strongest model-identified bargains in V1 were Tyrese Maxey, Desmond Bane, Tyrese Haliburton, Cam Thomas, Alperen Sengun and Eric Gordon. These are model outputs, not evidence that the contracts were mispriced.',
      'The final reconstruction’s saved outputs sit in the final/ folder; the README does not restate its metrics.',
    ],
    limits:[
      'Salary is not determined by production alone.',
      'Not captured: rookie-scale and maximum-contract rules, contract timing, age and projected development, injury history, positional scarcity, free-agent market conditions, team needs, reputation, negotiation leverage and playoff performance.',
      'Defensive and off-ball impact are not fully captured.',
      'Read a gap as “unusual versus similar production”, not true economic value.',
    ],
    labels:{learned:'What it taught'},
    learned:[
      'Acquiring and merging data, cleaning names and handling traded-player duplicates.',
      'Feature selection and regression evaluation with RMSE and R².',
      'Separating statistical prediction from real-world valuation.',
      'Building a reproducible workflow.',
    ],
    next:[
      'Multi-season salary models, with contract-year and contract-length features.',
      'Age curves, rookie and max-contract indicators, position and role information.',
      'Defensive impact, lineup, shot-location and tracking data.',
      'Nonlinear, regularised and tree-based models, compared with one another.',
    ],
    files:[
      {path:'data/',text:'the two 2023–24 CSV files'},
      {path:'development/',text:'v1 salary regression, v2 value-score experiment'},
      {path:'final/',text:'the final script, saved outputs, requirements'},
      {path:'portfolio/',text:'portfolio material'},
    ],
  },

  archetypes: {
    kicker:'Complete',
    tagline:'Do players fall into statistical archetypes beyond the five positions?',
    overview:[
      'Basketball positions are five labels. This project lets the statistics speak instead: group players by how they actually play and see which roles appear.',
      'It began as “Death of PF”, an idea about the changing role of the power forward, and widened into unsupervised clustering.',
    ],
    question:'Could players’ statistics reveal different types of players on their own, rather than the traditional positions?',
    data:[
      '2023–24 NBA regular-season player statistics (final version).',
      'Development history: 2024–25 data through nba_api was tried first, then a Kaggle 2023–24 dataset.',
      'Ten statistical features covering scoring, shooting, playmaking, rebounding, defense and playing time.',
    ],
    stats:[{label:'Clusters',value:'10'},{label:'Features',value:'10'},{label:'Season',value:'2023–24'},{label:'Status',value:'Complete'}],
    tools:['Python','pandas','NumPy','scikit-learn','Jupyter'],
    method:[
      {title:'Load and clean',text:'Load the 2023–24 player statistics and clean the records.'},
      {title:'Tidy the sample',text:'Handle players who appeared for several teams and remove extremely small samples.'},
      {title:'Select and standardise',text:'Ten features, standardised, because K-Means is distance-based and larger-scale features would otherwise dominate.'},
      {title:'Cluster',text:'K-Means with no target label: similar profiles group together.'},
      {title:'Read and name',text:'Examine each cluster’s centre and members, then give it a basketball name. The names are interpretation.'},
    ],
    details:[
      {term:'Why K-Means',text:'The goal was not to predict positions like Point Guard or Center, but to let similar profiles group and interpret them afterward.'},
      {term:'Why 10 clusters',text:'The final model uses 10. They give useful separation but are not the only possible solution; no selection metric is reported.'},
      {term:'Development vs final',text:'development/ keeps abandoned ideas and experiments. final/ is a cleaned reconstruction made for reproducibility.'},
    ],
    titles:{results:'The result'},
    chart:{kind:'contrast',title:'From five positions to ten clusters',from:{heading:'Traditional positions',items:['PG','SG','SF','PF','C']},to:{heading:'K-Means clusters',items:['1','2','3','4','5','6','7','8','9','10']},note:'Each cluster name is the author’s interpretation.'},
    findings:[
      'The final model uses 10 clusters.',
      'The main lesson: the data you have decides which roles a model can recognise.',
      'Defensive positioning, spacing and basketball IQ are hard to capture with box-score statistics.',
      'Cluster centres and each player’s archetype are saved as CSV files in final/.',
    ],
    limits:[
      'Changing the features can change the clusters.',
      'K-Means needs the number of clusters chosen in advance.',
      'Box-score statistics miss many contributions.',
      'Role profiles change over time (era effects).',
      'The archetype names are the author’s own; not every player fits one label perfectly.',
    ],
    next:[
      'Use multiple seasons and era-specific clustering.',
      'Add tracking, shot-location, defensive-matchup, play-type and lineup data.',
      'Ask the era question: what type of player would this statistical profile be in a different NBA era?',
    ],
    files:[
      {path:'data/',text:'project datasets'},
      {path:'development/',text:'v0 “Death of PF” and v1 clustering tests'},
      {path:'final/',text:'final script, archetype table, standardised cluster centres'},
      {path:'portfolio/',text:'case study and presentation material'},
    ],
  },

  purchase: {
    kicker:'STAT 380 final project',
    tagline:'Can browsing behaviour predict whether a session ends in a purchase?',
    overview:[
      'A Penn State STAT 380 project on online shopping behaviour. It uses supervised classification (will this session end in a purchase?) and unsupervised clustering (what kinds of session exist?).',
      'The two halves are kept apart: the purchase outcome is removed before the clustering, and only looked at once the segments are final.',
    ],
    question:'Can browsing behaviour predict whether a session ends in a purchase, and are there distinct behavioural groups among sessions when the outcome is ignored?',
    data:[
      'UCI Online Shoppers Purchasing Intention dataset, imported by the R Markdown file straight from the UCI Machine Learning Repository.',
      '12,330 sessions and 18 analysis variables. The response, Revenue, records whether a session ended in a purchase.',
      'About 15.5% of sessions ended in a purchase, an imbalance considered during evaluation.',
    ],
    stats:[{label:'Sessions',value:'12,330'},{label:'Test AUC',value:'0.91'},{label:'Threshold',value:'0.12'},{label:'Purchases',value:'≈ 15.5%'}],
    tools:['R','tidyverse','ggplot2','Logistic regression','KNN','K-means'],
    method:[
      {title:'Explore and check',text:'Exploratory analysis, visualisation, data-quality checks and preprocessing.'},
      {title:'Split',text:'Training, validation and test sets, with a fixed random seed of 380.'},
      {title:'Compare models',text:'Logistic regression against K-nearest neighbours, using 10-fold cross-validation.'},
      {title:'Tune the threshold',text:'The final model is logistic regression with a 0.12 probability threshold, which favours catching buyers because purchases are the minority class.'},
      {title:'Segment',text:'K-means clustering with Revenue removed first, ending with four segments.'},
    ],
    details:[
      {term:'Sensitivity',text:'The share of real purchases the model catches: 86.8%.'},
      {term:'Specificity',text:'The share of non-purchase sessions correctly left alone: 76.9%.'},
      {term:'Precision',text:'Of the sessions flagged as purchases, how many really were: 40.8%.'},
      {term:'AUC',text:'How well the model ranks buying sessions above others, from 0.5 (chance) to 1: here 0.91.'},
      {term:'Preprocessing',text:'Categorical variables are factors for logistic regression and one-hot encoded for KNN; numeric predictors for distance-based methods are standardised with training-data values.'},
    ],
    titles:{results:'The final model'},
    chart:{kind:'bars',title:'Final model on the held-out test set',max:100,items:[
      {label:'Accuracy',value:78.4,text:'78.4%'},{label:'Sensitivity',value:86.8,text:'86.8%'},{label:'Specificity',value:76.9,text:'76.9%'},
      {label:'Balanced accuracy',value:81.8,text:'81.8%'},{label:'Precision',value:40.8,text:'40.8%'},{label:'AUC (0–1 scale)',value:91,text:'0.91'},
    ]},
    extra:{kind:'cards',title:'Four shopper segments',items:[
      {title:'Quick-exit sessions',text:'High bounce and exit rates'},
      {title:'Special-day visitors',text:'Unusually high SpecialDay values'},
      {title:'Intensive product browsers',text:'High page counts and browsing durations'},
      {title:'Typical sessions',text:'The largest group, close to the overall average'},
    ]},
    findings:[
      'Browsing behaviour supports purchase prediction: test AUC 0.91.',
      'The 0.12 threshold favours catching buyers over precision. Sensitivity is high, but precision is only 40.8%.',
      'Sessions fall into four behavioural types, one of them the largest and closest to average.',
      'Purchase outcomes were examined only after the clusters were finalised.',
    ],
    limits:[
      'Only about 15.5% of sessions end in a purchase and precision is 40.8%, so most sessions flagged as likely purchases do not convert.',
      'Segment sizes, purchase rates by segment and the validation scores of the two models are not reported in the write-up.',
    ],
    files:[
      {path:'analysis/',text:'the reproducible R Markdown analysis'},
      {path:'assignment/',text:'the original project instructions'},
      {path:'report/',text:'the completed report (PDF)'},
    ],
  },

  letterboxd: {
    kicker:'Streamlit app',
    tagline:'A Letterboxd export turned into a portrait of how you watch films.',
    overview:[
      'A personal data science project built on the author’s own Letterboxd history. Upload a standard Letterboxd ZIP export and the app cleans it, explores ratings and viewing habits, and fits a simple rating model.',
      'One design choice runs through it: watching and rating are separate. An unrated film still counts as watched, but is never read as zero stars.',
    ],
    question:'What does a personal Letterboxd history say about rating behaviour, taste and viewing patterns?',
    data:[
      'A standard Letterboxd ZIP export containing ratings.csv, diary.csv and watched.csv (when available).',
      'Ratings use Letterboxd’s 0.5 to 5 star scale.',
      'Unrated films stay in viewing counts, monthly activity and heatmaps, but are left out of average and median ratings, distributions, rating trends and model training.',
    ],
    tools:['Python','Streamlit','pandas','NumPy','Matplotlib','scikit-learn'],
    method:[
      {title:'Upload and clean',text:'The app cleans and combines the files from the export.'},
      {title:'Summarise',text:'Total films watched, diary entries, average rating and median rating.'},
      {title:'Explore',text:'Rating distribution, rolling average, monthly activity, release decades, a year-by-month heatmap, weekdays and movie age.'},
      {title:'Predict',text:'A Ridge regression is trained on rated films with a train/test split, with a predicted-vs-actual plot, a prediction table and model coefficients.'},
    ],
    details:[
      {term:'Model features',text:'Month watched, day of week, release year, movie age at viewing, and days since the previous film.'},
      {term:'Movie age',text:'Watch year minus release year, grouped into ranges and compared by average rating.'},
      {term:'Metrics',text:'Mean absolute error, root mean squared error and R² on the test split.'},
      {term:'Run it',text:'pip install -r requirements.txt, then python -m streamlit run app.py, and upload the ZIP.'},
    ],
    titles:{results:'The dashboard'},
    chart:{kind:'cards',title:'What the dashboard shows',items:[
      {title:'Viewing summary',text:'Films, diary entries, average and median'},
      {title:'Rating distribution',text:'Each star level, 0.5 to 5'},
      {title:'Rolling average',text:'Adjustable window'},
      {title:'Monthly activity',text:'Films watched per month'},
      {title:'Release decades',text:'Counts and average rating'},
      {title:'Viewing heatmap',text:'Year by month'},
      {title:'Day of week',text:'Rating and volume by weekday'},
      {title:'Movie age',text:'Rating by age at viewing'},
    ],note:'Built with Streamlit.'},
    findings:[
      'The rating model is an exploratory baseline, not a finished predictor or recommender.',
      'It reports MAE, RMSE and R², but the README states no values.',
      'It uses only temporal and release-year information, which on their own have limited ability to explain whether a film will be liked.',
    ],
    limits:[
      'No genre, director, cast, runtime, language, country or production information yet.',
      'Depends on the structure of Letterboxd’s CSV export; a format change could need loader changes.',
      'Public deployment is future work.',
    ],
    labels:{learned:'How it changed'},
    learned:[
      'An early version treated unrated films as zero stars, which distorted averages, distributions, trends and training. A later revision separated unrated viewing from rated analysis.',
      'Other fixes: the rating scale corrected to 0.5–5, the rolling-rating calculation updated and unrated films excluded from training.',
    ],
    next:[
      'Add genre, director and cast; bring in external movie metadata.',
      'Compare several models and engineer features from movie characteristics.',
      'Build a personalised recommendation system.',
      'More interactive controls, a better dashboard and a public deployment.',
    ],
    files:[
      {path:'app.py',text:'the Streamlit app'},
      {path:'data/',text:'two exports, from different development stages'},
      {path:'docs/',text:'development history'},
      {path:'portfolio/',text:'portfolio material'},
    ],
  },

  kaggle: {
    kicker:'Penn State DS 310 · Fall 2026',
    tagline:'A regression and ensemble-modelling competition.',
    overview:[
      'A regression competition on Kaggle for Penn State’s DS 310. The work starts with ridge regression and then compares other models, with smaller changes to the features, training weights and model blends.',
      'The final entry finished 1st (Team 9) on the private leaderboard.',
    ],
    question:'Predict the target values for a Kaggle competition, starting from ridge regression and improving through features, weights and blends.',
    data:[
      '242 training rows, 200 test rows and 64 supplied predictor columns.',
      'Files: training features and targets, test features and a sample submission. The sample submission is never used as target labels.',
    ],
    stats:[{label:'Private MSE',value:'2058.85'},{label:'Private rank',value:'1st'},{label:'Public MSE',value:'2930.80'},{label:'Train rows',value:'242'}],
    tools:['Python','NumPy','pandas','SciPy','scikit-learn','Jupyter'],
    method:[
      {title:'Check and scale',text:'Data checks and feature scaling.'},
      {title:'Start with ridge',text:'Ridge regression on all 64 columns as the baseline.'},
      {title:'Weighted ridge',text:'Add powers of features, separate penalties for feature groups and training weights.'},
      {title:'Try other models',text:'PCA regression, SVR, splines and shallow trees, plus stacking and size-limited prediction adjustments.'},
      {title:'Blend',text:'The final model combines predictions with fixed weights, some of them negative. The notebook holds the full recipe.'},
    ],
    details:[
      {term:'Public vs private',text:'Kaggle scores a public and a private sample. They use different evaluation samples and are not directly comparable.'},
      {term:'Local validation',text:'The five-fold MSE for the final recipe was 3483.96, which differs from the public score.'},
      {term:'Reproducible',text:'The notebook (Python 3.12) rebuilds the submission, checks the 200 row IDs, and matched the scored file within 0.000001.'},
    ],
    titles:{results:'The scores'},
    chart:{kind:'bars',title:'Public leaderboard MSE, lower is better',max:3300,items:[
      {label:'Ridge, all 64 columns',value:3190.60,text:'3190.60'},{label:'Weighted ridge + features',value:3051.87,text:'3051.87'},
      {label:'Reference blend',value:3013.40,text:'3013.40'},{label:'Feature-penalty blend',value:2965.97,text:'2965.97'},
      {label:'Residual-weight blend',value:2959.83,text:'2959.83'},{label:'Earlier signed blend',value:2942.52,text:'2942.52'},
      {label:'Final signed blend',value:2930.80,text:'2930.80'},
    ],note:'Bars start at zero, so the steady gains look small; every step is listed.'},
    extra:{kind:'bars',title:'Same recipe, three different scores',max:3600,items:[
      {label:'Local five-fold',value:3483.96,text:'3483.96'},{label:'Public',value:2930.80,text:'2930.80'},{label:'Private',value:2058.85,text:'2058.85'},
    ],note:'The samples differ, so the gap is not a like-for-like change.'},
    findings:[
      'Public MSE fell from 3190.60 (plain ridge) to 2930.80 (final signed blend).',
      'Final private MSE 2058.85, rank 1 (Team 9), taken from the leaderboard.',
      'A larger model did not always perform better, and weighted ridge was a useful starting point.',
      'Careful feature penalties and training weights helped more than adding models without a clear reason.',
      'Some changes improved local results but did worse on Kaggle.',
    ],
    limits:[
      'Public scores were checked many times during the search, so the public result is not a fresh test of every model choice.',
      'Local (3483.96), public (2930.80) and private (2058.85) MSE differ substantially, and the write-up does not explain the gap.',
    ],
    labels:{next:'If doing it again'},
    next:['Keep a separate validation set.','Check public scores less often.'],
    files:[
      {path:'analysis/',text:'the finished regression notebook'},
      {path:'report/',text:'nine-page course report with a leaderboard screenshot'},
      {path:'submissions/',text:'the final submission file'},
      {path:'data/ · development/ · assignment/',text:'inputs, older work and course requirements'},
    ],
  },

  rag: {
    kicker:'Runs locally with Docker Compose',
    tagline:'Ask about basketball games and see the evidence behind each answer.',
    overview:[
      'An end-to-end retrieval-augmented generation (RAG) app for basketball statistics. Ask a question in plain English and the app finds the relevant game records, hands only those to a local language model, and shows the answer beside the evidence it used.',
      'It is an independent portfolio project built to show API development, vector search, local LLM generation and containerised deployment.',
    ],
    question:'How can a language model answer questions about basketball games using only retrieved records, and show where the answer came from?',
    data:[
      'data/games.csv holds sample game records. The data is synthetic, with fictional teams and players such as Harbor City, Metro Stars, Lake City and Coastal Waves.',
      'Replacement datasets must keep the same column names and be data you have the right to use.',
      'PROVENANCE.md records that the project contains no private assessment data, prompts, branding or copied code.',
    ],
    stats:[{label:'Embedding model',value:'nomic-embed-text'},{label:'Answer model',value:'llama3.2:3b'},{label:'Services',value:'3'},{label:'Data',value:'Synthetic'}],
    tools:['Python','FastAPI','PostgreSQL','pgvector','Ollama','Docker'],
    labels:{method:'One question, five steps',next:'A possible extension'},
    method:[
      {title:'Load',text:'backend/ingest.py validates the game records and loads them into PostgreSQL.'},
      {title:'Embed',text:'backend/index_embeddings.py writes a natural-language summary of each game and stores its vector embedding.'},
      {title:'Retrieve',text:'backend/rag_service.py embeds the question and finds similar games with pgvector.'},
      {title:'Generate',text:'Only those records are sent to the local language model.'},
      {title:'Show',text:'backend/api.py serves the chat endpoint and browser page, which display the answer with its retrieved evidence.'},
    ],
    details:[
      {term:'Stack',text:'Python and FastAPI, PostgreSQL with pgvector, Ollama for local models, Docker Compose, pandas for ingestion.'},
      {term:'Models',text:'nomic-embed-text turns text into vectors; llama3.2:3b writes the answers. Both run locally through Ollama.'},
      {term:'API',text:'GET /health, and POST /api/chat with a JSON body holding a question.'},
      {term:'Run it',text:'Needs Docker Desktop and about 4–6 GB of free disk space. Start the services, pull the models, run ingestion and indexing, then open localhost:8000.'},
    ],
    titles:{results:'What you can ask'},
    chart:{kind:'chat',title:'Example questions from the README',items:[
      'Which team scored the most points in a single game?',
      'What was the closest game in the sample?',
      'Who led Harbor City in scoring?',
      'What happened when Metro Stars played Lake City?',
      'Which games did Coastal Waves win?',
    ],note:'Fictional teams in a synthetic sample.'},
    findings:[
      'Every answer is shown together with the retrieved game records it was based on.',
      'The whole app runs locally as three Docker Compose services: the FastAPI app, PostgreSQL with pgvector and Ollama.',
      'The README gives example questions but reports no accuracy or latency figures.',
    ],
    limits:[
      'The sample data is synthetic and fictional.',
      'A local model needs enough RAM and disk space.',
      'Any data swapped in must be data you have the rights to use.',
    ],
    next:[
      'A proposed AWS deployment, described as future work and not something that exists today.',
      'S3 for raw data, RDS PostgreSQL for structured and vector data.',
      'ECS/Fargate or App Runner for the API, CloudWatch for logs, GitHub Actions for CI/CD.',
    ],
    files:[
      {path:'backend/',text:'ingest, embedding index, RAG service and API'},
      {path:'frontend/',text:'the chat page'},
      {path:'data/ · scripts/',text:'sample games and a model-setup helper'},
      {path:'docker-compose.yml · PROVENANCE.md',text:'the services and the provenance note'},
    ],
  },

  gas: {
    kicker:'GIBD Lab · Summer 2026 internship',
    tagline:'Hazard agents that plug into a multi-agent geospatial system.',
    overview:[
      'Contributions to Geospatial Agentic Services (GAS), an existing multi-agent framework from the Geoinformation and Big Data Research Lab (GIBD), during a Summer 2026 internship. The main work is a Travel Hazard Assessment Agent and a NOAA Flood Alert Agent, plus supporting service files, tests and an end-to-end demo.',
      'The Travel Hazard agent began as a prototype relying mostly on mock data. After learning GAS it was redesigned: specialised agents fetch real hazard data, and it became the shared assessment layer.',
    ],
    question:'Build hazard agents that plug into the existing GAS multi-agent system, so one plain request can return a map of nearby hazards.',
    data:[
      'NOAA / National Weather Service alerts, retrieved through the NWS alerts endpoint with no separate API key.',
      'USGS earthquake data from an existing GAS agent.',
      'GeoJSON artifacts passed between agents, and supported CSV hazard datasets.',
    ],
    stats:[{label:'Hazards found',value:'12'},{label:'Radius',value:'300 km'},{label:'Tests',value:'8 + 5'},{label:'Commits',value:'18'}],
    tools:['Python','GeoJSON','REST APIs','NOAA / NWS','Automated tests'],
    labels:{method:'The workflow',details:'The agents'},
    method:[
      {title:'Ask',text:'A request such as “Show all travel hazards within 300 km of Houston from the last week.”'},
      {title:'Retrieve in parallel',text:'The USGS Earthquake Agent and the NOAA Flood Alert Agent each return GeoJSON.'},
      {title:'Assess',text:'The Travel Hazard Assessment Agent standardises fields, assigns risk levels, removes duplicates, rejects unsupported geometry and outputs one point-based GeoJSON dataset.'},
      {title:'Map',text:'The Web Mapping App Agent turns that GeoJSON into an interactive hazard map.'},
    ],
    details:[
      {term:'NOAA Flood Alert Agent',text:'Deterministic Python. Parses location, radius and time range, retrieves alerts, keeps flood-related hazards, computes distance, classifies risk and turns alert areas into representative points.'},
      {term:'Travel Hazard Assessment Agent',text:'Uses earthquake magnitude and available alert information to classify risk, and keeps useful source information.'},
      {term:'Risk levels',text:'Low, Medium, High and Critical: simplified screening measures, not official emergency or travel guidance.'},
      {term:'Existing parts',text:'The USGS Earthquake Agent and Web Mapping App Agent are existing GAS components that were integrated, not written here.'},
      {term:'AI assistance',text:'GitHub Copilot and ChatGPT helped with implementation and debugging. The author directed changes, tested output and corrected problems.'},
    ],
    titles:{results:'The demo run'},
    chart:{kind:'stack',title:'Demo run: hazards near Houston by risk level',segments:[{label:'Low',value:3},{label:'Medium',value:6},{label:'High',value:3},{label:'Critical',value:0}],chips:[{label:'NOAA / NWS',value:'9'},{label:'USGS',value:'3'},{label:'Combined',value:'12'}],note:'From the final demonstration in the repository README.'},
    findings:[
      'The demo request combined 12 hazards, 9 from NOAA/NWS and 3 USGS earthquakes, and the map showed all 12.',
      'Risk mix: 3 Low, 6 Medium, 3 High and 0 Critical.',
      'Eight tests cover the NOAA agent: location, radius and time parsing, flood filtering, risk classification, geometry centre and distance.',
      'Five tests cover the Travel Hazard agent: earthquake classification, magnitude vs alert level, geometry validation, required inputs and full processing with deduplication.',
      'The whole workflow was also tested through the GAS client: agent registration, artifact generation and passing, and final map generation.',
    ],
    limits:[
      'Risk classifications are screening measures, not official guidance.',
      'NOAA historical retrieval is limited to what the NWS alerts endpoint provides.',
      'NOAA warning areas appear as points in the combined output, not full polygons.',
      'Only earthquake and flood/weather hazards are covered.',
      'Location handling in the NOAA agent is more limited than a dedicated geocoding system.',
    ],
    next:['More specialised hazard-data agents could be integrated later, because agents communicate through GeoJSON artifacts.'],
    files:[
      {path:'NOAA Flood Agent/',text:'the agent, its definition and its service'},
      {path:'Travel Risk Agent/',text:'the agent, its definition and its service'},
      {path:'Tests/',text:'the tests for both agents'},
      {path:'demo_client_workflow.py · docs/',text:'the integrated demo and a detailed work document'},
    ],
  },

  macropad: {
    kicker:'Penn State IEEE · Pluto12',
    tagline:'Custom QMK firmware and Windows shortcuts for a macropad.',
    overview:[
      'An 11-key macropad with a rotary encoder, assembled at a Penn State IEEE workshop and set up for music, coding and everyday desktop shortcuts. The firmware is QMK, and an optional AutoHotkey script handles app launching on Windows.',
      'The README is candid about status: the keymap compiles, but the button order and launcher actions still need checking on the physical pad.',
    ],
    labels:{question:'The goal',data:'The hardware and files',method:'Build and flash',details:'Worth knowing',findings:'Where it stands'},
    question:'Make the pad useful for music, coding and everyday desktop shortcuts.',
    data:[
      'A Pluto12 PCB, designed by the Penn State IEEE Projects Committee.',
      '11 keys plus a rotary encoder that controls volume.',
      'firmware/keymap.c is the QMK keymap; windows/macropad.ahk is the AutoHotkey v2 launcher script.',
    ],
    stats:[{label:'Keys',value:'11 + knob'},{label:'Firmware',value:'QMK'},{label:'Script',value:'AutoHotkey v2'},{label:'Board',value:'psuieee/pluto12'}],
    tools:['QMK','C','AutoHotkey v2','Windows'],
    method:[
      {title:'Set up QMK',text:'Install QMK MSYS and run qmk setup if QMK is not already present.'},
      {title:'Add the keymap',text:'Copy firmware/keymap.c into the psuieee/pluto12 keymaps folder, under an encoder directory.'},
      {title:'Compile',text:'qmk compile -kb psuieee/pluto12 -km encoder, then check the firmware size.'},
      {title:'Flash',text:'Confirm the board and knob position, then qmk flash, pressing the PCB reset button when QMK waits for the bootloader.'},
      {title:'Launch apps',text:'macropad.ahk catches F13 to F15: Spotify, Discord and Krillion open from a Start Menu shortcut, or the web version when none is found.'},
    ],
    details:[
      {term:'Encoder direction',text:'The encoder mapping is inverted relative to QMK’s clockwise value on this assembled pad, so turning right raises the volume.'},
      {term:'Run a notebook cell',text:'Button 5 sends Ctrl+Enter, which runs a VS Code notebook cell only when that cell has focus.'},
      {term:'Launcher keys',text:'Buttons 4, 7 and 11 send F13, F14 and F15 for the Windows script. Media and editing keys are programmed into the pad and work without it.'},
      {term:'Run at sign-in',text:'Put a shortcut to macropad.ahk in the shell:startup folder. The script works only while it is running.'},
    ],
    titles:{results:'Layout and status'},
    chart:{kind:'keys',title:'Key layout from the README',knob:'Volume',keys:['Play / pause','Next track','Mute','Spotify','Run notebook cell','Alt + Tab','Discord','Copy','Paste','Select all','Krillion'],note:'Numbered left to right, top to bottom; the knob takes the first top-row position.'},
    findings:[
      'The keymap compiles for psuieee/pluto12.',
      'The final physical button order and launcher actions still need to be tested on the pad.',
      'A verification checklist covers volume direction, buttons 1–3, 5, 6 and 8–10 in their target apps, and buttons 4, 7 and 11 opening Spotify, Discord and Krillion. No item is ticked yet.',
    ],
    limits:[
      'The original USB device reported VID_4748, while the QMK board definition uses VID_4747. Confirm the board is a Pluto12 before flashing.',
      'Physical button order and launcher behaviour are untested.',
      'The Windows launch features depend on a running script.',
    ],
    next:['If actions land on the wrong buttons, find the physical matrix order and update LAYOUT(...) before finalising the mapping.'],
    credit:'The Pluto12 PCB and workshop materials come from Penn State IEEE. The keymap builds on an example encoder keymap (copyright Will McGloughlin, 2021–22) and is GPL-2.0-or-later.',
    files:[
      {path:'firmware/keymap.c',text:'the QMK keymap'},
      {path:'windows/macropad.ahk',text:'the AutoHotkey v2 launcher'},
    ],
  },

  engineering: {
    kicker:'A collection of earlier work',
    tagline:'CAD and mechanical design, gathered into one volume.',
    overview:[
      'A collection of earlier CAD and mechanical-design work, including a Formula SAE nose cone, bearing, carabiner, Zen Garden table and 3D-printed mechanisms.',
    ],
    labels:{data:'Related experience'},
    data:[
      'ASME Design Team, January 2023 – May 2025: Team Lead for Chassis.',
      'Made By Design Lab, August 2023 – May 2025: multi-material 3D printing with Mosaic Palette and Chroma, including workflows, testing and a manual.',
    ],
    stats:[{label:'Works',value:String(engineeringWorks.length)},{label:'Focus',value:'CAD & 3D printing'}],
    tools:['CAD','SolidWorks','Fusion 360','3D printing'],
    titles:{results:'The works'},
    chart:{kind:'shelf',title:'On the shelf',items:engineeringWorks,note:'Eight works, listed on the facing page.'},
    findings:[],
    repoNote:'This volume groups earlier CAD and fabrication work. There is no single verified public repository to link to.',
  },
};
