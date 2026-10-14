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
  { id:'purchase', name:'Online Purchase Prediction', category:'Data Science & ML', description:'Predictive modeling and customer segmentation for online shopping behavior.', tools:['Python','Classification','Clustering'], link:git+'online-purchase-prediction', color:'#b0a5ff' },
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
