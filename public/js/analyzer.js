/*
 * Scenario analyzer: scans free-text scenario for signals on each of the
 * seven situational factors. Pure heuristics, runs entirely client-side.
 *
 * Returns, per factor it can read: { answer: 'H'|'L', confidence: 1..3, evidence: [phrase] }
 * Factors with no signal are omitted — the triage asks those directly.
 * Also returns a model hint (time vs dev) when the text signals urgency
 * or a development goal.
 */

const RULES = {
  sig: {
    H: [
      /\bcritical\b/, /\bmission[- ]critical\b/, /high[- ]stakes?/, /\bstrategic\b/,
      /\bmajor\b/, /can'?t afford (to fail|a mistake)/, /\birreversible\b/, /\bbet[- ]the[- ]company\b/,
      /\bsignificant (impact|consequences|investment)\b/, /\b(large|big|huge) (budget|investment|impact)\b/,
      /\blayoffs?\b/, /\brestructur/, /\bmerger\b/, /\bacquisition\b/, /\bcompliance\b/, /\bregulat/,
      /\bsafety\b/, /\bsecurity incident\b/, /entire (company|org|team|product)/, /long[- ]term/,
    ],
    L: [
      /\bminor\b/, /\btrivial\b/, /low[- ]stakes?/, /\bsmall (decision|matter|change)\b/,
      /\breversible\b/, /easily (undone|changed|reversed)/, /\bcosmetic\b/, /\bhousekeeping\b/,
      /doesn'?t (really )?matter (much|that much)/, /\bday[- ]to[- ]day\b/, /\broutine\b/,
    ],
  },
  com: {
    H: [
      /\bbuy[- ]?in\b/, /\bcommitment\b/, /\bmorale\b/, /\badoption\b/, /\bchange management\b/,
      /they (have to|need to|must|will) (implement|execute|carry|live with|adopt)/,
      /\bresist(ance|ant|s|ing)?\b/, /\bpushback\b/, /won'?t (accept|support|follow)/,
      /(team|everyone|people|staff) (must|needs? to|has to) (support|be on board|embrace)/,
      /affects? (their|everyone'?s|the team'?s) (daily|day[- ]to[- ]day|work)/,
    ],
    L: [
      /\bcompliance is enough\b/, /just (need to|have to) comply/, /\bmechanical\b/,
      /doesn'?t (affect|impact) (them|the team)/, /i('| a)m the only one (affected|who)/,
      /(execution|implementation) is (simple|straightforward|trivial|automated)/,
    ],
  },
  lex: {
    H: [
      /\bi('| ha)ve (done|seen|solved|handled) this (before|many times)\b/, /\bmy (area of )?expertise\b/,
      /i know (this|the) (domain|area|problem|space) (well|inside)/, /\bi('| a)m (an? )?(expert|specialist|deeply familiar)\b/,
      /\byears of experience (with|in)\b/, /i (already )?know (what|the answer|what to do)/,
    ],
    L: [
      /\bi('| a)m (not|no) (an? )?expert\b/, /\bi (don'?t|do not) (fully )?(know|understand)\b/,
      /\bnew to me\b/, /\bi('| a)m new to\b/, /\bunfamiliar\b/, /\bfirst time\b/, /\bout of my (depth|wheelhouse|league)\b/,
      /they (know|understand) (this |it )?(far |much |way )?(better|more) than (i|me)/,
      /\bi lack (the )?(knowledge|expertise|information|context)\b/, /\bi('| a)m missing (information|context|knowledge)\b/,
      /\bi('| a)m not sure (what|how|which)\b/, /\bnot my (area|specialty|field)\b/,
    ],
  },
  lik: {
    H: [
      /they (trust|respect|follow) (me|my)/, /\bhigh trust\b/, /they('| wi)ll (support|back|accept) (whatever|my)/,
      /(team|they) (usually|always|generally) (goes?|go) along with/, /\bbenefit of the doubt\b/,
    ],
    L: [
      /(won'?t|wouldn'?t|might not|may not) (accept|support|commit|buy in|follow)/,
      /\bskeptical\b/, /\bdistrust\b/, /low trust/, /\bcynical\b/, /if i (just )?decide[ds]? (alone|myself|unilaterally)/,
      /\bresent(ment|ed|s)?\b/, /\bmutiny\b/, /\bquit\b/, /\battrition\b/, /\bturnover\b/,
      /\bcontroversial\b/, /\bunpopular\b/, /strong (opinions|feelings|views)/, /\bdivided\b/, /\bpolarizi/,
    ],
  },
  gal: {
    H: [
      /\bshared goals?\b/, /\bsame (goals?|mission|objectives?|page)\b/, /\baligned\b/, /\balignment\b/,
      /everyone wants? (the|what'?s) best/, /\bcommon (goal|purpose|objective)\b/, /pull(ing)? in the same direction/,
    ],
    L: [
      /\bcompeting (interests?|priorities|agendas?)\b/, /\bown agendas?\b/, /\bpolitic/, /\bturf (wars?|battles?)\b/,
      /\bself[- ]interest/, /\bsilos?\b/, /\bmisaligned\b/, /\bnot aligned\b/, /(protect|defend)(ing)? their (own|turf|territory|headcount)/,
      /\bconflict(ing)? (goals?|interests?|priorities)\b/, /each (department|team|person) wants/,
    ],
  },
  gex: {
    H: [
      /\b(team|they|group) (is|are) (the )?(experts?|specialists?|highly (skilled|experienced)|deeply familiar)\b/,
      /(team|they) (know|understand)s? (this|the) (domain|problem|area|space|work)/,
      /closer to the (problem|work|customer|code)/, /\bhands[- ]on (knowledge|experience)\b/,
      /they (know|understand) (this |it )?(far |much |way )?(better|more) than (i|me)/, /\bsubject[- ]matter experts?\b/, /\bsmes?\b/,
    ],
    L: [
      /(team|they|group) (is|are) (junior|new|inexperienced|green)/, /(team|they) (lack|don'?t have) (the )?(expertise|experience|knowledge|skills)/,
      /\bnever (done|dealt with|seen) (this|anything like)/, /(team|they) (is|are) (unfamiliar|out of their depth)/,
      /\bjunior (team|engineers?|staff|members?)\b/, /\bnew hires?\b/, /\bno (one|body) (on the team )?(knows|has done)/,
    ],
  },
  tco: {
    H: [
      /\bwork(s)? well together\b/, /\bcohesive\b/, /\bhigh[- ]performing\b/, /\bgel(led|s)?\b/,
      /\bcollaborat(e|es|ive) (well|effectively|smoothly)\b/, /\bmature team\b/, /\btight[- ]knit\b/,
      /(good|great|strong) (team )?(dynamics?|chemistry)/, /\bself[- ]organiz/, /\bproductive (meetings?|discussions?)\b/,
    ],
    L: [
      /\bdysfunctional\b/, /\bnewly formed\b/, /\bbrand[- ]new team\b/, /just (formed|came together|merged|reorged)/,
      /don'?t (work|play) well together/, /\bin[- ]?fighting\b/, /\bfriction\b/, /\bclash(es|ing)?\b/,
      /(meetings?|discussions?) (go|going|end) nowhere/, /can'?t (agree|decide|reach)/, /\bblame\b/, /\btoxic\b/,
      /never worked together/, /\bfractured\b/, /\bdistrust each other\b/, /(strangers|new) to each other/,
    ],
  },
};

const MODEL_HINTS = {
  time: [
    /\burgent(ly)?\b/, /\basap\b/, /\bdeadline\b/, /\btime[- ](pressure|sensitive|critical)\b/, /\bimmediately\b/,
    /\bby (tomorrow|monday|tuesday|wednesday|thursday|friday|next week|end of (day|week|month))\b/,
    /\bno time\b/, /\bquick(ly)?\b/, /\bright away\b/, /\bcrisis\b/, /\bemergency\b/, /\bfire\b/,
    /\bshort (runway|timeline|notice)\b/, /\bthis week\b/, /\btoday\b/, /\bwithin (hours|days|\d+ (hours|days))\b/,
  ],
  dev: [
    /\bdevelop (the|my) team\b/, /\bgrow(th|ing)? (the|my|their)? ?(team|people|skills)\b/, /\bmentor/, /\bcoach/,
    /\blearning opportunity\b/, /\bbuild (capability|capacity|skills|ownership)\b/, /\bdevelopment\b/,
    /\bstretch (assignment|opportunity)\b/, /\bsuccession\b/, /\bempower/, /\bupskill/, /\bno (real )?(rush|deadline|time pressure)\b/,
    /\btake (our|their|the) time\b/, /\blong[- ]term (growth|investment in)/,
  ],
};

/* Collect matches for one rule set; returns { count, evidence[] } */
function scan(text, patterns) {
  const evidence = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) evidence.push(m[0].trim());
  }
  return evidence;
}

export function analyzeScenario(raw) {
  const text = (raw || '').toLowerCase();
  const factors = {};
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  if (words >= 8) {
    for (const [id, rules] of Object.entries(RULES)) {
      const hi = scan(text, rules.H);
      const lo = scan(text, rules.L);
      if (hi.length === lo.length) continue; // no signal or contradictory
      const answer = hi.length > lo.length ? 'H' : 'L';
      const evidence = (answer === 'H' ? hi : lo).slice(0, 3);
      const margin = Math.abs(hi.length - lo.length);
      const contested = Math.min(hi.length, lo.length) > 0;
      const confidence = contested ? 1 : Math.min(3, margin + (evidence.length > 1 ? 1 : 0));
      factors[id] = { answer, confidence, evidence };
    }
  }

  const timeHits = scan(text, MODEL_HINTS.time);
  const devHits = scan(text, MODEL_HINTS.dev);
  let modelHint = null;
  if (timeHits.length !== devHits.length) {
    modelHint = {
      model: timeHits.length > devHits.length ? 'time' : 'dev',
      evidence: (timeHits.length > devHits.length ? timeHits : devHits).slice(0, 3),
    };
  }

  return { factors, modelHint, words };
}

export const CONFIDENCE_LABEL = { 1: 'weak signal', 2: 'moderate signal', 3: 'strong signal' };
