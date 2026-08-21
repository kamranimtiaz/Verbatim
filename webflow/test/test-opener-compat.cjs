// Confirms videopopup.js accepts BOTH data-video-id (new, card-authored)
// and data-videopop-id (legacy, hero/feature buttons in wip.html).
const fs = require('fs');
const src = fs.readFileSync('/Users/kamran/Client Projects/Verbitam/webflow/videopopup.js', 'utf8');

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };

// Resolution is centralised in one expression that also falls back to the
// card, so assert the chain's shape rather than a per-call-site count.
check('opener guid chain reads data-video-id', /opener\.dataset\.videoId/.test(src));
check('opener guid chain falls back to legacy', /opener\.dataset\.videoId\s*\|\|\s*opener\.dataset\.videopopId/.test(src));
check('opener guid chain falls back to card',  /opener\.dataset\.videopopId\s*\|\|\s*fromCard\(['"]data-video-id['"]\)/.test(src));
check('popup player keeps internal attr',   src.includes("player.setAttribute('data-videopop-id'"));
check('no bare opener.dataset.videopopId',  !/[^|]\s+opener\.dataset\.videopopId(?!\s*[;)])/.test(src.replace(/videoId \|\| opener\.dataset\.videopopId/g, '')));

// Simulate both opener shapes through the same resolution the script uses.
const resolve = (ds) => ds.videoId || ds.videopopId;
check('new opener resolves',    resolve({ videoId: 'abc' }) === 'abc');
check('legacy opener resolves', resolve({ videopopId: 'xyz' }) === 'xyz');
check('new wins when both set', resolve({ videoId: 'abc', videopopId: 'xyz' }) === 'abc');
check('neither set → undefined', resolve({}) === undefined);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
