const fs = require('fs');
let c = fs.readFileSync('src/components/price-table/CategoryTable.tsx', 'utf8');

// Fix 1: Remove the orphaned stray closing fragment on line 234
// The patch left `)}</td></>\n` dangling after the closing brace of the component
c = c.replace(")\n}\n)}</td></>\n      case 'ac_combiner': return <><td className=\"px-4 py-2.5 text-slate-300\">{r(d.ac_combiner_name)}</td><td className=\"px-4 py-2.5 font-mono text-brand-400 text-xs text-right\">{r(d.ac_combiner_price, '\n      case 'dc_cabling':",
              ")\n}\n      case 'ac_combiner': return <><td className=\"px-4 py-2.5 text-slate-300\">{r(d.ac_combiner_name)}</td><td className=\"px-4 py-2.5 font-mono text-brand-400 text-xs text-right\">{r(d.ac_combiner_price, '$')}</td></>\n      case 'dc_cabling':");

fs.writeFileSync('src/components/price-table/CategoryTable.tsx', c, 'utf8');
console.log('Fixed. Length now:', c.length);
