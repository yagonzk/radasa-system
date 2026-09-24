import fs from 'node:fs';
const bi=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(!bi.includes('liveStagingFacts')) throw new Error('Romaneios atuais não são convertidos para staging');
if(!bi.includes('mergeStagingBiFacts(manualFacts,liveStagingFacts)')) throw new Error('Staging manual e atual não estão consolidadas');
if(!bi.includes('const facts=useMemo<Fact[]>(()=>stagingFacts.map')) throw new Error('Cálculos do BI não partem da staging consolidada');
console.log('OK: BI calcula pela staging consolidada, alimentada também pelos Romaneios atuais.');
